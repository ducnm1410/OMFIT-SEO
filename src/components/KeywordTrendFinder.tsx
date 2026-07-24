import React, { useState } from 'react';
import { Search, TrendingUp, Sparkles, Filter, ArrowRight, BarChart2, CheckCircle2, Zap, Crown } from 'lucide-react';
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
  const [industry, setIndustry] = useState('Pilates & Fitness OM FIT');
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
      <div className="glass-panel p-6 rounded-2xl space-y-4 border border-[#2a2822]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
              <Search className="w-5 h-5 text-[#c5a059]" /> Crawl Keyword & Trend SEO Ngành Fitness & Wellness
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Nhập từ khóa chủ đề (Pilates, Gym, Yoga, Sound Therapy, PT Course) để AI Gemini quét lượng tìm kiếm & từ khóa chuẩn thương hiệu OM FIT.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#c5a059]/15 border border-[#c5a059]/40 text-[#e6c687] text-xs font-semibold flex items-center gap-1">
            <Crown className="w-3.5 h-3.5" /> OM FIT Keyword Finder
          </span>
        </div>

        {/* Form Input */}
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2">
          <div className="md:col-span-6">
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Từ Khóa Main Target
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="VD: tập pilates, khóa học pt pilates, sound therapy..."
              className="w-full px-4 py-2.5 rounded-xl bg-[#101014] border border-[#332f27] text-slate-100 text-xs focus:outline-none focus:border-[#c5a059] transition"
              required
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-300 mb-1">Lĩnh Vực Thương Hiệu</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#101014] border border-[#332f27] text-slate-100 text-xs focus:outline-none focus:border-[#c5a059] transition"
            >
              <option value="Pilates & Fitness OM FIT">Pilates & Fitness (OM FIT)</option>
              <option value="Khóa Học Nghề PT Pilates">Khóa Học Nghề PT Pilates Chuyên Nghiệp</option>
              <option value="Sound Therapy & Chuông Xoay">Sound Therapy & Trị Liệu Âm Thanh</option>
              <option value="GYM & Personal Trainer">GYM & Huấn Luyện Viên PT</option>
              <option value="Yoga & GroupX">Yoga & Các Lớp Group X</option>
            </select>
          </div>

          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full gradient-bg-gold-btn px-4 py-2.5 rounded-xl text-xs font-bold text-[#0c0c0e] flex items-center justify-center gap-2 shadow-lg shadow-[#c5a059]/20 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#0c0c0e] border-t-transparent rounded-full animate-spin" />
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
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#c5a059]" /> Kết Quả Từ Khóa Hot Trend Ngành OM FIT ({trends.length})
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trends.map((item, index) => (
            <div
              key={index}
              className="glass-panel p-5 rounded-2xl space-y-4 border border-[#2a2822] hover:border-[#c5a059]/60 transition group relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-[#c5a059]/20 text-[#e6c687] border border-[#c5a059]/40">
                      {item.intent}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Volume: {item.searchVolume}</span>
                  </div>
                  <h4 className="font-extrabold text-base text-slate-100 group-hover:text-[#e6c687] transition">
                    {item.keyword}
                  </h4>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-[#e6c687] font-mono">Score: {item.trendScore}/100</div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#c5a059]/10 text-[#e6c687]">
                    Độ khó: {item.difficulty}
                  </span>
                </div>
              </div>

              {/* LSI Keywords */}
              <div className="space-y-1.5 pt-2 border-t border-[#2a2822]">
                <p className="text-[11px] font-semibold text-slate-400">Từ khóa phụ (LSI Keywords):</p>
                <div className="flex flex-wrap gap-1.5">
                  {item.relatedLsiKeywords.map((lsi, lsiIdx) => (
                    <span key={lsiIdx} className="px-2 py-0.5 rounded bg-[#18181e] text-slate-300 text-[10px] border border-[#2a2822]">
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
                  className="gradient-bg-gold-btn px-4 py-2 rounded-xl text-xs font-bold text-[#0c0c0e] flex items-center gap-1.5 shadow-md shadow-[#c5a059]/20"
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
