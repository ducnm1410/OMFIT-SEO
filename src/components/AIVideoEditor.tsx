import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  DollarSign,
  Download,
  Film,
  History,
  Image as ImageIcon,
  Loader2,
  MonitorPlay,
  RotateCcw,
  Send,
  Smartphone,
  Sparkles,
  Terminal,
  Upload,
  Wand2,
  X
} from 'lucide-react';
import type {
  GeneratedVideo,
  VideoAspectRatio,
  VideoEditorMode
} from '../types';
import {
  generateVideoEdit,
  loadVideoComparisonSource,
  loadVideoEditorAnalytics,
  loadVideoLibrary,
  markVideoUsed,
  prepareSourceMedia,
  type PreparedSourceVideo,
  type VideoComparisonSource,
  type VideoEditorAnalytics
} from '../services/videoEditorService';
import { ButtonContent } from './ButtonContent';

const MODE_OPTIONS: Array<{
  id: VideoEditorMode;
  label: string;
  description: string;
}> = [
  { id: 'text-to-video', label: 'Tạo từ prompt', description: 'Tạo video mới chỉ từ mô tả' },
  { id: 'image-to-video', label: 'Ảnh thành video', description: 'Tạo chuyển động từ một ảnh' },
  { id: 'edit-video', label: 'Sửa video', description: 'Thay đổi video đã tải lên' },
  { id: 'continue', label: 'Tiếp tục phiên bản', description: 'Tạo nhánh từ lịch sử' }
];

const EXAMPLE_PROMPTS: Record<VideoEditorMode, string[]> = {
  'text-to-video': [
    'Một buổi tập Pilates cao cấp, ánh sáng tự nhiên, chuyển động máy quay chậm',
    'Không gian wellness tối giản, một cảnh quay liên tục, nhạc nền thư giãn'
  ],
  'image-to-video': [
    'Tạo chuyển động máy quay tiến nhẹ, chủ thể chuyển động tự nhiên',
    'Giữ nguyên sản phẩm, thêm ánh sáng chuyển động và nền có chiều sâu'
  ],
  'edit-video': [
    'Chuyển video sang phong cách điện ảnh cao cấp',
    'Đổi ánh sáng thành hoàng hôn, giữ nguyên chủ thể và bố cục',
    'Làm chuyển động máy quay mượt và tự nhiên hơn'
  ],
  continue: [
    'Giữ nguyên phiên bản này và thêm hiệu ứng mưa nhẹ',
    'Làm màu sắc ấm hơn, không thay đổi chủ thể',
    'Thêm nhạc nền thư giãn, không có hội thoại'
  ]
};

const EMPTY_ANALYTICS: VideoEditorAnalytics = {
  totalVideos: 0,
  averageRenderSeconds: null,
  estimatedCostUsd: 0,
  usedVideos: 0,
  usageRate: 0
};

type Phase = 'idle' | 'uploading' | 'ready' | 'rendering' | 'error';

function mergeVideos(...groups: GeneratedVideo[][]) {
  const seen = new Set<string>();
  return groups.flat().filter((video) => {
    if (seen.has(video.id)) return false;
    seen.add(video.id);
    return true;
  });
}

function formatElapsed(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatMetricDuration(seconds: number | null) {
  if (!seconds) return 'Chưa có dữ liệu';
  if (seconds < 60) return `${Math.round(seconds)} giây`;
  return `${Math.floor(seconds / 60)}p ${Math.round(seconds % 60)}g`;
}

function formatCreatedAt(value: string) {
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

function modeLabel(mode: VideoEditorMode) {
  return MODE_OPTIONS.find((option) => option.id === mode)?.label || 'Sửa video';
}

function promptInstruction(
  mode: VideoEditorMode,
  source: PreparedSourceVideo | null,
  currentVideo: GeneratedVideo | null
) {
  if (mode === 'image-to-video' && !source) return 'Hãy tải một ảnh lên để mở khóa ô prompt.';
  if (mode === 'edit-video' && !source) return 'Hãy tải video nguồn lên để mở khóa ô prompt.';
  if (mode === 'continue' && !currentVideo) return 'Hãy chọn “Tiếp tục từ bản này” trong lịch sử để mở khóa ô prompt.';
  if (mode === 'text-to-video') return 'Mô tả bối cảnh, chuyển động máy quay, ánh sáng và âm thanh mong muốn.';
  return 'Nguồn đã sẵn sàng. Hãy mô tả chính xác chuyển động hoặc thay đổi bạn muốn.';
}

function modeIcon(mode: VideoEditorMode) {
  if (mode === 'text-to-video') return <Sparkles className="h-4 w-4" />;
  if (mode === 'image-to-video') return <ImageIcon className="h-4 w-4" />;
  if (mode === 'continue') return <RotateCcw className="h-4 w-4" />;
  return <Film className="h-4 w-4" />;
}

export const AIVideoEditor: React.FC = () => {
  const [mode, setMode] = useState<VideoEditorMode>('edit-video');
  const [source, setSource] = useState<PreparedSourceVideo | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [promptVi, setPromptVi] = useState('');
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>('16:9');
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [library, setLibrary] = useState<GeneratedVideo[]>([]);
  const [analytics, setAnalytics] = useState<VideoEditorAnalytics>(EMPTY_ANALYTICS);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [currentVideo, setCurrentVideo] = useState<GeneratedVideo | null>(null);
  const [comparisonSource, setComparisonSource] = useState<VideoComparisonSource | null>(null);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const sourcePreviewRef = useRef<string | null>(null);
  const working = phase === 'uploading' || phase === 'rendering';
  const sourceRequired = mode === 'image-to-video' || mode === 'edit-video';
  const prerequisiteReady = mode === 'text-to-video'
    || (sourceRequired && Boolean(source))
    || (mode === 'continue' && Boolean(currentVideo));
  const promptLocked = working || !prerequisiteReady;

  const addLog = (message: string) => {
    setLogs((previous) => [
      ...previous,
      `[${new Date().toLocaleTimeString('vi-VN')}] ${message}`
    ]);
  };

  const refreshAnalytics = async () => {
    const nextAnalytics = await loadVideoEditorAnalytics();
    setAnalytics(nextAnalytics);
  };

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadVideoLibrary(), loadVideoEditorAnalytics()])
      .then(([videos, videoAnalytics]) => {
        if (cancelled) return;
        setLibrary(videos);
        setAnalytics(videoAnalytics);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Không thể tải lịch sử video.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingLibrary(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!working) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [working]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [logs]);

  useEffect(() => () => {
    if (sourcePreviewRef.current) URL.revokeObjectURL(sourcePreviewRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setComparisonSource(null);
    if (!currentVideo) return () => {
      cancelled = true;
    };
    if (source && sourcePreview) {
      setComparisonSource({ url: sourcePreview, kind: source.inputKind });
      return () => {
        cancelled = true;
      };
    }
    const localParent = library.find((video) => video.id === currentVideo.parentAssetId);
    if (localParent) {
      setComparisonSource({ url: localParent.url, kind: 'video' });
      return () => {
        cancelled = true;
      };
    }
    setIsLoadingComparison(true);
    void loadVideoComparisonSource(currentVideo.id)
      .then((value) => {
        if (!cancelled) setComparisonSource(value);
      })
      .catch(() => {
        if (!cancelled) setComparisonSource(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingComparison(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentVideo, library, source, sourcePreview]);

  const setPreviewUrl = (value: string | null) => {
    if (sourcePreviewRef.current) URL.revokeObjectURL(sourcePreviewRef.current);
    sourcePreviewRef.current = value;
    setSourcePreview(value);
  };

  const handleModeChange = (nextMode: VideoEditorMode) => {
    if (working || nextMode === mode) return;
    setMode(nextMode);
    setError('');
    setPhase('idle');
    setElapsed(0);
    if (nextMode === 'continue') {
      setSource(null);
      setPreviewUrl(null);
      return;
    }
    setCurrentVideo(null);
    setComparisonSource(null);
    setSource(null);
    setPreviewUrl(null);
  };

  const handleFile = async (file: File) => {
    const inputKind = mode === 'image-to-video' ? 'image' : 'video';
    setError('');
    setCurrentVideo(null);
    setSource(null);
    setElapsed(0);
    setPreviewUrl(URL.createObjectURL(file));
    setPhase('uploading');
    addLog(`Đang tải ${inputKind === 'image' ? 'ảnh' : 'video'} nguồn ${(file.size / 1048576).toFixed(1)} MB vào kho riêng tư…`);
    try {
      const prepared = await prepareSourceMedia(file, inputKind);
      setSource(prepared);
      setPhase('ready');
      addLog(`${inputKind === 'image' ? 'Ảnh' : 'Video'} nguồn đã sẵn sàng. Ô prompt đã được mở khóa.`);
    } catch (uploadError) {
      setPhase('error');
      const message = uploadError instanceof Error ? uploadError.message : 'Không thể chuẩn bị tệp nguồn.';
      setError(message);
      addLog(`Lỗi chuẩn bị nguồn: ${message}`);
    }
  };

  const handleApply = async () => {
    if (!prerequisiteReady) {
      setError(promptInstruction(mode, source, currentVideo));
      return;
    }
    if (promptVi.trim().length < 2) {
      setError('Hãy nhập yêu cầu tạo hoặc chỉnh sửa video.');
      return;
    }
    setError('');
    setElapsed(0);
    setPhase('rendering');
    const submittedPrompt = promptVi.trim();
    addLog(`Đã gửi yêu cầu “${submittedPrompt}”. Gemini đang render; hệ thống sẽ tự chuyển sang kiểm tra định kỳ nếu cần…`);
    try {
      const video = await generateVideoEdit({
        promptVi: submittedPrompt,
        resolution,
        aspectRatio,
        mode,
        sourceTicket: sourceRequired ? source?.ticket : undefined,
        previousAssetId: mode === 'continue' ? currentVideo?.id : undefined
      });
      setLibrary((previous) => mergeVideos([video], previous));
      setCurrentVideo(video);
      setPromptVi('');
      setPhase('ready');
      void refreshAnalytics().catch(() => undefined);
      addLog('Hoàn tất, đã lưu video và telemetry vào Supabase CDN.');
    } catch (generationError) {
      setPhase('error');
      const message = generationError instanceof Error ? generationError.message : 'Không thể xử lý video.';
      setError(message);
      addLog(`Lỗi render: ${message}`);
    }
  };

  const updateVideo = (updated: GeneratedVideo) => {
    setLibrary((previous) => previous.map((video) => video.id === updated.id ? updated : video));
    setCurrentVideo((current) => current?.id === updated.id ? updated : current);
  };

  const recordVideoUse = (video: GeneratedVideo, action: 'download' | 'selected') => {
    void markVideoUsed(video.id, action)
      .then((updated) => {
        updateVideo(updated);
        return refreshAnalytics();
      })
      .catch(() => undefined);
  };

  const continueFromVideo = (video: GeneratedVideo) => {
    setMode('continue');
    setCurrentVideo(video);
    setSource(null);
    setPreviewUrl(null);
    setPhase('ready');
    setError('');
    recordVideoUse(video, 'selected');
    addLog(`Đã chọn “${video.fileName}”. Lượt tiếp theo sẽ tạo một nhánh từ phiên bản này.`);
  };

  const resetSession = () => {
    setSource(null);
    setPreviewUrl(null);
    setCurrentVideo(null);
    setComparisonSource(null);
    setPromptVi('');
    setError('');
    setLogs([]);
    setElapsed(0);
    setPhase('idle');
  };

  const uploadAccept = mode === 'image-to-video'
    ? 'image/jpeg,image/png,image/webp'
    : 'video/mp4,video/quicktime,video/webm';
  const actionLabel = mode === 'text-to-video' ? 'Tạo video'
    : mode === 'image-to-video' ? 'Tạo video từ ảnh'
      : mode === 'continue' ? 'Tạo phiên bản tiếp' : 'Áp dụng chỉnh sửa';
  const sourceKind = source?.inputKind || (mode === 'image-to-video' ? 'image' : 'video');

  return (
    <div className="ui-page space-y-6">
      <header className="ui-page-header p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold tracking-[-0.02em] text-[#17191D]">
              <Wand2 className="h-5 w-5 text-[#0879D9]" /> AI Video Editor
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500">Tạo, chỉnh sửa và đo hiệu quả video trong cùng một luồng.</p>
          </div>
          <span className="flex w-fit items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
            <Sparkles className="h-3.5 w-3.5" /> Gemini Omni
          </span>
        </div>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium leading-5 text-amber-800">
          Câu lệnh càng cụ thể về cảnh, chuyển động, ánh sáng và âm thanh thì kết quả càng ổn định. Chỉnh sửa giọng nói hiện chưa được hỗ trợ.
        </div>
        {error && (
          <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} className="ml-auto" aria-label="Đóng thông báo lỗi">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </header>

      <section aria-labelledby="video-dashboard-title" className="rounded-3xl border border-[#0879D9]/15 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 id="video-dashboard-title" className="flex items-center gap-2 text-sm font-extrabold text-[#071827]">
              <BarChart3 className="h-4 w-4 text-[#0879D9]" /> Hiệu suất AI Video
            </h3>
            <p className="mt-1 text-xs font-medium text-slate-500">Tổng hợp từ các video đã render thành công trong Supabase.</p>
          </div>
          <span className="text-xs font-bold text-slate-400">{analytics.totalVideos} video hoàn tất</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-sky-600"><Clock3 className="h-4 w-4" /></span>
            <p className="mt-3 text-xs font-bold text-slate-500">Thời gian render trung bình</p>
            <p className="mt-1 text-xl font-extrabold text-[#071827]">{formatMetricDuration(analytics.averageRenderSeconds)}</p>
          </div>
          <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-violet-600"><DollarSign className="h-4 w-4" /></span>
            <p className="mt-3 text-xs font-bold text-slate-500">Chi phí API ước tính</p>
            <p className="mt-1 text-xl font-extrabold text-[#071827]">${analytics.estimatedCostUsd.toFixed(3)}</p>
            <p className="mt-1 text-[10px] font-medium text-slate-400">Theo usage Gemini Omni hiện tại</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-emerald-600"><MonitorPlay className="h-4 w-4" /></span>
            <p className="mt-3 text-xs font-bold text-slate-500">Tỷ lệ video được sử dụng</p>
            <p className="mt-1 text-xl font-extrabold text-[#071827]">{analytics.usageRate.toFixed(0)}%</p>
            <p className="mt-1 text-[10px] font-medium text-slate-400">{analytics.usedVideos}/{analytics.totalVideos} video được tải hoặc dùng tiếp</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="video-mode-title" className="rounded-3xl border border-[#0879D9]/15 bg-white p-5 sm:p-6">
        <h3 id="video-mode-title" className="text-sm font-extrabold text-[#071827]">1. Chọn chế độ làm việc</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {MODE_OPTIONS.map((option) => {
            const active = mode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                disabled={working}
                onClick={() => handleModeChange(option.id)}
                className={`rounded-2xl border p-4 text-left transition disabled:opacity-50 ${active ? 'border-[#0879D9] bg-[#F0F9FF] ring-1 ring-[#0879D9]' : 'border-slate-200 bg-white hover:border-[#0879D9]/40'}`}
              >
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${active ? 'bg-[#0879D9] text-white' : 'bg-slate-100 text-slate-500'}`}>{modeIcon(option.id)}</span>
                <span className="mt-3 block text-sm font-extrabold text-[#071827]">{option.label}</span>
                <span className="mt-1 block text-xs font-medium leading-5 text-slate-500">{option.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <input
        ref={fileInputRef}
        type="file"
        accept={uploadAccept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = '';
        }}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          {!currentVideo && sourceRequired && !sourcePreview && (
            <button
              type="button"
              disabled={working}
              onClick={() => fileInputRef.current?.click()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0];
                if (file) void handleFile(file);
              }}
              onDragOver={(event) => event.preventDefault()}
              className="flex min-h-64 w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-[#0879D9]/35 bg-[#F0F9FF] p-8 text-center transition hover:border-[#0879D9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0879D9] disabled:opacity-50"
            >
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-[#0879D9] shadow-sm">
                {mode === 'image-to-video' ? <ImageIcon className="h-7 w-7" /> : <Upload className="h-7 w-7" />}
              </span>
              <span className="text-base font-extrabold text-[#071827]">
                {mode === 'image-to-video' ? 'Tải ảnh để tạo chuyển động' : 'Kéo-thả hoặc bấm để tải video'}
              </span>
              <span className="text-xs font-medium text-slate-500">
                {mode === 'image-to-video' ? 'JPG, PNG hoặc WEBP · tối đa 10 MB' : 'MP4, MOV hoặc WEBM · tối đa 100 MB'}
              </span>
            </button>
          )}

          {!currentVideo && mode === 'text-to-video' && (
            <section className="flex min-h-52 flex-col items-center justify-center rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 to-sky-50 p-8 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-violet-600 shadow-sm"><Sparkles className="h-7 w-7" /></span>
              <p className="mt-4 text-base font-extrabold text-[#071827]">Sẵn sàng tạo video từ ý tưởng</p>
              <p className="mt-1 max-w-md text-xs font-medium leading-5 text-slate-500">Không cần tải tệp. Viết prompt bên dưới, chọn tỷ lệ và bắt đầu render.</p>
            </section>
          )}

          {!currentVideo && mode === 'continue' && (
            <section className="flex min-h-52 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <History className="h-8 w-8 text-slate-400" />
              <p className="mt-3 text-sm font-extrabold text-[#071827]">Chọn một video trong lịch sử</p>
              <p className="mt-1 max-w-sm text-xs font-medium leading-5 text-slate-500">Bấm “Tiếp tục từ bản này” để xem video và mở khóa ô prompt.</p>
            </section>
          )}

          {!currentVideo && sourcePreview && (
            <section className="space-y-4 rounded-3xl border border-[#0879D9]/15 bg-white p-5 sm:p-6">
              <div>
                <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">{sourceKind === 'image' ? 'Ảnh nguồn' : 'Video nguồn'}</p>
                <div className="relative overflow-hidden rounded-2xl bg-black">
                  {sourceKind === 'image' ? (
                    <img src={sourcePreview} alt="Ảnh nguồn tạo video" className="max-h-[420px] w-full object-contain" />
                  ) : (
                    <video src={sourcePreview} controls className="max-h-[420px] w-full bg-black object-contain" />
                  )}
                  {phase === 'uploading' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/65 text-white">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <span className="text-sm font-bold">Đang tải và xử lý nguồn… {formatElapsed(elapsed)}</span>
                    </div>
                  )}
                </div>
              </div>
              <button type="button" onClick={resetSession} disabled={working} className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600 disabled:opacity-50">
                <X className="h-4 w-4" /> Chọn tệp khác
              </button>
            </section>
          )}

          {currentVideo && (
            <section className="space-y-4 rounded-3xl border border-[#0879D9]/15 bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> Phiên bản AI đang chọn
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-500">{modeLabel(currentVideo.generationMode)} · {currentVideo.aspectRatio} · {currentVideo.resolution}</p>
                </div>
                {currentVideo.usedAt && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">Đã sử dụng</span>}
              </div>

              {comparisonSource ? (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <MonitorPlay className="h-4 w-4 text-[#0879D9]" />
                    <h3 className="text-sm font-extrabold text-[#071827]">So sánh Before / After</h3>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Before · Bản nguồn</p>
                      <div className="overflow-hidden rounded-2xl bg-black">
                        {comparisonSource.kind === 'image' ? (
                          <img src={comparisonSource.url} alt="Ảnh trước khi tạo video" className="aspect-video w-full object-contain" />
                        ) : (
                          <video src={comparisonSource.url} controls preload="metadata" className="aspect-video w-full object-contain" />
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-emerald-700">After · Phiên bản AI</p>
                      <div className="overflow-hidden rounded-2xl bg-black ring-2 ring-emerald-400">
                        <video key={currentVideo.url} src={currentVideo.url} controls autoPlay muted className="aspect-video w-full object-contain" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl bg-black ring-2 ring-emerald-400">
                  <video key={currentVideo.url} src={currentVideo.url} controls autoPlay muted className="max-h-[440px] w-full bg-black object-contain" />
                </div>
              )}

              {isLoadingComparison && (
                <p className="flex items-center gap-2 text-xs font-semibold text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải bản Before…</p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={currentVideo.url}
                  target="_blank"
                  rel="noreferrer"
                  download
                  onClick={() => recordVideoUse(currentVideo, 'download')}
                  className="flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white"
                >
                  <Download className="h-4 w-4" /> Tải và dùng video
                </a>
                {mode !== 'continue' && (
                  <button type="button" onClick={() => continueFromVideo(currentVideo)} disabled={working} className="flex min-h-10 items-center gap-2 rounded-xl border border-[#0879D9]/25 px-4 text-xs font-bold text-[#0879D9] disabled:opacity-50">
                    <RotateCcw className="h-4 w-4" /> Sửa tiếp bản này
                  </button>
                )}
                <button type="button" onClick={resetSession} disabled={working} className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600 disabled:opacity-50">
                  <X className="h-4 w-4" /> Bắt đầu lại
                </button>
              </div>

              {phase === 'rendering' && (
                <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 text-violet-800">
                  <Loader2 className="h-6 w-6 shrink-0 animate-spin" />
                  <div>
                    <p className="text-sm font-bold">Gemini đang render video</p>
                    <p className="mt-0.5 text-xs font-medium">Đã trôi qua {formatElapsed(elapsed)} · có thể mất vài phút</p>
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="rounded-3xl border border-[#0879D9]/15 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <label className="flex items-center gap-2 text-sm font-extrabold text-slate-700" htmlFor="video-edit-prompt">
                  <Sparkles className="h-4 w-4 text-[#0879D9]" /> 2. Viết prompt
                </label>
                <p id="video-prompt-help" className={`mt-1 text-xs font-medium ${prerequisiteReady ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {promptInstruction(mode, source, currentVideo)}
                </p>
              </div>
              {!prerequisiteReady && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">Đang khóa</span>}
            </div>
            <textarea
              id="video-edit-prompt"
              aria-describedby="video-prompt-help"
              rows={4}
              value={promptVi}
              onChange={(event) => setPromptVi(event.target.value)}
              disabled={promptLocked}
              placeholder="Ví dụ: Một cảnh quay liên tục, ánh sáng buổi sáng, máy quay tiến chậm về phía chủ thể…"
              className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm font-medium leading-6 text-[#071827] outline-none focus:border-[#0879D9] focus:ring-2 focus:ring-[#0879D9]/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS[mode].map((example) => (
                <button key={example} type="button" onClick={() => setPromptVi(example)} disabled={promptLocked} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-[#0879D9]/40 disabled:cursor-not-allowed disabled:opacity-40">
                  {example}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <fieldset disabled={working}>
                <legend className="text-xs font-bold text-slate-600">3. Tỷ lệ khung hình</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(['9:16', '16:9'] as const).map((option) => (
                    <button key={option} type="button" aria-pressed={aspectRatio === option} onClick={() => setAspectRatio(option)} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-bold ${aspectRatio === option ? 'border-[#0879D9] bg-[#0879D9] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
                      {option === '9:16' ? <Smartphone className="h-4 w-4" /> : <MonitorPlay className="h-4 w-4" />}
                      {option} · {option === '9:16' ? 'Reel / TikTok' : 'Website'}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset disabled={working || mode === 'continue' || mode === 'text-to-video' || mode === 'image-to-video'}>
                <legend className="text-xs font-bold text-slate-600">Chất lượng đọc video nguồn</legend>
                <div className="mt-2 inline-flex overflow-hidden rounded-xl border border-slate-200">
                  {(['720p', '1080p'] as const).map((option) => (
                    <button key={option} type="button" aria-pressed={resolution === option} onClick={() => setResolution(option)} className={`min-h-11 px-5 text-xs font-bold ${resolution === option ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}>
                      {option}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => void handleApply()} disabled={working || !prerequisiteReady || promptVi.trim().length < 2} aria-busy={phase === 'rendering'} className="ui-action-button gradient-bg-omfit-btn flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white disabled:opacity-50 sm:w-auto">
                <ButtonContent busy={phase === 'rendering'} busyLabel="Đang render..." label={actionLabel} icon={<Send className="h-4 w-4" />} />
              </button>
            </div>
          </section>

          {logs.length > 0 && (
            <section className="rounded-2xl bg-slate-950 p-4">
              <h3 className="flex items-center gap-2 text-xs font-bold text-slate-400"><Terminal className="h-4 w-4" /> Nhật ký hoạt động</h3>
              <div className="mt-2 max-h-44 space-y-1 overflow-y-auto font-mono text-[11px] leading-5 text-slate-300">
                {logs.map((line, index) => <div key={`${index}-${line}`} className="break-words">{line}</div>)}
                <div ref={logEndRef} />
              </div>
            </section>
          )}
        </div>

        <aside className="lg:col-span-4">
          <section className="rounded-3xl border border-[#0879D9]/15 bg-white p-5 lg:sticky lg:top-24 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#071827]"><History className="h-4 w-4 text-[#0879D9]" /> Lịch sử chỉnh sửa</h3>
              <span className="rounded-full bg-[#F0F9FF] px-2 py-1 text-[10px] font-bold text-[#0879D9]">{library.length} video</span>
            </div>
            <p className="mt-1 text-xs font-medium leading-5 text-slate-500">Chọn một phiên bản để xem Before/After hoặc tiếp tục chỉnh sửa.</p>
            {isLoadingLibrary ? (
              <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Đang tải lịch sử…</div>
            ) : library.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs font-medium text-slate-400">Chưa có phiên bản video nào.</div>
            ) : (
              <ol className="mt-4 max-h-[70vh] space-y-3 overflow-y-auto pr-1">
                {library.map((video, index) => {
                  const active = currentVideo?.id === video.id;
                  return (
                    <li key={video.id} className={`rounded-2xl border p-3 ${active ? 'border-[#0879D9] bg-[#F0F9FF]' : 'border-slate-200'}`}>
                      <video src={video.url} preload="metadata" muted className={`${video.aspectRatio === '9:16' ? 'aspect-[9/16] max-h-56 object-contain' : 'aspect-video object-cover'} w-full rounded-xl bg-black`} />
                      <div className="mt-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-xs font-bold text-slate-700">{video.promptVi || `Phiên bản ${library.length - index}`}</p>
                          <p className="mt-1 text-[10px] font-medium text-slate-400">{formatCreatedAt(video.createdAt)}</p>
                        </div>
                        {active && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0879D9]" />}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500">{modeLabel(video.generationMode)}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500">{video.aspectRatio}</span>
                        {video.usedAt && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700">Đã dùng</span>}
                      </div>
                      {!active && (
                        <button type="button" onClick={() => continueFromVideo(video)} className="mt-2 flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#0879D9]/25 bg-white text-[11px] font-bold text-[#0879D9]">
                          <RotateCcw className="h-3.5 w-3.5" /> Tiếp tục từ bản này
                        </button>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
};
