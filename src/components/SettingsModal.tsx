import React, { useState } from 'react';
import { Settings, Sparkles, Image as ImageIcon, Globe, CheckCircle2, Save, X, Crown } from 'lucide-react';
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
    <div className="glass-panel p-6 rounded-2xl max-w-2xl mx-auto space-y-6 border border-[#2a2822]">
      <div className="flex items-center justify-between border-b border-[#2a2822] pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#c5a059]/20 text-[#e6c687]">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-100">Cấu Hình API Keys & MCP WordPress (omfit.com.vn)</h2>
            <p className="text-xs text-slate-400">Cấu hình API Key cho Gemini (Content) & OpenAI (DALL-E 3 Image)</p>
          </div>
        </div>

        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="p-4 rounded-xl bg-[#101014] border border-[#2a2822] space-y-2">
          <label className="block text-xs font-bold text-slate-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#c5a059]" /> Google Gemini API Key (Viết bài & Crawl Keyword)
          </label>
          <input
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full px-4 py-2.5 rounded-xl bg-[#18181e] border border-[#332f27] text-slate-100 text-xs font-mono focus:outline-none focus:border-[#c5a059]"
          />
          <p className="text-[10px] text-slate-400">
            Dùng để sinh dàn ý chuẩn SEO, tối ưu câu từ và phân tích hot trend ngành Fitness/Wellness.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#101014] border border-[#2a2822] space-y-2">
          <label className="block text-xs font-bold text-slate-200 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[#c5a059]" /> OpenAI API Key (Sinh ảnh DALL-E 3 mới nhất)
          </label>
          <input
            type="password"
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder="sk-proj-..."
            className="w-full px-4 py-2.5 rounded-xl bg-[#18181e] border border-[#332f27] text-slate-100 text-xs font-mono focus:outline-none focus:border-[#c5a059]"
          />
          <p className="text-[10px] text-slate-400">
            Điền API Key của OpenAI để sinh ảnh độc quyền bằng DALL-E 3 dựa trên prompt & ảnh mẫu thương hiệu.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#101014] border border-[#2a2822] space-y-3">
          <label className="block text-xs font-bold text-slate-200 flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#c5a059]" /> Kết Nối MCP Website omfit.com.vn
          </label>
          <input
            type="text"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            placeholder="https://omfit.com.vn"
            className="w-full px-4 py-2.5 rounded-xl bg-[#18181e] border border-[#332f27] text-slate-100 text-xs font-mono focus:outline-none focus:border-[#c5a059]"
          />
          <div className="flex items-center justify-between text-[11px] text-[#e6c687] font-semibold pt-1">
            <span>✓ MCP Server Active: wsp-omfit-com-vn</span>
            <span>Gutenberg & Elementor Compatible</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Trạng Thái Đăng Bài Mặc Định</label>
          <select
            value={defaultStatus}
            onChange={(e) => setDefaultStatus(e.target.value as 'draft' | 'publish')}
            className="w-full px-4 py-2.5 rounded-xl bg-[#101014] border border-[#332f27] text-slate-100 text-xs focus:outline-none"
          >
            <option value="publish">Xuất bản ngay (Publish)</option>
            <option value="draft">Lưu nháp (Draft)</option>
          </select>
        </div>

        <div className="pt-2 flex items-center justify-between">
          {isSaved && (
            <span className="text-xs font-bold text-[#e6c687] flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Cấu hình đã được lưu thành công!
            </span>
          )}
          <button
            type="submit"
            className="ml-auto gradient-bg-gold-btn px-6 py-2.5 rounded-xl text-xs font-bold text-[#0c0c0e] flex items-center gap-2 shadow-lg shadow-[#c5a059]/20"
          >
            <Save className="w-4 h-4" /> Lưu Cấu Hình
          </button>
        </div>
      </form>
    </div>
  );
};
