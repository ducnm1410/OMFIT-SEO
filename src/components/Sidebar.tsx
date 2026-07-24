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
  Crown
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
    { id: 'imagestudio', label: 'Generative AI Studio', icon: ImageIcon, badge: 'DALL-E 3' },
    { id: 'editor', label: 'Xem & Đăng Bài MCP', icon: Edit3, badge: 'Live' },
    { id: 'history', label: 'Lịch Sử Đăng Bài', icon: History, badge: '' }
  ];

  return (
    <aside className="w-64 bg-[#101014] border-r border-[#26241e] flex flex-col justify-between h-screen sticky top-0 z-30 shadow-2xl">
      <div>
        {/* Brand Header OM FIT Luxury */}
        <div className="p-5 border-b border-[#26241e] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#e6c687] via-[#c5a059] to-[#9a7b38] flex items-center justify-center text-[#0c0c0e] font-black shadow-lg shadow-[#c5a059]/20">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight leading-none gradient-text-gold">
              OM FIT SEO
            </h1>
            <p className="text-[10px] text-[#c5a059] font-medium tracking-wide mt-1 uppercase">
              Balance For Life • MCP Suite
            </p>
          </div>
        </div>

        {/* Connection Badge */}
        <div className="mx-4 my-4 p-3 rounded-xl bg-[#18181e] border border-[#c5a059]/30 flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#c5a059] animate-pulse" />
            <div>
              <p className="text-xs font-bold text-slate-100">omfit.com.vn</p>
              <p className="text-[10px] text-[#c5a059] flex items-center gap-1 font-medium">
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
                    ? 'bg-gradient-to-r from-[#c5a059]/25 to-[#c5a059]/10 text-[#e6c687] border border-[#c5a059]/40 shadow-md shadow-[#c5a059]/10'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-[#1c1b22]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-[#e6c687]' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                      item.badge === 'HOT'
                        ? 'bg-[#c5a059]/20 text-[#e6c687] border border-[#c5a059]/40'
                        : item.badge === 'Gemini'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
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
      <div className="p-4 border-t border-[#26241e]">
        <button
          onClick={() => setActiveTab('settings')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'settings'
              ? 'bg-[#1e1c24] text-[#e6c687] border border-[#c5a059]/40'
              : 'text-slate-400 hover:text-slate-100 hover:bg-[#18181e]'
          }`}
        >
          <Settings className="w-4.5 h-4.5" />
          <span>Cấu Hình API & MCP</span>
        </button>

        <div className="mt-3 pt-3 border-t border-[#26241e]/60 text-center">
          <p className="text-[10px] text-[#c5a059]/70 font-medium">OM FIT WordPress AutoPoster v2.5</p>
        </div>
      </div>
    </aside>
  );
};
