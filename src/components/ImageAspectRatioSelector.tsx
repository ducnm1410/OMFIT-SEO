import React from 'react';
import { IMAGE_ASPECT_RATIO_OPTIONS } from '../constants/imageGeneration';
import type { ImageAspectRatio } from '../types';

interface ImageAspectRatioSelectorProps {
  value: ImageAspectRatio;
  onChange: (value: ImageAspectRatio) => void;
  disabled?: boolean;
  compact?: boolean;
}

export const ImageAspectRatioSelector: React.FC<ImageAspectRatioSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  compact = false
}) => (
  <fieldset disabled={disabled}>
    <legend className="text-sm font-bold text-slate-700">Tỷ lệ & kích thước (Aspect Ratio Settings)</legend>
    {!compact && (
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Chọn một kích thước chuẩn được GPT Image 2 hỗ trợ.
      </p>
    )}
    <div className={`mt-3 grid gap-2 ${compact ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-5'}`}>
      {IMAGE_ASPECT_RATIO_OPTIONS.map((option) => {
        const selected = value === option.ratio;
        return (
          <button
            key={option.ratio}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.ratio)}
            className={`group flex min-h-20 flex-col items-center justify-center rounded-xl border px-2 py-2.5 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0879D9] disabled:cursor-not-allowed disabled:opacity-50 ${
              selected
                ? 'border-[#0879D9] bg-[#F0F9FF] text-[#075EA8] ring-2 ring-[#0879D9]/10'
                : 'border-slate-200 bg-[#F8FAFC] text-slate-600 hover:border-[#0879D9]/50'
            }`}
          >
            <span
              aria-hidden="true"
              className={`mb-1.5 block max-h-7 max-w-10 rounded-sm border-2 ${selected ? 'border-[#0879D9] bg-white' : 'border-slate-300 bg-white'}`}
              style={{
                aspectRatio: `${option.width} / ${option.height}`,
                width: option.width >= option.height ? '2.5rem' : `${Math.max(1.15, 2.5 * option.width / option.height)}rem`,
                height: option.height > option.width ? '1.75rem' : `${Math.max(1.15, 2.5 * option.height / option.width)}rem`
              }}
            />
            <strong className="text-xs">{option.ratio}</strong>
            <span className="mt-0.5 text-[10px] font-medium text-slate-500">
              {option.width} × {option.height}
            </span>
          </button>
        );
      })}
    </div>
  </fieldset>
);
