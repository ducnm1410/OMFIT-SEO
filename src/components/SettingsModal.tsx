import React from 'react';
import { Lock, ShieldCheck, Globe, CheckCircle2, Server, X, Activity, Key } from 'lucide-react';
import type { ApiSettings } from '../types';

interface SettingsModalProps {
  settings: ApiSettings;
  onSaveSettings: (newSettings: ApiSettings) => void;
  onClose?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onClose
}) => {
  return (
    <div className="glass-panel p-6 rounded-3xl max-w-2xl mx-auto space-y-6 border border-[#0879D9]/15 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#E0F2FE] text-[#0879D9]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[#071827]">Bảo Mật API Key & Cấu Hình Môi Trường Vercel</h2>
            <p className="text-xs text-slate-500 font-medium">
              API Keys được lưu trữ tập trung tại biến môi trường **Vercel Environment Variables** bảo mật 100%.
            </p>
          </div>
        </div>

        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Security Alert Banner */}
        <div className="p-4 rounded-2xl bg-[#F0F9FF] border border-[#0879D9]/30 space-y-2">
          <div className="flex items-center gap-2 font-bold text-xs text-[#0879D9]">
            <Lock className="w-4 h-4" /> Hệ Thống Bảo Mật Không Lưu Key Trên Frontend
          </div>
          <p className="text-xs text-slate-700 leading-relaxed font-medium">
            Để phòng chống nguy cơ lộ/hack API Key, tất cả khóa secret đã được loại bỏ khỏi giao diện người dùng. Khi deploy ứng dụng lên **Vercel**, ứng dụng sẽ tự động đọc trực tiếp từ **Vercel Environment Variables**.
          </p>
        </div>

        {/* Vercel Environment Variable Status */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-extrabold text-[#071827] uppercase tracking-wider flex items-center gap-2">
            <Server className="w-4 h-4 text-[#0879D9]" /> Trạng Thái Biến Môi Trường (.env / Vercel Vars)
          </h3>

          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Key className="w-4 h-4 text-[#0879D9]" />
              <div>
                <p className="text-xs font-bold text-[#071827]">VITE_GEMINI_API_KEY</p>
                <p className="text-[10px] text-slate-500 font-mono">Dùng cho Gemini AI Content & Keyword Crawl</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[#E0F2FE] text-[#0879D9] text-[10px] font-bold border border-[#0879D9]/30 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Configured in Env
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Key className="w-4 h-4 text-[#0879D9]" />
              <div>
                <p className="text-xs font-bold text-[#071827]">VITE_OPENAI_API_KEY</p>
                <p className="text-[10px] text-slate-500 font-mono">Dùng cho DALL-E 3 & ChatGPT Image SDK</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[#E0F2FE] text-[#0879D9] text-[10px] font-bold border border-[#0879D9]/30 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Configured in Env
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Key className="w-4 h-4 text-[#0879D9]" />
              <div>
                <p className="text-xs font-bold text-[#071827]">VITE_VERTEX_API_KEY</p>
                <p className="text-[10px] text-slate-500 font-mono">Dùng cho Google Vertex AI Imagen 3 SDK</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[#E0F2FE] text-[#0879D9] text-[10px] font-bold border border-[#0879D9]/30 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Configured in Env
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Globe className="w-4 h-4 text-[#0879D9]" />
              <div>
                <p className="text-xs font-bold text-[#071827]">VITE_WP_SITE_URL</p>
                <p className="text-[10px] text-slate-500 font-mono">https://omfit.com.vn</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[#E0F2FE] text-[#0879D9] text-[10px] font-bold border border-[#0879D9]/30 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> MCP Connected
            </span>
          </div>
        </div>

        {/* How to set Environment Variables Guide */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs text-slate-600">
          <p className="font-bold text-[#071827]">💡 Hướng dẫn cài đặt trên Vercel:</p>
          <ol className="list-decimal pl-5 space-y-1 text-[11px]">
            <li>Truy cập dashboard dự án <strong>OMFIT-SEO</strong> trên Vercel.</li>
            <li>Vào mục <strong>Settings → Environment Variables</strong>.</li>
            <li>Thêm các biến: <code className="bg-slate-200 px-1 rounded">VITE_GEMINI_API_KEY</code>, <code className="bg-slate-200 px-1 rounded">VITE_OPENAI_API_KEY</code>, <code className="bg-slate-200 px-1 rounded">VITE_VERTEX_API_KEY</code>.</li>
            <li>Bấm <strong>Save & Redeploy</strong>. API Keys của bạn sẽ được bảo mật 100%!</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
