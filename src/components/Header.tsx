import React from 'react';
import { Lock, Sparkles, Image as ImageIcon, CheckCircle2, ShieldCheck, Activity } from 'lucide-react';
import type { ApiSettings } from '../types';

interface HeaderProps {
  settings: ApiSettings;
  onQuickGenerate: () => void;
}

export const Header: React.FC<HeaderProps> = ({ settings, onQuickGenerate }) => {
  const hasGemini = Boolean(settings.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY);
  const hasOpenAi = Boolean(settings.openaiApiKey || import.meta.env.VITE_OPENAI_API_KEY);

  return (
    <header className="h-16 bg-white border-b border-[#0879D9]/15 px-6 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md">
      {/* Title Area */}
      <div className="flex items-center gap-3">
        <h2 className="text-xs font-extrabold text-[#071827] uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#0879D9]" />
          OMFIT FITNESS & WELLNESS • BALANCE IN MOTION
        </h2>
      </div>

      {/* Secure Environment Badges */}
      <div className="flex items-center gap-3">
        {/* Gemini Env Secured Badge */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F0F9FF] border border-[#0879D9]/20 transition"
          title="Bảo mật bằng Vercel Environment Variables"
        >
          <Lock className="w-3.5 h-3.5 text-[#0879D9]" />
          <span className="text-slate-700 font-bold">Gemini API:</span>
          {hasGemini ? (
            <span className="text-[#0879D9] flex items-center gap-1 font-bold">
              <CheckCircle2 className="w-3 h-3" /> Env Secured
            </span>
          ) : (
            <span className="text-slate-400 font-bold">Vercel Env Ready</span>
          )}
        </div>

        {/* OpenAI Env Secured Badge */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F0F9FF] border border-[#0879D9]/20 transition"
          title="Bảo mật bằng Vercel Environment Variables"
        >
          <ImageIcon className="w-3.5 h-3.5 text-[#0879D9]" />
          <span className="text-slate-700 font-bold">OpenAI API:</span>
          {hasOpenAi ? (
            <span className="text-[#0879D9] flex items-center gap-1 font-bold">
              <CheckCircle2 className="w-3 h-3" /> Env Secured
            </span>
          ) : (
            <span className="text-slate-400 font-bold">Vercel Env Ready</span>
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
