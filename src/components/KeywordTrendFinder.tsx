import React, { useState } from 'react';
import { Search, TrendingUp, Sparkles, ArrowRight, Zap, Activity } from 'lucide-react';
import type { KeywordTrend, ActiveTab } from '../types';
import { GeminiService } from '../services/geminiService';

interface KeywordTrendFinderProps {
  geminiService: GeminiService;
  onSelectKeywordForArticle: (keyword: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
}

export const KeywordTrendFinder: React.FC<KeywordTrendFinderProps> = ({
  geminiService,
  onSelectKeywordForArticle,
  setActiveTab
}) => {
  const [query, setQuery] = useState('tập pilates giảm cân');
  const [industry, setIndustry] = useState('OMFIT PILATES');
  const [isLoading, setIsLoading] = useState(false);
  const [trends, setTrends] = useState<KeywordTrend[]>([
    {
      keyword: 'khóa học nghề pt pilates chuyên nghiệp 2026',
      searchVolume: '16.4K/tháng',
      difficulty: 'Medium',
      trendScore: 98,
      intent: 'Commercial',
      relatedLsiKeywords: ['học hlv pilates tphcm', 'báo giá khóa pt pilates', 'bằng chứng chỉ hlv pilates']
    },
    {
      keyword: 'tập pilates giảm mỡ bụng cho nữ hiệu quả',
      searchVolume: '24.8K/tháng',
      difficulty: 'Easy',
      trendScore: 95,
      intent: 'Informational',
      relatedLsiKeywords: ['lợi ích của tập pilates', 'tập pilates tại omfit', 'phòng tập pilates tân mỹ quận 7']
    },
    {
      keyword: 'sound therapy trị liệu bằng chuông xoay',
      searchVolume: '9.1K/tháng',
      difficulty: 'Easy',
      trendScore: 91,
      intent: 'Informational',
      relatedLsiKeywords: ['liệu pháp chuông xoay omfit', 'thư giãn tinh thần sound bath', 'giảm stress yoga sound']
    },
    {
      keyword: 'phòng tập gym và groupx đẳng cấp tại tphcm',
      searchVolume: '12.5K/tháng',
      difficulty: 'Medium',
      trendScore: 88,
      intent: 'Transactional',
      relatedLsiKeywords: ['đăng ký tập thử omfit', 'lớp học group x đa dạng', 'huấn luyện viên cá nhân pt']
    }
  ]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    setIsLoading(true);
    try {
      const results = await geminiService.searchKeywordTrends(query, industry);
      setTrends(results);
    } catch (err) {
      console.error('Error fetching trends:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-3xl space-y-4 border border-[#0879D9]/15 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-[#071827] flex items-center gap-2">
              <Search className="w-5 h-5 text-[#0879D9]" /> Crawl Keyword & Trend SEO (OMFIT Architecture)
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Nhập từ khóa chủ đề (Pilates, Gym, Yoga, Sound Therapy, PT Course) để AI Gemini quét lượng tìm kiếm & từ khóa chuẩn OMFIT.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#E0F2FE] border border-[#0879D9]/30 text-[#0879D9] text-xs font-bold flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" /> OMFIT Keyword Finder
          </span>
        </div>

        {/* Form Input */}
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2">
          <div className="md:col-span-6">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Từ Khóa Main Target
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="VD: tập pilates, khóa học pt pilates, sound therapy..."
              className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#071827] text-xs focus:outline-none focus:border-[#0879D9] transition font-medium"
              required
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-bold text-slate-700 mb-1">Kiến Trúc Thương Hiệu</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#071827] text-xs focus:outline-none focus:border-[#0879D9] transition font-semibold"
            >
              <option value="OMFIT PILATES">OMFIT PILATES (Reformer, Cadillac, Coaching)</option>
              <option value="OMFIT FITNESS">OMFIT FITNESS (Gym, Functional, GroupX, Spinning)</option>
              <option value="OMFIT WELLNESS">OMFIT WELLNESS (Yoga, Sauna, Sound Therapy)</option>
              <option value="Khóa Học Nghề PT Pilates">Khóa Học Nghề PT Pilates Chuyên Nghiệp</option>
            </select>
          </div>

          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full gradient-bg-omfit-btn px-4 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 shadow-md shadow-[#0879D9]/20 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Đang quét...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" /> Crawl Trend
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Keyword Trend Cards List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#0879D9]" /> Kết Quả Từ Khóa Hot Trend OMFIT ({trends.length})
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trends.map((item, index) => (
            <div
              key={index}
              className="glass-panel p-5 rounded-3xl space-y-4 border border-[#0879D9]/15 hover:border-[#0879D9] transition group relative overflow-hidden bg-white"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-[#E0F2FE] text-[#0879D9] border border-[#0879D9]/30">
                      {item.intent}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono font-semibold">Volume: {item.searchVolume}</span>
                  </div>
                  <h4 className="font-extrabold text-base text-[#071827] group-hover:text-[#0879D9] transition">
                    {item.keyword}
                  </h4>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-[#0879D9] font-mono">Score: {item.trendScore}/100</div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    Độ khó: {item.difficulty}
                  </span>
                </div>
              </div>

              {/* LSI Keywords */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <p className="text-[11px] font-semibold text-slate-500">Từ khóa phụ (LSI Keywords):</p>
                <div className="flex flex-wrap gap-1.5">
                  {item.relatedLsiKeywords.map((lsi, lsiIdx) => (
                    <span key={lsiIdx} className="px-2 py-0.5 rounded bg-[#F0F9FF] text-[#0879D9] text-[10px] font-semibold border border-[#0879D9]/15">
                      + {lsi}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => {
                    onSelectKeywordForArticle(item.keyword);
                    setActiveTab('generator');
                  }}
                  className="gradient-bg-omfit-btn px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow-md shadow-[#0879D9]/20"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Sinh bài viết SEO với Keyword này
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
