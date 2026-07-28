import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Clock3,
  FilePenLine,
  List,
  ShieldCheck,
  Target,
  UsersRound
} from 'lucide-react';
import type { SeoOutline, GeneratedArticle, ActiveTab, ContentBrief } from '../types';
import { GeminiService } from '../services/geminiService';
import { ButtonContent } from './ButtonContent';

interface SeoContentGeneratorProps {
  selectedKeyword: string;
  brief: ContentBrief;
  geminiService: GeminiService;
  onBriefChange: (brief: ContentBrief) => void;
  onArticleGenerated: (article: GeneratedArticle) => Promise<void>;
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
  const [generationError, setGenerationError] = useState('');
  const [generationSeconds, setGenerationSeconds] = useState(0);
  const [generationStage, setGenerationStage] = useState<'drafting' | 'saving'>('drafting');
  const articleRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (step !== 'generating') {
      setGenerationSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setGenerationSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [step]);

  useEffect(() => () => articleRequestRef.current?.abort(), []);

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
    setGenerationError('');
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
      setGenerationError(err instanceof Error ? err.message : 'Không thể tạo dàn ý. Vui lòng thử lại.');
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  const handleGenerateFullArticle = async () => {
    if (!outline) return;
    const controller = new AbortController();
    articleRequestRef.current?.abort();
    articleRequestRef.current = controller;
    setGenerationError('');
    setGenerationStage('drafting');
    setStep('generating');
    setIsGeneratingArticle(true);
    try {
      const article = await geminiService.generateFullArticle(outline, wordCount, controller.signal);
      setGenerationStage('saving');
      const savePromise = onArticleGenerated(article);
      setActiveTab('editor');
      void savePromise.catch((error) => {
        console.error('Không thể hoàn tất lưu bài viết mới:', error);
      });
    } catch (err) {
      console.error('Error generating article:', err);
      setGenerationError(err instanceof Error ? err.message : 'Không thể tạo bài viết. Vui lòng thử lại.');
      setStep('outline');
    } finally {
      if (articleRequestRef.current === controller) articleRequestRef.current = null;
      setIsGeneratingArticle(false);
    }
  };

  const handleCancelArticleGeneration = () => {
    articleRequestRef.current?.abort();
  };

  const generationMessage = generationStage === 'saving'
    ? 'Đang kiểm tra SEO và lưu bản nháp an toàn...'
    : generationSeconds < 15
      ? 'Đang phân tích dàn ý và chuẩn bị cấu trúc bài...'
      : generationSeconds < 40
        ? 'Đang soạn nội dung và tối ưu SEO On-Page...'
        : 'Đang hoàn thiện nội dung, FAQ và mục lục tự động...';

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
          {generationError && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{generationError}</span>
            </div>
          )}
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
                aria-busy={isGeneratingOutline}
                className="ui-action-button gradient-bg-omfit-btn flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-bold text-white shadow-md shadow-[#0879D9]/20 disabled:opacity-50 sm:w-auto sm:max-w-64"
              >
                <ButtonContent
                  busy={isGeneratingOutline}
                  busyLabel="Đang tạo dàn ý..."
                  label="Tạo dàn ý chuẩn SEO"
                  icon={<FilePenLine className="h-4 w-4" />}
                  trailingIcon={<ArrowRight className="h-4 w-4" />}
                />
              </button>
            </div>
          </form>
        </div>
      )}

      {step === 'outline' && outline && (
        <div className="ui-panel space-y-6 p-5 sm:p-6">
          {generationError && (
            <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
              <span className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{generationError}</span>
              </span>
              <button
                type="button"
                onClick={() => setGenerationError('')}
                className="shrink-0 font-bold text-rose-700 underline underline-offset-2"
              >
                Đóng
              </button>
            </div>
          )}
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
              aria-busy={isGeneratingArticle}
              className="ui-action-button gradient-bg-omfit-btn flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-bold text-white shadow-md shadow-[#0879D9]/20 sm:w-auto sm:max-w-72"
            >
              <ButtonContent
                busy={isGeneratingArticle}
                busyLabel="Đang tạo bài viết..."
                label="Tạo toàn bộ bài viết HTML"
                icon={<FilePenLine className="h-4 w-4" />}
                trailingIcon={<ArrowRight className="h-4 w-4" />}
              />
            </button>
          </div>
        </div>
      )}

      {step === 'generating' && (
        <div className="ui-panel p-8 text-center sm:p-12">
          <div className="mx-auto max-w-xl space-y-5">
            <div className="relative mx-auto grid h-14 w-14 place-items-center">
              <div className="absolute inset-0 animate-spin rounded-full border-4 border-[#D9EEFC] border-t-[#0879D9]" />
              <FilePenLine className="h-5 w-5 text-[#0879D9]" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-[#071827]">Đang tạo bài viết theo chuẩn OMFIT</h3>
              <p aria-live="polite" className="text-sm font-semibold text-[#0879D9]">{generationMessage}</p>
              <p className="mx-auto max-w-md text-xs font-medium leading-5 text-slate-500">
                Bài dài {wordCount.toLocaleString('vi-VN')} từ thường cần 30–60 giây. Khi hoàn tất, hệ thống sẽ tự chuyển sang màn hình chỉnh sửa.
              </p>
            </div>
            <div className="mx-auto h-1.5 max-w-sm overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#0879D9] transition-[width] duration-1000"
                style={{ width: `${generationStage === 'saving' ? 96 : Math.min(88, 16 + generationSeconds * 1.35)}%` }}
              />
            </div>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                <Clock3 className="h-3.5 w-3.5" />
                Đã xử lý {generationSeconds} giây
              </span>
              {generationStage === 'drafting' && (
                <button
                  type="button"
                  onClick={handleCancelArticleGeneration}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 transition hover:border-rose-200 hover:text-rose-700"
                >
                  Dừng và quay lại dàn ý
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
