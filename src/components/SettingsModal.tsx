import React, { useState } from 'react';
import { Settings, Sparkles, Image as ImageIcon, Globe, CheckCircle2, Save, X, Activity } from 'lucide-react';
import type { ApiSettings } from '../types';

interface SettingsModalProps {
  settings: ApiSettings;
  onSaveSettings: (newSettings: ApiSettings) => void;
  onClose?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onSaveSettings,
  onClose
}) => {
  const [geminiKey, setGeminiKey] = useState(settings.geminiApiKey);
  const [openaiKey, setOpenaiKey] = useState(settings.openaiApiKey);
  const [siteUrl, setSiteUrl] = useState(settings.wpSiteUrl);
  const [defaultStatus, setDefaultStatus] = useState<'draft' | 'publish'>(settings.defaultStatus);
  const [isSaved, setIsSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      ...settings,
      geminiApiKey: geminiKey,
      openaiApiKey: openaiKey,
      wpSiteUrl: siteUrl,
      defaultStatus: defaultStatus
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="glass-panel p-6 rounded-3xl max-w-2xl mx-auto space-y-6 border border-[#0879D9]/15 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#E0F2FE] text-[#0879D9]">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[#071827]">Cấu Hình API Keys & MCP WordPress (omfit.com.vn)</h2>
            <p className="text-xs text-slate-500 font-medium">Cấu hình API Key cho Gemini (Content) & OpenAI (DALL-E 3 Image)</p>
          </div>
        </div>

        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-2">
          <label className="block text-xs font-bold text-slate-700 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#0879D9]" /> Google Gemini API Key (Viết bài & Crawl Keyword)
          </label>
          <input
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-[#071827] text-xs font-mono focus:outline-none focus:border-[#0879D9]"
          />
          <p className="text-[10px] text-slate-500 font-medium">
            Dùng để sinh dàn ý chuẩn SEO, tối ưu câu từ và phân tích hot trend ngành Fitness/Wellness.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-2">
          <label className="block text-xs font-bold text-slate-700 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[#0879D9]" /> OpenAI API Key (Sinh ảnh DALL-E 3 mới nhất)
          </label>
          <input
            type="password"
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder="sk-proj-..."
            className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-[#071827] text-xs font-mono focus:outline-none focus:border-[#0879D9]"
          />
          <p className="text-[10px] text-slate-500 font-medium">
            Điền API Key của OpenAI để sinh ảnh độc quyền bằng DALL-E 3 dựa trên prompt & ảnh mẫu thương hiệu.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-3">
          <label className="block text-xs font-bold text-slate-700 flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#0879D9]" /> Kết Nối MCP Website omfit.com.vn
          </label>
          <input
            type="text"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            placeholder="https://omfit.com.vn"
            className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-[#071827] text-xs font-mono focus:outline-none focus:border-[#0879D9]"
          />
          <div className="flex items-center justify-between text-[11px] text-[#0879D9] font-bold pt-1">
            <span>✓ MCP Server Active: wsp-omfit-com-vn</span>
            <span>Gutenberg & Elementor Compatible</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Trạng Thái Đăng Bài Mặc Định</label>
          <select
            value={defaultStatus}
            onChange={(e) => setDefaultStatus(e.target.value as 'draft' | 'publish')}
            className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-300 text-[#071827] text-xs font-semibold focus:outline-none"
          >
            <option value="publish">Xuất bản ngay (Publish)</option>
            <option value="draft">Lưu nháp (Draft)</option>
          </select>
        </div>

        <div className="pt-2 flex items-center justify-between">
          {isSaved && (
            <span className="text-xs font-bold text-[#0879D9] flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Cấu hình đã được lưu thành công!
            </span>
          )}
          <button
            type="submit"
            className="ml-auto gradient-bg-omfit-btn px-6 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-md shadow-[#0879D9]/20"
          >
            <Save className="w-4 h-4" /> Lưu Cấu Hình
          </button>
        </div>
      </form>
    </div>
  );
};
