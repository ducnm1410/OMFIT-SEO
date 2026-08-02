import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  X
} from 'lucide-react';

export interface PublishDialogResult {
  variant: 'success' | 'error';
  title: string;
  message: string;
  postUrl?: string;
  checks?: Array<{
    label: string;
    status: 'success' | 'warning' | 'pending';
    detail: string;
  }>;
}

interface PublishResultDialogProps {
  result: PublishDialogResult | null;
  onClose: () => void;
}

export const PublishResultDialog: React.FC<PublishResultDialogProps> = ({
  result,
  onClose
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!result) return;

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus();
    };
  }, [result]);

  if (!result) return null;

  const isSuccess = result.variant === 'success';

  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-[3px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
              isSuccess
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-rose-50 text-rose-700'
            }`}>
              {isSuccess
                ? <CheckCircle2 className="h-5 w-5" />
                : <AlertTriangle className="h-5 w-5" />}
            </span>
            <div>
              <p className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${
                isSuccess ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {isSuccess ? 'Hoàn tất' : 'Cần kiểm tra'}
              </p>
              <h2 id={titleId} className="mt-0.5 text-lg font-semibold tracking-[-0.02em] text-[#17191D]">
                {result.title}
              </h2>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng thông báo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-5 sm:px-6">
          <p id={descriptionId} className="max-h-40 overflow-y-auto whitespace-pre-line pr-1 text-sm leading-6 text-slate-600">
            {result.message}
          </p>

          {result.checks && result.checks.length > 0 && (
            <ul className="mt-4 space-y-2" aria-label="Trạng thái khám phá và lập chỉ mục">
              {result.checks.map((check) => (
                <li key={check.label} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <span className={`mt-0.5 shrink-0 ${
                    check.status === 'success'
                      ? 'text-emerald-600'
                      : check.status === 'warning' ? 'text-amber-600' : 'text-sky-600'
                  }`}>
                    {check.status === 'success'
                      ? <CheckCircle2 className="h-4 w-4" />
                      : check.status === 'warning'
                        ? <AlertTriangle className="h-4 w-4" />
                        : <Clock3 className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{check.label}</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{check.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {isSuccess ? 'Đóng' : 'Quay lại chỉnh sửa'}
            </button>
            {isSuccess && result.postUrl && (
              <a
                href={result.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="gradient-bg-omfit-btn inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white"
              >
                Mở bài viết <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
};
