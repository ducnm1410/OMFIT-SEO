import React from 'react';
import {
  LayoutDashboard,
  Search,
  Sparkles,
  Image as ImageIcon,
  Edit3,
  History,
  Settings,
  Globe,
  CheckCircle2,
  Activity
} from 'lucide-react';
import type { ActiveTab } from '../types';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  wpConnected: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, wpConnected }) => {
  const menuItems = [
    { id: 'overview', label: 'Tổng Quan', icon: LayoutDashboard, badge: '' },
    { id: 'keywords', label: 'Crawl Keyword & Trend', icon: Search, badge: 'HOT' },
    { id: 'generator', label: 'Sinh Bài Viết SEO (AI)', icon: Sparkles, badge: 'Gemini' },
    { id: 'imagestudio', label: 'Generative AI Studio', icon: ImageIcon, badge: 'Imagen 3' },
    { id: 'editor', label: 'Xem & Đăng Bài MCP', icon: Edit3, badge: 'Live' },
    { id: 'history', label: 'Lịch Sử Đăng Bài', icon: History, badge: '' }
  ];

  return (
    <aside className="w-64 bg-white border-r border-[#0879D9]/15 flex flex-col justify-between h-screen sticky top-0 z-30 shadow-sm">
      <div>
        {/* Brand Header OMFIT Light */}
        <div className="p-5 border-b border-[#0879D9]/15 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0879D9] to-[#0284C7] flex items-center justify-center text-white font-black shadow-md shadow-[#0879D9]/20">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-black text-lg tracking-tight leading-none text-[#071827]">
              OMFIT
            </h1>
            <p className="text-[9px] text-[#0879D9] font-bold tracking-wider mt-1 uppercase">
              FITNESS & WELLNESS • BALANCE FOR LIFE
            </p>
          </div>
        </div>

        {/* Connection Badge */}
        <div className="mx-4 my-4 p-3 rounded-xl bg-[#F0F9FF] border border-[#0879D9]/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#0879D9] animate-pulse" />
            <div>
              <p className="text-xs font-bold text-[#071827]">omfit.com.vn</p>
              <p className="text-[10px] text-[#0879D9] flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3 h-3 inline" /> Ready MCP Server
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
                onClick={() => setActiveTab(item.id as ActiveTab)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-[#E0F2FE] text-[#0879D9] border border-[#0879D9]/30 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-[#0879D9] hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-[#0879D9]' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                      item.badge === 'HOT'
                        ? 'bg-[#0879D9] text-white'
                        : item.badge === 'Gemini'
                        ? 'bg-[#E0F2FE] text-[#0879D9] border border-[#0879D9]/30'
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

      {/* Footer Settings */}
      <div className="p-4 border-t border-[#0879D9]/15">
        <button
          onClick={() => setActiveTab('settings')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'settings'
              ? 'bg-[#E0F2FE] text-[#0879D9] border border-[#0879D9]/30'
              : 'text-slate-600 hover:text-[#0879D9] hover:bg-slate-50'
          }`}
        >
          <Settings className="w-4.5 h-4.5" />
          <span>Cấu Hình API & MCP</span>
        </button>

        <div className="mt-3 pt-3 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-medium">OMFIT Brand Light Theme • AutoPoster</p>
        </div>
      </div>
    </aside>
  );
};
