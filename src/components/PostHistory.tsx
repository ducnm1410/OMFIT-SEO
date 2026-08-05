import React, { useEffect, useRef, useState } from 'react';
import { Calendar, Check, Copy, Edit3, FileText, History, Trash2 } from 'lucide-react';
import type { GeneratedArticle, ActiveTab } from '../types';
import { ConfirmDialog } from './ConfirmDialog';

interface PostHistoryProps {
  articles: GeneratedArticle[];
  onSelectArticleForEdit: (article: GeneratedArticle) => void;
  onDeleteDraft: (article: GeneratedArticle) => Promise<void>;
  setActiveTab: (tab: ActiveTab) => void;
}

export const PostHistory: React.FC<PostHistoryProps> = ({
  articles,
  onSelectArticleForEdit,
  onDeleteDraft,
  setActiveTab
}) => {
  const [pendingDelete, setPendingDelete] = useState<GeneratedArticle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [copiedArticleId, setCopiedArticleId] = useState('');
  const copyResetTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (copyResetTimerRef.current) window.clearTimeout(copyResetTimerRef.current);
  }, []);

  const handleDeleteDraft = async () => {
    if (!pendingDelete || pendingDelete.status !== 'draft') return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await onDeleteDraft(pendingDelete);
      setPendingDelete(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Không thể xóa bản nháp.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyTitle = async (article: GeneratedArticle) => {
    try {
      await navigator.clipboard.writeText(article.title);
      setCopiedArticleId(article.id);
      if (copyResetTimerRef.current) window.clearTimeout(copyResetTimerRef.current);
      copyResetTimerRef.current = window.setTimeout(() => setCopiedArticleId(''), 1_800);
    } catch {
      setCopiedArticleId('');
    }
  };

  const renderTitle = (article: GeneratedArticle) => {
    const copied = copiedArticleId === article.id;
    return (
      <div className="flex min-w-0 items-start gap-2">
        <p
          className="line-clamp-2 min-w-0 flex-1 break-words text-sm font-semibold leading-5 text-[#071827]"
          title={article.title}
        >
          {article.title}
        </p>
        <button
          type="button"
          onClick={() => void handleCopyTitle(article)}
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition ${
            copied
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 bg-white text-slate-400 hover:border-[#0879D9]/40 hover:text-[#0879D9]'
          }`}
          aria-label={copied ? 'Đã sao chép tiêu đề' : 'Sao chép đầy đủ tiêu đề'}
          title={copied ? 'Đã sao chép' : 'Sao chép đầy đủ tiêu đề'}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    );
  };

  const renderActions = (article: GeneratedArticle) => (
    <div className="inline-flex items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={() => {
          onSelectArticleForEdit(article.sharedFromAnotherUser
            ? {
                ...article,
                id: crypto.randomUUID(),
                ownerId: undefined,
                sharedFromAnotherUser: false,
                status: 'draft',
                wpPostId: undefined,
                wpPostUrl: undefined,
                createdAt: new Date().toISOString(),
                updatedAt: undefined
              }
            : article);
          setActiveTab('editor');
        }}
        className="grid h-9 w-9 place-items-center rounded-lg border border-[#0879D9]/25 bg-[#F0F9FF] text-[#0879D9] transition hover:bg-[#0879D9] hover:text-white"
        aria-label={`Xem và chỉnh sửa ${article.title}`}
        title={article.sharedFromAnotherUser ? 'Sao chép vào tài khoản này để chỉnh sửa' : 'Xem và chỉnh sửa'}
      >
        <Edit3 className="h-4 w-4" />
      </button>
      {article.status === 'draft' && !article.sharedFromAnotherUser && (
        <button
          type="button"
          onClick={() => {
            setDeleteError('');
            setPendingDelete(article);
          }}
          className="grid h-9 w-9 place-items-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-600 hover:text-white"
          aria-label={`Xóa bản nháp ${article.title}`}
          title="Xóa bản nháp"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return (
    <div className="ui-page space-y-6">
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Xóa bản nháp này?"
        message={`Bản nháp “${pendingDelete?.title || ''}” sẽ bị xóa khỏi kho bài viết. Thao tác này không ảnh hưởng bài đã đăng trên WordPress.`}
        confirmLabel="Xóa bản nháp"
        isBusy={isDeleting}
        error={deleteError}
        onCancel={() => {
          if (isDeleting) return;
          setPendingDelete(null);
          setDeleteError('');
        }}
        onConfirm={() => void handleDeleteDraft()}
      />
      <div className="ui-page-header space-y-2 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-[-0.02em] text-[#17191D]">
          <History className="w-5 h-5 text-[#0879D9]" /> Lịch sử bài viết OMFIT
        </h2>
        <p className="text-xs text-slate-500 font-medium">
          Danh sách bài viết đã tạo và đăng qua WordPress trên omfit.com.vn.
        </p>
      </div>

      <div className="ui-panel space-y-4 p-4 sm:p-5">
        {articles.length === 0 ? (
          <div className="text-center py-16 bg-[#F8FAFC] rounded-2xl border border-dashed border-slate-200 space-y-3">
            <FileText className="w-12 h-12 text-[#0879D9]/30 mx-auto" />
            <p className="text-sm font-semibold text-slate-500">Chưa có lịch sử bài viết.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {articles.map((article) => (
                <article key={article.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  {renderTitle(article)}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {article.sharedFromAnotherUser && (
                      <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">
                        Lịch sử dùng chung
                      </span>
                    )}
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                      article.status === 'published'
                        ? 'border-[#0879D9]/30 bg-[#0879D9]/10 text-[#0879D9]'
                        : 'border-amber-300 bg-amber-50 text-amber-700'
                    }`}>
                      {article.status === 'published' ? 'Đã đăng' : 'Bản nháp'}
                    </span>
                    <span className="rounded-lg bg-[#F0F9FF] px-2 py-1 text-[10px] font-bold text-[#0879D9]">
                      SEO {article.seoScore}/100
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500">
                      <Calendar className="h-3 w-3" />
                      {new Date(article.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <p className="min-w-0 truncate font-mono text-[10px] font-semibold text-slate-500" title={article.focusKeyword}>
                      {article.focusKeyword}
                    </p>
                    {renderActions(article)}
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="ui-table w-full table-fixed text-left text-xs">
                <thead className="bg-[#F8FAFC] text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                  <th className="w-[34%] p-3.5 xl:w-[28%]">Tiêu đề bài viết</th>
                  <th className="hidden w-[18%] p-3.5 xl:table-cell">Từ khóa SEO</th>
                  <th className="hidden w-[8%] p-3.5 text-center xl:table-cell">Số từ</th>
                  <th className="w-[13%] p-3.5 text-center xl:w-[9%]">SEO</th>
                  <th className="hidden w-[12%] p-3.5 lg:table-cell">Ngày tạo</th>
                  <th className="w-[20%] p-3.5 xl:w-[17%]">Trạng thái</th>
                  <th className="w-[92px] p-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {articles.map((article) => (
                    <tr key={article.id} className="hover:bg-[#F0F9FF] transition">
                    <td className="p-3.5 align-top">
                      {renderTitle(article)}
                    </td>
                    <td className="hidden min-w-0 p-3.5 align-middle xl:table-cell">
                      <span className="block truncate rounded border border-[#0879D9]/20 bg-[#E0F2FE] px-2 py-1 font-mono text-[10px] font-bold text-[#0879D9]" title={article.focusKeyword}>
                        {article.focusKeyword}
                      </span>
                    </td>
                    <td className="hidden p-3.5 text-center font-medium text-slate-700 xl:table-cell">{article.wordCount}</td>
                    <td className="p-3.5 text-center align-middle font-bold text-[#0879D9]">{article.seoScore}</td>
                    <td className="hidden p-3.5 align-middle text-slate-500 lg:table-cell">
                      <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium">
                        <Calendar className="h-3.5 w-3.5 text-[#0879D9]" />
                        {new Date(article.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </td>
                    <td className="p-3.5 align-middle">
                      <span
                        className={`inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                          article.status === 'published'
                            ? 'border-[#0879D9]/30 bg-[#0879D9]/10 text-[#0879D9]'
                            : 'border-amber-300 bg-amber-50 text-amber-700'
                        }`}
                        title={article.status === 'published' ? 'Đã đăng trên omfit.com.vn' : 'Bản nháp'}
                      >
                        {article.status === 'published' ? 'Đã đăng' : 'Bản nháp'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right align-middle">
                      {renderActions(article)}
                    </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
