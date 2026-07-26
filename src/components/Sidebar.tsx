import React from 'react';
import {
  LayoutDashboard,
  Search,
  FilePenLine,
  Image as ImageIcon,
  Edit3,
  History,
  Globe,
  CheckCircle2,
  Activity,
  Settings2,
  X
} from 'lucide-react';
import type { ActiveTab } from '../types';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  wpConnected: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  wpConnected,
  isOpen,
  onClose
}) => {
  const menuItems = [
    { id: 'overview', label: 'Tổng Quan', icon: LayoutDashboard, badge: '' },
    { id: 'keywords', label: 'Phân Tích Keyword', icon: Search, badge: 'HOT' },
    { id: 'generator', label: 'Soạn Bài Viết SEO', icon: FilePenLine, badge: '' },
    { id: 'imagestudio', label: 'Thư Viện Hình Ảnh', icon: ImageIcon, badge: '' },
    { id: 'editor', label: 'Xem & Đăng Bài MCP', icon: Edit3, badge: 'Live' },
    { id: 'history', label: 'Lịch Sử Đăng Bài', icon: History, badge: '' },
    { id: 'settings', label: 'Brand Settings', icon: Settings2, badge: '' }
  ];

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/45 md:hidden"
          onClick={onClose}
          aria-label="Đóng trình đơn"
        />
      )}
      <aside className={`w-[280px] md:w-64 bg-white border-r border-[#0879D9]/15 flex flex-col justify-between h-dvh fixed md:sticky top-0 z-50 md:z-30 shadow-xl md:shadow-sm transition-transform duration-200 ${
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
      <div>
        {/* Brand Header OMFIT Light */}
        <div className="p-4 border-b border-[#0879D9]/15 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0879D9] to-[#0284C7] flex items-center justify-center text-white font-black shadow-md shadow-[#0879D9]/20">
            <Activity className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-black text-lg tracking-tight leading-none text-[#071827]">
              OMFIT
            </h1>
            <p className="text-[9px] leading-3 text-[#0879D9] font-bold tracking-wide mt-1 uppercase break-words">
              FITNESS & WELLNESS • BALANCE FOR LIFE
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="md:hidden ml-auto w-11 h-11 rounded-xl grid place-items-center text-slate-500 hover:bg-slate-100"
            aria-label="Đóng trình đơn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Connection Badge */}
        <div className="mx-4 my-4 p-3 rounded-xl bg-[#F0F9FF] border border-[#0879D9]/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#0879D9] animate-pulse" />
            <div>
              <p className="text-xs font-bold text-[#071827]">omfit.com.vn</p>
              <p className="text-xs text-[#0879D9] flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 inline" />
                {wpConnected ? 'Đã kết nối' : 'Chưa kết nối'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="px-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as ActiveTab);
                  onClose();
                }}
                className={`w-full min-h-12 flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-[12px] leading-5 font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-[#E0F2FE] text-[#0879D9] border border-[#0879D9]/30 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-[#0879D9] hover:bg-slate-50'
                }`}
              >
                <div className="min-w-0 flex items-center gap-2.5">
                  <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-[#0879D9]' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`shrink-0 text-[9px] leading-4 font-extrabold px-1.5 py-0.5 rounded-full ${
                      item.badge === 'HOT'
                        ? 'bg-[#0879D9] text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[#0879D9]/15">
        <div className="text-center">
          <p className="text-[10px] text-slate-400 font-medium">OMFIT Brand Light Theme • AutoPoster</p>
        </div>
      </div>
      </aside>
    </>
  );
};
