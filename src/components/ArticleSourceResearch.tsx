import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  Search
} from 'lucide-react';
import type { ArticleSource } from '../types';
import {
  applyApprovedArticleSources,
  getArticleSources,
  researchArticleSources
} from '../services/researchService';
import { ApiClientError } from '../services/apiClient';
import { ButtonContent } from './ButtonContent';

interface ArticleSourceResearchProps {
  articleId: string;
  title: string;
  focusKeyword: string;
  contentHtml: string;
  initialSources?: ArticleSource[];
  onSourcesChange: (sources: ArticleSource[]) => void;
  onContentApplied: (contentHtml: string, sources: ArticleSource[]) => void;
}

const statusLabels: Record<ArticleSource['status'], string> = {
  candidate: 'Chờ kiểm tra',
  verified: 'Đã xác minh URL',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
  broken: 'Liên kết lỗi'
};

const statusClasses: Record<ArticleSource['status'], string> = {
  candidate: 'bg-amber-50 text-amber-700 border-amber-200',
  verified: 'bg-sky-50 text-sky-700 border-sky-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-slate-100 text-slate-600 border-slate-200',
  broken: 'bg-rose-50 text-rose-700 border-rose-200'
};

function approvedIdsFrom(sources: ArticleSource[]) {
  return new Set(
    sources
      .filter((source) => source.approved && source.status !== 'broken')
      .map((source) => source.id)
  );
}

async function getArticleSourcesWithRetry(articleId: string) {
  const delays = [500, 1_000];
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await getArticleSources(articleId);
    } catch (error) {
      const isTransientNewArticleRace = (
        error instanceof ApiClientError
        && (error.status === 403 || error.status === 404)
        && attempt < delays.length
      );
      if (!isTransientNewArticleRace) throw error;
      await new Promise((resolve) => window.setTimeout(resolve, delays[attempt]));
    }
  }
}

export const ArticleSourceResearch: React.FC<ArticleSourceResearchProps> = ({
  articleId,
  title,
  focusKeyword,
  contentHtml,
  initialSources = [],
  onSourcesChange,
  onContentApplied
}) => {
  const [sources, setSources] = useState<ArticleSource[]>(initialSources);
  const [approvedSourceIds, setApprovedSourceIds] = useState<Set<string>>(
    () => approvedIdsFrom(initialSources)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [summary, setSummary] = useState('');
  const [searchQueries, setSearchQueries] = useState<string[]>([]);
  const [searchEntryPointHtml, setSearchEntryPointHtml] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let isCurrent = true;
    setSources(initialSources);
    setApprovedSourceIds(approvedIdsFrom(initialSources));
    setSummary('');
    setSearchQueries([]);
    setSearchEntryPointHtml('');
    setMessage('');
    setError('');
    setIsLoading(true);

    void getArticleSourcesWithRetry(articleId)
      .then((response) => {
        if (!isCurrent) return;
        const nextSources = response.sources || [];
        setSources(nextSources);
        setApprovedSourceIds(approvedIdsFrom(nextSources));
      })
      .catch((loadError) => {
        if (!isCurrent) return;
        if (initialSources.length === 0) {
          setError(loadError instanceof Error
            ? loadError.message
            : 'Không thể tải nguồn tham khảo của bài viết.');
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
    // Nguồn được tải lại khi người dùng chuyển sang bài viết khác.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);

  const approvableCount = useMemo(
    () => sources.filter((source) => source.status !== 'broken').length,
    [sources]
  );

  const handleResearch = async () => {
    setIsResearching(true);
    setError('');
    setMessage('');
    try {
      const response = await researchArticleSources({
        articleId,
        title,
        focusKeyword,
        contentHtml
      });
      const nextSources = response.sources || [];
      setSources(nextSources);
      setApprovedSourceIds(approvedIdsFrom(nextSources));
      setSummary(response.summary || '');
      setSearchQueries(response.searchQueries || []);
      setSearchEntryPointHtml(response.searchEntryPointHtml || '');
      onSourcesChange(nextSources);
      setMessage(
        response.reusedExistingSources
          ? `Google chưa trả về nguồn mới. Hệ thống đang giữ ${nextSources.length} nguồn đã tìm trước đó; bạn có thể thử lại.`
          : nextSources.length > 0
          ? `Đã tìm thấy ${nextSources.length} nguồn. Hãy mở từng nguồn để kiểm tra trước khi duyệt.`
          : 'Chưa tìm thấy nguồn phù hợp. Bạn có thể chỉnh từ khóa rồi thử lại.'
      );
    } catch (researchError) {
      setError(researchError instanceof Error
        ? researchError.message
        : 'Không thể tìm nguồn tham khảo lúc này.');
    } finally {
      setIsResearching(false);
    }
  };

  const toggleApproval = (source: ArticleSource) => {
    if (source.status === 'broken') return;
    setApprovedSourceIds((current) => {
      const next = new Set(current);
      if (next.has(source.id)) next.delete(source.id);
      else next.add(source.id);
      return next;
    });
    setMessage('');
    setError('');
  };

  const handleApply = async () => {
    setIsApplying(true);
    setError('');
    setMessage('');
    try {
      const response = await applyApprovedArticleSources({
        articleId,
        approvedSourceIds: [...approvedSourceIds],
        contentHtml
      });
      const nextSources = response.sources || [];
      setSources(nextSources);
      setApprovedSourceIds(approvedIdsFrom(nextSources));
      onSourcesChange(nextSources);
      onContentApplied(response.contentHtml, nextSources);
      setMessage(
        approvedSourceIds.size > 0
          ? `Đã áp dụng ${approvedSourceIds.size} nguồn vào nội dung và mục tài liệu tham khảo.`
          : 'Đã bỏ toàn bộ nguồn khỏi nội dung bài viết.'
      );
    } catch (applyError) {
      setError(applyError instanceof Error
        ? applyError.message
        : 'Không thể áp dụng nguồn tham khảo.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <section className="rounded-3xl border border-[#0879D9]/15 bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-[#0879D9]">
            <BookOpen className="h-5 w-5" />
            <h3 className="text-base font-medium text-[#071827]">Nguồn tham khảo cho bài viết</h3>
          </div>
          <p className="mt-1 text-sm font-normal leading-6 text-slate-600">
            Hệ thống tìm nguồn công khai theo nội dung bài viết. Nguồn chỉ được chèn sau khi bạn mở,
            kiểm tra và đánh dấu duyệt.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleResearch()}
          disabled={isResearching || isApplying || !title.trim()}
          aria-busy={isResearching}
          className="ui-action-button inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#0879D9]/30 bg-[#F0F9FF] px-4 text-sm font-medium text-[#075EA8] transition hover:bg-[#E0F2FE] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:max-w-60"
        >
          <ButtonContent
            busy={isResearching}
            busyLabel="Đang tìm nguồn..."
            label="Tìm nguồn có kiểm chứng"
            icon={<Search className="h-4 w-4" />}
          />
        </button>
      </div>

      {summary && (
        <details className="mt-4 rounded-xl border border-sky-100 bg-sky-50/60 p-3">
          <summary className="cursor-pointer text-sm font-normal text-slate-700">
            Xem nhận định cần kiểm chứng
          </summary>
          <p className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap pr-2 text-sm font-normal leading-6 text-slate-700">
            {summary}
          </p>
        </details>
      )}

      {searchQueries.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Các truy vấn đã dùng">
          {searchQueries.map((query) => (
            <span
              key={query}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-normal text-slate-600"
            >
              {query}
            </span>
          ))}
        </div>
      )}

      {searchEntryPointHtml && (
        <iframe
          title="Gợi ý tìm kiếm của Google"
          srcDoc={searchEntryPointHtml}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          className="mt-3 h-16 w-full rounded-xl border-0 bg-white"
        />
      )}

      {error && (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-normal text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void handleResearch()}
              disabled={isResearching || isApplying || !title.trim()}
              aria-busy={isResearching}
              className="ui-action-button inline-flex min-h-9 max-w-40 items-center justify-center gap-2 self-start rounded-lg border border-rose-300 bg-white px-3 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
            >
              <ButtonContent
                busy={isResearching}
                busyLabel="Đang thử lại..."
                label="Thử lại"
                icon={<Search className="h-3.5 w-3.5" />}
              />
            </button>
          </div>
        </div>
      )}
      {message && (
        <div aria-live="polite" className="mt-4 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-normal text-sky-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {isLoading && sources.length === 0 && (
          <div className="flex min-h-24 items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-[#F8FAFC] text-sm font-normal text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Đang tải nguồn tham khảo...
          </div>
        )}
        {!isLoading && sources.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-[#F8FAFC] p-5 text-center text-sm font-normal leading-6 text-slate-500">
            Chưa có nguồn tham khảo. Nhấn “Tìm nguồn có kiểm chứng” để hệ thống đề xuất nguồn phù hợp.
          </div>
        )}
        {sources.map((source) => {
          const checked = approvedSourceIds.has(source.id);
          const href = source.url;
          return (
            <article key={source.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={source.status === 'broken' || isApplying}
                  onChange={() => toggleApproval(source)}
                  aria-label={`Duyệt nguồn ${source.title || source.domain}`}
                  className="mt-1 h-5 w-5 shrink-0 accent-[#0879D9] disabled:cursor-not-allowed disabled:opacity-50"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-w-0 items-center gap-1.5 break-words text-sm font-medium leading-6 text-[#075EA8] hover:underline"
                    >
                      <span>{source.title || source.domain || 'Nguồn chưa có tiêu đề'}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-normal ${statusClasses[source.status]}`}>
                      {statusLabels[source.status]}
                    </span>
                  </div>
                  <p className="mt-1 break-all text-xs font-normal text-slate-500">
                    {source.publisher || source.domain || href}
                  </p>
                  {source.claimText && (
                    <details className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
                      <summary className="cursor-pointer text-xs font-normal text-slate-600">
                        Xem nhận định liên quan
                      </summary>
                      <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap pr-2 text-sm font-normal leading-6 text-slate-700">
                        {source.claimText}
                      </p>
                    </details>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {sources.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-normal leading-5 text-slate-500">
            Đã chọn {approvedSourceIds.size}/{approvableCount} nguồn hợp lệ. Thao tác áp dụng sẽ lưu
            chính xác danh sách đang chọn.
          </p>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={isApplying || isResearching}
            aria-busy={isApplying}
            className="ui-action-button inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0879D9] px-4 text-sm font-medium text-white transition hover:bg-[#075EA8] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:max-w-60"
          >
            <ButtonContent
              busy={isApplying}
              busyLabel="Đang áp dụng..."
              label="Áp dụng nguồn đã duyệt"
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
          </button>
        </div>
      )}
    </section>
  );
};
