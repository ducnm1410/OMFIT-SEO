import React from 'react';
import {
  ChevronRight,
  Cloud,
  CloudOff,
  FilePlus2,
  LoaderCircle,
  LogOut,
  Menu,
  ShieldCheck,
  UserRound
} from 'lucide-react';
import type { ActiveTab, ApiSettings, WorkflowSaveStatus } from '../types';

interface HeaderProps {
  activeTab: ActiveTab;
  settings: ApiSettings;
  userLabel: string;
  currentArticleTitle?: string;
  saveStatus: WorkflowSaveStatus;
  onLogout: () => void;
  onQuickGenerate: () => void;
  onMenuToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  settings,
  userLabel,
  currentArticleTitle,
  saveStatus,
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
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5 text-sm">
          <span className="hidden font-medium text-slate-400 sm:inline">Workspace</span>
          <ChevronRight className="hidden h-3.5 w-3.5 text-slate-300 sm:block" />
          <h2 className="truncate font-semibold text-[#17191D]">{pageLabels[activeTab]}</h2>
        </div>
        {currentArticleTitle && (
          <p className="mt-0.5 max-w-[48vw] truncate text-[10px] font-medium text-slate-500 sm:max-w-xs">
            Đang làm: <span className="text-slate-700">{currentArticleTitle}</span>
          </p>
        )}
      </div>
    </div>

    <div className="flex items-center gap-2 sm:gap-3">
      <div className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-white border border-slate-200">
        <ShieldCheck className="w-4 h-4 text-emerald-600" />
        <span className="text-slate-700">
          {settings.wpMcpConnected ? 'WordPress đã kết nối' : 'Chưa kết nối WordPress'}
        </span>
      </div>

      {currentArticleTitle && (
        <div className={`hidden xl:flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-medium ${
          saveStatus === 'error'
            ? 'border-rose-200 bg-rose-50 text-rose-700'
            : 'border-slate-200 bg-white text-slate-500'
        }`}>
          {saveStatus === 'saving' && <LoaderCircle className="h-3.5 w-3.5 animate-spin text-[#0879D9]" />}
          {saveStatus === 'error' && <CloudOff className="h-3.5 w-3.5" />}
          {(saveStatus === 'idle' || saveStatus === 'saved') && <Cloud className="h-3.5 w-3.5 text-emerald-600" />}
          {saveStatus === 'saving'
            ? 'Đang lưu'
            : saveStatus === 'error'
              ? 'Lỗi lưu'
              : 'Đã lưu'}
        </div>
      )}

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
