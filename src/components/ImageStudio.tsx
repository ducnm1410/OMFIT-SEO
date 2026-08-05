import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  History,
  Image as ImageIcon,
  ImagePlus,
  RefreshCw,
  Tag,
  Upload
} from 'lucide-react';
import type { BrandAsset, BrandProfile, GeneratedImage, ImageAspectRatio } from '../types';
import { LeonardoService } from '../services/leonardoService';
import {
  loadMediaLibrary,
  uploadBrandAsset,
  uploadMediaFile
} from '../services/contentRepository';
import {
  DEFAULT_IMAGE_ASPECT_RATIO,
  getImageAspectRatioOption,
  isImageAspectRatio
} from '../constants/imageGeneration';
import { ButtonContent } from './ButtonContent';
import { ImageAspectRatioSelector } from './ImageAspectRatioSelector';

const noReferenceSelection = '__no_reference__';
const referenceSelectionStorageKey = 'omfit-image-studio-reference-selection';
const legacyLogoSelectionStorageKey = 'omfit-image-studio-logo-selection';
const aspectRatioStorageKey = 'omfit-image-studio-aspect-ratio';

function mergeMediaLibrary(...groups: GeneratedImage[][]) {
  const seen = new Set<string>();
  return groups.flat().filter((image) => {
    if (seen.has(image.id)) return false;
    seen.add(image.id);
    return true;
  });
}

function formatCreatedAt(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

interface ImageStudioProps {
  leonardoService: LeonardoService;
  currentKeyword: string;
  articleId?: string;
  brandProfile: BrandProfile | null;
  brandAssets: BrandAsset[];
  onBrandAssetUploaded: (asset: BrandAsset) => void;
  onSetFeaturedImage?: (image: GeneratedImage) => void;
  onInsertInline?: (image: GeneratedImage) => void;
}

export const ImageStudio: React.FC<ImageStudioProps> = ({
  leonardoService,
  currentKeyword,
  articleId,
  brandProfile,
  brandAssets,
  onBrandAssetUploaded,
  onSetFeaturedImage,
  onInsertInline
}) => {
  const referenceAssets = useMemo(
    () => brandAssets.filter((asset) => (
      (asset.assetType === 'logo' || asset.assetType === 'reference')
      && asset.url
      && (!asset.mimeType || asset.mimeType.startsWith('image/'))
    )),
    [brandAssets]
  );
  const [prompt, setPrompt] = useState(
    'Hình ảnh phòng tập Pilates Reformer cao cấp OMFIT, không gian sáng tự nhiên, máy Reformer nhập khẩu, bố cục hiện đại và chuyên nghiệp'
  );
  const [style, setStyle] = useState('Photorealistic 4K');
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>(() => {
    try {
      const storedValue = window.localStorage.getItem(aspectRatioStorageKey);
      return isImageAspectRatio(storedValue) ? storedValue : DEFAULT_IMAGE_ASPECT_RATIO;
    } catch {
      return DEFAULT_IMAGE_ASPECT_RATIO;
    }
  });
  const [selectedReferenceId, setSelectedReferenceId] = useState(() => {
    try {
      return window.localStorage.getItem(referenceSelectionStorageKey)
        || window.localStorage.getItem(legacyLogoSelectionStorageKey)
        || noReferenceSelection;
    } catch {
      return noReferenceSelection;
    }
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploadingReference, setIsUploadingReference] = useState(false);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [mediaLibrary, setMediaLibrary] = useState<GeneratedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [message, setMessage] = useState('');

  const directUploadRef = useRef<HTMLInputElement>(null);
  const referenceUploadRef = useRef<HTMLInputElement>(null);
  const pendingReferenceType = useRef<'logo' | 'reference'>('reference');
  const selectedReference = referenceAssets.find((asset) => asset.id === selectedReferenceId);

  const refreshMediaLibrary = useCallback(async (showMessage = false) => {
    setIsLoadingLibrary(true);
    try {
      const images = await loadMediaLibrary();
      setMediaLibrary((previous) => mergeMediaLibrary(images, previous));
      setSelectedImage((previous) => previous || images[0] || null);
      if (showMessage) setMessage(`Đã cập nhật thư viện: ${images.length} ảnh từ Supabase CDN.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể tải lịch sử hình ảnh.');
    } finally {
      setIsLoadingLibrary(false);
    }
  }, []);

  useEffect(() => {
    void refreshMediaLibrary();
  }, [refreshMediaLibrary]);

  useEffect(() => {
    if (selectedReferenceId === noReferenceSelection || referenceAssets.length === 0) return;
    if (!referenceAssets.some((asset) => asset.id === selectedReferenceId)) {
      setSelectedReferenceId(noReferenceSelection);
    }
  }, [referenceAssets, selectedReferenceId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(referenceSelectionStorageKey, selectedReferenceId);
    } catch {
      // Reference selection remains active for the current session.
    }
  }, [selectedReferenceId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(aspectRatioStorageKey, aspectRatio);
    } catch {
      // Aspect ratio selection remains active for the current session.
    }
  }, [aspectRatio]);

  const addToLibrary = (image: GeneratedImage) => {
    setMediaLibrary((previous) => mergeMediaLibrary([image], previous));
    setSelectedImage(image);
  };

  const handleDirectCustomUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsGenerating(true);
    setMessage('');
    try {
      const customImage = await uploadMediaFile(file, articleId);
      addToLibrary(customImage);
      setMessage('Đã tải ảnh lên Supabase CDN và thêm vào thư viện. Chọn hành động ở khung xem trước để sử dụng ảnh.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể lưu ảnh vào kho OMFIT.');
    } finally {
      setIsGenerating(false);
      event.target.value = '';
    }
  };

  const openReferenceUpload = (assetType: 'logo' | 'reference') => {
    pendingReferenceType.current = assetType;
    referenceUploadRef.current?.click();
  };

  const handleReferenceUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!brandProfile?.id) {
      setMessage('Chưa tải được hồ sơ thương hiệu. Vui lòng mở Cài đặt thương hiệu và thử lại.');
      event.target.value = '';
      return;
    }
    const assetType = pendingReferenceType.current;
    setIsUploadingReference(true);
    setMessage('');
    try {
      const asset = await uploadBrandAsset(file, brandProfile.id, assetType);
      onBrandAssetUploaded(asset);
      setSelectedReferenceId(asset.id);
      setMessage(assetType === 'logo'
        ? 'Đã tải và chọn logo. Logo này sẽ được gửi kèm request tạo ảnh.'
        : 'Đã tải và chọn ảnh mẫu. Ảnh này sẽ được gửi kèm request tạo ảnh.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể tải ảnh tham chiếu.');
    } finally {
      setIsUploadingReference(false);
      event.target.value = '';
    }
  };

  const handleGenerate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (prompt.trim().length < 10) {
      setMessage('Mô tả hình ảnh cần có ít nhất 10 ký tự.');
      return;
    }
    setIsGenerating(true);
    setMessage('');
    const referenceAssetId = selectedReference?.id;
    try {
      const newImage = await leonardoService.generateImage(
        prompt.trim(),
        style,
        {
          keyword: currentKeyword || 'omfit-seo',
          articleId,
          referenceAssetId,
          aspectRatio
        }
      );
      addToLibrary(newImage);
      const dimensions = getImageAspectRatioOption(aspectRatio);
      setMessage(referenceAssetId
        ? `Đã tạo và lưu ảnh ${aspectRatio} (${dimensions.width} × ${dimensions.height}) với tham chiếu “${selectedReference?.name}”.`
        : `Đã tạo và lưu ảnh ${aspectRatio} (${dimensions.width} × ${dimensions.height}) không dùng ảnh tham chiếu.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể tạo hình ảnh.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="ui-page space-y-6">
      <header className="ui-page-header p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold tracking-[-0.02em] text-[#17191D]">
              <ImageIcon className="h-5 w-5 text-[#0879D9]" /> Image Studio
            </h2>
            <p className="mt-1 text-sm font-medium leading-6 text-slate-500">
              Tạo ảnh, lưu lịch sử trên Supabase CDN, rồi chọn dùng làm ảnh bìa hoặc chèn vào bài viết.
            </p>
          </div>
          <span className="flex w-fit items-center gap-1 rounded-full border border-[#0879D9]/30 bg-[#E0F2FE] px-3 py-1 text-xs font-bold text-[#0879D9]">
            <Activity className="h-3.5 w-3.5" /> OMFIT Studio
          </span>
        </div>
        {message && (
          <div aria-live="polite" className="mt-4 flex items-start gap-2 rounded-xl bg-[#F0F9FF] p-3 text-sm font-semibold text-[#075EA8]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}
      </header>

      <input ref={directUploadRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleDirectCustomUpload(event)} className="hidden" />
      <input ref={referenceUploadRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleReferenceUpload(event)} className="hidden" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-6">
          <section className="rounded-3xl border border-[#0879D9]/20 bg-[#F0F9FF] p-5">
            <h3 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#0879D9]">
              <Upload className="h-4 w-4" /> 1. Tải ảnh có sẵn
            </h3>
            <p className="mt-2 text-xs font-medium leading-5 text-slate-600">Dùng file PNG, JPG hoặc WEBP có sẵn trên máy tính.</p>
            <button
              type="button"
              onClick={() => directUploadRef.current?.click()}
              disabled={isGenerating}
              className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#0879D9]/40 bg-white p-4 text-sm font-extrabold text-[#071827] transition hover:border-[#0879D9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0879D9] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload className="h-5 w-5 text-[#0879D9]" /> Chọn ảnh từ máy tính
            </button>
          </section>

          <section className="rounded-3xl border border-[#0879D9]/15 bg-white p-5 sm:p-6">
            <h3 className="flex items-center gap-1.5 border-b border-slate-100 pb-3 text-xs font-extrabold uppercase tracking-wider text-[#071827]">
              <ImagePlus className="h-4 w-4 text-[#0879D9]" /> 2. Tạo hình ảnh theo thương hiệu
            </h3>

            <form onSubmit={handleGenerate} className="mt-4 space-y-5">
              <fieldset>
                <legend className="text-sm font-bold text-slate-700">Chọn logo hoặc ảnh tham chiếu</legend>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Mục được chọn sẽ được tải lên API tạo ảnh và ghi lại trong metadata của ảnh đầu ra.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    aria-pressed={selectedReferenceId === noReferenceSelection}
                    onClick={() => {
                      setSelectedReferenceId(noReferenceSelection);
                      setMessage('Đã chọn tạo ảnh không dùng ảnh tham chiếu.');
                    }}
                    className={`relative min-h-24 rounded-2xl border p-3 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0879D9] ${selectedReferenceId === noReferenceSelection ? 'border-[#0879D9] bg-[#F0F9FF] ring-2 ring-[#0879D9]/10' : 'border-slate-200 bg-white hover:border-[#0879D9]/50'}`}
                  >
                    {selectedReferenceId === noReferenceSelection && <Check className="absolute right-2 top-2 h-4 w-4 text-[#0879D9]" />}
                    <ImageIcon className="mx-auto h-7 w-7 text-slate-400" />
                    <span className="mt-2 block text-xs font-bold text-slate-700">Không tham chiếu</span>
                  </button>
                  {referenceAssets.map((asset) => {
                    const selected = selectedReferenceId === asset.id;
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setSelectedReferenceId(asset.id);
                          setMessage(`Đã chọn ${asset.assetType === 'logo' ? 'logo' : 'ảnh mẫu'} “${asset.name}”.`);
                        }}
                        className={`relative min-h-24 overflow-hidden rounded-2xl border p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0879D9] ${selected ? 'border-[#0879D9] bg-[#F0F9FF] ring-2 ring-[#0879D9]/10' : 'border-slate-200 bg-white hover:border-[#0879D9]/50'}`}
                      >
                        {selected && <Check className="absolute right-2 top-2 z-10 h-4 w-4 rounded-full bg-white text-[#0879D9]" />}
                        <span className="absolute left-2 top-2 z-10 rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-extrabold text-[#0879D9]">
                          {asset.assetType === 'logo' ? 'LOGO' : 'ẢNH MẪU'}
                        </span>
                        <img src={asset.url} alt={asset.name} className="mx-auto h-14 w-full object-contain" />
                        <span className="mt-1 block truncate text-[11px] font-bold text-slate-600" title={asset.name}>{asset.name}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => openReferenceUpload('logo')}
                    disabled={isUploadingReference || !brandProfile?.id}
                    className="min-h-11 rounded-xl border border-dashed border-[#0879D9]/40 bg-[#F8FAFC] px-3 text-xs font-bold text-[#0879D9] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Upload className="mr-1.5 inline h-4 w-4" /> Thêm logo
                  </button>
                  <button
                    type="button"
                    onClick={() => openReferenceUpload('reference')}
                    disabled={isUploadingReference || !brandProfile?.id}
                    className="min-h-11 rounded-xl border border-dashed border-[#0879D9]/40 bg-[#F8FAFC] px-3 text-xs font-bold text-[#0879D9] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ImagePlus className="mr-1.5 inline h-4 w-4" /> Thêm ảnh mẫu
                  </button>
                </div>
                {selectedReference && (
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                    <img src={selectedReference.url} alt="" className="h-10 w-10 rounded-lg bg-white object-contain" />
                    <span>Đầu vào đã chọn: <strong>{selectedReference.name}</strong> · sẽ được gửi kèm khi tạo ảnh.</span>
                  </div>
                )}
              </fieldset>

              <label className="block text-sm font-bold text-slate-700">
                Mô tả hình ảnh
                <textarea
                  rows={4}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Mô tả không gian, chủ thể, bố cục và cảm xúc mong muốn..."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm leading-6 text-[#071827] outline-none transition focus:border-[#0879D9] focus:ring-2 focus:ring-[#0879D9]/10"
                  required
                />
              </label>

              <label className="block text-sm font-bold text-slate-700">
                Phong cách hình ảnh
                <select
                  value={style}
                  onChange={(event) => setStyle(event.target.value)}
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-2.5 text-sm font-semibold text-[#071827] outline-none transition focus:border-[#0879D9] focus:ring-2 focus:ring-[#0879D9]/10"
                >
                  <option value="Photorealistic 4K">Chân thực 4K — studio OMFIT</option>
                  <option value="Modern Tech 3D Render">Đồ họa 3D hiện đại</option>
                  <option value="Corporate Minimalist">Tối giản, sang trọng</option>
                </select>
              </label>

              <ImageAspectRatioSelector value={aspectRatio} onChange={setAspectRatio} disabled={isGenerating || isUploadingReference} />

              <button
                type="submit"
                disabled={isGenerating || isUploadingReference}
                aria-busy={isGenerating}
                className="ui-action-button gradient-bg-omfit-btn flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white shadow-md shadow-[#0879D9]/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ButtonContent busy={isGenerating} busyLabel="Đang tạo hình ảnh..." label="Tạo hình ảnh" icon={<ImagePlus className="h-4 w-4" />} />
              </button>
            </form>
          </section>
        </div>

        <section className="space-y-4 rounded-3xl border border-[#0879D9]/15 bg-white p-5 lg:col-span-6 sm:p-6">
          <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#071827]">
            <ImageIcon className="h-4 w-4 text-[#0879D9]" /> Xem trước ảnh được chọn
          </h3>
          {selectedImage ? (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-[#0879D9]/30 bg-[#F8FAFC]">
                <img src={selectedImage.url} alt={selectedImage.altText} className="h-80 w-full object-cover" />
              </div>
              <div className="space-y-2 rounded-xl border border-[#0879D9]/15 bg-[#F0F9FF] p-4 text-xs">
                <div className="flex items-start gap-2 font-semibold text-slate-700">
                  <Tag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0879D9]" />
                  <span>Tên tệp SEO: <span className="break-all font-mono font-bold text-[#0879D9]">{selectedImage.fileName}</span></span>
                </div>
                <div className="flex items-start gap-2 font-semibold text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0879D9]" />
                  <span>Alt text: <strong className="text-slate-900">{selectedImage.altText}</strong></span>
                </div>
                {selectedImage.width && selectedImage.height && (
                  <div className="flex items-start gap-2 font-semibold text-slate-700">
                    <ImageIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0879D9]" />
                    <span>Kích thước: <strong className="text-slate-900">{selectedImage.aspectRatio || `${selectedImage.width}:${selectedImage.height}`} · {selectedImage.width} × {selectedImage.height}</strong></span>
                  </div>
                )}
                {selectedImage.referenceAssetName && (
                  <div className="flex items-start gap-2 font-semibold text-slate-700">
                    <ImagePlus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0879D9]" />
                    <span>Tham chiếu đã dùng: <strong className="text-slate-900">{selectedImage.referenceAssetName}</strong></span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={!onSetFeaturedImage}
                  onClick={() => {
                    onSetFeaturedImage?.({ ...selectedImage, role: 'featured' });
                    setMessage('Đã đặt ảnh làm ảnh bìa cho bài viết đang chọn.');
                  }}
                  className="gradient-bg-omfit-btn flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" /> Đặt làm ảnh bìa
                </button>
                <button
                  type="button"
                  disabled={!onInsertInline}
                  onClick={() => {
                    onInsertInline?.({ ...selectedImage, role: 'inline' });
                    setMessage('Đã chèn ảnh vào nội dung bài viết đang chọn.');
                  }}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#0879D9]/30 bg-[#F0F9FF] px-4 text-xs font-bold text-[#0879D9] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ImagePlus className="h-4 w-4" /> Chèn vào bài <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              {!articleId && <p className="text-center text-xs font-medium text-amber-700">Hãy chọn một bài viết để bật hai hành động sử dụng ảnh.</p>}
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-dashed border-slate-200 bg-[#F8FAFC] py-20 text-center">
              <ImageIcon className="mx-auto h-12 w-12 text-[#0879D9]/30" />
              <p className="text-sm font-bold text-slate-600">{isLoadingLibrary ? 'Đang tải lịch sử hình ảnh...' : 'Chưa có hình ảnh.'}</p>
              <p className="text-xs text-slate-400">Tải ảnh từ máy tính hoặc tạo ảnh mới ở cột bên trái.</p>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-3xl border border-[#0879D9]/15 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#071827]">
              <History className="h-4 w-4 text-[#0879D9]" /> Lịch sử hình ảnh
            </h3>
            <p className="mt-1 text-xs font-medium text-slate-500">Dữ liệu lấy từ Supabase; ảnh hiển thị bằng link CDN đã lưu trong media_assets.</p>
          </div>
          <button
            type="button"
            onClick={() => void refreshMediaLibrary(true)}
            disabled={isLoadingLibrary}
            className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingLibrary ? 'animate-spin' : ''}`} /> Làm mới
          </button>
        </div>
        {mediaLibrary.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {mediaLibrary.map((image) => {
              const selected = selectedImage?.id === image.id;
              return (
                <button
                  key={image.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedImage(image)}
                  className={`overflow-hidden rounded-2xl border bg-white text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0879D9] ${selected ? 'border-[#0879D9] ring-2 ring-[#0879D9]/15' : 'border-slate-200 hover:border-[#0879D9]/50'}`}
                >
                  <div className="relative">
                    <img src={image.url} alt={image.altText} className="aspect-square w-full object-cover" loading="lazy" />
                    {selected && <Check className="absolute right-2 top-2 h-5 w-5 rounded-full bg-white p-0.5 text-[#0879D9] shadow" />}
                  </div>
                  <div className="space-y-1 p-2.5">
                    <p className="truncate text-[11px] font-bold text-slate-700" title={image.fileName}>{image.fileName}</p>
                    <div className="flex items-center justify-between gap-1 text-[10px] font-semibold text-slate-400">
                      <span>{image.source === 'upload' ? 'Tải lên' : 'Ảnh AI'}</span>
                      <span className="truncate">{formatCreatedAt(image.createdAt)}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : !isLoadingLibrary ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm font-medium text-slate-500">
            Thư viện chưa có ảnh. Ảnh tải lên hoặc ảnh tạo mới sẽ xuất hiện tại đây.
          </div>
        ) : null}
      </section>
    </div>
  );
};
