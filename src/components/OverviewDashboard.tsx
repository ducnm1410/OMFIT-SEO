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
  Activity,
  BarChart3,
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
      {/* Welcome Banner - Bento Hero Card OMFIT Official */}
      <div className="glass-panel-glow p-8 rounded-3xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#0879D9]/20 border border-[#28A9F4]/40 text-[#28A9F4] text-xs font-bold shadow-md">
            <Activity className="w-3.5 h-3.5" /> OMFIT BRAND GUIDELINE v1.0 • BALANCE IN MOTION
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            Hệ Thống Đăng Bài SEO Tự Động <span className="gradient-text-omfit">omfit.com.vn</span>
          </h1>
          <p className="text-[#DCEAF0] text-xs leading-relaxed max-w-2xl">
            Tự động hóa 100% quy trình SEO chuẩn thương hiệu OMFIT: Crawl keyword theo 3 trụ cột (OMFIT PILATES, OMFIT FITNESS, OMFIT WELLNESS), sinh bài viết Gemini, tạo hình ảnh Vertex AI Imagen 3 & OpenAI DALL-E 3, đăng bài qua MCP WordPress Server.
          </p>
          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={() => setActiveTab('keywords')}
              className="gradient-bg-omfit-btn px-5 py-2.5 rounded-2xl text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-[#0879D9]/30"
            >
              <Search className="w-4 h-4" /> Crawl Keyword & Trend Ngay
            </button>
            <button
              onClick={() => setActiveTab('generator')}
              className="px-4 py-2.5 rounded-2xl text-xs font-bold text-[#F3F0E9] bg-[#071827] border border-[#0879D9]/40 hover:border-[#28A9F4] transition flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-[#28A9F4]" /> Sinh Bài Viết SEO
            </button>
          </div>
        </div>

        {/* Orbit Motion Line Graphic Motif */}
        <div className="absolute right-[-40px] top-[-40px] w-96 h-96 border border-[#28A9F4]/20 rounded-full pointer-events-none" />
        <div className="absolute right-[-10px] top-[-10px] w-72 h-72 border border-[#0879D9]/30 rounded-full pointer-events-none" />
      </div>

      {/* Top Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl space-y-2 border border-[#28A9F4]/20 hover:border-[#28A9F4]/60 transition">
          <div className="flex items-center justify-between text-[#DCEAF0]">
            <span className="text-xs font-semibold">Bài Viết Đã Đăng</span>
            <div className="p-2.5 rounded-xl bg-[#0879D9]/20 text-[#28A9F4]">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-white">{publishedCount}</p>
          <p className="text-[11px] text-[#28A9F4] flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3" /> Xuất bản qua MCP WordPress
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl space-y-2 border border-[#28A9F4]/20 hover:border-[#28A9F4]/60 transition">
          <div className="flex items-center justify-between text-[#DCEAF0]">
            <span className="text-xs font-semibold">Tổng Số Từ AI Viết</span>
            <div className="p-2.5 rounded-xl bg-[#28A9F4]/20 text-[#28A9F4]">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-white">{totalWordCount.toLocaleString()} từ</p>
          <p className="text-[11px] text-[#DCEAF0] font-medium">Định dạng Gutenberg & Elementor</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl space-y-2 border border-[#28A9F4]/20 hover:border-[#28A9F4]/60 transition">
          <div className="flex items-center justify-between text-[#DCEAF0]">
            <span className="text-xs font-semibold">Điểm SEO Trung Bình</span>
            <div className="p-2.5 rounded-xl bg-[#D7C8B7]/20 text-[#D7C8B7]">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-[#28A9F4]">{avgSeoScore}/100</p>
          <p className="text-[11px] text-[#DCEAF0]/70 font-medium">Đạt tiêu chuẩn On-Page Google</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl space-y-2 border border-[#28A9F4]/20 hover:border-[#28A9F4]/60 transition">
          <div className="flex items-center justify-between text-[#DCEAF0]">
            <span className="text-xs font-semibold">Trạng Thái MCP Site</span>
            <div className="p-2.5 rounded-xl bg-[#0879D9]/20 text-[#28A9F4]">
              <Globe className="w-5 h-5" />
            </div>
          </div>
          <p className="text-base font-bold text-white truncate">omfit.com.vn</p>
          <p className="text-[11px] text-[#28A9F4] font-medium">wsp-omfit-com-vn Active</p>
        </div>
      </div>

      {/* ECharts Bento Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 glass-panel p-6 rounded-3xl border border-[#28A9F4]/20 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#28A9F4] uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#0879D9]" /> Tăng Trưởng Đăng Bài & Điểm SEO Theo Tuần (ECharts)
            </h3>
            <span className="text-[11px] text-[#DCEAF0] font-mono">Performance Analytics</span>
          </div>
          <SeoPerformanceChart />
        </div>

        <div className="lg:col-span-4 glass-panel p-6 rounded-3xl border border-[#28A9F4]/20 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#28A9F4] uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#0879D9]" /> Đánh Giá 6 Chỉ Số SEO On-Page
            </h3>
          </div>
          <SeoRadarChart />
        </div>
      </div>

      {/* ECharts Bento Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 glass-panel p-6 rounded-3xl border border-[#28A9F4]/20 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#28A9F4] uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#0879D9]" /> Lượng Tìm Kiếm Hàng Tháng Theo Nhóm Từ Khóa
            </h3>
          </div>
          <KeywordTrendChart />
        </div>

        <div className="lg:col-span-5 glass-panel p-6 rounded-3xl border border-[#28A9F4]/20 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#28A9F4] uppercase tracking-wider flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-[#0879D9]" /> Tỷ Lệ Phân Bổ Kiến Trúc Thương Hiệu (OMFIT Architecture)
            </h3>
          </div>
          <CategoryPieChart />
        </div>
      </div>

      {/* Workflow Stepper */}
      <div className="glass-panel p-6 rounded-3xl space-y-4 border border-[#28A9F4]/20">
        <h3 className="text-xs font-bold text-[#28A9F4] uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#0879D9]" /> Quy Trình 4 Bước Đăng Bài SEO Tự Động OMFIT
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div
            onClick={() => setActiveTab('keywords')}
            className="p-4 rounded-2xl bg-[#071827] border border-[#0879D9]/30 hover:border-[#28A9F4] cursor-pointer transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="w-6 h-6 rounded-full bg-[#0879D9]/20 text-[#28A9F4] font-black text-xs flex items-center justify-center">
                1
              </span>
              <Search className="w-4 h-4 text-[#DCEAF0]/60 group-hover:text-[#28A9F4] transition" />
            </div>
            <h4 className="font-bold text-xs text-white group-hover:text-[#28A9F4] transition">
              Crawl Keyword & Trend
            </h4>
            <p className="text-[11px] text-[#DCEAF0]/70 mt-1">Phân tích từ khóa OMFIT Pilates, Fitness, Wellness.</p>
          </div>

          <div
            onClick={() => setActiveTab('generator')}
            className="p-4 rounded-2xl bg-[#071827] border border-[#0879D9]/30 hover:border-[#28A9F4] cursor-pointer transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="w-6 h-6 rounded-full bg-[#0879D9]/20 text-[#28A9F4] font-black text-xs flex items-center justify-center">
                2
              </span>
              <Sparkles className="w-4 h-4 text-[#DCEAF0]/60 group-hover:text-[#28A9F4] transition" />
            </div>
            <h4 className="font-bold text-xs text-white group-hover:text-[#28A9F4] transition">
              Sinh Bài Viết Gemini
            </h4>
            <p className="text-[11px] text-[#DCEAF0]/70 mt-1">Tạo dàn ý H2/H3, viết bài chuẩn On-Page.</p>
          </div>

          <div
            onClick={() => setActiveTab('imagestudio')}
            className="p-4 rounded-2xl bg-[#071827] border border-[#0879D9]/30 hover:border-[#28A9F4] cursor-pointer transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="w-6 h-6 rounded-full bg-[#0879D9]/20 text-[#28A9F4] font-black text-xs flex items-center justify-center">
                3
              </span>
              <Sparkles className="w-4 h-4 text-[#DCEAF0]/60 group-hover:text-[#28A9F4] transition" />
            </div>
            <h4 className="font-bold text-xs text-white group-hover:text-[#28A9F4] transition">
              Sinh Ảnh Vertex & OpenAI
            </h4>
            <p className="text-[11px] text-[#DCEAF0]/70 mt-1">Sinh ảnh Vertex AI Imagen 3 & DALL-E 3.</p>
          </div>

          <div
            onClick={() => setActiveTab('editor')}
            className="p-4 rounded-2xl bg-[#071827] border border-[#0879D9]/30 hover:border-[#28A9F4] cursor-pointer transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="w-6 h-6 rounded-full bg-[#0879D9]/20 text-[#28A9F4] font-black text-xs flex items-center justify-center">
                4
              </span>
              <Edit3 className="w-4 h-4 text-[#DCEAF0]/60 group-hover:text-[#28A9F4] transition" />
            </div>
            <h4 className="font-bold text-xs text-white group-hover:text-[#28A9F4] transition">
              Xem Lại & Đăng Bài MCP
            </h4>
            <p className="text-[11px] text-[#DCEAF0]/70 mt-1">Chỉnh sửa trực tiếp & Publish lên omfit.com.vn.</p>
          </div>
        </div>
      </div>

      {/* Recent Articles */}
      <div className="glass-panel p-6 rounded-3xl space-y-4 border border-[#28A9F4]/20">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#28A9F4]" /> Danh Sách Bài Viết Đã Tạo & Xem Trước
          </h3>
          <button
            onClick={() => setActiveTab('history')}
            className="text-xs text-[#28A9F4] hover:underline flex items-center gap-1 font-semibold"
          >
            Xem toàn bộ lịch sử <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#071827] text-[#DCEAF0] font-semibold border-b border-[#0879D9]/30">
              <tr>
                <th className="p-3">Tiêu đề Bài viết</th>
                <th className="p-3">Từ khóa SEO</th>
                <th className="p-3">Số từ</th>
                <th className="p-3">SEO Score</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0879D9]/20">
              {articles.map((article) => (
                <tr key={article.id} className="hover:bg-[#071827]/60 transition">
                  <td className="p-3 font-semibold text-white max-w-xs truncate">
                    {article.title}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-[#0879D9]/20 text-[#28A9F4] font-mono text-[11px] border border-[#0879D9]/40">
                      {article.focusKeyword}
                    </span>
                  </td>
                  <td className="p-3 text-[#F3F0E9] font-medium">{article.wordCount} từ</td>
                  <td className="p-3 font-bold text-[#28A9F4]">{article.seoScore}/100</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        article.status === 'published'
                          ? 'bg-[#0879D9]/20 text-[#28A9F4] border border-[#0879D9]/40'
                          : 'bg-[#D7C8B7]/20 text-[#D7C8B7] border border-[#D7C8B7]/30'
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
                      className="px-3 py-1.5 rounded-lg bg-[#071827] text-[#28A9F4] border border-[#0879D9]/40 hover:bg-[#0879D9]/20 transition font-semibold text-[11px] inline-flex items-center gap-1"
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
