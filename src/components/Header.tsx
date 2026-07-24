import React from 'react';
import { Key, Sparkles, Image as ImageIcon, CheckCircle2, AlertCircle, Activity } from 'lucide-react';
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
    <header className="h-16 bg-white border-b border-[#0879D9]/15 px-6 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md">
      {/* Title Area */}
      <div className="flex items-center gap-3">
        <h2 className="text-xs font-extrabold text-[#071827] uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#0879D9]" />
          OMFIT FITNESS & WELLNESS • BALANCE IN MOTION
        </h2>
      </div>

      {/* Status Badges & Quick Action */}
      <div className="flex items-center gap-4">
        {/* Gemini API Badge */}
        <div
          onClick={openSettingsModal}
          className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F0F9FF] border border-[#0879D9]/20 hover:border-[#0879D9] transition"
          title="Click để thay đổi Gemini API Key"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#0879D9]" />
          <span className="text-slate-700">Gemini (Content):</span>
          {hasGemini ? (
            <span className="text-[#0879D9] flex items-center gap-1 font-bold">
              <CheckCircle2 className="w-3 h-3" /> Ready
            </span>
          ) : (
            <span className="text-amber-600 flex items-center gap-1 font-bold">
              <AlertCircle className="w-3 h-3" /> Mock Key
            </span>
          )}
        </div>

        {/* Image Gen Badge */}
        <div
          onClick={openSettingsModal}
          className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F0F9FF] border border-[#0879D9]/20 hover:border-[#0879D9] transition"
          title="Click để bổ sung API Key"
        >
          <ImageIcon className="w-3.5 h-3.5 text-[#0879D9]" />
          <span className="text-slate-700">Image Gen:</span>
          {hasOpenAi ? (
            <span className="text-[#0879D9] flex items-center gap-1 font-bold">
              <CheckCircle2 className="w-3 h-3" /> Configured
            </span>
          ) : (
            <span className="text-sky-600 flex items-center gap-1 font-bold">
              <Key className="w-3 h-3" /> Thêm Key
            </span>
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={onQuickGenerate}
          className="gradient-bg-omfit-btn px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-md shadow-[#0879D9]/20"
        >
          <Sparkles className="w-4 h-4" />
          Tạo Bài SEO Mới
        </button>
      </div>
    </header>
  );
};
