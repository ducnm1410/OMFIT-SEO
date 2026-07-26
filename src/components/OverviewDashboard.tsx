import React from 'react';
import {
  Activity,
  ArrowRight,
  Award,
  CheckCircle2,
  Edit3,
  FilePenLine,
  FileText,
  Globe,
  Image as ImageIcon,
  Search,
  TrendingUp,
  PieChart as PieChartIcon
} from 'lucide-react';
import type { GeneratedArticle, ActiveTab } from '../types';
import { SeoPerformanceChart } from './charts/SeoPerformanceChart';
import { CategoryPieChart } from './charts/CategoryPieChart';

interface OverviewDashboardProps {
  articles: GeneratedArticle[];
  wpConnected: boolean;
  setActiveTab: (tab: ActiveTab) => void;
  onSelectArticleForEdit: (article: GeneratedArticle) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  articles,
  wpConnected,
  setActiveTab,
  onSelectArticleForEdit
}) => {
  const publishedCount = articles.filter((article) => article.status === 'published').length;
  const totalWordCount = articles.reduce((sum, article) => sum + article.wordCount, 0);
  const scoredArticles = articles.filter((article) => article.seoScore > 0);
  const avgSeoScore = scoredArticles.length
    ? Math.round(scoredArticles.reduce((sum, article) => sum + article.seoScore, 0) / scoredArticles.length)
    : null;

  return (
    <div className="space-y-6">
      <div className="glass-panel-glow p-5 sm:p-8 rounded-3xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#E0F2FE] border border-[#0879D9]/30 text-[#0879D9] text-xs font-extrabold shadow-sm">
            <Activity className="w-3.5 h-3.5" /> OMFIT • BALANCE IN MOTION
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#071827] leading-tight">
            Hệ thống quản lý nội dung SEO <span className="gradient-text-omfit">omfit.com.vn</span>
          </h1>
          <p className="text-slate-600 text-sm leading-relaxed max-w-2xl font-medium">
            Nghiên cứu keyword từ Google Ads, soạn nội dung, quản lý hình ảnh và đăng bài WordPress.
            Dashboard chỉ hiển thị dữ liệu được tạo hoặc lấy thật trong phiên làm việc.
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Bài viết đã đăng"
          value={publishedCount.toLocaleString('vi-VN')}
          note="Dữ liệu trong phiên hiện tại"
          icon={<FileText className="w-5 h-5" />}
        />
        <MetricCard
          label="Tổng số từ đã soạn"
          value={totalWordCount.toLocaleString('vi-VN')}
          note="Tính từ nội dung đã tạo"
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <MetricCard
          label="Điểm SEO trung bình"
          value={avgSeoScore === null ? '—' : `${avgSeoScore}/100`}
          note={avgSeoScore === null ? 'Chưa có bài viết được chấm điểm' : `${scoredArticles.length} bài có dữ liệu`}
          icon={<Award className="w-5 h-5" />}
        />
        <MetricCard
          label="Kết nối WordPress"
          value={wpConnected ? 'Đã kết nối' : 'Chưa kết nối'}
          note="omfit.com.vn"
          icon={<Globe className="w-5 h-5" />}
          positive={wpConnected}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 glass-panel p-4 sm:p-6 rounded-3xl border border-[#0879D9]/15 space-y-4 bg-white">
          <h3 className="text-xs font-extrabold text-[#0879D9] uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4" /> Bài viết và điểm SEO theo ngày
          </h3>
          <SeoPerformanceChart articles={articles} />
        </section>

        <section className="lg:col-span-5 glass-panel p-4 sm:p-6 rounded-3xl border border-[#0879D9]/15 space-y-4 bg-white">
          <h3 className="text-xs font-extrabold text-[#0879D9] uppercase tracking-wider flex items-center gap-2">
            <PieChartIcon className="w-4 h-4" /> Phân bổ chuyên mục thực tế
          </h3>
          <CategoryPieChart articles={articles} />
        </section>
      </div>

      <section className="glass-panel p-6 rounded-3xl space-y-4 border border-[#0879D9]/15 bg-white">
        <h3 className="text-xs font-extrabold text-[#0879D9] uppercase tracking-wider flex items-center gap-2">
          <FilePenLine className="w-4 h-4" /> Quy trình tạo bài SEO
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <WorkflowCard step="1" label="Phân tích keyword" description="Lấy dữ liệu thật từ Google Ads." icon={<Search />} onClick={() => setActiveTab('keywords')} />
          <WorkflowCard step="2" label="Soạn bài SEO" description="Tạo dàn ý và nội dung từ dịch vụ đã cấu hình." icon={<FilePenLine />} onClick={() => setActiveTab('generator')} />
          <WorkflowCard step="3" label="Chuẩn bị hình ảnh" description="Tải lên hoặc tạo hình ảnh cho bài viết." icon={<ImageIcon />} onClick={() => setActiveTab('imagestudio')} />
          <WorkflowCard step="4" label="Kiểm tra và đăng bài" description="Biên tập rồi gửi lên WordPress." icon={<Edit3 />} onClick={() => setActiveTab('editor')} />
        </div>
      </section>

      <section className="glass-panel p-4 sm:p-6 rounded-3xl space-y-4 border border-[#0879D9]/15 bg-white">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-extrabold text-[#071827] uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#0879D9]" /> Bài viết đã tạo
          </h3>
          <button
            onClick={() => setActiveTab('history')}
            className="text-xs text-[#0879D9] hover:underline flex items-center gap-1 font-bold"
          >
            Xem lịch sử <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {articles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
            <FileText className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">Chưa có bài viết thực tế.</p>
            <p className="mt-1 text-xs text-slate-400">Bài viết mới sẽ xuất hiện ở đây sau khi được tạo.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Tiêu đề</th>
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
                    <td className="p-3 font-semibold text-[#071827] max-w-xs truncate">{article.title}</td>
                    <td className="p-3 text-slate-600">{article.focusKeyword}</td>
                    <td className="p-3 text-slate-700 font-medium">{article.wordCount.toLocaleString('vi-VN')}</td>
                    <td className="p-3 font-bold text-[#0879D9]">
                      {article.seoScore > 0 ? `${article.seoScore}/100` : 'Chưa chấm'}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        article.status === 'published'
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-100 text-amber-700 border border-amber-200'
                      }`}>
                        {article.status === 'published' ? 'Đã đăng' : 'Bản nháp'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => onSelectArticleForEdit(article)}
                        className="px-3 py-1.5 rounded-lg bg-[#F0F9FF] text-[#0879D9] border border-[#0879D9]/30 hover:bg-[#0879D9] hover:text-white transition font-bold text-[11px] inline-flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Chỉnh sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

interface MetricCardProps {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  positive?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, note, icon, positive }) => (
  <div className="glass-panel p-5 rounded-2xl space-y-2 border border-[#0879D9]/15 bg-white">
    <div className="flex items-center justify-between text-slate-500">
      <span className="text-xs font-semibold">{label}</span>
      <div className="p-2.5 rounded-xl bg-[#E0F2FE] text-[#0879D9]">{icon}</div>
    </div>
    <p className={`text-2xl font-black ${positive ? 'text-emerald-600' : 'text-[#071827]'}`}>{value}</p>
    <p className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
      {positive && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
      {note}
    </p>
  </div>
);

interface WorkflowCardProps {
  step: string;
  label: string;
  description: string;
  icon: React.ReactElement<{ className?: string }>;
  onClick: () => void;
}

const WorkflowCard: React.FC<WorkflowCardProps> = ({ step, label, description, icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="p-4 text-left rounded-2xl bg-[#F8FAFC] border border-slate-200 hover:border-[#0879D9] transition group"
  >
    <div className="flex items-center justify-between mb-2">
      <span className="w-6 h-6 rounded-full bg-[#0879D9] text-white font-black text-xs flex items-center justify-center">{step}</span>
      {React.cloneElement(icon, { className: 'w-4 h-4 text-slate-400 group-hover:text-[#0879D9] transition' })}
    </div>
    <h4 className="font-bold text-xs text-[#071827] group-hover:text-[#0879D9] transition">{label}</h4>
    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{description}</p>
  </button>
);
