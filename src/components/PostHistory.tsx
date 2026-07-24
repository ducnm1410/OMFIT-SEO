import React from 'react';
import { History, FileText, Calendar, Edit3, Crown } from 'lucide-react';
import type { GeneratedArticle, ActiveTab } from '../types';

interface PostHistoryProps {
  articles: GeneratedArticle[];
  onSelectArticleForEdit: (article: GeneratedArticle) => void;
  setActiveTab: (tab: ActiveTab) => void;
}

export const PostHistory: React.FC<PostHistoryProps> = ({
  articles,
  onSelectArticleForEdit,
  setActiveTab
}) => {
  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-2xl space-y-2 border border-[#2a2822]">
        <h2 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
          <History className="w-5 h-5 text-[#c5a059]" /> Lịch Sử Bài Viết OM FIT Đã Tạo & Xuất Bản
        </h2>
        <p className="text-xs text-slate-400">
          Danh sách bài viết được sinh bởi AI Gemini & đăng bài qua MCP WordPress Server (omfit.com.vn).
        </p>
      </div>

      <div className="glass-panel p-6 rounded-2xl space-y-4 border border-[#2a2822]">
        {articles.length === 0 ? (
          <div className="text-center py-16 bg-[#101014] rounded-xl border border-dashed border-[#2a2822] space-y-3">
            <FileText className="w-12 h-12 text-[#c5a059]/40 mx-auto" />
            <p className="text-sm font-medium text-slate-400">Chưa có lịch sử bài viết.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#18181e] text-slate-400 font-semibold border-b border-[#2a2822]">
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
              <tbody className="divide-y divide-[#2a2822]">
                {articles.map((article) => (
                  <tr key={article.id} className="hover:bg-[#18181e]/60 transition">
                    <td className="p-3.5 font-semibold text-slate-100 max-w-sm truncate">
                      {article.title}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded bg-[#c5a059]/15 text-[#e6c687] font-mono text-[11px] border border-[#c5a059]/30">
                        {article.focusKeyword}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-300 font-medium">{article.wordCount} từ</td>
                    <td className="p-3.5 font-bold text-[#e6c687]">{article.seoScore}/100</td>
                    <td className="p-3.5 text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[#c5a059]" />
                      {new Date(article.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          article.status === 'published'
                            ? 'bg-[#c5a059]/20 text-[#e6c687] border border-[#c5a059]/40'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {article.status === 'published' ? '✓ Published (omfit.com.vn)' : 'Draft'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => {
                          onSelectArticleForEdit(article);
                          setActiveTab('editor');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#18181e] text-[#e6c687] border border-[#c5a059]/30 hover:bg-[#c5a059]/20 transition font-semibold text-[11px] inline-flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Xem lại
                      </button>
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
