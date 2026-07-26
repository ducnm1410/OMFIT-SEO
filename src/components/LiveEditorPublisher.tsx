import React, { useState, useRef } from 'react';
import {
  Edit3,
  Globe,
  Upload,
  FilePenLine,
  CheckCircle2,
  Eye,
  Code,
  ShieldCheck,
  Award,
  Terminal,
  ExternalLink,
  Activity,
  Trash2,
  RefreshCw,
  PlusCircle,
  Tag,
  ImageIcon
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
          Vui lòng tạo bài viết mới hoặc chọn bài viết từ bảng điều khiển để xem và đăng lên omfit.com.vn.
        </p>
        <button
          onClick={() => setActiveTab('generator')}
          className="gradient-bg-omfit-btn px-5 py-2.5 rounded-xl text-xs font-bold text-white inline-flex items-center gap-2"
        >
          <FilePenLine className="w-4 h-4" /> Bắt đầu tạo bài viết
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

  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyImageInputRef = useRef<HTMLInputElement>(null);

  // Handle direct file upload for Featured Image from local device
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const fileBase64 = reader.result as string;
        const cleanFileName = (file.name || `${slug}-featured-${Date.now()}`)
          .toLowerCase()
          .replace(/[^a-z0-9.]/g, '-');

        const newImage: GeneratedImage = {
          id: 'img-upload-' + Date.now(),
          url: fileBase64,
          prompt: `Ảnh tự tải lên cho bài viết: ${title}`,
          altText: article.title || 'Ảnh đại diện OMFIT',
          fileName: cleanFileName,
          style: 'Direct Upload',
          source: 'upload'
        };

        const updatedArticle = {
          ...article,
          featuredImage: newImage
        };
        onSaveArticle(updatedArticle);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle uploading an image directly into body content
  const handleBodyImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const fileBase64 = reader.result as string;
        const altText = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        const imgHtml = `\n<figure class="my-6 text-center">\n  <img src="${fileBase64}" alt="${altText}" class="w-full rounded-2xl border border-slate-200 shadow-sm mx-auto my-4 object-cover" />\n  <figcaption class="text-xs text-slate-500 italic mt-2">${altText}</figcaption>\n</figure>\n`;
        setContentHtml((prev) => prev + imgHtml);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAltTextChange = (newAlt: string) => {
    if (article.featuredImage) {
      const updatedArticle = {
        ...article,
        featuredImage: {
          ...article.featuredImage,
          altText: newAlt
        }
      };
      onSaveArticle(updatedArticle);
    }
  };

  const handleRemoveImage = () => {
    const updatedArticle = {
      ...article,
      featuredImage: undefined
    };
    onSaveArticle(updatedArticle);
  };

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
      
      window.alert('🎉 Đăng bài thành công lên website omfit.com.vn!');
    } catch (err: any) {
      console.error('WordPress Publishing Failed:', err);
      window.alert('❌ Đăng bài thất bại:\n' + err.message);
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
                <Globe className="w-4 h-4" /> Đăng Bài
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          {/* Featured Image Management Panel */}
          <div className="glass-panel p-5 rounded-3xl space-y-4 border border-[#0879D9]/15 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <h3 className="text-xs font-extrabold text-[#071827] uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-[#0879D9]" /> Ảnh Đại Diện (Featured Image)
              </h3>
              {article.featuredImage && (
                <span className="text-[9px] font-extrabold px-2 py-0.5 rounded bg-[#E0F2FE] text-[#0879D9]">
                  {article.featuredImage.source === 'upload'
                    ? 'ẢNH TẢI LÊN'
                    : 'LEONARDO BANANA 2'}
                </span>
              )}
            </div>

            {/* Hidden Input File for Local Device Upload */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <input
              type="file"
              ref={bodyImageInputRef}
              accept="image/*"
              onChange={handleBodyImageUpload}
              className="hidden"
            />

            {article.featuredImage ? (
              <div className="space-y-3">
                <div className="relative rounded-2xl overflow-hidden border border-[#0879D9]/30 group bg-[#F8FAFC]">
                  <img
                    src={article.featuredImage.url}
                    alt={article.featuredImage.altText}
                    className="w-full h-44 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 rounded-xl bg-white text-[#0879D9] font-bold text-xs shadow-md hover:bg-slate-50 transition flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Thay ảnh
                    </button>
                    <button
                      onClick={handleRemoveImage}
                      className="p-2 rounded-xl bg-rose-600 text-white font-bold text-xs shadow-md hover:bg-rose-700 transition flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Xóa
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-[#0879D9]" /> Alt Text Tối Ưu SEO
                  </label>
                  <input
                    type="text"
                    value={article.featuredImage.altText}
                    onChange={(e) => handleAltTextChange(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs text-[#071827] font-medium focus:border-[#0879D9] focus:outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 px-3 py-2 rounded-xl bg-[#F0F9FF] text-[#0879D9] border border-[#0879D9]/30 hover:bg-[#0879D9] hover:text-white transition font-bold text-[11px] flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" /> Tải Ảnh Khác Từ Máy Tính
                  </button>
                  <button
                    onClick={() => setActiveTab('imagestudio')}
                    className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition font-bold text-[11px] flex items-center gap-1"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-[#0879D9]" /> Ảnh được tạo
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-6 text-center border-2 border-dashed border-slate-300 hover:border-[#0879D9] rounded-2xl cursor-pointer transition space-y-2 bg-[#F8FAFC] hover:bg-[#F0F9FF]"
                >
                  <div className="w-10 h-10 rounded-full bg-[#E0F2FE] text-[#0879D9] flex items-center justify-center mx-auto">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#071827]">Tải Ảnh Trực Tiếp Từ Máy Tính</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Click vào đây để chọn file ảnh PNG, JPG, WEBP...</p>
                  </div>
                </div>

                <div className="text-center text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Hoặc</div>

                <button
                  onClick={() => setActiveTab('imagestudio')}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#F0F9FF] text-[#0879D9] border border-[#0879D9]/30 hover:bg-[#0879D9] hover:text-white transition font-bold text-xs flex items-center justify-center gap-2"
                >
                  <ImageIcon className="w-4 h-4" /> Tạo ảnh mới
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Body Content & Preview Column */}
        <div className="lg:col-span-8 glass-panel p-6 rounded-3xl space-y-4 border border-[#0879D9]/15 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveView('visual')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  activeView === 'visual'
                    ? 'bg-[#E0F2FE] text-[#0879D9] border border-[#0879D9]/30'
                    : 'text-slate-500 hover:text-[#0879D9]'
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> Xem Trực Quan (Visual Render)
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

            <div className="flex items-center gap-3">
              <button
                onClick={() => bodyImageInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-[#F0F9FF] text-[#0879D9] border border-[#0879D9]/30 hover:bg-[#0879D9] hover:text-white transition font-bold text-[11px] flex items-center gap-1.5"
                title="Chèn ảnh bất kỳ từ máy tính vào giữa bài viết"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Chèn Ảnh Vào Bài Viết
              </button>

              <span className="text-xs font-mono text-[#0879D9] flex items-center gap-1 font-extrabold">
                <Award className="w-3.5 h-3.5 text-[#0879D9]" /> SEO Score: {article.seoScore > 0 ? `${article.seoScore}/100` : 'Chưa chấm'}
              </span>
            </div>
          </div>

          {activeView === 'visual' ? (
            <div className="p-6 bg-[#F8FAFC] rounded-2xl border border-slate-200 min-h-[450px] prose-custom overflow-y-auto max-h-[600px]">
              <h1 className="text-3xl font-black text-[#071827] mb-6">{title}</h1>
              {article.featuredImage && (
                <figure className="mb-6 text-center">
                  <img
                    src={article.featuredImage.url}
                    alt={article.featuredImage.altText}
                    className="w-full h-80 object-cover rounded-2xl border border-slate-200 shadow-sm mx-auto"
                  />
                  <figcaption className="text-xs text-slate-500 italic mt-2">
                    {article.featuredImage.altText}
                  </figcaption>
                </figure>
              )}
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
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
