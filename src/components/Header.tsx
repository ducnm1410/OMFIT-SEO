import React from 'react';
import { Activity, FilePlus2, LogOut, Menu, ShieldCheck, UserRound } from 'lucide-react';
import type { ApiSettings } from '../types';

interface HeaderProps {
  settings: ApiSettings;
  userLabel: string;
  onLogout: () => void;
  onQuickGenerate: () => void;
  onMenuToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  userLabel,
  onLogout,
  onQuickGenerate,
  onMenuToggle
}) => (
  <header className="min-h-16 bg-white/95 border-b border-[#0879D9]/15 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 sticky top-0 z-20 backdrop-blur-md">
    <div className="flex items-center gap-3 min-w-0">
      <button
        type="button"
        onClick={onMenuToggle}
        className="md:hidden w-11 h-11 shrink-0 rounded-xl border border-slate-200 text-slate-700 grid place-items-center hover:bg-slate-50"
        aria-label="Mở trình đơn"
      >
        <Menu className="w-5 h-5" />
      </button>
      <h2 className="text-sm font-bold text-[#071827] flex items-center gap-2 min-w-0">
        <Activity className="w-4 h-4 text-[#0879D9]" />
        <span className="truncate">OMFIT SEO</span>
      </h2>
    </div>

    <div className="flex items-center gap-2 sm:gap-3">
      <div className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-[#F0F9FF] border border-[#0879D9]/20">
        <ShieldCheck className="w-4 h-4 text-[#0879D9]" />
        <span className="text-slate-700">
          {settings.wpMcpConnected ? 'WordPress đã kết nối' : 'Chưa kết nối WordPress'}
        </span>
      </div>

      <div className="hidden sm:flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
        <UserRound className="h-4 w-4 shrink-0 text-[#0879D9]" />
        <span className="max-w-36 truncate">{userLabel}</span>
      </div>

      <button
        type="button"
        onClick={onQuickGenerate}
        className="gradient-bg-omfit-btn px-3 sm:px-4 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-2 shadow-md shadow-[#0879D9]/20 whitespace-nowrap"
      >
        <FilePlus2 className="w-4 h-4" />
        <span className="hidden sm:inline">Tạo bài SEO mới</span>
        <span className="sm:hidden">Tạo bài</span>
      </button>

      <button
        type="button"
        onClick={onLogout}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:text-rose-600"
        aria-label="Đăng xuất"
        title="Đăng xuất"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  </header>
);
