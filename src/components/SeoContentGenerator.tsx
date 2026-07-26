import React, { useState } from 'react';
import { FilePenLine, FileText, CheckCircle2, ArrowRight, Settings, List, Layers, ShieldCheck, Activity } from 'lucide-react';
import type { SeoOutline, GeneratedArticle, ActiveTab } from '../types';
import { GeminiService } from '../services/geminiService';

interface SeoContentGeneratorProps {
  selectedKeyword: string;
  geminiService: GeminiService;
  onArticleGenerated: (article: GeneratedArticle) => void;
  setActiveTab: (tab: ActiveTab) => void;
}

export const SeoContentGenerator: React.FC<SeoContentGeneratorProps> = ({
  selectedKeyword,
  geminiService,
  onArticleGenerated,
  setActiveTab
}) => {
  const [keyword, setKeyword] = useState(selectedKeyword);
  const [tone, setTone] = useState('Chuyên nghiệp, truyền cảm hứng, cân bằng');
  const [wordCount, setWordCount] = useState(1500);
  const [step, setStep] = useState<'input' | 'outline' | 'generating'>('input');
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);
  const [outline, setOutline] = useState<SeoOutline | null>(null);

  const handleGenerateOutline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword) return;
    setIsGeneratingOutline(true);
    try {
      const generatedOutline = await geminiService.generateOutline(keyword, tone);
      setOutline(generatedOutline);
      setStep('outline');
    } catch (err) {
      console.error('Error generating outline:', err);
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  const handleGenerateFullArticle = async () => {
    if (!outline) return;
    setStep('generating');
    setIsGeneratingArticle(true);
    try {
      const article = await geminiService.generateFullArticle(outline, wordCount);
      onArticleGenerated(article);
      setActiveTab('editor');
    } catch (err) {
      console.error('Error generating article:', err);
      setStep('outline');
    } finally {
      setIsGeneratingArticle(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-3xl space-y-3 border border-[#0879D9]/15 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-[#071827] flex items-center gap-2">
              <FilePenLine className="w-5 h-5 text-[#0879D9]" /> Soạn bài viết SEO thương hiệu OMFIT
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Tự động hóa 100% quy trình viết bài: Dàn ý chuẩn On-Page, văn phong OMFIT (Elevated, Human, Energetic, Restorative), chèn Table of Contents, Callout & FAQ.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#E0F2FE] border border-[#0879D9]/30 text-[#0879D9] text-xs font-bold flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" /> OMFIT Standard
          </span>
        </div>

        {/* Step Indicator */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-3 border-t border-slate-100">
          <div className={`flex items-center gap-2 text-xs font-bold ${step === 'input' ? 'text-[#0879D9]' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full bg-[#0879D9] text-white text-[11px] flex items-center justify-center">1</span>
            Từ Khóa & Giọng Văn OMFIT
          </div>
          <div className="w-8 h-[1px] bg-slate-200" />
          <div className={`flex items-center gap-2 text-xs font-bold ${step === 'outline' ? 'text-[#0879D9]' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full bg-[#0879D9] text-white text-[11px] flex items-center justify-center">2</span>
            Duyệt Dàn Ý H2/H3
          </div>
          <div className="w-8 h-[1px] bg-slate-200" />
          <div className={`flex items-center gap-2 text-xs font-bold ${step === 'generating' ? 'text-[#0879D9]' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full bg-[#0879D9] text-white text-[11px] flex items-center justify-center">3</span>
            Hoàn Tất Bài Viết
          </div>
        </div>
      </div>

      {step === 'input' && (
        <div className="glass-panel p-6 rounded-3xl space-y-6 border border-[#0879D9]/15 bg-white">
          <form onSubmit={handleGenerateOutline} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Từ Khóa Chính Để SEO (Focus Keyword)
              </label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="VD: khóa học pt pilates chuyên nghiệp, tập pilates giảm mỡ bụng..."
                className="w-full px-4 py-3 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#071827] text-sm focus:outline-none focus:border-[#0879D9] transition font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Giọng Văn OMFIT (Voice & Tone)</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#071827] text-xs focus:outline-none focus:border-[#0879D9] transition font-semibold"
                >
                  <option value="Chuyên nghiệp, truyền cảm hứng, cân bằng">Khích lệ & Cân bằng (Mặc định OMFIT)</option>
                  <option value="Elevated & Human chuyên sâu y khoa">Elevated & Human chuyên sâu y khoa Pilates</option>
                  <option value="Energetic & Restorative phục hồi">Energetic & Restorative phục hồi sức khỏe</option>
                  <option value="Kích thích hành động đăng ký tập thử">Kích thích hành động đăng ký trải nghiệm</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số Từ Mục Tiêu (Word Count Target)
                </label>
                <select
                  value={wordCount}
                  onChange={(e) => setWordCount(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#071827] text-xs focus:outline-none focus:border-[#0879D9] transition font-semibold"
                >
                  <option value={1000}>1,000 từ (Bài ngắn gọn tiêu chuẩn)</option>
                  <option value={1500}>1,500 từ (Bài SEO Chuyên sâu OMFIT - Khuyên dùng)</option>
                  <option value={2000}>2,000 từ (Bài Ultimate Guide Pilates / Wellness)</option>
                </select>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isGeneratingOutline}
                className="gradient-bg-omfit-btn px-6 py-3 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-md shadow-[#0879D9]/20 disabled:opacity-50"
              >
                {isGeneratingOutline ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Đang Tạo Dàn Ý SEO...
                  </>
                ) : (
                  <>
                    <FilePenLine className="w-4 h-4" /> Tạo dàn ý chuẩn SEO
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {step === 'outline' && outline && (
        <div className="glass-panel p-6 rounded-3xl space-y-6 border border-[#0879D9]/15 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-[#E0F2FE] text-[#0879D9]">
                OMFIT OUTLINE GENERATED
              </span>
              <h3 className="text-lg font-black text-[#071827] mt-1">{outline.title}</h3>
            </div>
            <button onClick={() => setStep('input')} className="text-xs text-slate-500 hover:text-[#0879D9] underline font-semibold">
              ← Thay đổi thông số
            </button>
          </div>

          <div className="p-4 rounded-xl bg-[#F0F9FF] border border-[#0879D9]/20 space-y-2">
            <h4 className="text-xs font-bold text-[#0879D9] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Đánh Giá Thẻ Meta SEO Trên Google Search
            </h4>
            <div className="space-y-1">
              <p className="text-sm font-bold text-[#0879D9] hover:underline cursor-pointer">
                {outline.metaTitle}
              </p>
              <p className="text-[11px] text-slate-600 font-mono font-semibold">https://omfit.com.vn/{outline.slug}/</p>
              <p className="text-xs text-slate-700">{outline.metaDescription}</p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <List className="w-4 h-4 text-[#0879D9]" /> Cấu Trúc Các Tiêu Đề (H2 & H3)
            </h4>
            <div className="space-y-2">
              {outline.headings.map((h, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-xs text-[#071827]">
                    <span className="px-1.5 py-0.5 rounded bg-[#0879D9] text-white text-[10px] font-mono">
                      {h.tag.toUpperCase()}
                    </span>
                    {h.text}
                  </div>
                  <ul className="pl-6 list-disc space-y-0.5 text-[11px] text-slate-600">
                    {h.points.map((pt, ptIdx) => (
                      <li key={ptIdx}>{pt}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
            <div className="text-xs text-slate-500 font-medium">
              Độ dài dự kiến: <span className="font-bold text-[#071827]">{wordCount} từ</span> | Định dạng OMFIT Brand
            </div>
            <button
              onClick={handleGenerateFullArticle}
              disabled={isGeneratingArticle}
              className="gradient-bg-omfit-btn px-6 py-3 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-md shadow-[#0879D9]/20"
            >
              <FilePenLine className="w-4 h-4" /> Tạo toàn bộ bài viết HTML
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 'generating' && (
        <div className="glass-panel p-12 rounded-3xl text-center space-y-4 border border-[#0879D9]/15 bg-white">
          <div className="w-12 h-12 border-4 border-[#0879D9] border-t-transparent rounded-full animate-spin mx-auto" />
          <h3 className="text-lg font-bold text-[#071827]">Đang soạn bài viết theo chuẩn OMFIT...</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
            Hệ thống đang sinh nội dung HTML, tối ưu SEO On-Page, tạo mục lục tự động và chuẩn bị chuyển sang màn hình **Xem & Chỉnh Sửa Bài Viết (Live Editor)**.
          </p>
        </div>
      )}
    </div>
  );
};
