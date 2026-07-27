import React from 'react';
import { ChevronRight, FilePlus2, LogOut, Menu, ShieldCheck, UserRound } from 'lucide-react';
import type { ActiveTab, ApiSettings } from '../types';

interface HeaderProps {
  activeTab: ActiveTab;
  settings: ApiSettings;
  userLabel: string;
  onLogout: () => void;
  onQuickGenerate: () => void;
  onMenuToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  settings,
  userLabel,
  onLogout,
  onQuickGenerate,
  onMenuToggle
}) => {
  const pageLabels: Record<ActiveTab, string> = {
    overview: 'Tổng quan',
    keywords: 'Phân tích keyword',
    generator: 'Soạn bài SEO',
    imagestudio: 'Thư viện hình ảnh',
    editor: 'Biên tập & xuất bản',
    history: 'Lịch sử bài viết',
    settings: 'Cài đặt thương hiệu'
  };

  return (
  <header className="ui-topbar min-h-16 px-4 sm:px-6 xl:px-8 py-2.5 flex items-center justify-between gap-3 sticky top-0 z-20">
    <div className="flex items-center gap-3 min-w-0">
      <button
        type="button"
        onClick={onMenuToggle}
        className="md:hidden w-10 h-10 shrink-0 rounded-lg border border-slate-200 text-slate-700 grid place-items-center hover:bg-slate-50"
        aria-label="Mở trình đơn"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="hidden font-medium text-slate-400 sm:inline">Workspace</span>
        <ChevronRight className="hidden h-3.5 w-3.5 text-slate-300 sm:block" />
        <h2 className="truncate font-semibold text-[#17191D]">{pageLabels[activeTab]}</h2>
      </div>
    </div>

    <div className="flex items-center gap-2 sm:gap-3">
      <div className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-white border border-slate-200">
        <ShieldCheck className="w-4 h-4 text-emerald-600" />
        <span className="text-slate-700">
          {settings.wpMcpConnected ? 'WordPress đã kết nối' : 'Chưa kết nối WordPress'}
        </span>
      </div>

      <div className="hidden sm:flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
        <UserRound className="h-4 w-4 shrink-0 text-[#0879D9]" />
        <span className="max-w-36 truncate">{userLabel}</span>
      </div>

      <button
        type="button"
        onClick={onQuickGenerate}
        className="gradient-bg-omfit-btn px-3 sm:px-4 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center gap-2 whitespace-nowrap"
      >
        <FilePlus2 className="w-4 h-4" />
        <span className="hidden sm:inline">Tạo bài SEO mới</span>
        <span className="sm:hidden">Tạo bài</span>
      </button>

      <button
        type="button"
        onClick={onLogout}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
        aria-label="Đăng xuất"
        title="Đăng xuất"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  </header>
  );
};
