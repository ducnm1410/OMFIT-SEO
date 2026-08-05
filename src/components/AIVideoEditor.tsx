import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Film,
  History,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  Terminal,
  Upload,
  Wand2,
  X
} from 'lucide-react';
import type { GeneratedVideo } from '../types';
import {
  generateVideoEdit,
  loadVideoLibrary,
  prepareSourceVideo,
  type PreparedSourceVideo
} from '../services/videoEditorService';
import { ButtonContent } from './ButtonContent';

const EXAMPLE_PROMPTS = [
  'Chuyển video sang phong cách điện ảnh cao cấp',
  'Đổi ánh sáng thành hoàng hôn, giữ nguyên mọi thứ khác',
  'Thêm hiệu ứng mưa nhẹ, giữ nguyên chủ thể',
  'Làm chuyển động máy quay mượt và tự nhiên hơn',
  'Thêm nhạc nền thư giãn, không có hội thoại'
];

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

export const AIVideoEditor: React.FC = () => {
  const [source, setSource] = useState<PreparedSourceVideo | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [promptVi, setPromptVi] = useState('');
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [library, setLibrary] = useState<GeneratedVideo[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [currentVideo, setCurrentVideo] = useState<GeneratedVideo | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const sourcePreviewRef = useRef<string | null>(null);
  const working = phase === 'uploading' || phase === 'rendering';

  const addLog = (message: string) => {
    setLogs((previous) => [
      ...previous,
      `[${new Date().toLocaleTimeString('vi-VN')}] ${message}`
    ]);
  };

  useEffect(() => {
    void loadVideoLibrary()
      .then(setLibrary)
      .catch((loadError) => setError(
        loadError instanceof Error ? loadError.message : 'Không thể tải lịch sử video.'
      ))
      .finally(() => setIsLoadingLibrary(false));
  }, []);

  useEffect(() => {
    if (!working) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [working]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [logs]);

  useEffect(() => () => {
    if (sourcePreviewRef.current) URL.revokeObjectURL(sourcePreviewRef.current);
  }, []);

  const setPreviewUrl = (value: string | null) => {
    if (sourcePreviewRef.current) URL.revokeObjectURL(sourcePreviewRef.current);
    sourcePreviewRef.current = value;
    setSourcePreview(value);
  };

  const handleFile = async (file: File) => {
    setError('');
    setCurrentVideo(null);
    setSource(null);
    setElapsed(0);
    setPreviewUrl(URL.createObjectURL(file));
    setPhase('uploading');
    addLog(`Đang tải video nguồn ${(file.size / 1048576).toFixed(1)} MB vào kho riêng tư…`);
    try {
      const prepared = await prepareSourceVideo(file);
      setSource(prepared);
      setPhase('ready');
      addLog('Video nguồn đã sẵn sàng. Bạn có thể nhập yêu cầu chỉnh sửa đầu tiên.');
    } catch (uploadError) {
      setPhase('error');
      const message = uploadError instanceof Error ? uploadError.message : 'Không thể chuẩn bị video nguồn.';
      setError(message);
      addLog(`Lỗi chuẩn bị video: ${message}`);
    }
  };

  const handleApply = async () => {
    if (!source && !currentVideo) {
      setError('Hãy tải video nguồn hoặc chọn một video trong lịch sử.');
      return;
    }
    if (promptVi.trim().length < 2) {
      setError('Hãy nhập yêu cầu chỉnh sửa video.');
      return;
    }
    setError('');
    setElapsed(0);
    setPhase('rendering');
    const submittedPrompt = promptVi.trim();
    addLog(`Đã gửi yêu cầu “${submittedPrompt}”. Gemini đang render background…`);
    try {
      const video = await generateVideoEdit({
        promptVi: submittedPrompt,
        resolution,
        sourceTicket: currentVideo ? undefined : source?.ticket,
        previousAssetId: currentVideo?.id
      });
      setLibrary((previous) => mergeVideos([video], previous));
      setCurrentVideo(video);
      setPromptVi('');
      setPhase('ready');
      addLog('Hoàn tất và đã lưu video vào Supabase CDN.');
    } catch (generationError) {
      setPhase('error');
      const message = generationError instanceof Error ? generationError.message : 'Không thể chỉnh sửa video.';
      setError(message);
      addLog(`Lỗi render: ${message}`);
    }
  };

  const continueFromVideo = (video: GeneratedVideo) => {
    setCurrentVideo(video);
    setSource(null);
    setPreviewUrl(null);
    setPhase('ready');
    setError('');
    addLog(`Đã chọn “${video.fileName}”. Lượt sửa tiếp theo sẽ tạo một nhánh từ phiên bản này.`);
  };

  const resetSession = () => {
    setSource(null);
    setPreviewUrl(null);
    setCurrentVideo(null);
    setPromptVi('');
    setError('');
    setLogs([]);
    setElapsed(0);
    setPhase('idle');
  };

  const canEdit = Boolean(source || currentVideo);

  return (
    <div className="ui-page space-y-6">
      <header className="ui-page-header p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold tracking-[-0.02em] text-[#17191D]">
              <Wand2 className="h-5 w-5 text-[#0879D9]" /> AI Video Editor
            </h2>
          </div>
          <span className="flex w-fit items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
            <Sparkles className="h-3.5 w-3.5" /> Gemini Omni
          </span>
        </div>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium leading-5 text-amber-800">
          Câu lệnh ngắn gọn cho kết quả tốt nhất. Mỗi lượt sửa kế thừa phiên bản đang chọn; chỉnh sửa giọng nói hiện chưa được hỗ trợ.
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

      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = '';
        }}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          {!sourcePreview && !currentVideo ? (
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
              className="flex min-h-72 w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-[#0879D9]/35 bg-[#F0F9FF] p-8 text-center transition hover:border-[#0879D9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0879D9] disabled:opacity-50"
            >
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-[#0879D9] shadow-sm">
                <Upload className="h-7 w-7" />
              </span>
              <span className="text-base font-extrabold text-[#071827]">Kéo-thả hoặc bấm để tải video</span>
              <span className="text-xs font-medium text-slate-500">MP4, MOV hoặc WEBM · tối đa 100 MB</span>
            </button>
          ) : (
            <section className="space-y-4 rounded-3xl border border-[#0879D9]/15 bg-white p-5 sm:p-6">
              {sourcePreview && (
                <div>
                  <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">Video nguồn</p>
                  <div className="relative overflow-hidden rounded-2xl bg-black">
                    <video src={sourcePreview} controls className="max-h-[360px] w-full bg-black object-contain" />
                    {phase === 'uploading' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/65 text-white">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <span className="text-sm font-bold">Đang tải và xử lý video… {formatElapsed(elapsed)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {currentVideo && (
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> Phiên bản đang chọn
                    </p>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{currentVideo.resolution}</span>
                  </div>
                  <div className="overflow-hidden rounded-2xl bg-black ring-2 ring-emerald-400">
                    <video key={currentVideo.url} src={currentVideo.url} controls autoPlay muted className="max-h-[420px] w-full bg-black object-contain" />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <a href={currentVideo.url} target="_blank" rel="noreferrer" download className="flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white">
                      <Download className="h-4 w-4" /> Tải video
                    </a>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-500" title={currentVideo.fileName}>{currentVideo.fileName}</span>
                  </div>
                </div>
              )}

              {phase === 'rendering' && (
                <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 text-violet-800">
                  <Loader2 className="h-6 w-6 shrink-0 animate-spin" />
                  <div>
                    <p className="text-sm font-bold">Gemini đang render video background</p>
                    <p className="mt-0.5 text-xs font-medium">Đã trôi qua {formatElapsed(elapsed)} · có thể mất vài phút</p>
                  </div>
                </div>
              )}

              <button type="button" onClick={resetSession} disabled={working} className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600 disabled:opacity-50">
                <X className="h-4 w-4" /> Chọn video khác
              </button>
            </section>
          )}

          {canEdit && (
            <section className="rounded-3xl border border-[#0879D9]/15 bg-white p-5 sm:p-6">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700" htmlFor="video-edit-prompt">
                <Sparkles className="h-4 w-4 text-[#0879D9]" />
                {currentVideo ? 'Sửa tiếp từ phiên bản đang chọn' : 'Yêu cầu chỉnh sửa đầu tiên'}
              </label>
              <textarea
                id="video-edit-prompt"
                rows={3}
                value={promptVi}
                onChange={(event) => setPromptVi(event.target.value)}
                disabled={working}
                placeholder="Ví dụ: Đổi ánh sáng thành hoàng hôn, giữ nguyên chủ thể và bố cục…"
                className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm font-medium leading-6 text-[#071827] outline-none focus:border-[#0879D9] focus:ring-2 focus:ring-[#0879D9]/10 disabled:opacity-60"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((example) => (
                  <button key={example} type="button" onClick={() => setPromptVi(example)} disabled={working} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-[#0879D9]/40 disabled:opacity-50">
                    {example}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <fieldset disabled={working || Boolean(currentVideo)}>
                  <legend className="text-xs font-bold text-slate-600">Chất lượng đọc video nguồn</legend>
                  <div className="mt-2 inline-flex overflow-hidden rounded-xl border border-slate-200">
                    {(['720p', '1080p'] as const).map((option) => (
                      <button key={option} type="button" aria-pressed={resolution === option} onClick={() => setResolution(option)} className={`min-h-9 px-4 text-xs font-bold ${resolution === option ? 'bg-[#0879D9] text-white' : 'bg-white text-slate-600'}`}>
                        {option}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <button type="button" onClick={() => void handleApply()} disabled={working || promptVi.trim().length < 2} aria-busy={phase === 'rendering'} className="ui-action-button gradient-bg-omfit-btn flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white disabled:opacity-50">
                  <ButtonContent busy={phase === 'rendering'} busyLabel="Đang render..." label="Áp dụng chỉnh sửa" icon={<Send className="h-4 w-4" />} />
                </button>
              </div>
            </section>
          )}

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
            <p className="mt-1 text-xs font-medium leading-5 text-slate-500">Chọn một phiên bản để xem hoặc tiếp tục chỉnh sửa từ đó.</p>
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
                      <video src={video.url} preload="metadata" muted className="aspect-video w-full rounded-xl bg-black object-cover" />
                      <div className="mt-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-xs font-bold text-slate-700">{video.promptVi || `Phiên bản ${library.length - index}`}</p>
                          <p className="mt-1 text-[10px] font-medium text-slate-400">{formatCreatedAt(video.createdAt)}</p>
                        </div>
                        {active && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0879D9]" />}
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
