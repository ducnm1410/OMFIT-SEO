import React from 'react';
import { Key, Sparkles, Image as ImageIcon, Zap, CheckCircle2, AlertCircle, Crown } from 'lucide-react';
import type { ApiSettings } from '../types';

interface HeaderProps {
  settings: ApiSettings;
  openSettingsModal: () => void;
  onQuickGenerate: () => void;
}

export const Header: React.FC<HeaderProps> = ({ settings, openSettingsModal, onQuickGenerate }) => {
  const hasGemini = Boolean(settings.geminiApiKey);
  const hasOpenAi = Boolean(settings.openaiApiKey);

  return (
    <header className="h-16 bg-[#101014]/90 border-b border-[#26241e] px-6 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md">
      {/* Search / Title Area */}
      <div className="flex items-center gap-3">
        <h2 className="text-xs font-bold text-[#e6c687] uppercase tracking-wider flex items-center gap-2">
          <Crown className="w-4 h-4 text-[#c5a059]" />
          OM FIT — Hệ Thống Tự Động Tạo & Đăng Bài SEO Qua MCP WordPress
        </h2>
      </div>

      {/* Status Badges & Quick Action */}
      <div className="flex items-center gap-4">
        {/* Gemini API Badge */}
        <div
          onClick={openSettingsModal}
          className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#18181e] border border-[#332f27] hover:border-[#c5a059]/50 transition"
          title="Click để thay đổi Gemini API Key"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#c5a059]" />
          <span className="text-slate-300">Gemini (Content):</span>
          {hasGemini ? (
            <span className="text-[#e6c687] flex items-center gap-1 font-bold">
              <CheckCircle2 className="w-3 h-3" /> Ready
            </span>
          ) : (
            <span className="text-amber-400 flex items-center gap-1 font-bold">
              <AlertCircle className="w-3 h-3" /> Mock Key
            </span>
          )}
        </div>

        {/* OpenAI DALL-E Badge */}
        <div
          onClick={openSettingsModal}
          className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#18181e] border border-[#332f27] hover:border-[#c5a059]/50 transition"
          title="Click để bổ sung OpenAI API Key"
        >
          <ImageIcon className="w-3.5 h-3.5 text-[#c5a059]" />
          <span className="text-slate-300">OpenAI (Image):</span>
          {hasOpenAi ? (
            <span className="text-[#e6c687] flex items-center gap-1 font-bold">
              <CheckCircle2 className="w-3 h-3" /> Configured
            </span>
          ) : (
            <span className="text-amber-300 flex items-center gap-1 font-bold">
              <Key className="w-3 h-3" /> Thêm Key
            </span>
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={onQuickGenerate}
          className="gradient-bg-gold-btn px-4 py-2 rounded-xl text-xs font-bold text-[#0c0c0e] flex items-center gap-2 shadow-lg shadow-[#c5a059]/20"
        >
          <Sparkles className="w-4 h-4" />
          Tạo Bài SEO Mới
        </button>
      </div>
    </header>
  );
};
