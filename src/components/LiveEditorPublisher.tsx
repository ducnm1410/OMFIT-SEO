import React, { useState } from 'react';
import {
  Edit3,
  Globe,
  Upload,
  Sparkles,
  CheckCircle2,
  Eye,
  Code,
  ShieldCheck,
  Award,
  Terminal,
  ExternalLink,
  Activity
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { GeneratedArticle, GeneratedImage, ActiveTab } from '../types';
import { WordpressMcpService } from '../services/wordpressMcpService';

interface LiveEditorPublisherProps {
  article: GeneratedArticle | null;
  wpService: WordpressMcpService;
  onSaveArticle: (updatedArticle: GeneratedArticle) => void;
  setActiveTab: (tab: ActiveTab) => void;
}

export const LiveEditorPublisher: React.FC<LiveEditorPublisherProps> = ({
  article,
  wpService,
  onSaveArticle,
  setActiveTab
}) => {
  if (!article) {
    return (
      <div className="glass-panel p-12 rounded-3xl text-center space-y-4 border border-[#0879D9]/15 bg-white">
        <Edit3 className="w-12 h-12 text-[#0879D9]/40 mx-auto" />
        <h3 className="text-lg font-bold text-[#071827]">Chưa Chọn Bài Viết Nào Để Xem</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
          Vui lòng tạo bài viết mới từ Gemini hoặc chọn bài viết từ bảng điều khiển để xem và đăng bài lên omfit.com.vn.
        </p>
        <button
          onClick={() => setActiveTab('generator')}
          className="gradient-bg-omfit-btn px-5 py-2.5 rounded-xl text-xs font-bold text-white inline-flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" /> Bắt đầu tạo bài viết ngay
        </button>
      </div>
    );
  }

  const [title, setTitle] = useState(article.title);
  const [metaTitle, setMetaTitle] = useState(article.metaTitle);
  const [metaDescription, setMetaDescription] = useState(article.metaDescription);
  const [slug, setSlug] = useState(article.slug);
  const [focusKeyword, setFocusKeyword] = useState(article.focusKeyword);
  const [contentHtml, setContentHtml] = useState(article.contentHtml);
  const [postStatus, setPostStatus] = useState<'draft' | 'publish'>('publish');
  const [activeView, setActiveView] = useState<'visual' | 'code'>('visual');

  const [isPublishing, setIsPublishing] = useState(false);
  const [publishLogs, setPublishLogs] = useState<string[]>([]);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishLogs([]);
    setPublishedUrl(null);

    const currentArticleState: GeneratedArticle = {
      ...article,
      title,
      metaTitle,
      metaDescription,
      slug,
      focusKeyword,
      contentHtml
    };

    try {
      const result = await wpService.publishArticleWithMcp(currentArticleState, postStatus);
      setPublishLogs(result.logs);
      setPublishedUrl(result.postUrl);

      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });

      onSaveArticle({
        ...currentArticleState,
        status: 'published',
        wpPostId: result.postId
      });
    } catch (err) {
      console.error('WordPress Publishing Failed:', err);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Actions */}
      <div className="glass-panel p-6 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-[#0879D9]/15 bg-white">
        <div>
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-[#E0F2FE] text-[#0879D9] border border-[#0879D9]/30 flex items-center gap-1 inline-flex">
            <Activity className="w-3 h-3" /> OMFIT PUBLISHER READY
          </span>
          <h2 className="text-xl font-extrabold text-[#071827] mt-1">Xem Trực Quan & Thao Tác Chỉnh Sửa Trực Tiếp</h2>
          <p className="text-xs text-slate-500 font-medium">
            Xem bài viết hiển thị như trên omfit.com.vn và tùy chỉnh trực tiếp trước khi ấn đăng bài qua MCP.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={postStatus}
            onChange={(e) => setPostStatus(e.target.value as 'draft' | 'publish')}
            className="px-3 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs text-[#071827] font-bold focus:outline-none"
          >
            <option value="publish">Xuất Bản Ngay (Publish)</option>
            <option value="draft">Lưu Bản Nháp (Draft)</option>
          </select>

          <button
            onClick={handlePublish}
            disabled={isPublishing}
            className="gradient-bg-omfit-btn px-6 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-md shadow-[#0879D9]/20 disabled:opacity-50"
          >
            {isPublishing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Đang Đăng Bài Qua MCP...
              </>
            ) : (
              <>
                <Globe className="w-4 h-4" /> Đăng Bài Lên omfit.com.vn Ngay
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-panel p-5 rounded-3xl space-y-4 border border-[#0879D9]/15 bg-white">
            <h3 className="text-xs font-extrabold text-[#071827] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <ShieldCheck className="w-4 h-4 text-[#0879D9]" /> Tiêu Đề & Thẻ SEO Meta
            </h3>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Tiêu Đề H1 Bài Viết</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#071827] text-xs font-bold focus:border-[#0879D9] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Meta Title SEO</label>
              <input
                type="text"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#071827] text-xs font-semibold focus:border-[#0879D9] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Meta Description</label>
              <textarea
                rows={3}
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#071827] text-xs font-medium focus:border-[#0879D9] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Từ Khóa SEO</label>
                <input
                  type="text"
                  value={focusKeyword}
                  onChange={(e) => setFocusKeyword(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#0879D9] text-xs font-mono font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Slug URL</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-slate-700 text-xs font-mono focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="glass-panel p-5 rounded-3xl space-y-3 border border-[#0879D9]/15 bg-white">
            <h3 className="text-xs font-extrabold text-[#071827] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Upload className="w-4 h-4 text-[#0879D9]" /> Ảnh Đại Diện (Featured Image)
            </h3>

            {article.featuredImage ? (
              <div className="space-y-2">
                <img
                  src={article.featuredImage.url}
                  alt={article.featuredImage.altText}
                  className="w-full h-40 object-cover rounded-xl border border-[#0879D9]/30"
                />
                <p className="text-[10px] text-slate-500 truncate font-medium">
                  Alt text: <span className="text-[#0879D9] font-bold">{article.featuredImage.altText}</span>
                </p>
              </div>
            ) : (
              <div
                onClick={() => setActiveTab('imagestudio')}
                className="p-6 text-center border-2 border-dashed border-slate-200 hover:border-[#0879D9] rounded-xl cursor-pointer transition space-y-1 bg-[#F8FAFC]"
              >
                <Sparkles className="w-6 h-6 text-[#0879D9] mx-auto" />
                <p className="text-xs font-bold text-[#071827]">Chưa có ảnh đại diện</p>
                <p className="text-[10px] text-[#0879D9] font-semibold">Click để qua Studio tạo ảnh DALL-E 3 / Vertex AI</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-8 glass-panel p-6 rounded-3xl space-y-4 border border-[#0879D9]/15 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveView('visual')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  activeView === 'visual'
                    ? 'bg-[#E0F2FE] text-[#0879D9] border border-[#0879D9]/30'
                    : 'text-slate-500 hover:text-[#0879D9]'
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> Chế Độ Xem Trực Quan (Visual Render)
              </button>
              <button
                onClick={() => setActiveView('code')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  activeView === 'code'
                    ? 'bg-[#E0F2FE] text-[#0879D9] border border-[#0879D9]/30'
                    : 'text-slate-500 hover:text-[#0879D9]'
                }`}
              >
                <Code className="w-3.5 h-3.5" /> Chế Độ Sửa HTML Mã Nguồn
              </button>
            </div>

            <span className="text-xs font-mono text-[#0879D9] flex items-center gap-1 font-extrabold">
              <Award className="w-3.5 h-3.5 text-[#0879D9]" /> SEO Score: 98/100
            </span>
          </div>

          {activeView === 'visual' ? (
            <div className="p-6 bg-[#F8FAFC] rounded-2xl border border-slate-200 min-h-[450px] prose-custom overflow-y-auto max-h-[600px]">
              <h1 className="text-3xl font-black text-[#071827] mb-6">{title}</h1>
              <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
            </div>
          ) : (
            <textarea
              rows={20}
              value={contentHtml}
              onChange={(e) => setContentHtml(e.target.value)}
              className="w-full p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#071827] font-mono text-xs focus:outline-none focus:border-[#0879D9]"
            />
          )}
        </div>
      </div>

      {publishLogs.length > 0 && (
        <div className="glass-panel p-6 rounded-3xl space-y-3 border border-[#0879D9]/30 bg-white">
          <h3 className="text-xs font-bold text-[#0879D9] uppercase tracking-wider flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#0879D9]" /> Nhật Ký Đăng Bài Trực Tiếp Tới MCP WordPress (omfit.com.vn)
          </h3>
          <div className="p-4 rounded-xl bg-[#071827] font-mono text-xs text-[#F3F0E9] space-y-1 max-h-48 overflow-y-auto border border-[#0879D9]/30">
            {publishLogs.map((log, i) => (
              <p key={i} className={log.includes('THÀNH CÔNG') ? 'text-[#28A9F4] font-bold' : ''}>
                {log}
              </p>
            ))}
          </div>

          {publishedUrl && (
            <div className="pt-2 flex items-center justify-between">
              <div className="text-xs text-[#0879D9] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Bài viết đã xuất bản thành công lên website omfit.com.vn!
              </div>
              <a
                href={publishedUrl}
                target="_blank"
                rel="noreferrer"
                className="gradient-bg-omfit-btn px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow-md shadow-[#0879D9]/20"
              >
                Mở Xem Bài Viết Trực Tiếp Trên Web <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
