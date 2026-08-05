import React from 'react';
import {
  LayoutDashboard,
  Search,
  FilePenLine,
  Image as ImageIcon,
  Edit3,
  Film,
  History,
  Globe,
  CheckCircle2,
  Activity,
  Settings2,
  X,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import type { ActiveTab } from '../types';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  wpConnected: boolean;
  isOpen: boolean;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  wpConnected,
  isOpen,
  isCollapsed,
  onToggleCollapsed,
  onClose
}) => {
  const menuGroups = [
    {
      label: 'Không gian làm việc',
      items: [
        { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard, badge: '' }
      ]
    },
    {
      label: 'Quy trình SEO',
      items: [
        { id: 'keywords', label: '1. Content brief', icon: Search, badge: 'Mới' },
        { id: 'generator', label: '2. Bằng chứng & dàn ý', icon: FilePenLine, badge: '' },
        { id: 'imagestudio', label: '3. Nội dung & hình ảnh', icon: ImageIcon, badge: '' },
        { id: 'editor', label: '4. Kiểm duyệt & xuất bản', icon: Edit3, badge: 'Live' }
      ]
    },
    {
      label: 'Nội dung',
      items: [
        { id: 'videoeditor', label: 'AI Video Editor', icon: Film, badge: 'Mới' },
        { id: 'history', label: 'Lịch sử bài viết', icon: History, badge: '' }
      ]
    },
    {
      label: 'Hệ thống',
      items: [
        { id: 'settings', label: 'Cài đặt thương hiệu', icon: Settings2, badge: '' }
      ]
    }
  ];

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px] md:hidden"
          onClick={onClose}
          aria-label="Đóng trình đơn"
        />
      )}
      <aside className={`ui-sidebar relative flex h-dvh w-[280px] flex-col justify-between fixed md:sticky top-0 z-50 md:z-30 transition-[width,transform] duration-200 ${
        isCollapsed ? 'md:w-[76px]' : 'md:w-[264px]'
      } ${
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
      <div>
        <div className={`flex min-h-16 items-center gap-3 border-b border-slate-200 px-4 ${
          isCollapsed ? 'md:justify-center md:px-2' : ''
        }`}>
          <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#17191D] text-white ${
            isCollapsed ? 'md:hidden' : ''
          }`}>
            <Activity className="h-[18px] w-[18px]" />
          </div>
          <div className={`min-w-0 ${isCollapsed ? 'md:hidden' : ''}`}>
            <h1 className="text-[15px] font-bold leading-none tracking-tight text-[#17191D]">OMFIT SEO</h1>
            <p className="mt-1 text-[10px] font-medium text-slate-500">Content workspace</p>
          </div>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className={`hidden h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-[#0879D9] md:grid ${
              isCollapsed ? '' : 'ml-auto'
            }`}
            aria-label={isCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
            title={isCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          >
            {isCollapsed
              ? <ChevronsRight className="h-3.5 w-3.5" />
              : <ChevronsLeft className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="md:hidden ml-auto w-10 h-10 rounded-lg grid place-items-center text-slate-500 hover:bg-slate-100"
            aria-label="Đóng trình đơn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className={`space-y-5 px-3 py-5 ${isCollapsed ? 'md:px-2' : ''}`} aria-label="Điều hướng chính">
          {menuGroups.map((group) => (
            <div key={group.label}>
              <p className={`mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 ${
                isCollapsed ? 'md:sr-only' : ''
              }`}>
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => {
                        setActiveTab(item.id as ActiveTab);
                        onClose();
                      }}
                      title={isCollapsed ? item.label : undefined}
                      className={`group w-full min-h-10 flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[13px] leading-5 transition-colors ${
                        isCollapsed ? 'md:justify-center md:px-2' : ''
                      } ${
                        isActive
                          ? 'bg-[#E9EAEC] text-[#17191D] font-semibold'
                          : 'text-slate-600 font-medium hover:text-[#17191D] hover:bg-[#F0F1F2]'
                      }`}
                    >
                      <span className="min-w-0 flex items-center gap-2.5">
                        <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#0879D9]' : 'text-slate-400 group-hover:text-slate-600'}`} />
                        <span className={`truncate ${isCollapsed ? 'md:hidden' : ''}`}>{item.label}</span>
                      </span>
                      {item.badge && (
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                          isCollapsed ? 'md:hidden' : ''
                        } ${
                          item.badge === 'Live'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-[#FFF1E8] text-[#C2410C]'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className={`border-t border-slate-200 p-3 ${isCollapsed ? 'md:p-2' : ''}`}>
        <div
          className={`flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 ${
            isCollapsed ? 'md:justify-center md:p-2' : ''
          }`}
          title={isCollapsed ? (wpConnected ? 'WordPress đã kết nối' : 'WordPress chưa kết nối') : undefined}
        >
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
            wpConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          }`}>
            <Globe className="h-4 w-4" />
          </span>
          <div className={`min-w-0 flex-1 ${isCollapsed ? 'md:hidden' : ''}`}>
            <p className="truncate text-xs font-semibold text-[#17191D]">omfit.com.vn</p>
            <p className={`mt-0.5 flex items-center gap-1 text-[10px] font-medium ${
              wpConnected ? 'text-emerald-700' : 'text-amber-700'
            }`}>
              <CheckCircle2 className="h-3 w-3" />
              {wpConnected ? 'WordPress đã kết nối' : 'Chưa kết nối'}
            </p>
          </div>
        </div>
      </div>
      </aside>
    </>
  );
};
