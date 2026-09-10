import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  Layers,
  Maximize2,
  ScanText,
  History,
  ImagePlus,
  Wand2,
  Download,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Copy,
  Check,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Eye,
  Sliders,
  Trash2,
  HelpCircle,
  FileCheck
} from 'lucide-react';
import type {
  BannerAspectRatio,
  BannerQuality,
  BannerMode,
  BatchSet,
  BatchResult,
  ResizeResult,
  BannerAdAsset
} from '../types';
import {
  generateSingleBanner,
  generateBatchBanners,
  resizeBanner,
  scanBannerText,
  localizeBanner,
  loadBannerHistory,
  saveBannerToAssets,
  downloadBannerImage
} from '../services/bannerAdsService';
import { ButtonContent } from './ButtonContent';
import { compressImageFile, estimateDataUrlBytes, formatBytes } from '../utils/imageCompression';

/**
 * NGÂN SÁCH ẢNH CHO MỖI REQUEST BANNER ADS.
 * Server chấp nhận body tối đa 50MB (xem express.json cho '/api/banner-ads' trong
 * server/index.mjs). Ở client chặn ở 45MB để chừa chỗ cho phần JSON còn lại
 * (prompt, thông điệp, metadata) và phần escape của chuỗi base64.
 */
const MAX_REQUEST_IMAGE_BYTES = 45 * 1024 * 1024;

/** Trần dung lượng cho từng ảnh sau khi nén: 10 ảnh (5 bộ x 2) vẫn nằm dưới ngân sách trên. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Cạnh dài nhất giữ lại khi nén — đủ chi tiết cho ảnh tham chiếu của model tạo ảnh. */
const MAX_IMAGE_DIMENSION = 2048;

const ASPECT_RATIOS: Array<{
  id: BannerAspectRatio;
  label: string;
  tag: string;
  ratio: string;
}> = [
  { id: '16:9', label: '16:9 Landscape', tag: 'Web & Ads', ratio: 'w-16 h-9' },
  { id: '9:16', label: '9:16 Portrait', tag: 'Story & Reels', ratio: 'w-9 h-16' },
  { id: '1:1', label: '1:1 Square', tag: 'Feed & Insta', ratio: 'w-12 h-12' },
  { id: '4:5', label: '4:5 Portrait', tag: 'FB Feed', ratio: 'w-10 h-12' },
  { id: '3:2', label: '3:2 Landscape', tag: 'Display Ad', ratio: 'w-15 h-10' },
  { id: '2:3', label: '2:3 Portrait', tag: 'Mobile Card', ratio: 'w-10 h-15' },
  { id: '3:4', label: '3:4 Portrait', tag: 'Pinterest', ratio: 'w-12 h-16' },
  { id: '21:9', label: '21:9 UltraWide', tag: 'Cover Banner', ratio: 'w-20 h-9' }
];

// Kích thước thật do Leonardo quyết định (xem LEONARDO_RESOLUTIONS trong
// server/bannerAdsRoute.mjs). Cạnh dài tối đa API hỗ trợ là 3808px.
const QUALITY_TIERS: Array<{ id: BannerQuality; label: string; desc: string }> = [
  { id: '1k', label: '1K Standard', desc: 'cạnh dài 1024 - 1584px (Nhanh)' },
  { id: '2k', label: '2K High Def', desc: 'cạnh dài 2048 - 3200px (Cân bằng)' },
  { id: '4k', label: 'Ultra HD', desc: 'cạnh dài 3264 - 3808px (Sắc nét nhất)' }
];

export function BannerAds() {
  const [activeMode, setActiveMode] = useState<BannerMode>('single');

  // ── Single Mode State ─────────────────────────────────────────────────────
  const [singleCompetitor, setSingleCompetitor] = useState<{ id: string; dataUrl: string } | null>(null);
  const [singleCharacter, setSingleCharacter] = useState<{ id: string; dataUrl: string } | null>(null);
  const [singleKeyMessage, setSingleKeyMessage] = useState('');
  const [singleRatio, setSingleRatio] = useState<BannerAspectRatio>('16:9');
  const [singleQuality, setSingleQuality] = useState<BannerQuality>('1k');
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleResult, setSingleResult] = useState<{ imageUrl: string; promptUsed: string } | null>(null);
  const [singleError, setSingleError] = useState<string | null>(null);
  const [singleSaved, setSingleSaved] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // ── Batch Mode State ──────────────────────────────────────────────────────
  const [batchSets, setBatchSets] = useState<BatchSet[]>([
    { competitor: null, character: null, keyMessage: '' },
    { competitor: null, character: null, keyMessage: '' },
    { competitor: null, character: null, keyMessage: '' }
  ]);
  const [activeBatchIndex, setActiveBatchIndex] = useState(0);
  const [batchRatio, setBatchRatio] = useState<BannerAspectRatio>('16:9');
  const [batchQuality, setBatchQuality] = useState<BannerQuality>('1k');
  const [batchSeed, setBatchSeed] = useState<string>('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [batchError, setBatchError] = useState<string | null>(null);

  // ── Resize Mode State ─────────────────────────────────────────────────────
  const [resizeImage, setResizeImage] = useState<{ id: string; dataUrl: string } | null>(null);
  const [resizeSelectedSizes, setResizeSelectedSizes] = useState<BannerAspectRatio[]>(['16:9', '9:16', '1:1', '4:5']);
  const [resizeQuality, setResizeQuality] = useState<BannerQuality>('1k');
  const [resizeSeed, setResizeSeed] = useState<string>('');
  const [resizeLoading, setResizeLoading] = useState(false);
  const [resizeResults, setResizeResults] = useState<ResizeResult[]>([]);
  const [resizeError, setResizeError] = useState<string | null>(null);

  // ── Localize Mode State ───────────────────────────────────────────────────
  const [localizeImage, setLocalizeImage] = useState<{ id: string; dataUrl: string } | null>(null);
  const [localizeDetectedText, setLocalizeDetectedText] = useState('');
  const [localizeTargetText, setLocalizeTargetText] = useState('');
  const [localizeLanguage, setLocalizeLanguage] = useState('Vietnamese');
  const [localizeScanning, setLocalizeScanning] = useState(false);
  const [localizeLoading, setLocalizeLoading] = useState(false);
  const [localizeResult, setLocalizeResult] = useState<{ imageUrl: string; promptUsed?: string } | null>(null);
  const [localizeError, setLocalizeError] = useState<string | null>(null);

  // ── History Mode State ────────────────────────────────────────────────────
  const [historyItems, setHistoryItems] = useState<BannerAdAsset[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyRatioFilter, setHistoryRatioFilter] = useState('all');
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  // ── Upload State (dùng chung cho mọi chế độ) ──────────────────────────────
  const [uploadingCount, setUploadingCount] = useState(0);
  const isUploading = uploadingCount > 0;

  // Load history when entering History tab
  useEffect(() => {
    if (activeMode === 'history') {
      void fetchHistory();
    }
  }, [activeMode]);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const items = await loadBannerHistory();
      setHistoryItems(items);
    } catch (err: any) {
      console.warn('Lỗi tải lịch sử banner:', err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ── File Upload Helper ────────────────────────────────────────────────────
  // Ảnh được thu nhỏ & nén ngay tại trình duyệt trước khi encode base64;
  // gửi thẳng ảnh gốc từ máy ảnh/điện thoại sẽ vượt giới hạn body của API (lỗi 413).
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    onLoad: (data: { id: string; dataUrl: string }) => void,
    onError?: (message: string | null) => void
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    e.target.value = '';

    setUploadingCount((count) => count + 1);
    try {
      const dataUrl = await compressImageFile(file, {
        maxDimension: MAX_IMAGE_DIMENSION,
        maxBytes: MAX_IMAGE_BYTES
      });
      onLoad({ id: Math.random().toString(36).slice(2), dataUrl });
      onError?.(null);
    } catch (err: any) {
      onError?.(err?.message || 'Không thể xử lý ảnh tải lên. Vui lòng thử ảnh khác.');
    } finally {
      setUploadingCount((count) => Math.max(0, count - 1));
    }
  };

  /** Chặn sớm các request vượt giới hạn thay vì để server trả về 413. */
  const checkImagePayloadSize = (dataUrls: Array<string | null | undefined>): string | null => {
    const total = dataUrls.reduce(
      (sum, dataUrl) => sum + (dataUrl ? estimateDataUrlBytes(dataUrl) : 0),
      0
    );
    if (total > MAX_REQUEST_IMAGE_BYTES) {
      return `Tổng dung lượng ảnh (${formatBytes(total)}) vượt giới hạn ${formatBytes(
        MAX_REQUEST_IMAGE_BYTES
      )}. Vui lòng bớt ảnh hoặc dùng ảnh nhẹ hơn.`;
    }
    return null;
  };

  // ── Single Mode Handlers ──────────────────────────────────────────────────
  const handleSingleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleCompetitor && !singleCharacter && !singleKeyMessage.trim()) {
      setSingleError('Vui lòng tải lên ít nhất 1 ảnh tham chiếu hoặc nhập thông điệp banner.');
      return;
    }

    const payloadError = checkImagePayloadSize([
      singleCompetitor?.dataUrl,
      singleCharacter?.dataUrl
    ]);
    if (payloadError) {
      setSingleError(payloadError);
      return;
    }

    setSingleLoading(true);
    setSingleError(null);
    setSingleSaved(false);

    try {
      const response = await generateSingleBanner({
        competitorRef: singleCompetitor?.dataUrl || null,
        character: singleCharacter?.dataUrl || null,
        keyMessage: singleKeyMessage.trim(),
        language: 'Vietnamese',
        size: singleRatio,
        quality: singleQuality
      });
      setSingleResult(response);
    } catch (err: any) {
      setSingleError(err.message || 'Không thể tạo banner lúc này. Vui lòng thử lại.');
    } finally {
      setSingleLoading(false);
    }
  };

  const handleSaveSingleBanner = async () => {
    if (!singleResult?.imageUrl || singleSaved) return;
    try {
      await saveBannerToAssets({
        imageUrl: singleResult.imageUrl,
        prompt: singleResult.promptUsed,
        keyMessage: singleKeyMessage,
        size: singleRatio,
        quality: singleQuality,
        mode: 'single'
      });
      setSingleSaved(true);
    } catch (err: any) {
      alert(err.message || 'Không thể lưu vào thư viện.');
    }
  };

  const handleCopyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  // ── Batch Mode Handlers ───────────────────────────────────────────────────
  const handleBatchGenerate = async () => {
    const validSets = batchSets.filter(
      (s) => s.competitor || s.character || s.keyMessage.trim()
    );
    if (validSets.length === 0) {
      setBatchError('Vui lòng điền thông tin cho ít nhất 1 bộ banner.');
      return;
    }

    const payloadError = checkImagePayloadSize(
      batchSets.flatMap((s) => [s.competitor?.dataUrl, s.character?.dataUrl])
    );
    if (payloadError) {
      setBatchError(payloadError);
      return;
    }

    setBatchLoading(true);
    setBatchError(null);
    setBatchResults([]);

    try {
      const seedNum = batchSeed.trim() ? Number(batchSeed.trim()) : undefined;
      const res = await generateBatchBanners({
        batchSets: batchSets.map((s) => ({
          competitorRef: s.competitor?.dataUrl || null,
          character: s.character?.dataUrl || null,
          keyMessage: s.keyMessage.trim()
        })),
        size: batchRatio,
        quality: batchQuality,
        seed: seedNum
      });
      setBatchResults(res.results);
    } catch (err: any) {
      setBatchError(err.message || 'Lỗi khi tạo loạt banner.');
    } finally {
      setBatchLoading(false);
    }
  };

  const addBatchSet = () => {
    if (batchSets.length >= 5) return;
    setBatchSets((prev) => [
      ...prev,
      { competitor: null, character: null, keyMessage: '' }
    ]);
    setActiveBatchIndex(batchSets.length);
  };

  const removeBatchSet = (index: number) => {
    if (batchSets.length <= 1) return;
    setBatchSets((prev) => prev.filter((_, i) => i !== index));
    if (activeBatchIndex >= batchSets.length - 1) {
      setActiveBatchIndex(Math.max(0, batchSets.length - 2));
    }
  };

  // ── Resize Mode Handlers ──────────────────────────────────────────────────
  const handleResizeGenerate = async () => {
    if (!resizeImage) {
      setResizeError('Vui lòng tải lên ảnh banner gốc cần đổi kích thước.');
      return;
    }
    if (resizeSelectedSizes.length === 0) {
      setResizeError('Vui lòng chọn ít nhất 1 tỉ lệ kích thước mục tiêu.');
      return;
    }

    const payloadError = checkImagePayloadSize([resizeImage.dataUrl]);
    if (payloadError) {
      setResizeError(payloadError);
      return;
    }

    setResizeLoading(true);
    setResizeError(null);
    setResizeResults([]);

    try {
      const seedNum = resizeSeed.trim() ? Number(resizeSeed.trim()) : undefined;
      const res = await resizeBanner({
        imageData: resizeImage.dataUrl,
        sizes: resizeSelectedSizes,
        quality: resizeQuality,
        seed: seedNum
      });
      setResizeResults(res.results);
    } catch (err: any) {
      setResizeError(err.message || 'Lỗi khi đổi kích thước banner.');
    } finally {
      setResizeLoading(false);
    }
  };

  const toggleResizeSize = (size: BannerAspectRatio) => {
    setResizeSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  // ── Localize Mode Handlers ────────────────────────────────────────────────
  const handleScanText = async () => {
    if (!localizeImage) return;
    setLocalizeScanning(true);
    setLocalizeError(null);
    try {
      const res = await scanBannerText(localizeImage.dataUrl);
      setLocalizeDetectedText(res.detectedText);
      if (res.suggestedTranslation && !localizeTargetText) {
        setLocalizeTargetText(res.suggestedTranslation);
      }
    } catch (err: any) {
      setLocalizeError(err.message || 'Không thể quét chữ trên banner.');
    } finally {
      setLocalizeScanning(false);
    }
  };

  const handleLocalizeGenerate = async () => {
    if (!localizeImage || !localizeTargetText.trim()) {
      setLocalizeError('Vui lòng cung cấp ảnh banner và nội dung chữ thay thế.');
      return;
    }
    const payloadError = checkImagePayloadSize([localizeImage.dataUrl]);
    if (payloadError) {
      setLocalizeError(payloadError);
      return;
    }

    setLocalizeLoading(true);
    setLocalizeError(null);
    try {
      const res = await localizeBanner({
        imageData: localizeImage.dataUrl,
        targetText: localizeTargetText.trim(),
        targetLanguage: localizeLanguage
      });
      setLocalizeResult(res);
    } catch (err: any) {
      setLocalizeError(err.message || 'Lỗi khi bản địa hóa banner.');
    } finally {
      setLocalizeLoading(false);
    }
  };

  // Filtered history
  const filteredHistory = historyItems.filter((item) => {
    const matchesSearch =
      !historySearch ||
      item.keyMessage?.toLowerCase().includes(historySearch.toLowerCase()) ||
      item.prompt?.toLowerCase().includes(historySearch.toLowerCase());
    const matchesRatio =
      historyRatioFilter === 'all' || item.size === historyRatioFilter;
    return matchesSearch && matchesRatio;
  });

  const bannerModes: Array<{
    id: BannerMode;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { id: 'single', label: 'Tạo banner', icon: Zap },
    { id: 'resize', label: 'Đổi kích thước', icon: Maximize2 },
    { id: 'localize', label: 'Thay chữ / Dịch', icon: ScanText },
    { id: 'batch', label: 'Tạo hàng loạt', icon: Layers },
    { id: 'history', label: 'Thư viện', icon: History, badge: historyItems.length > 0 ? historyItems.length : undefined }
  ];

  return (
    <div className="space-y-6">
      {/* ── Studio Header ─────────────────────────────────────────────────── */}
      <div className="ui-panel space-y-4 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#0879D9]/15 to-[#0879D9]/5 text-[#0879D9] border border-[#0879D9]/20 shadow-sm">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-[#17191D]">
                  Banner Ad Studio
                </h1>
                <span className="hidden sm:inline-flex items-center rounded-full bg-[#0879D9]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#0879D9] border border-[#0879D9]/20">
                  AI Ads Suite
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                Tạo banner quảng cáo đa kênh & chuyển đổi cao theo nhận diện thương hiệu OMFIT
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Ảnh tải lên được tự động nén về tối đa {MAX_IMAGE_DIMENSION}px — tổng dung lượng mỗi lần gửi tối đa 50MB
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
              <FileCheck className="h-3.5 w-3.5 text-[#0879D9]" />
              <span>{historyItems.length} banner trong kho</span>
            </span>
          </div>
        </div>

        {/* Mode Navigation Tabs */}
        <nav
          aria-label="Chế độ Banner Studio"
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar rounded-xl border border-slate-200/80 bg-slate-100/90 p-1.5"
        >
          {bannerModes.map((mode) => {
            const Icon = mode.icon;
            const isActive = activeMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setActiveMode(mode.id)}
                className={`flex flex-1 min-w-fit items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-xs font-bold transition-all duration-150 ${
                  isActive
                    ? 'bg-white text-[#0879D9] shadow-sm ring-1 ring-slate-200/80'
                    : 'text-slate-600 hover:bg-white/60 hover:text-[#17191D]'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#0879D9]' : 'text-slate-400'}`} />
                <span>{mode.label}</span>
                {typeof mode.badge === 'number' && (
                  <span
                    className={`ml-1 inline-flex items-center justify-center rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      isActive
                        ? 'bg-[#0879D9]/10 text-[#0879D9]'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {mode.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── MODE 1: SINGLE BANNER GENERATION ─────────────────────────────── */}
      {activeMode === 'single' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Controls Column */}
          <div className="space-y-6 lg:col-span-6 xl:col-span-5">
            <form onSubmit={handleSingleGenerate} className="ui-panel space-y-5 p-5 sm:p-6">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-[#17191D] uppercase tracking-wider">
                  Cấu hình Banner
                </h2>
                <p className="text-xs text-slate-500">
                  Tải lên tài nguyên tham chiếu và nhập thông điệp chiến dịch OMFIT
                </p>
              </div>

              {/* Upload References Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Reference 1: Layout / Competitor Banner */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    1. Bố cục / Mẫu banner
                  </label>
                  {singleCompetitor ? (
                    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                      <img
                        src={singleCompetitor.dataUrl}
                        alt="Competitor reference"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setSingleCompetitor(null)}
                        className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-slate-900/70 text-white hover:bg-slate-900 transition"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-3 text-center transition hover:border-[#0879D9] hover:bg-[#EEF7FE]/30">
                      <ImagePlus className="h-6 w-6 text-slate-400" />
                      <span className="mt-1.5 text-[11px] font-semibold text-slate-600">
                        Tải ảnh mẫu layout
                      </span>
                      <span className="text-[10px] text-slate-400">PNG, JPG, WebP</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => void handleFileUpload(e, setSingleCompetitor, setSingleError)}
                      />
                    </label>
                  )}
                </div>

                {/* Reference 2: Character / Subject */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    2. Người mẫu / Chủ thể OMFIT
                  </label>
                  {singleCharacter ? (
                    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                      <img
                        src={singleCharacter.dataUrl}
                        alt="Character reference"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setSingleCharacter(null)}
                        className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-slate-900/70 text-white hover:bg-slate-900 transition"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-3 text-center transition hover:border-[#0879D9] hover:bg-[#EEF7FE]/30">
                      <ImagePlus className="h-6 w-6 text-slate-400" />
                      <span className="mt-1.5 text-[11px] font-semibold text-slate-600">
                        Tải ảnh chủ thể/mẫu
                      </span>
                      <span className="text-[10px] text-slate-400">Huấn luyện viên, máy tập</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => void handleFileUpload(e, setSingleCharacter, setSingleError)}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Key Message */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Thông điệp chính / Headline & CTA
                </label>
                <textarea
                  rows={2}
                  value={singleKeyMessage}
                  onChange={(e) => setSingleKeyMessage(e.target.value)}
                  placeholder="VD: Đánh thức vóc dáng cân bằng cùng OMFIT Pilates - Trải nghiệm 1-1"
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-[#0879D9] focus:ring-2 focus:ring-[#0879D9]/20"
                />
              </div>

              {/* Aspect Ratio Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Tỉ lệ khung hình (Aspect Ratio)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {ASPECT_RATIOS.slice(0, 4).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSingleRatio(r.id)}
                      className={`flex flex-col items-center rounded-xl border p-2 text-center transition ${
                        singleRatio === r.id
                          ? 'border-[#0879D9] bg-[#EEF7FE] text-[#0879D9]'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-xs font-bold">{r.id}</span>
                      <span className="text-[10px] opacity-75">{r.tag}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Chất lượng hiển thị
                </label>
                <select
                  value={singleQuality}
                  onChange={(e) => setSingleQuality(e.target.value as BannerQuality)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-[#0879D9]"
                >
                  {QUALITY_TIERS.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.label} ({q.desc})
                    </option>
                  ))}
                </select>
              </div>

              {singleError && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{singleError}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={singleLoading || isUploading}
                className="gradient-bg-omfit-btn flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold shadow-sm transition disabled:opacity-50"
              >
                {singleLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Đang tạo…</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    <span>Tạo</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Preview & Output Column */}
          <div className="space-y-6 lg:col-span-6 xl:col-span-7">
            <div className="ui-panel flex flex-col justify-between p-5 sm:p-6 min-h-[460px]">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-bold text-[#17191D] uppercase tracking-wider">
                    Kết Quả Banner
                  </h2>
                  {singleResult && (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      Đã hoàn thành ({singleRatio})
                    </span>
                  )}
                </div>

                <div className="mt-5 flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4">
                  {singleLoading ? (
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="relative">
                        <div className="h-12 w-12 rounded-full border-4 border-slate-200 border-t-[#0879D9] animate-spin" />
                        <Sparkles className="absolute inset-0 m-auto h-5 w-5 text-[#0879D9] animate-pulse" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          Đang tổng hợp bố cục & render ảnh...
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Quá trình xử lý mất khoảng 15-30 giây
                        </p>
                      </div>
                    </div>
                  ) : singleResult?.imageUrl ? (
                    <div className="group relative max-h-[480px] w-full overflow-hidden rounded-xl bg-slate-900 shadow-md">
                      <img
                        src={singleResult.imageUrl}
                        alt="Generated OMFIT Banner"
                        className="h-full w-full object-contain mx-auto"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center text-slate-400">
                      <Layers className="h-12 w-12 stroke-[1.5]" />
                      <p className="mt-3 text-sm font-medium text-slate-600">
                        Chưa có banner nào được tạo
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Cấu hình thông tin bên trái và bấm &quot;Tạo Banner AI&quot;
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Bar */}
              {singleResult && (
                <div className="mt-5 space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => downloadBannerImage(singleResult.imageUrl, `omfit-banner-${singleRatio}.png`)}
                        className="flex items-center gap-1.5 rounded-lg bg-[#0879D9] px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#026BBF] transition"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Tải ảnh HD
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveSingleBanner}
                        disabled={singleSaved}
                        className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${
                          singleSaved
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {singleSaved ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Đã lưu thư viện
                          </>
                        ) : (
                          <>
                            <FileCheck className="h-3.5 w-3.5" />
                            Lưu vào kho OMFIT
                          </>
                        )}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyPrompt(singleResult.promptUsed)}
                      className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-[#0879D9] transition"
                    >
                      {copiedPrompt ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-emerald-600">Đã sao chép prompt</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Sao chép Prompt AI</span>
                        </>
                      )}
                    </button>
                  </div>

                  {singleResult.promptUsed && (
                    <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600 border border-slate-200/60">
                      <span className="font-semibold text-slate-700">Art Director Prompt: </span>
                      <span className="italic">{singleResult.promptUsed}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODE 2: BATCH / MULTI GENERATION ─────────────────────────────── */}
      {activeMode === 'batch' && (
        <div className="space-y-6">
          <div className="ui-panel p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-[#17191D] uppercase tracking-wider">
                  Tạo Hàng Loạt (Multi-Set Batch)
                </h2>
                <p className="text-xs text-slate-500">
                  Cấu hình tối đa 5 bộ banner độc lập để AI xử lý song song
                </p>
              </div>

              {/* Set Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {batchSets.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveBatchIndex(i)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      activeBatchIndex === i
                        ? 'bg-[#0879D9] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>Bộ {i + 1}</span>
                    {batchSets.length > 1 && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBatchSet(i);
                        }}
                        className="hover:text-rose-200"
                      >
                        <X className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                ))}
                {batchSets.length < 5 && (
                  <button
                    type="button"
                    onClick={addBatchSet}
                    className="flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-[#0879D9] hover:text-[#0879D9]"
                  >
                    + Thêm bộ
                  </button>
                )}
              </div>
            </div>

            {/* Active Set Form */}
            {batchSets[activeBatchIndex] && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="lg:col-span-6 space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Competitor */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        1. Mẫu banner layout (Bộ {activeBatchIndex + 1})
                      </label>
                      {batchSets[activeBatchIndex].competitor ? (
                        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          <img
                            src={batchSets[activeBatchIndex].competitor!.dataUrl}
                            alt="Competitor ref"
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...batchSets];
                              updated[activeBatchIndex].competitor = null;
                              setBatchSets(updated);
                            }}
                            className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-slate-900/70 text-white hover:bg-slate-900"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-3 text-center transition hover:border-[#0879D9]">
                          <ImagePlus className="h-5 w-5 text-slate-400" />
                          <span className="mt-1 text-[11px] font-semibold text-slate-600">
                            Tải ảnh mẫu
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              void handleFileUpload(
                                e,
                                (data) => {
                                  const updated = [...batchSets];
                                  updated[activeBatchIndex].competitor = data;
                                  setBatchSets(updated);
                                },
                                setBatchError
                              )
                            }
                          />
                        </label>
                      )}
                    </div>

                    {/* Character */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        2. Chủ thể OMFIT (Bộ {activeBatchIndex + 1})
                      </label>
                      {batchSets[activeBatchIndex].character ? (
                        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          <img
                            src={batchSets[activeBatchIndex].character!.dataUrl}
                            alt="Character ref"
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...batchSets];
                              updated[activeBatchIndex].character = null;
                              setBatchSets(updated);
                            }}
                            className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-slate-900/70 text-white hover:bg-slate-900"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-3 text-center transition hover:border-[#0879D9]">
                          <ImagePlus className="h-5 w-5 text-slate-400" />
                          <span className="mt-1 text-[11px] font-semibold text-slate-600">
                            Tải ảnh mẫu
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              void handleFileUpload(
                                e,
                                (data) => {
                                  const updated = [...batchSets];
                                  updated[activeBatchIndex].character = data;
                                  setBatchSets(updated);
                                },
                                setBatchError
                              )
                            }
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Thông điệp chính (Bộ {activeBatchIndex + 1})
                    </label>
                    <input
                      type="text"
                      value={batchSets[activeBatchIndex].keyMessage}
                      onChange={(e) => {
                        const updated = [...batchSets];
                        updated[activeBatchIndex].keyMessage = e.target.value;
                        setBatchSets(updated);
                      }}
                      placeholder="VD: OMFIT Pilates - Khỏe Đẹp Toàn Diện"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0879D9]"
                    />
                  </div>
                </div>

                {/* Global Batch Settings */}
                <div className="lg:col-span-6 space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <span className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Cài đặt chung cho toàn bộ batch
                  </span>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Tỉ lệ khung hình
                      </label>
                      <select
                        value={batchRatio}
                        onChange={(e) => setBatchRatio(e.target.value as BannerAspectRatio)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium"
                      >
                        {ASPECT_RATIOS.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Chất lượng
                      </label>
                      <select
                        value={batchQuality}
                        onChange={(e) => setBatchQuality(e.target.value as BannerQuality)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium"
                      >
                        {QUALITY_TIERS.map((q) => (
                          <option key={q.id} value={q.id}>
                            {q.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Seed tái tạo (Tùy chọn)
                    </label>
                    <input
                      type="number"
                      value={batchSeed}
                      onChange={(e) => setBatchSeed(e.target.value)}
                      placeholder="Để trống để sinh ngẫu nhiên"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                    />
                  </div>

                  {batchError && (
                    <p className="text-xs text-rose-600 font-medium">{batchError}</p>
                  )}

                  <button
                    type="button"
                    onClick={handleBatchGenerate}
                    disabled={batchLoading || isUploading}
                    className="gradient-bg-omfit-btn flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold shadow-sm transition disabled:opacity-50"
                  >
                    {batchLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Đang tạo hàng loạt {batchSets.length} bộ banner…</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4" />
                        <span>Tạo tất cả {batchSets.length} bộ Banner</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Batch Results Grid */}
          {batchResults.length > 0 && (
            <div className="ui-panel p-5 sm:p-6 space-y-4">
              <h3 className="text-sm font-bold text-[#17191D] uppercase tracking-wider">
                Kết quả loạt Banner
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {batchResults.map((item, idx) => (
                  <div
                    key={idx}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50">
                      <span>Bộ {item.setIndex + 1}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          item.status === 'success'
                            ? 'bg-emerald-50 text-emerald-700'
                            : item.status === 'error'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {item.status === 'success' ? 'Hoàn thành' : item.status === 'error' ? 'Lỗi' : 'Bỏ qua'}
                      </span>
                    </div>

                    <div className="relative aspect-video w-full bg-slate-900">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={`Batch result ${item.setIndex + 1}`}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-slate-400">
                          {item.error || 'Không có ảnh'}
                        </div>
                      )}
                    </div>

                    {item.imageUrl && (
                      <div className="flex items-center justify-between p-2.5">
                        <button
                          type="button"
                          onClick={() => downloadBannerImage(item.imageUrl!)}
                          className="flex items-center gap-1 rounded bg-[#0879D9] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#026BBF]"
                        >
                          <Download className="h-3 w-3" />
                          Tải về
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MODE 3: SMART RESIZE ─────────────────────────────────────────── */}
      {activeMode === 'resize' && (
        <div className="space-y-6">
          <div className="ui-panel p-5 sm:p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-[#17191D] uppercase tracking-wider">
                Đổi Kích Thước Thông Minh (Smart Resize)
              </h2>
              <p className="text-xs text-slate-500">
                Tải lên 1 ảnh banner gốc và tạo ngay các định dạng chuẩn cho Facebook, Instagram, Google Display Ads
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Master Image Upload */}
              <div className="lg:col-span-5 space-y-3">
                <label className="block text-xs font-semibold text-slate-700">
                  Ảnh Banner Gốc (Master Banner)
                </label>
                {resizeImage ? (
                  <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-sm">
                    <img
                      src={resizeImage.dataUrl}
                      alt="Master banner"
                      className="h-full w-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setResizeImage(null)}
                      className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-slate-900/70 text-white hover:bg-slate-900"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-center transition hover:border-[#0879D9]">
                    <ImagePlus className="h-8 w-8 text-slate-400" />
                    <span className="mt-2 text-xs font-semibold text-slate-700">
                      Tải lên banner gốc
                    </span>
                    <span className="text-[10px] text-slate-400">PNG, JPG, WebP</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void handleFileUpload(e, setResizeImage, setResizeError)}
                    />
                  </label>
                )}
              </div>

              {/* Target Sizes Selector */}
              <div className="lg:col-span-7 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Chọn các kích thước mục tiêu cần sinh:
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {ASPECT_RATIOS.map((r) => {
                      const isSelected = resizeSelectedSizes.includes(r.id);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => toggleResizeSize(r.id)}
                          className={`flex flex-col items-center rounded-xl border p-3 text-center transition ${
                            isSelected
                              ? 'border-[#0879D9] bg-[#EEF7FE] text-[#0879D9]'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <span className="text-xs font-bold">{r.id}</span>
                          <span className="text-[10px] opacity-75">{r.tag}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {resizeError && (
                  <p className="text-xs text-rose-600 font-medium">{resizeError}</p>
                )}

                <button
                  type="button"
                  onClick={handleResizeGenerate}
                  disabled={resizeLoading || isUploading || !resizeImage}
                  className="gradient-bg-omfit-btn flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {resizeLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Đang mở rộng & điều chỉnh bố cục…</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-4 w-4" />
                      <span>Đổi kích thước sang {resizeSelectedSizes.length} định dạng</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Resize Results Grid */}
          {resizeResults.length > 0 && (
            <div className="ui-panel p-5 sm:p-6 space-y-4">
              <h3 className="text-sm font-bold text-[#17191D] uppercase tracking-wider">
                Kết Quả Định Dạng Mới
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {resizeResults.map((item, idx) => (
                  <div
                    key={idx}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-xs font-bold text-slate-800 bg-slate-50">
                      <span>Tỉ lệ {item.size}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] ${
                          item.status === 'success'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {item.status === 'success' ? 'Hoàn thành' : 'Lỗi'}
                      </span>
                    </div>

                    <div className="relative aspect-video w-full bg-slate-900">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={`Resized banner ${item.size}`}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-rose-500">
                          {item.error}
                        </div>
                      )}
                    </div>

                    {item.imageUrl && (
                      <div className="p-2.5">
                        <button
                          type="button"
                          onClick={() => downloadBannerImage(item.imageUrl!, `omfit-banner-${item.size}.png`)}
                          className="flex w-full items-center justify-center gap-1 rounded bg-[#0879D9] py-1.5 text-xs font-semibold text-white hover:bg-[#026BBF]"
                        >
                          <Download className="h-3 w-3" />
                          Tải về {item.size}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MODE 4: LOCALIZE & TEXT CLONE ────────────────────────────────── */}
      {activeMode === 'localize' && (
        <div className="space-y-6">
          <div className="ui-panel p-5 sm:p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-[#17191D] uppercase tracking-wider">
                Bản Địa Hóa & Thay Thế Chữ (Localize & Text Clone)
              </h2>
              <p className="text-xs text-slate-500">
                Nhận diện văn bản trên ảnh banner mẫu và thay thế bằng thông điệp OMFIT mới giữ nguyên phong cách
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Image & OCR Section */}
              <div className="lg:col-span-5 space-y-3">
                <label className="block text-xs font-semibold text-slate-700">
                  Ảnh banner cần thay chữ
                </label>
                {localizeImage ? (
                  <div className="space-y-3">
                    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
                      <img
                        src={localizeImage.dataUrl}
                        alt="Localize input banner"
                        className="h-full w-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setLocalizeImage(null);
                          setLocalizeDetectedText('');
                        }}
                        className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-slate-900/70 text-white hover:bg-slate-900"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleScanText}
                      disabled={localizeScanning}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {localizeScanning ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0879D9]" />
                          <span>Gemini Vision đang quét chữ…</span>
                        </>
                      ) : (
                        <>
                          <ScanText className="h-3.5 w-3.5 text-[#0879D9]" />
                          <span>Quét & Trích xuất chữ (OCR)</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <label className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-center transition hover:border-[#0879D9]">
                    <ImagePlus className="h-8 w-8 text-slate-400" />
                    <span className="mt-2 text-xs font-semibold text-slate-700">
                      Tải lên banner có chữ
                    </span>
                    <span className="text-[10px] text-slate-400">PNG, JPG, WebP</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void handleFileUpload(e, setLocalizeImage, setLocalizeError)}
                    />
                  </label>
                )}
              </div>

              {/* Text Inputs & Action */}
              <div className="lg:col-span-7 space-y-4">
                {localizeDetectedText && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <span className="block text-[11px] font-bold text-slate-600 uppercase">
                      Chữ phát hiện trong ảnh gốc:
                    </span>
                    <p className="mt-1 text-xs text-slate-800 font-medium italic">
                      &quot;{localizeDetectedText}&quot;
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Văn bản / Thông điệp OMFIT mới cần thay thế:
                  </label>
                  <textarea
                    rows={3}
                    value={localizeTargetText}
                    onChange={(e) => setLocalizeTargetText(e.target.value)}
                    placeholder="VD: Khám Phá Không Gian Pilates Chuẩn Quốc Tế Tại OMFIT"
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-[#0879D9]"
                  />
                </div>

                {localizeError && (
                  <p className="text-xs text-rose-600 font-medium">{localizeError}</p>
                )}

                <button
                  type="button"
                  onClick={handleLocalizeGenerate}
                  disabled={localizeLoading || isUploading || !localizeImage || !localizeTargetText.trim()}
                  className="gradient-bg-omfit-btn flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {localizeLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Đang tái tạo banner với nội dung mới…</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      <span>Tái tạo Banner với thông điệp mới</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Localize Output */}
          {localizeResult && (
            <div className="ui-panel p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-[#17191D] uppercase tracking-wider">
                  Kết Quả Bản Địa Hóa
                </h3>
                <button
                  type="button"
                  onClick={() => downloadBannerImage(localizeResult.imageUrl, 'omfit-localized-banner.png')}
                  className="flex items-center gap-1.5 rounded-lg bg-[#0879D9] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#026BBF]"
                >
                  <Download className="h-3.5 w-3.5" />
                  Tải ảnh về
                </button>
              </div>

              <div className="overflow-hidden rounded-xl bg-slate-900 shadow-md">
                <img
                  src={localizeResult.imageUrl}
                  alt="Localized OMFIT Banner"
                  className="max-h-[480px] w-full object-contain mx-auto"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MODE 5: BANNER GALLERY & HISTORY ─────────────────────────────── */}
      {activeMode === 'history' && (
        <div className="space-y-6">
          <div className="ui-panel p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-[#17191D] uppercase tracking-wider">
                  Kho Banner Đã Lưu
                </h2>
                <p className="text-xs text-slate-500">
                  Tổng hợp tất cả banner đã tạo và lưu trữ trong tài khoản OMFIT
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Tìm theo thông điệp..."
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-[#0879D9]"
                />
                <button
                  type="button"
                  onClick={fetchHistory}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  title="Làm mới"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {historyLoading ? (
              <div className="grid min-h-48 place-items-center">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-[#0879D9]" />
                  Đang tải kho banner OMFIT…
                </div>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="flex min-h-48 flex-col items-center justify-center text-center text-slate-400">
                <History className="h-10 w-10 stroke-[1.5]" />
                <p className="mt-2 text-xs font-semibold text-slate-600">
                  Chưa có banner nào được lưu
                </p>
                <p className="text-[11px] text-slate-400">
                  Tạo banner mới ở tab &quot;Banner đơn&quot; và bấm &quot;Lưu vào kho OMFIT&quot;
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                  >
                    <div className="relative aspect-video w-full bg-slate-900 overflow-hidden">
                      <img
                        src={item.url}
                        alt={item.keyMessage || 'Banner'}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewModalUrl(item.url)}
                          className="grid h-8 w-8 place-items-center rounded-full bg-white text-slate-800 shadow hover:bg-slate-100"
                          title="Xem ảnh lớn"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadBannerImage(item.url)}
                          className="grid h-8 w-8 place-items-center rounded-full bg-[#0879D9] text-white shadow hover:bg-[#026BBF]"
                          title="Tải về"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="p-3 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-semibold uppercase tracking-wider text-[#0879D9]">
                          {item.size || '16:9'}
                        </span>
                        <span>{new Date(item.createdAt).toLocaleDateString('vi-VN')}</span>
                      </div>
                      <p className="truncate text-xs font-semibold text-slate-800">
                        {item.keyMessage || 'Banner OMFIT'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Lightbox ───────────────────────────────────────────────── */}
      {previewModalUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] max-w-5xl overflow-hidden rounded-2xl bg-slate-900 p-2 shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewModalUrl(null)}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-slate-900/80 text-white hover:bg-slate-900 transition z-10"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={previewModalUrl}
              alt="Banner preview"
              className="max-h-[80vh] w-auto rounded-xl object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default BannerAds;
