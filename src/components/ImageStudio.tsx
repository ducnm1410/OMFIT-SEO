import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  Image as ImageIcon,
  ImagePlus,
  Tag,
  Upload
} from 'lucide-react';
import type { BrandAsset, BrandProfile, GeneratedImage } from '../types';
import { LeonardoService } from '../services/leonardoService';
import { uploadBrandAsset, uploadMediaFile } from '../services/contentRepository';

const noLogoSelection = '__no_logo__';
const logoSelectionStorageKey = 'omfit-image-studio-logo-selection';

interface ImageStudioProps {
  leonardoService: LeonardoService;
  currentKeyword: string;
  articleId?: string;
  brandProfile: BrandProfile | null;
  brandAssets: BrandAsset[];
  onBrandAssetUploaded: (asset: BrandAsset) => void;
  onImageGenerated: (image: GeneratedImage) => void;
  onInsertInline?: (image: GeneratedImage) => void;
}

export const ImageStudio: React.FC<ImageStudioProps> = ({
  leonardoService,
  currentKeyword,
  articleId,
  brandProfile,
  brandAssets,
  onBrandAssetUploaded,
  onImageGenerated,
  onInsertInline
}) => {
  const logos = useMemo(
    () => brandAssets.filter((asset) => asset.assetType === 'logo' && asset.url),
    [brandAssets]
  );
  const [prompt, setPrompt] = useState(
    'Hình ảnh phòng tập Pilates Reformer cao cấp OMFIT, không gian sáng tự nhiên, máy Reformer nhập khẩu, bố cục hiện đại và chuyên nghiệp'
  );
  const [style, setStyle] = useState('Photorealistic 4K');
  const [selectedLogoId, setSelectedLogoId] = useState(() => {
    try {
      return window.localStorage.getItem(logoSelectionStorageKey) || '';
    } catch {
      return '';
    }
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [message, setMessage] = useState('');

  const directUploadRef = useRef<HTMLInputElement>(null);
  const logoUploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedLogoId === noLogoSelection) return;
    if (selectedLogoId && logos.some((logo) => logo.id === selectedLogoId)) return;
    if (logos.length > 0) setSelectedLogoId(logos[0].id);
  }, [logos, selectedLogoId]);

  useEffect(() => {
    if (!selectedLogoId) return;
    try {
      window.localStorage.setItem(logoSelectionStorageKey, selectedLogoId);
    } catch {
      // Logo selection remains active for the current session.
    }
  }, [selectedLogoId]);

  const handleDirectCustomUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsGenerating(true);
    setMessage('');
    try {
      const customImage = await uploadMediaFile(file, articleId);
      setGeneratedImages((previous) => [customImage, ...previous]);
      setSelectedImage(customImage);
      onImageGenerated(customImage);
      setMessage('Đã tải ảnh lên kho OMFIT.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể lưu ảnh vào kho OMFIT.');
    } finally {
      setIsGenerating(false);
      event.target.value = '';
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!brandProfile?.id) {
      setMessage('Chưa tải được hồ sơ thương hiệu. Vui lòng mở Cài đặt thương hiệu và thử lại.');
      event.target.value = '';
      return;
    }
    setIsUploadingLogo(true);
    setMessage('');
    try {
      const asset = await uploadBrandAsset(file, brandProfile.id, 'logo');
      onBrandAssetUploaded(asset);
      setSelectedLogoId(asset.id);
      setMessage('Đã tải và chọn logo mới làm ảnh tham chiếu.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể tải logo.');
    } finally {
      setIsUploadingLogo(false);
      event.target.value = '';
    }
  };

  const handleGenerate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (prompt.trim().length < 10) {
      setMessage('Mô tả hình ảnh cần có ít nhất 10 ký tự.');
      return;
    }
    setIsGenerating(true);
    setMessage('');
    const logoAssetId = selectedLogoId !== noLogoSelection
      && logos.some((logo) => logo.id === selectedLogoId)
      ? selectedLogoId
      : undefined;
    try {
      const newImage = await leonardoService.generateImage(
        prompt.trim(),
        style,
        undefined,
        currentKeyword || 'omfit-seo',
        'nano-banana-2',
        articleId,
        logoAssetId
      );
      setGeneratedImages((previous) => [newImage, ...previous]);
      setSelectedImage(newImage);
      onImageGenerated(newImage);
      setMessage(logoAssetId
        ? 'Đã tạo ảnh với logo được chọn làm ngữ cảnh thương hiệu.'
        : 'Đã tạo ảnh không dùng logo tham chiếu.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể tạo hình ảnh.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="ui-page space-y-6">
      <header className="ui-page-header p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold tracking-[-0.02em] text-[#17191D]">
              <ImageIcon className="h-5 w-5 text-[#0879D9]" /> Image Studio
            </h2>
            <p className="mt-1 text-sm font-medium leading-6 text-slate-500">
              Tải ảnh có sẵn hoặc tạo hình ảnh chuẩn SEO theo nhận diện thương hiệu OMFIT.
            </p>
          </div>
          <span className="flex w-fit items-center gap-1 rounded-full border border-[#0879D9]/30 bg-[#E0F2FE] px-3 py-1 text-xs font-bold text-[#0879D9]">
            <Activity className="h-3.5 w-3.5" /> OMFIT Studio
          </span>
        </div>
        {message && (
          <div aria-live="polite" className="mt-4 flex items-start gap-2 rounded-xl bg-[#F0F9FF] p-3 text-sm font-semibold text-[#075EA8]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}
      </header>

      <input ref={directUploadRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleDirectCustomUpload(event)} className="hidden" />
      <input ref={logoUploadRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleLogoUpload(event)} className="hidden" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-6">
          <section className="rounded-3xl border border-[#0879D9]/20 bg-[#F0F9FF] p-5">
            <h3 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#0879D9]">
              <Upload className="h-4 w-4" /> 1. Tải ảnh có sẵn
            </h3>
            <p className="mt-2 text-xs font-medium leading-5 text-slate-600">
              Dùng file PNG, JPG hoặc WEBP có sẵn trên máy tính.
            </p>
            <button
              type="button"
              onClick={() => directUploadRef.current?.click()}
              disabled={isGenerating}
              className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#0879D9]/40 bg-white p-4 text-sm font-extrabold text-[#071827] transition hover:border-[#0879D9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0879D9] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload className="h-5 w-5 text-[#0879D9]" /> Chọn ảnh từ máy tính
            </button>
          </section>

          <section className="rounded-3xl border border-[#0879D9]/15 bg-white p-5 sm:p-6">
            <h3 className="flex items-center gap-1.5 border-b border-slate-100 pb-3 text-xs font-extrabold uppercase tracking-wider text-[#071827]">
              <ImagePlus className="h-4 w-4 text-[#0879D9]" /> 2. Tạo hình ảnh theo thương hiệu
            </h3>

            <form onSubmit={handleGenerate} className="mt-4 space-y-5">
              <fieldset>
                <legend className="text-sm font-bold text-slate-700">Chọn logo làm ảnh tham chiếu</legend>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Leonardo sẽ dùng hình dáng và màu sắc của logo để tăng độ chính xác. Nội dung chữ nhỏ trong ảnh tạo sinh vẫn nên được kiểm tra lại.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    aria-pressed={selectedLogoId === noLogoSelection || (!selectedLogoId && logos.length === 0)}
                    onClick={() => {
                      setSelectedLogoId(noLogoSelection);
                      setMessage('Đã chọn tạo ảnh không dùng logo tham chiếu.');
                    }}
                    className={`relative min-h-24 rounded-2xl border p-3 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0879D9] ${
                      selectedLogoId === noLogoSelection || (!selectedLogoId && logos.length === 0)
                        ? 'border-[#0879D9] bg-[#F0F9FF] ring-2 ring-[#0879D9]/10'
                        : 'border-slate-200 bg-white hover:border-[#0879D9]/50'
                    }`}
                  >
                    {(selectedLogoId === noLogoSelection || (!selectedLogoId && logos.length === 0)) && (
                      <Check className="absolute right-2 top-2 h-4 w-4 text-[#0879D9]" />
                    )}
                    <ImageIcon className="mx-auto h-7 w-7 text-slate-400" />
                    <span className="mt-2 block text-xs font-bold text-slate-700">Không dùng logo</span>
                  </button>
                  {logos.map((logo) => {
                    const selected = selectedLogoId === logo.id;
                    return (
                      <button
                        key={logo.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setSelectedLogoId(logo.id);
                          setMessage(`Đã chọn logo “${logo.name}” làm ảnh tham chiếu.`);
                        }}
                        className={`relative min-h-24 overflow-hidden rounded-2xl border p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0879D9] ${selected ? 'border-[#0879D9] bg-[#F0F9FF] ring-2 ring-[#0879D9]/10' : 'border-slate-200 bg-white hover:border-[#0879D9]/50'}`}
                      >
                        {selected && <Check className="absolute right-2 top-2 z-10 h-4 w-4 rounded-full bg-white text-[#0879D9]" />}
                        <img src={logo.url} alt={`Logo ${logo.name}`} className="mx-auto h-14 w-full object-contain" />
                        <span className="mt-1 block truncate text-[11px] font-bold text-slate-600" title={logo.name}>{logo.name}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => logoUploadRef.current?.click()}
                    disabled={isUploadingLogo || !brandProfile?.id}
                    className="min-h-24 rounded-2xl border-2 border-dashed border-[#0879D9]/30 bg-[#F8FAFC] p-3 text-center transition hover:border-[#0879D9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0879D9] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isUploadingLogo
                      ? <span className="mx-auto block h-5 w-5 animate-spin rounded-full border-2 border-[#0879D9] border-t-transparent" />
                      : <Upload className="mx-auto h-5 w-5 text-[#0879D9]" />}
                    <span className="mt-2 block text-xs font-bold text-[#0879D9]">{isUploadingLogo ? 'Đang tải...' : 'Thêm logo mới'}</span>
                  </button>
                </div>
              </fieldset>

              <label className="block text-sm font-bold text-slate-700">
                Mô tả hình ảnh
                <textarea
                  rows={4}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Mô tả không gian, chủ thể, bố cục và cảm xúc mong muốn..."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm leading-6 text-[#071827] outline-none transition focus:border-[#0879D9] focus:ring-2 focus:ring-[#0879D9]/10"
                  required
                />
              </label>

              <label className="block text-sm font-bold text-slate-700">
                Phong cách hình ảnh
                <select
                  value={style}
                  onChange={(event) => setStyle(event.target.value)}
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-2.5 text-sm font-semibold text-[#071827] outline-none transition focus:border-[#0879D9] focus:ring-2 focus:ring-[#0879D9]/10"
                >
                  <option value="Photorealistic 4K">Chân thực 4K — studio OMFIT</option>
                  <option value="Modern Tech 3D Render">Đồ họa 3D hiện đại</option>
                  <option value="Corporate Minimalist">Tối giản, sang trọng</option>
                </select>
              </label>

              <button
                type="submit"
                disabled={isGenerating || isUploadingLogo}
                className="gradient-bg-omfit-btn flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-6 text-sm font-bold text-white shadow-md shadow-[#0879D9]/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating
                  ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Đang tạo hình ảnh...</>
                  : <><ImagePlus className="h-4 w-4" /> Tạo hình ảnh</>}
              </button>
            </form>
          </section>
        </div>

        <section className="space-y-4 rounded-3xl border border-[#0879D9]/15 bg-white p-5 lg:col-span-6 sm:p-6">
          <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#071827]">
            <ImageIcon className="h-4 w-4 text-[#0879D9]" /> Xem trước ảnh được chọn
          </h3>
          {selectedImage ? (
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-2xl border border-[#0879D9]/30 bg-[#F8FAFC]">
                <img src={selectedImage.url} alt={selectedImage.altText} className="h-80 w-full object-cover" />
                <div className="absolute right-3 top-3 rounded-full border border-[#0879D9]/30 bg-white/90 px-2.5 py-1 text-[10px] font-extrabold text-[#0879D9] shadow-sm">
                  {selectedImage.source === 'upload' ? 'ẢNH TẢI LÊN' : 'LEONARDO BANANA 2'}
                </div>
              </div>
              <div className="space-y-2 rounded-xl border border-[#0879D9]/15 bg-[#F0F9FF] p-4 text-xs">
                <div className="flex items-start gap-2 font-semibold text-slate-700">
                  <Tag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0879D9]" />
                  <span>Tên tệp SEO: <span className="break-all font-mono font-bold text-[#0879D9]">{selectedImage.fileName}</span></span>
                </div>
                <div className="flex items-start gap-2 font-semibold text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0879D9]" />
                  <span>Alt text: <strong className="text-slate-900">{selectedImage.altText}</strong></span>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    onImageGenerated(selectedImage);
                    setMessage('Đã đặt ảnh làm ảnh đại diện cho bài viết.');
                  }}
                  className="gradient-bg-omfit-btn flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold text-white"
                >
                  <CheckCircle2 className="h-4 w-4" /> Đặt làm ảnh đại diện
                </button>
                <button
                  type="button"
                  disabled={!onInsertInline}
                  onClick={() => {
                    onInsertInline?.(selectedImage);
                    setMessage('Đã chèn ảnh vào nội dung bài viết.');
                  }}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#0879D9]/30 bg-[#F0F9FF] px-4 text-xs font-bold text-[#0879D9] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ImagePlus className="h-4 w-4" /> Chèn vào bài <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-dashed border-slate-200 bg-[#F8FAFC] py-20 text-center">
              <ImageIcon className="mx-auto h-12 w-12 text-[#0879D9]/30" />
              <p className="text-sm font-bold text-slate-600">Chưa có hình ảnh.</p>
              <p className="text-xs text-slate-400">Tải ảnh từ máy tính hoặc tạo ảnh mới ở cột bên trái.</p>
            </div>
          )}
          {generatedImages.length > 1 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Ảnh vừa tạo</p>
              <div className="grid grid-cols-3 gap-2">
                {generatedImages.slice(0, 6).map((image) => (
                  <button key={image.id} type="button" onClick={() => setSelectedImage(image)} className="overflow-hidden rounded-xl border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0879D9]">
                    <img src={image.url} alt={image.altText} className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
