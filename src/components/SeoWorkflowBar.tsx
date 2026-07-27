import React from 'react';
import {
  Check,
  Circle,
  Cloud,
  CloudOff,
  FileSearch,
  Image as ImageIcon,
  LoaderCircle,
  Search,
  ShieldCheck
} from 'lucide-react';
import type {
  ContentBrief,
  GeneratedArticle,
  SeoWorkflowStep,
  WorkflowSaveStatus
} from '../types';

interface SeoWorkflowBarProps {
  activeStep: SeoWorkflowStep;
  brief: ContentBrief;
  article: GeneratedArticle | null;
  saveStatus: WorkflowSaveStatus;
  lastSavedAt: string;
  onStepChange: (step: SeoWorkflowStep) => void;
}

const workflowSteps = [
  {
    id: 1 as const,
    label: 'Content brief',
    shortLabel: 'Brief',
    description: 'Keyword và mục tiêu',
    icon: Search
  },
  {
    id: 2 as const,
    label: 'Bằng chứng & dàn ý',
    shortLabel: 'Dàn ý',
    description: 'Cấu trúc nội dung',
    icon: FileSearch
  },
  {
    id: 3 as const,
    label: 'Nội dung & hình ảnh',
    shortLabel: 'Nội dung',
    description: 'Biên tập bản thảo',
    icon: ImageIcon
  },
  {
    id: 4 as const,
    label: 'Kiểm duyệt & xuất bản',
    shortLabel: 'Xuất bản',
    description: 'Quality gate',
    icon: ShieldCheck
  }
];

function formatSavedTime(value: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export const SeoWorkflowBar: React.FC<SeoWorkflowBarProps> = ({
  activeStep,
  brief,
  article,
  saveStatus,
  lastSavedAt,
  onStepChange
}) => {
  const hasBrief = Boolean(
    brief.keyword.trim()
    && brief.audience.trim()
    && brief.conversionGoal.trim()
  );
  const hasDraft = Boolean(article?.contentHtml.trim());
  const hasMedia = Boolean(
    article?.featuredImage
    && (article.articleImages.length > 0 || /<img\b/i.test(article.contentHtml))
  );
  const isPublished = article?.status === 'published';
  const completionByStep: Record<SeoWorkflowStep, boolean> = {
    1: hasBrief,
    2: hasDraft,
    3: hasDraft && hasMedia,
    4: isPublished
  };
  const completedCount = Object.values(completionByStep).filter(Boolean).length;
  const savedTime = formatSavedTime(lastSavedAt);

  const saveLabel = saveStatus === 'saving'
    ? 'Đang lưu thay đổi'
    : saveStatus === 'error'
      ? 'Lưu chưa thành công'
      : saveStatus === 'saved'
        ? `Đã lưu${savedTime ? ` lúc ${savedTime}` : ''}`
        : 'Tự động lưu khi có thay đổi';

  return (
    <section
      aria-label="Tiến độ quy trình SEO"
      className="ui-panel overflow-hidden border-[#0879D9]/15 bg-white"
    >
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#0879D9]">
              Quy trình SEO
            </p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              {completedCount}/4 hoàn tất
            </span>
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-[#17191D]">
            {article?.title || brief.keyword || 'Bắt đầu từ content brief mới'}
          </p>
        </div>

        <div
          aria-live="polite"
          className={`inline-flex min-h-9 shrink-0 items-center gap-2 self-start rounded-lg border px-3 text-xs font-medium sm:self-auto ${
            saveStatus === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-slate-200 bg-slate-50 text-slate-600'
          }`}
        >
          {saveStatus === 'saving' && <LoaderCircle className="h-3.5 w-3.5 animate-spin text-[#0879D9]" />}
          {saveStatus === 'error' && <CloudOff className="h-3.5 w-3.5" />}
          {(saveStatus === 'saved' || saveStatus === 'idle') && <Cloud className="h-3.5 w-3.5 text-emerald-600" />}
          {saveLabel}
        </div>
      </div>

      <div className="overflow-x-auto px-3 py-3 sm:px-4">
        <ol className="grid min-w-[680px] grid-cols-4 gap-2" aria-label="Bốn bước làm bài SEO">
          {workflowSteps.map((step) => {
            const Icon = step.icon;
            const isActive = activeStep === step.id;
            const isComplete = completionByStep[step.id];
            return (
              <li key={step.id}>
                <button
                  type="button"
                  aria-current={isActive ? 'step' : undefined}
                  onClick={() => onStepChange(step.id)}
                  className={`group flex min-h-[72px] w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                    isActive
                      ? 'border-[#0879D9]/35 bg-[#F0F9FF] shadow-sm'
                      : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                    isComplete
                      ? 'bg-emerald-100 text-emerald-700'
                      : isActive
                        ? 'bg-[#0879D9] text-white'
                        : 'bg-slate-100 text-slate-400 group-hover:text-slate-600'
                  }`}>
                    {isComplete
                      ? <Check className="h-4 w-4" />
                      : isActive
                        ? <Icon className="h-4 w-4" />
                        : <Circle className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-[10px] font-semibold uppercase tracking-[0.06em] ${
                      isActive ? 'text-[#0879D9]' : 'text-slate-400'
                    }`}>
                      Bước {step.id}
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-semibold text-[#17191D]">
                      <span className="sm:hidden">{step.shortLabel}</span>
                      <span className="hidden sm:inline">{step.label}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                      {isComplete ? 'Đã hoàn tất' : step.description}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
};
