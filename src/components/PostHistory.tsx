import React, { useState } from 'react';
import { History, FileText, Calendar, Edit3, Trash2 } from 'lucide-react';
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
          <div className="overflow-x-auto">
            <table className="ui-table w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Tiêu đề bài viết</th>
                  <th className="p-3.5">Từ khóa SEO</th>
                  <th className="p-3.5">Số từ</th>
                  <th className="p-3.5">SEO Score</th>
                  <th className="p-3.5">Ngày tạo</th>
                  <th className="p-3.5">Trạng thái</th>
                  <th className="p-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {articles.map((article) => (
                  <tr key={article.id} className="hover:bg-[#F0F9FF] transition">
                    <td className="p-3.5 font-semibold text-[#071827] max-w-sm truncate">
                      {article.title}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded bg-[#E0F2FE] text-[#0879D9] font-mono text-[11px] border border-[#0879D9]/20 font-bold">
                        {article.focusKeyword}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-700 font-medium">{article.wordCount} từ</td>
                    <td className="p-3.5 font-bold text-[#0879D9]">{article.seoScore}/100</td>
                    <td className="p-3.5 text-slate-500 flex items-center gap-1 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-[#0879D9]" />
                      {new Date(article.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          article.status === 'published'
                            ? 'bg-[#0879D9]/15 text-[#0879D9] border border-[#0879D9]/30'
                            : 'bg-amber-100 text-amber-700 border border-amber-300'
                        }`}
                      >
                        {article.status === 'published' ? 'Đã đăng trên omfit.com.vn' : 'Bản nháp'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectArticleForEdit(article);
                            setActiveTab('editor');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#F0F9FF] text-[#0879D9] border border-[#0879D9]/30 hover:bg-[#0879D9] hover:text-white transition font-bold text-[11px] inline-flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Xem lại
                        </button>
                        {article.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError('');
                              setPendingDelete(article);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-700 transition hover:bg-rose-600 hover:text-white"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Xóa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
