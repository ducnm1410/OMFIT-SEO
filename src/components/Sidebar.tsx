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
    <aside className="w-64 bg-[#0B263D] border-r border-[#28A9F4]/20 flex flex-col justify-between h-screen sticky top-0 z-30 shadow-2xl">
      <div>
        {/* Brand Header OMFIT Official */}
        <div className="p-5 border-b border-[#28A9F4]/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0879D9] to-[#28A9F4] flex items-center justify-center text-white font-black shadow-lg shadow-[#0879D9]/30">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-black text-base tracking-tight leading-none gradient-text-omfit">
              OMFIT
            </h1>
            <p className="text-[9px] text-[#28A9F4] font-bold tracking-wider mt-1 uppercase">
              FITNESS & WELLNESS • BALANCE FOR LIFE
            </p>
          </div>
        </div>

        {/* Connection Badge */}
        <div className="mx-4 my-4 p-3 rounded-xl bg-[#071827] border border-[#0879D9]/30 flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#28A9F4] animate-pulse" />
            <div>
              <p className="text-xs font-bold text-[#F3F0E9]">omfit.com.vn</p>
              <p className="text-[10px] text-[#28A9F4] flex items-center gap-1 font-medium">
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
                    ? 'bg-[#0879D9]/25 text-[#28A9F4] border border-[#0879D9]/50 shadow-md shadow-[#0879D9]/20'
                    : 'text-[#DCEAF0]/70 hover:text-white hover:bg-[#071827]/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-[#28A9F4]' : 'text-[#DCEAF0]/60'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                      item.badge === 'HOT'
                        ? 'bg-[#28A9F4]/20 text-[#28A9F4] border border-[#28A9F4]/30'
                        : item.badge === 'Gemini'
                        ? 'bg-[#0879D9]/20 text-[#28A9F4] border border-[#0879D9]/30'
                        : 'bg-[#D7C8B7]/20 text-[#D7C8B7] border border-[#D7C8B7]/30'
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

      {/* Footer Settings & User Info */}
      <div className="p-4 border-t border-[#28A9F4]/20">
        <button
          onClick={() => setActiveTab('settings')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'settings'
              ? 'bg-[#071827] text-[#28A9F4] border border-[#0879D9]/40'
              : 'text-[#DCEAF0]/70 hover:text-white hover:bg-[#071827]/40'
          }`}
        >
          <Settings className="w-4.5 h-4.5" />
          <span>Cấu Hình API & MCP</span>
        </button>

        <div className="mt-3 pt-3 border-t border-[#28A9F4]/15 text-center">
          <p className="text-[10px] text-[#28A9F4]/70 font-medium">OMFIT Brand Guideline v1.0 • AutoPoster</p>
        </div>
      </div>
    </aside>
  );
};
