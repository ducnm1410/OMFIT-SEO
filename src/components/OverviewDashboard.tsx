import React from 'react';
import {
  FileText,
  TrendingUp,
  Award,
  Globe,
  FilePenLine,
  Image as ImageIcon,
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
      {/* Welcome Banner - Hero Light Blue Card */}
      <div className="glass-panel-glow p-5 sm:p-8 rounded-3xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#E0F2FE] border border-[#0879D9]/30 text-[#0879D9] text-xs font-extrabold shadow-sm">
            <Activity className="w-3.5 h-3.5" /> OMFIT LIGHT THEME • BALANCE IN MOTION
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#071827] leading-tight">
            Hệ Thống Đăng Bài SEO Tự Động <span className="gradient-text-omfit">omfit.com.vn</span>
          </h1>
          <p className="text-slate-600 text-sm leading-relaxed max-w-2xl font-medium">
            Quản lý quy trình SEO theo ba trụ cột OMFIT Pilates, OMFIT Fitness và OMFIT Wellness: nghiên cứu keyword, soạn nội dung, quản lý hình ảnh và đăng bài WordPress.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              onClick={() => setActiveTab('keywords')}
              className="gradient-bg-omfit-btn px-5 py-2.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 shadow-md shadow-[#0879D9]/20"
            >
              <Search className="w-4 h-4" /> Phân tích keyword
            </button>
            <button
              onClick={() => setActiveTab('generator')}
              className="px-4 py-2.5 rounded-2xl text-sm font-bold text-[#071827] bg-white border border-[#0879D9]/30 hover:border-[#0879D9] hover:bg-[#F0F9FF] transition flex items-center justify-center gap-2"
            >
              <FilePenLine className="w-4 h-4 text-[#0879D9]" /> Soạn bài viết SEO
            </button>
          </div>
        </div>

        <div className="absolute right-[-40px] top-[-40px] w-96 h-96 border border-[#0879D9]/15 rounded-full pointer-events-none" />
        <div className="absolute right-[-10px] top-[-10px] w-72 h-72 border border-[#0879D9]/25 rounded-full pointer-events-none" />
      </div>

      {/* Top Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl space-y-2 border border-[#0879D9]/15 hover:border-[#0879D9]/40 transition bg-white">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Bài Viết Đã Đăng</span>
            <div className="p-2.5 rounded-xl bg-[#E0F2FE] text-[#0879D9]">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-[#071827]">{publishedCount}</p>
          <p className="text-[11px] text-[#0879D9] flex items-center gap-1 font-semibold">
            <CheckCircle2 className="w-3 h-3" /> Xuất bản qua MCP WordPress
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl space-y-2 border border-[#0879D9]/15 hover:border-[#0879D9]/40 transition bg-white">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Tổng số từ đã soạn</span>
            <div className="p-2.5 rounded-xl bg-[#E0F2FE] text-[#0879D9]">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-[#071827]">{totalWordCount.toLocaleString()} từ</p>
          <p className="text-[11px] text-slate-500 font-medium">Định dạng Gutenberg & Elementor</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl space-y-2 border border-[#0879D9]/15 hover:border-[#0879D9]/40 transition bg-white">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Điểm SEO Trung Bình</span>
            <div className="p-2.5 rounded-xl bg-[#E0F2FE] text-[#0879D9]">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-[#0879D9]">{avgSeoScore}/100</p>
          <p className="text-[11px] text-slate-500 font-medium">Đạt tiêu chuẩn On-Page Google</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl space-y-2 border border-[#0879D9]/15 hover:border-[#0879D9]/40 transition bg-white">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Trạng Thái MCP Site</span>
            <div className="p-2.5 rounded-xl bg-[#E0F2FE] text-[#0879D9]">
              <Globe className="w-5 h-5" />
            </div>
          </div>
          <p className="text-base font-bold text-[#071827] truncate">omfit.com.vn</p>
          <p className="text-[11px] text-[#0879D9] font-semibold">wsp-omfit-com-vn Active</p>
        </div>
      </div>

      {/* ECharts Bento Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 glass-panel p-4 sm:p-6 rounded-3xl border border-[#0879D9]/15 space-y-4 bg-white">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-[#0879D9] uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#0879D9]" /> Tăng Trưởng Đăng Bài & Điểm SEO Theo Tuần (ECharts)
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Performance Analytics</span>
          </div>
          <SeoPerformanceChart />
        </div>

        <div className="lg:col-span-5 glass-panel p-4 sm:p-6 rounded-3xl border border-[#0879D9]/15 space-y-4 bg-white">
          <div className="flex items-center justify-between">
            <h3 className="min-w-0 text-[12px] leading-5 font-extrabold text-[#0879D9] uppercase tracking-wide flex items-start gap-2">
              <BarChart3 className="w-4 h-4 mt-0.5 shrink-0 text-[#0879D9]" /> <span>Đánh Giá 6 Chỉ Số SEO On-Page</span>
            </h3>
          </div>
          <SeoRadarChart />
        </div>
      </div>

      {/* ECharts Bento Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 glass-panel p-6 rounded-3xl border border-[#0879D9]/15 space-y-4 bg-white">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-[#0879D9] uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#0879D9]" /> Lượng Tìm Kiếm Hàng Tháng Theo Nhóm Từ Khóa
            </h3>
          </div>
          <KeywordTrendChart />
        </div>

        <div className="lg:col-span-5 glass-panel p-6 rounded-3xl border border-[#0879D9]/15 space-y-4 bg-white">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-[#0879D9] uppercase tracking-wider flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-[#0879D9]" /> Tỷ Lệ Phân Bổ Kiến Trúc Thương Hiệu (OMFIT Architecture)
            </h3>
          </div>
          <CategoryPieChart />
        </div>
      </div>

      {/* Workflow Stepper */}
      <div className="glass-panel p-6 rounded-3xl space-y-4 border border-[#0879D9]/15 bg-white">
        <h3 className="text-xs font-extrabold text-[#0879D9] uppercase tracking-wider flex items-center gap-2">
          <FilePenLine className="w-4 h-4 text-[#0879D9]" /> Quy trình 4 bước đăng bài SEO OMFIT
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div
            onClick={() => setActiveTab('keywords')}
            className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200 hover:border-[#0879D9] cursor-pointer transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="w-6 h-6 rounded-full bg-[#0879D9] text-white font-black text-xs flex items-center justify-center">
                1
              </span>
              <Search className="w-4 h-4 text-slate-400 group-hover:text-[#0879D9] transition" />
            </div>
            <h4 className="font-bold text-xs text-[#071827] group-hover:text-[#0879D9] transition">
              Crawl Keyword & Trend
            </h4>
            <p className="text-[11px] text-slate-500 mt-1">Phân tích từ khóa OMFIT Pilates, Fitness, Wellness.</p>
          </div>

          <div
            onClick={() => setActiveTab('generator')}
            className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200 hover:border-[#0879D9] cursor-pointer transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="w-6 h-6 rounded-full bg-[#0879D9] text-white font-black text-xs flex items-center justify-center">
                2
              </span>
              <FilePenLine className="w-4 h-4 text-slate-400 group-hover:text-[#0879D9] transition" />
            </div>
            <h4 className="font-bold text-xs text-[#071827] group-hover:text-[#0879D9] transition">
              Soạn bài viết SEO
            </h4>
            <p className="text-[11px] text-slate-500 mt-1">Tạo dàn ý H2/H3, viết bài chuẩn On-Page.</p>
          </div>

          <div
            onClick={() => setActiveTab('imagestudio')}
            className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200 hover:border-[#0879D9] cursor-pointer transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="w-6 h-6 rounded-full bg-[#0879D9] text-white font-black text-xs flex items-center justify-center">
                3
              </span>
              <ImageIcon className="w-4 h-4 text-slate-400 group-hover:text-[#0879D9] transition" />
            </div>
            <h4 className="font-bold text-xs text-[#071827] group-hover:text-[#0879D9] transition">
              Chuẩn bị hình ảnh
            </h4>
            <p className="text-[11px] text-slate-500 mt-1">Tải lên hoặc tạo hình ảnh chuẩn SEO.</p>
          </div>

          <div
            onClick={() => setActiveTab('editor')}
            className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200 hover:border-[#0879D9] cursor-pointer transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="w-6 h-6 rounded-full bg-[#0879D9] text-white font-black text-xs flex items-center justify-center">
                4
              </span>
              <Edit3 className="w-4 h-4 text-slate-400 group-hover:text-[#0879D9] transition" />
            </div>
            <h4 className="font-bold text-xs text-[#071827] group-hover:text-[#0879D9] transition">
              Xem Lại & Đăng Bài MCP
            </h4>
            <p className="text-[11px] text-slate-500 mt-1">Chỉnh sửa trực tiếp & Publish lên omfit.com.vn.</p>
          </div>
        </div>
      </div>

      {/* Recent Articles */}
      <div className="glass-panel p-6 rounded-3xl space-y-4 border border-[#0879D9]/15 bg-white">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-[#071827] uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#0879D9]" /> Danh Sách Bài Viết Đã Tạo & Xem Trước
          </h3>
          <button
            onClick={() => setActiveTab('history')}
            className="text-xs text-[#0879D9] hover:underline flex items-center gap-1 font-bold"
          >
            Xem toàn bộ lịch sử <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">Tiêu đề Bài viết</th>
                <th className="p-3">Từ khóa SEO</th>
                <th className="p-3">Số từ</th>
                <th className="p-3">SEO Score</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {articles.map((article) => (
                <tr key={article.id} className="hover:bg-[#F0F9FF] transition">
                  <td className="p-3 font-semibold text-[#071827] max-w-xs truncate">
                    {article.title}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-[#E0F2FE] text-[#0879D9] font-mono text-[11px] border border-[#0879D9]/20 font-bold">
                      {article.focusKeyword}
                    </span>
                  </td>
                  <td className="p-3 text-slate-700 font-medium">{article.wordCount} từ</td>
                  <td className="p-3 font-bold text-[#0879D9]">{article.seoScore}/100</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        article.status === 'published'
                          ? 'bg-[#0879D9]/15 text-[#0879D9] border border-[#0879D9]/30'
                          : 'bg-amber-100 text-amber-700 border border-amber-300'
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
                      className="px-3 py-1.5 rounded-lg bg-[#F0F9FF] text-[#0879D9] border border-[#0879D9]/30 hover:bg-[#0879D9] hover:text-white transition font-bold text-[11px] inline-flex items-center gap-1"
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
