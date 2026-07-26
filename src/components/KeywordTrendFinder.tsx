import React, { useEffect, useState } from 'react';
import {
  Search,
  TrendingUp,
  FilePenLine,
  ArrowRight,
  Activity,
  Info,
  Database,
  Link2,
  Unplug,
  CircleCheck
} from 'lucide-react';
import type { KeywordTrend, KeywordResearchResponse, ActiveTab, GoogleAdsConnection } from '../types';
import {
  analyzeKeywords,
  disconnectGoogleAds,
  getGoogleAdsConnection,
  selectGoogleAdsAccount,
  startGoogleAdsConnection
} from '../services/keywordResearchService';

interface KeywordTrendFinderProps {
  onSelectKeywordForArticle: (keyword: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
}

export const KeywordTrendFinder: React.FC<KeywordTrendFinderProps> = ({
  onSelectKeywordForArticle,
  setActiveTab
}) => {
  const [query, setQuery] = useState('');
  const [industry, setIndustry] = useState('OMFIT PILATES');
  const [isLoading, setIsLoading] = useState(false);
  const [trends, setTrends] = useState<KeywordTrend[]>([]);
  const [meta, setMeta] = useState<KeywordResearchResponse['meta'] | null>(null);
  const [error, setError] = useState('');
  const [connection, setConnection] = useState<GoogleAdsConnection | null>(null);
  const [isConnectionLoading, setIsConnectionLoading] = useState(true);
  const [connectionMessage, setConnectionMessage] = useState('');

  const loadConnection = async () => {
    setIsConnectionLoading(true);
    try {
      const status = await getGoogleAdsConnection();
      setConnection(status);
      if (status.reconnectRequired) {
        setConnectionMessage('Phiên Google Ads đã hết hạn. Vui lòng kết nối lại.');
      }
    } catch (err) {
      setConnection({
        connected: false,
        selectedCustomerId: '',
        accounts: []
      });
      setConnectionMessage(err instanceof Error ? err.message : 'Không thể kiểm tra kết nối Google Ads.');
    } finally {
      setIsConnectionLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthResult = params.get('google_ads');
    if (oauthResult === 'connected') {
      setConnectionMessage('Đã kết nối Google Ads thành công.');
    } else if (oauthResult === 'select_account') {
      setConnectionMessage('Đã đăng nhập. Hãy chọn tài khoản Google Ads cần sử dụng.');
    } else if (oauthResult === 'denied') {
      setConnectionMessage('Bạn đã hủy cấp quyền Google Ads.');
    } else if (oauthResult === 'error') {
      setConnectionMessage('Không thể hoàn tất kết nối Google Ads. Hãy kiểm tra OAuth Client và Redirect URI.');
    }

    if (oauthResult) {
      params.delete('google_ads');
      params.delete('detail');
      const search = params.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${search ? `?${search}` : ''}`);
    }

    void loadConnection();
  }, []);

  const handleAccountChange = async (customerId: string) => {
    setIsConnectionLoading(true);
    setConnectionMessage('');
    try {
      await selectGoogleAdsAccount(customerId);
      await loadConnection();
      setConnectionMessage('Đã chọn tài khoản Google Ads.');
    } catch (err) {
      setConnectionMessage(err instanceof Error ? err.message : 'Không thể chọn tài khoản Google Ads.');
      setIsConnectionLoading(false);
    }
  };

  const handleConnect = async () => {
    setIsConnectionLoading(true);
    setConnectionMessage('');
    try {
      await startGoogleAdsConnection();
    } catch (err) {
      setConnectionMessage(err instanceof Error ? err.message : 'Không thể kết nối Google Ads.');
      setIsConnectionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsConnectionLoading(true);
    setConnectionMessage('');
    try {
      await disconnectGoogleAds();
      setConnection({ connected: false, selectedCustomerId: '', accounts: [] });
      setTrends([]);
      setMeta(null);
      setConnectionMessage('Đã ngắt kết nối Google Ads.');
    } catch (err) {
      setConnectionMessage(err instanceof Error ? err.message : 'Không thể ngắt kết nối Google Ads.');
    } finally {
      setIsConnectionLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return;
    if (!connection?.connected || !connection.selectedCustomerId) {
      setError('Hãy kết nối và chọn tài khoản Google Ads trước khi phân tích.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const result = await analyzeKeywords({
        query: normalizedQuery,
        industry,
        pageUrl: 'https://omfit.com.vn'
      });
      setTrends(result.items);
      setMeta(result.meta);
    } catch (err) {
      console.error('Error fetching trends:', err);
      setTrends([]);
      setMeta(null);
      setError(err instanceof Error ? err.message : 'Không thể lấy dữ liệu keyword.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-3xl space-y-4 border border-[#0879D9]/15 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-[#071827] flex items-center gap-2">
              <Search className="w-5 h-5 text-[#0879D9]" /> Phân tích keyword và xu hướng SEO
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Nhập chủ đề để nhận nhóm từ khóa, ý định tìm kiếm và từ khóa liên quan theo định hướng OMFIT.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#E0F2FE] border border-[#0879D9]/30 text-[#0879D9] text-xs font-bold flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" /> OMFIT Keyword Finder
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {connection?.connected ? (
                  <CircleCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <Link2 className="h-4 w-4 shrink-0 text-[#0879D9]" />
                )}
                <p className="text-sm font-bold text-[#071827]">
                  {isConnectionLoading
                    ? 'Đang kiểm tra kết nối Google Ads...'
                    : connection?.connected
                      ? 'Google Ads đã kết nối'
                      : 'Kết nối tài khoản Google Ads'}
                </p>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                User đăng nhập trực tiếp với Google. Token được mã hóa trong cookie bảo mật và không hiển thị trên trình duyệt.
              </p>
            </div>

            {!isConnectionLoading && !connection?.connected && (
              <button
                type="button"
                onClick={() => void handleConnect()}
                className="shrink-0 rounded-xl bg-[#0879D9] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0668bb]"
              >
                Đăng nhập Google Ads
              </button>
            )}

            {!isConnectionLoading && connection?.connected && (
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                {connection.accounts.length > 0 && (
                  <select
                    aria-label="Chọn tài khoản Google Ads"
                    value={connection.selectedCustomerId}
                    onChange={(event) => void handleAccountChange(event.target.value)}
                    className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-[#0879D9] focus:outline-none"
                  >
                    <option value="">Chọn Customer ID</option>
                    {connection.accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.label}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => void handleDisconnect()}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-rose-200 hover:text-rose-600"
                >
                  <Unplug className="h-3.5 w-3.5" /> Ngắt kết nối
                </button>
              </div>
            )}
          </div>

          {connection?.connected && connection.accounts.length === 0 && !isConnectionLoading && (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Tài khoản Google hiện tại chưa truy cập được Customer ID Google Ads nào.
            </p>
          )}
          {connectionMessage && (
            <p className="mt-3 text-xs font-medium text-slate-600">{connectionMessage}</p>
          )}
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
              className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#071827] text-sm focus:outline-none focus:border-[#0879D9] transition font-medium"
              required
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-bold text-slate-700 mb-1">Kiến Trúc Thương Hiệu</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#071827] text-sm focus:outline-none focus:border-[#0879D9] transition font-semibold"
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
              disabled={isLoading || isConnectionLoading || !connection?.connected || !connection.selectedCustomerId}
              className="w-full gradient-bg-omfit-btn px-4 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 shadow-md shadow-[#0879D9]/20 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Đang lấy dữ liệu...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" /> Phân tích
                </>
              )}
            </button>
          </div>
        </form>
        <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-900">
          <Database className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Search volume, competition và lịch sử theo tháng được lấy từ Google Ads Keyword Planner.
            Model chỉ phân loại intent, cluster và đề xuất hướng nội dung.
          </p>
        </div>
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </div>

      {/* Keyword Trend Cards List */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#0879D9]" /> Kết quả keyword ({trends.length})
          </h3>
          {meta && (
            <span className="text-xs text-slate-500">
              Google Ads · Việt Nam · {meta.modelApplied ? 'Đã phân tích SEO' : 'Chưa cấu hình model'}
            </span>
          )}
        </div>
        {meta?.warnings.map((warning) => (
          <div key={warning} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {warning}
          </div>
        ))}

        {trends.length === 0 && !isLoading && !error ? (
          <div className="glass-panel rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <Search className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">Nhập chủ đề để lấy dữ liệu keyword thực tế.</p>
          </div>
        ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {trends.map((item, index) => (
            <div
              key={`${item.keyword}-${index}`}
              className="glass-panel p-5 rounded-3xl space-y-4 border border-[#0879D9]/15 hover:border-[#0879D9] transition group relative overflow-hidden bg-white"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#E0F2FE] text-[#0879D9] border border-[#0879D9]/30">
                      {item.intent}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold tabular-nums">Lượt tìm kiếm: {item.searchVolume}</span>
                    <span className="text-xs text-slate-500 font-semibold">Cạnh tranh: {item.competitionIndex}/100</span>
                  </div>
                  <h4 className="font-extrabold text-base text-[#071827] group-hover:text-[#0879D9] transition">
                    {item.keyword}
                  </h4>
                </div>

                <div className="sm:text-right shrink-0">
                  <div className="text-xs font-bold text-[#0879D9] font-mono">Score: {item.trendScore}/100</div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    Độ khó: {item.difficulty}
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                <p className="font-bold text-[#071827]">Cluster: {item.cluster}</p>
                <p className="mt-1 leading-relaxed">{item.contentAngle}</p>
              </div>

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
                  <FilePenLine className="w-3.5 h-3.5" /> Soạn bài SEO với keyword này
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
};
