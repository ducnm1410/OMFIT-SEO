import React, { useState } from 'react';
import { FilePenLine, ArrowRight, List, ShieldCheck, Activity, Target, UsersRound } from 'lucide-react';
import type { SeoOutline, GeneratedArticle, ActiveTab, ContentBrief } from '../types';
import { GeminiService } from '../services/geminiService';

interface SeoContentGeneratorProps {
  selectedKeyword: string;
  brief: ContentBrief;
  geminiService: GeminiService;
  onBriefChange: (brief: ContentBrief) => void;
  onArticleGenerated: (article: GeneratedArticle) => void;
  setActiveTab: (tab: ActiveTab) => void;
}

export const SeoContentGenerator: React.FC<SeoContentGeneratorProps> = ({
  selectedKeyword,
  brief,
  geminiService,
  onBriefChange,
  onArticleGenerated,
  setActiveTab
}) => {
  const [keyword, setKeyword] = useState(selectedKeyword || brief.keyword);
  const [searchIntent, setSearchIntent] = useState(brief.searchIntent);
  const [service, setService] = useState(brief.service);
  const [audience, setAudience] = useState(brief.audience);
  const [conversionGoal, setConversionGoal] = useState(brief.conversionGoal);
  const [tone, setTone] = useState(brief.tone);
  const [wordCount, setWordCount] = useState(brief.wordCount);
  const [step, setStep] = useState<'input' | 'outline' | 'generating'>('input');
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);
  const [outline, setOutline] = useState<SeoOutline | null>(null);

  const commitBrief = (overrides: Partial<ContentBrief> = {}) => {
    onBriefChange({
      keyword,
      searchIntent,
      service,
      audience,
      conversionGoal,
      tone,
      wordCount,
      ...overrides
    });
  };

  const handleGenerateOutline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword) return;
    commitBrief();
    setIsGeneratingOutline(true);
    try {
      const briefContext = [
        tone,
        `Search intent: ${searchIntent}`,
        `Dịch vụ trọng tâm: ${service}`,
        `Độc giả: ${audience}`,
        `Mục tiêu chuyển đổi: ${conversionGoal}`
      ].join('. ');
      const generatedOutline = await geminiService.generateOutline(keyword, briefContext);
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
    <div className="ui-page space-y-6">
      {/* Header Banner */}
      <div className="ui-page-header space-y-4 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold tracking-[-0.02em] text-[#17191D]">
              <FilePenLine className="w-5 h-5 text-[#0879D9]" /> Content brief và dàn ý SEO
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Chốt mục tiêu nội dung trước khi tạo dàn ý H2/H3, FAQ và metadata theo chuẩn OMFIT.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#E0F2FE] border border-[#0879D9]/30 text-[#0879D9] text-xs font-bold flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" /> OMFIT Standard
          </span>
        </div>
      </div>

      {step === 'input' && (
        <div className="ui-panel space-y-6 p-5 sm:p-6">
          <form onSubmit={handleGenerateOutline} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Từ khóa chính (Focus keyword)
              </label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  commitBrief({ keyword: e.target.value });
                }}
                placeholder="VD: khóa học pt pilates chuyên nghiệp, tập pilates giảm mỡ bụng..."
                className="w-full px-4 py-3 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#071827] text-sm focus:outline-none focus:border-[#0879D9] transition font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Target className="h-3.5 w-3.5 text-[#0879D9]" /> Search intent
                </label>
                <select
                  value={searchIntent}
                  onChange={(event) => {
                    const value = event.target.value as ContentBrief['searchIntent'];
                    setSearchIntent(value);
                    commitBrief({ searchIntent: value });
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-2.5 text-xs font-semibold text-[#071827] transition focus:border-[#0879D9] focus:outline-none"
                >
                  <option value="Informational">Tìm hiểu thông tin</option>
                  <option value="Commercial">So sánh và cân nhắc dịch vụ</option>
                  <option value="Transactional">Đăng ký hoặc mua dịch vụ</option>
                  <option value="Navigational">Tìm thương hiệu hoặc địa điểm</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Dịch vụ OMFIT liên quan</label>
                <select
                  value={service}
                  onChange={(event) => {
                    setService(event.target.value);
                    commitBrief({ service: event.target.value });
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-2.5 text-xs font-semibold text-[#071827] transition focus:border-[#0879D9] focus:outline-none"
                >
                  <option value="OMFIT PILATES">Pilates</option>
                  <option value="OMFIT FITNESS">Fitness, Gym và Group X</option>
                  <option value="OMFIT WELLNESS">Yoga, Sauna và Sound Therapy</option>
                  <option value="Khóa Học Nghề PT Pilates">Khóa học nghề PT Pilates</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <UsersRound className="h-3.5 w-3.5 text-[#0879D9]" /> Đối tượng độc giả
                </label>
                <input
                  type="text"
                  value={audience}
                  onChange={(event) => {
                    setAudience(event.target.value);
                    commitBrief({ audience: event.target.value });
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-2.5 text-xs font-medium text-[#071827] transition focus:border-[#0879D9] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Mục tiêu chuyển đổi</label>
                <input
                  type="text"
                  value={conversionGoal}
                  onChange={(event) => {
                    setConversionGoal(event.target.value);
                    commitBrief({ conversionGoal: event.target.value });
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-2.5 text-xs font-medium text-[#071827] transition focus:border-[#0879D9] focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Giọng văn OMFIT</label>
                <select
                  value={tone}
                  onChange={(e) => {
                    setTone(e.target.value);
                    commitBrief({ tone: e.target.value });
                  }}
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
                  Số từ mục tiêu
                </label>
                <select
                  value={wordCount}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setWordCount(value);
                    commitBrief({ wordCount: value });
                  }}
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
        <div className="ui-panel space-y-6 p-5 sm:p-6">
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

          <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Search intent</p>
              <p className="mt-1 text-xs font-semibold text-[#17191D]">{searchIntent}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Dịch vụ</p>
              <p className="mt-1 text-xs font-semibold text-[#17191D]">{service}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Mục tiêu</p>
              <p className="mt-1 line-clamp-2 text-xs font-semibold text-[#17191D]">{conversionGoal}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F0F9FF] border border-[#0879D9]/20 space-y-2">
            <h4 className="text-xs font-bold text-[#0879D9] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Xem trước thẻ meta trên Google Search
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
              <List className="w-4 h-4 text-[#0879D9]" /> Cấu trúc tiêu đề H2 và H3
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
              Độ dài dự kiến: <span className="font-bold text-[#071827]">{wordCount} từ</span>.
              Nguồn công khai sẽ được kiểm chứng và duyệt trước bước xuất bản.
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
        <div className="ui-panel space-y-4 p-10 text-center sm:p-12">
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
