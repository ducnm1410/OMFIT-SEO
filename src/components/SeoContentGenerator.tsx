import React, { useState } from 'react';
import { Sparkles, FileText, CheckCircle2, ArrowRight, Settings, List, Layers, ShieldCheck, Crown } from 'lucide-react';
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
  const [keyword, setKeyword] = useState(selectedKeyword || 'khóa học pt pilates chuyên nghiệp');
  const [tone, setTone] = useState('Sang trọng, chuyên nghiệp, truyền cảm hứng');
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
      <div className="glass-panel p-6 rounded-2xl space-y-3 border border-[#2a2822]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#c5a059]" /> Sinh Bài Viết SEO Thương Hiệu OM FIT Với Gemini AI
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Tự động hóa 100% quy trình viết bài: Tạo dàn ý chuẩn On-Page, sinh nội dung chuẩn văn phong OM FIT, chèn Table of Contents, Callout box và FAQ.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#c5a059]/15 border border-[#c5a059]/40 text-[#e6c687] text-xs font-semibold flex items-center gap-1">
            <Crown className="w-3.5 h-3.5" /> OM FIT Standard
          </span>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-4 pt-3 border-t border-[#2a2822]">
          <div className={`flex items-center gap-2 text-xs font-bold ${step === 'input' ? 'text-[#e6c687]' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full bg-[#c5a059]/20 text-[#e6c687] text-[11px] flex items-center justify-center">1</span>
            Từ Khóa & Giọng Văn OM FIT
          </div>
          <div className="w-8 h-[1px] bg-[#2a2822]" />
          <div className={`flex items-center gap-2 text-xs font-bold ${step === 'outline' ? 'text-[#e6c687]' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full bg-[#c5a059]/20 text-[#e6c687] text-[11px] flex items-center justify-center">2</span>
            Duyệt Dàn Ý H2/H3
          </div>
          <div className="w-8 h-[1px] bg-[#2a2822]" />
          <div className={`flex items-center gap-2 text-xs font-bold ${step === 'generating' ? 'text-[#e6c687]' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full bg-[#c5a059]/20 text-[#e6c687] text-[11px] flex items-center justify-center">3</span>
            Hoàn Tất Bài Viết
          </div>
        </div>
      </div>

      {step === 'input' && (
        <div className="glass-panel p-6 rounded-2xl space-y-6 border border-[#2a2822]">
          <form onSubmit={handleGenerateOutline} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Từ Khóa Chính Để SEO (Focus Keyword)
              </label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="VD: khóa học pt pilates chuyên nghiệp, tập pilates giảm mỡ bụng..."
                className="w-full px-4 py-3 rounded-xl bg-[#101014] border border-[#332f27] text-slate-100 text-sm focus:outline-none focus:border-[#c5a059] transition font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Giọng Văn (Tone of Voice)</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#101014] border border-[#332f27] text-slate-100 text-xs focus:outline-none focus:border-[#c5a059] transition"
                >
                  <option value="Sang trọng, chuyên nghiệp, truyền cảm hứng">Sang trọng, chuyên nghiệp, truyền cảm hứng (Mặc định OM FIT)</option>
                  <option value="Chuyên sâu y khoa & giải phẫu học">Chuyên sâu y khoa & giải phẫu học Pilates</option>
                  <option value="Thân thiện, động viên hội viên">Thân thiện, động viên hội viên</option>
                  <option value="Kích thích hành động đăng ký tập thử">Kích thích hành động đăng ký tập thử</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Số Từ Mục Tiêu (Word Count Target)
                </label>
                <select
                  value={wordCount}
                  onChange={(e) => setWordCount(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#101014] border border-[#332f27] text-slate-100 text-xs focus:outline-none focus:border-[#c5a059] transition"
                >
                  <option value={1000}>1,000 từ (Bài ngắn gọn tiêu chuẩn)</option>
                  <option value={1500}>1,500 từ (Bài SEO Chuyên sâu OM FIT - Khuyên dùng)</option>
                  <option value={2000}>2,000 từ (Bài Ultimate Guide Pilates / Wellness)</option>
                </select>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isGeneratingOutline}
                className="gradient-bg-gold-btn px-6 py-3 rounded-xl text-xs font-bold text-[#0c0c0e] flex items-center gap-2 shadow-lg shadow-[#c5a059]/20 disabled:opacity-50"
              >
                {isGeneratingOutline ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#0c0c0e] border-t-transparent rounded-full animate-spin" />
                    Đang Tạo Dàn Ý SEO...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Bắt Đầu Sinh Dàn Ý chuẩn SEO
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {step === 'outline' && outline && (
        <div className="glass-panel p-6 rounded-2xl space-y-6 border border-[#2a2822]">
          <div className="flex items-center justify-between border-b border-[#2a2822] pb-4">
            <div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#c5a059]/20 text-[#e6c687]">
                OM FIT OUTLINE GENERATED
              </span>
              <h3 className="text-lg font-extrabold text-slate-100 mt-1">{outline.title}</h3>
            </div>
            <button onClick={() => setStep('input')} className="text-xs text-slate-400 hover:text-slate-200 underline">
              ← Thay đổi thông số
            </button>
          </div>

          <div className="p-4 rounded-xl bg-[#101014] border border-[#2a2822] space-y-2">
            <h4 className="text-xs font-bold text-[#e6c687] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Đánh Giá Thẻ Meta SEO Trên Google Search
            </h4>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#e6c687] hover:underline cursor-pointer">
                {outline.metaTitle}
              </p>
              <p className="text-[11px] text-[#c5a059] font-mono">https://omfit.com.vn/{outline.slug}/</p>
              <p className="text-xs text-slate-300">{outline.metaDescription}</p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <List className="w-4 h-4 text-[#c5a059]" /> Cấu Trúc Các Tiêu Đề (H2 & H3)
            </h4>
            <div className="space-y-2">
              {outline.headings.map((h, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-[#18181e] border border-[#2a2822] space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-200">
                    <span className="px-1.5 py-0.5 rounded bg-[#c5a059]/20 text-[#e6c687] text-[10px] font-mono">
                      {h.tag.toUpperCase()}
                    </span>
                    {h.text}
                  </div>
                  <ul className="pl-6 list-disc space-y-0.5 text-[11px] text-slate-400">
                    {h.points.map((pt, ptIdx) => (
                      <li key={ptIdx}>{pt}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-[#2a2822]">
            <div className="text-xs text-slate-400">
              Độ dài dự kiến: <span className="font-bold text-slate-200">{wordCount} từ</span> | Định dạng OM FIT Brand
            </div>
            <button
              onClick={handleGenerateFullArticle}
              disabled={isGeneratingArticle}
              className="gradient-bg-gold-btn px-6 py-3 rounded-xl text-xs font-bold text-[#0c0c0e] flex items-center gap-2 shadow-lg shadow-[#c5a059]/20"
            >
              <Sparkles className="w-4 h-4" /> Tiến Hành Sinh Toàn Bộ Bài Viết HTML
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 'generating' && (
        <div className="glass-panel p-12 rounded-2xl text-center space-y-4 border border-[#2a2822]">
          <div className="w-12 h-12 border-4 border-[#c5a059] border-t-transparent rounded-full animate-spin mx-auto" />
          <h3 className="text-lg font-bold text-slate-100">AI Gemini Đang Soạn Bài Viết Theo Chuẩn OM FIT...</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Hệ thống đang sinh nội dung HTML, tối ưu SEO On-Page, tạo mục lục tự động và chuẩn bị chuyển sang màn hình **Xem & Chỉnh Sửa Bài Viết (Live Editor)**.
          </p>
        </div>
      )}
    </div>
  );
};
