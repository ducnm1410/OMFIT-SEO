import React from 'react';
import {
  FileText,
  TrendingUp,
  Award,
  Globe,
  Sparkles,
  Search,
  Edit3,
  ArrowRight,
  CheckCircle2,
  Crown,
  BarChart3,
  Activity,
  PieChart as PieChartIcon
} from 'lucide-react';
import type { GeneratedArticle, ActiveTab } from '../types';
import { SeoPerformanceChart } from './charts/SeoPerformanceChart';
import { SeoRadarChart } from './charts/SeoRadarChart';
import { KeywordTrendChart } from './charts/KeywordTrendChart';
import { CategoryPieChart } from './charts/CategoryPieChart';

interface OverviewDashboardProps {
  articles: GeneratedArticle[];
  setActiveTab: (tab: ActiveTab) => void;
  onSelectArticleForEdit: (article: GeneratedArticle) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  articles,
  setActiveTab,
  onSelectArticleForEdit
}) => {
  const publishedCount = articles.filter((a) => a.status === 'published').length;
  const totalWordCount = articles.reduce((sum, a) => sum + a.wordCount, 0);
  const avgSeoScore = articles.length
    ? Math.round(articles.reduce((sum, a) => sum + a.seoScore, 0) / articles.length)
    : 98;

  return (
    <div className="space-y-6">
      {/* Welcome Banner - Bento Hero Card */}
      <div className="glass-panel-glow p-7 rounded-3xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#c5a059]/15 border border-[#c5a059]/40 text-[#e6c687] text-xs font-bold shadow-md">
            <Crown className="w-3.5 h-3.5" /> OM FIT Bento Design System • ECharts Powered Dashboard
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-100">
            Hệ Thống Đăng Bài SEO Tự Động <span className="gradient-text-gold">omfit.com.vn</span>
          </h1>
          <p className="text-slate-300 text-xs leading-relaxed max-w-2xl">
            Tự động hóa 100% quy trình SEO thương hiệu OM FIT: Crawl keyword hot trend, sinh bài viết bằng Gemini, tạo hình ảnh bằng Google Vertex AI Imagen 3 & OpenAI DALL-E 3, đăng bài qua MCP WordPress Server.
          </p>
          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={() => setActiveTab('keywords')}
              className="gradient-bg-gold-btn px-5 py-2.5 rounded-2xl text-xs font-bold text-[#0c0c0e] flex items-center gap-2 shadow-lg shadow-[#c5a059]/20"
            >
              <Search className="w-4 h-4" /> Crawl Keyword & Trend Ngay
            </button>
            <button
              onClick={() => setActiveTab('generator')}
              className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-200 bg-[#18181e] border border-[#332f27] hover:border-[#c5a059]/50 transition flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-[#c5a059]" /> Sinh Bài Viết SEO
            </button>
          </div>
        </div>

        <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-[#c5a059]/15 via-[#9a7b38]/5 to-transparent pointer-events-none" />
      </div>

      {/* Top Key Performance Indicators - Bento Grid Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl space-y-2 border border-[#2a2822] hover:border-[#c5a059]/50 transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Bài Viết Đã Đăng</span>
            <div className="p-2.5 rounded-xl bg-[#c5a059]/15 text-[#e6c687]">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-100">{publishedCount}</p>
          <p className="text-[11px] text-[#e6c687] flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3" /> Xuất bản qua MCP WordPress
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl space-y-2 border border-[#2a2822] hover:border-[#c5a059]/50 transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Tổng Số Từ AI Viết</span>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-100">{totalWordCount.toLocaleString()} từ</p>
          <p className="text-[11px] text-amber-300 font-medium">Định dạng Gutenberg & Elementor</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl space-y-2 border border-[#2a2822] hover:border-[#c5a059]/50 transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Điểm SEO Trung Bình</span>
            <div className="p-2.5 rounded-xl bg-[#c5a059]/20 text-[#e6c687]">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-[#e6c687]">{avgSeoScore}/100</p>
          <p className="text-[11px] text-slate-400 font-medium">Đạt tiêu chuẩn On-Page Google</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl space-y-2 border border-[#2a2822] hover:border-[#c5a059]/50 transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Trạng Thái MCP Site</span>
            <div className="p-2.5 rounded-xl bg-[#c5a059]/15 text-[#e6c687]">
              <Globe className="w-5 h-5" />
            </div>
          </div>
          <p className="text-base font-bold text-slate-100 truncate">omfit.com.vn</p>
          <p className="text-[11px] text-[#e6c687] font-medium">wsp-omfit-com-vn Active</p>
        </div>
      </div>

      {/* ECharts Bento Row 2: Analytics & Radar Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Area Line Chart */}
        <div className="lg:col-span-8 glass-panel p-6 rounded-3xl border border-[#2a2822] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#e6c687] uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#c5a059]" /> Tăng Trưởng Lượt Đăng Bài & Điểm SEO Theo Tuần (ECharts)
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Real-time Analytics</span>
          </div>
          <SeoPerformanceChart />
        </div>

        {/* SEO Radar Factor Chart */}
        <div className="lg:col-span-4 glass-panel p-6 rounded-3xl border border-[#2a2822] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#e6c687] uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#c5a059]" /> Đánh Giá 6 Chỉ Số SEO On-Page
            </h3>
          </div>
          <SeoRadarChart />
        </div>
      </div>

      {/* ECharts Bento Row 3: Keyword Trends & Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 glass-panel p-6 rounded-3xl border border-[#2a2822] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#e6c687] uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#c5a059]" /> Lượng Tìm Kiếm Hàng Tháng Theo Nhóm Từ Khóa (ECharts)
            </h3>
          </div>
          <KeywordTrendChart />
        </div>

        <div className="lg:col-span-5 glass-panel p-6 rounded-3xl border border-[#2a2822] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#e6c687] uppercase tracking-wider flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-[#c5a059]" /> Tỷ Lệ Phân Bổ Chuyên Mục Bài Viết
            </h3>
          </div>
          <CategoryPieChart />
        </div>
      </div>

      {/* Quick Action Workflow Stepper - Bento Box */}
      <div className="glass-panel p-6 rounded-3xl space-y-4 border border-[#2a2822]">
        <h3 className="text-xs font-bold text-[#e6c687] uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#c5a059]" /> Quy Trình 4 Bước Đăng Bài SEO Tự Động Thương Hiệu OM FIT
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div
            onClick={() => setActiveTab('keywords')}
            className="p-4 rounded-2xl bg-[#15151a] border border-[#2a2822] hover:border-[#c5a059]/60 cursor-pointer transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="w-6 h-6 rounded-full bg-[#c5a059]/20 text-[#e6c687] font-black text-xs flex items-center justify-center">
                1
              </span>
              <Search className="w-4 h-4 text-slate-400 group-hover:text-[#e6c687] transition" />
            </div>
            <h4 className="font-bold text-xs text-slate-200 group-hover:text-[#e6c687] transition">
              Crawl Keyword & Trend
            </h4>
            <p className="text-[11px] text-slate-400 mt-1">Phân tích từ khóa Fitness, Pilates, Wellness, Gym.</p>
          </div>

          <div
            onClick={() => setActiveTab('generator')}
            className="p-4 rounded-2xl bg-[#15151a] border border-[#2a2822] hover:border-[#c5a059]/60 cursor-pointer transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="w-6 h-6 rounded-full bg-[#c5a059]/20 text-[#e6c687] font-black text-xs flex items-center justify-center">
                2
              </span>
              <Sparkles className="w-4 h-4 text-slate-400 group-hover:text-[#e6c687] transition" />
            </div>
            <h4 className="font-bold text-xs text-slate-200 group-hover:text-[#e6c687] transition">
              Sinh Bài Viết Với Gemini
            </h4>
            <p className="text-[11px] text-slate-400 mt-1">Tạo dàn ý H2/H3, viết bài chuẩn SEO On-Page.</p>
          </div>

          <div
            onClick={() => setActiveTab('imagestudio')}
            className="p-4 rounded-2xl bg-[#15151a] border border-[#2a2822] hover:border-[#c5a059]/60 cursor-pointer transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="w-6 h-6 rounded-full bg-[#c5a059]/20 text-[#e6c687] font-black text-xs flex items-center justify-center">
                3
              </span>
              <Sparkles className="w-4 h-4 text-slate-400 group-hover:text-[#e6c687] transition" />
            </div>
            <h4 className="font-bold text-xs text-slate-200 group-hover:text-[#e6c687] transition">
              Sinh Ảnh Vertex & DALL-E 3
            </h4>
            <p className="text-[11px] text-slate-400 mt-1">Upload ảnh mẫu, sinh ảnh Vertex AI Imagen 3 & OpenAI.</p>
          </div>

          <div
            onClick={() => setActiveTab('editor')}
            className="p-4 rounded-2xl bg-[#15151a] border border-[#2a2822] hover:border-[#c5a059]/60 cursor-pointer transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="w-6 h-6 rounded-full bg-[#c5a059]/20 text-[#e6c687] font-black text-xs flex items-center justify-center">
                4
              </span>
              <Edit3 className="w-4 h-4 text-slate-400 group-hover:text-[#e6c687] transition" />
            </div>
            <h4 className="font-bold text-xs text-slate-200 group-hover:text-[#e6c687] transition">
              Xem Lại & Đăng Bài MCP
            </h4>
            <p className="text-[11px] text-slate-400 mt-1">Chỉnh sửa trực tiếp & Publish lên omfit.com.vn.</p>
          </div>
        </div>
      </div>

      {/* Recent Articles List - Bento Box */}
      <div className="glass-panel p-6 rounded-3xl space-y-4 border border-[#2a2822]">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#c5a059]" /> Danh Sách Bài Viết Đã Tạo & Xem Trước
          </h3>
          <button
            onClick={() => setActiveTab('history')}
            className="text-xs text-[#e6c687] hover:underline flex items-center gap-1 font-semibold"
          >
            Xem toàn bộ lịch sử <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#18181e] text-slate-400 font-semibold border-b border-[#2a2822]">
              <tr>
                <th className="p-3">Tiêu đề Bài viết</th>
                <th className="p-3">Từ khóa SEO</th>
                <th className="p-3">Số từ</th>
                <th className="p-3">SEO Score</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2822]">
              {articles.map((article) => (
                <tr key={article.id} className="hover:bg-[#18181e]/60 transition">
                  <td className="p-3 font-semibold text-slate-100 max-w-xs truncate">
                    {article.title}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-[#c5a059]/15 text-[#e6c687] font-mono text-[11px] border border-[#c5a059]/30">
                      {article.focusKeyword}
                    </span>
                  </td>
                  <td className="p-3 text-slate-300 font-medium">{article.wordCount} từ</td>
                  <td className="p-3 font-bold text-[#e6c687]">{article.seoScore}/100</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        article.status === 'published'
                          ? 'bg-[#c5a059]/20 text-[#e6c687] border border-[#c5a059]/40'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {article.status === 'published' ? 'Đã đăng (omfit.com.vn)' : 'Bản nháp (Draft)'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => {
                        onSelectArticleForEdit(article);
                        setActiveTab('editor');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#18181e] text-[#e6c687] border border-[#c5a059]/30 hover:bg-[#c5a059]/20 transition font-semibold text-[11px] inline-flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Xem & Chỉnh sửa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
