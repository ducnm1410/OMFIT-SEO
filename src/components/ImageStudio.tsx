import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Upload, ImagePlus, CheckCircle2, Tag, Activity, Trash2, ArrowRight } from 'lucide-react';
import type { GeneratedImage } from '../types';
import { LeonardoService } from '../services/leonardoService';

interface ImageStudioProps {
  leonardoService: LeonardoService;
  currentKeyword: string;
  onImageGenerated: (image: GeneratedImage) => void;
}

export const ImageStudio: React.FC<ImageStudioProps> = ({
  leonardoService,
  currentKeyword,
  onImageGenerated
}) => {
  // Only using Leonardo Banana 2
  const [prompt, setPrompt] = useState(
    `Hình ảnh phòng tập Pilates Reformer đẳng cấp OMFIT, không gian sáng mịn tự nhiên, máy Reformer nhập khẩu cao cấp`
  );
  const [style, setStyle] = useState('Photorealistic 4K');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);

  const directUploadRef = useRef<HTMLInputElement>(null);
  const referenceUploadRef = useRef<HTMLInputElement>(null);

  // Handle uploading reference image for AI prompt guidance
  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setReferenceImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle direct file upload from computer (Direct Custom Image Upload)
  const handleDirectCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const fileBase64 = reader.result as string;
        const cleanFileName = (file.name || `${currentKeyword || 'omfit'}-custom-${Date.now()}`)
          .toLowerCase()
          .replace(/[^a-z0-9.]/g, '-');

        const customImage: GeneratedImage = {
          id: 'img-upload-' + Date.now(),
          url: fileBase64,
          prompt: `Ảnh tự tải lên từ máy tính (${file.name})`,
          altText: `OMFIT - ${currentKeyword || 'Hình ảnh thương hiệu'}: ${file.name.replace(/\.[^/.]+$/, '')}`,
          fileName: cleanFileName,
          style: 'Direct Device Upload',
          source: 'upload'
        };

        setGeneratedImages([customImage, ...generatedImages]);
        setSelectedImage(customImage);
        onImageGenerated(customImage);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt) return;
    setIsGenerating(true);
    try {
      const newImg = await leonardoService.generateImage(
        prompt,
        style,
        referenceImage || undefined,
        currentKeyword || 'omfit-seo',
        'nano-banana-2'
      );

      setGeneratedImages([newImg, ...generatedImages]);
      setSelectedImage(newImg);
      onImageGenerated(newImg);
    } catch (err) {
      console.error('Error generating image:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-3xl space-y-2 border border-[#0879D9]/15 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-[#071827] flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-[#0879D9]" /> Image Studio & Tải Ảnh Trực Tiếp Tới WordPress
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Tải ảnh từ máy tính hoặc tạo hình ảnh chuẩn SEO cho omfit.com.vn.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#E0F2FE] border border-[#0879D9]/30 text-[#0879D9] text-xs font-bold flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" /> OMFIT Studio
          </span>
        </div>
      </div>

      {/* Hidden direct file input */}
      <input
        type="file"
        ref={directUploadRef}
        accept="image/*"
        onChange={handleDirectCustomUpload}
        className="hidden"
      />
      <input
        type="file"
        ref={referenceUploadRef}
        accept="image/*"
        onChange={handleReferenceUpload}
        className="hidden"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form Column */}
        <div className="lg:col-span-6 space-y-5">
          {/* Quick Direct Local File Upload Box */}
          <div className="glass-panel p-5 rounded-3xl space-y-3 border border-[#0879D9]/20 bg-[#F0F9FF]">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-[#0879D9] uppercase tracking-wider flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-[#0879D9]" /> 1. Tải Ảnh Có Sẵn Từ Máy Tính (Fast Upload)
              </h3>
            </div>
            <p className="text-[11px] text-slate-600 font-medium">
              Nếu bạn đã có sẵn file hình mẫu trên máy tính (PNG, JPG, WEBP), tải lên trực tiếp tại đây:
            </p>
            <button
              type="button"
              onClick={() => directUploadRef.current?.click()}
              className="w-full bg-white border-2 border-dashed border-[#0879D9]/40 hover:border-[#0879D9] p-4 rounded-2xl text-center transition flex items-center justify-center gap-2 group shadow-sm"
            >
              <Upload className="w-5 h-5 text-[#0879D9] group-hover:scale-110 transition" />
              <span className="text-xs font-extrabold text-[#071827]">Chọn File Ảnh Từ Máy Tính</span>
            </button>
          </div>

          {/* AI Image Generation Box */}
          <div className="glass-panel p-6 rounded-3xl space-y-4 border border-[#0879D9]/15 bg-white">
            <h3 className="text-xs font-extrabold text-[#071827] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <ImagePlus className="w-4 h-4 text-[#0879D9]" /> 2. Tạo hình ảnh
            </h3>

            <form onSubmit={handleGenerate} className="space-y-4">

              {/* Reference Image Upload for AI Prompting */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tải ảnh mẫu định hướng
                </label>
                <div
                  onClick={() => referenceUploadRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-[#0879D9] rounded-2xl p-4 text-center cursor-pointer transition bg-[#F8FAFC]"
                >
                  {referenceImage ? (
                    <div className="flex items-center justify-center gap-3">
                      <img src={referenceImage} alt="Ảnh tham chiếu" className="w-16 h-16 object-cover rounded-lg border border-[#0879D9]" />
                      <div className="text-left text-xs">
                        <p className="font-bold text-[#0879D9]">Đã nạp ảnh mẫu định hướng</p>
                        <p className="text-slate-500 text-[11px]">Bố cục ảnh này sẽ được dùng làm tham chiếu</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReferenceImage(null);
                          }}
                          className="text-[10px] text-rose-500 hover:underline mt-1 font-semibold flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Gỡ ảnh mẫu
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="w-5 h-5 text-[#0879D9] mx-auto" />
                      <p className="text-xs font-semibold text-slate-700">Chọn ảnh mẫu định hướng</p>
                      <p className="text-[10px] text-slate-400">Ảnh mẫu giúp định hướng bố cục và góc máy</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mô tả hình ảnh
                </label>
                <textarea
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Nhập prompt hình ảnh phòng tập, lớp pilates..."
                  className="w-full px-4 py-3 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#071827] text-xs focus:outline-none focus:border-[#0879D9] transition font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phong Cách Hình Ảnh (Visual Style)</label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#071827] text-xs focus:outline-none focus:border-[#0879D9] transition font-semibold"
                >
                  <option value="Photorealistic 4K">Photorealistic 4K (Chân thực studio OMFIT)</option>
                  <option value="Modern Tech 3D Render">Modern Tech 3D Render (Đồ họa 3D ấn tượng)</option>
                  <option value="Corporate Minimalist">Corporate Minimalist (Đơn giản sang trọng)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full gradient-bg-omfit-btn px-6 py-3 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 shadow-md shadow-[#0879D9]/20 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Đang tạo hình ảnh...
                  </>
                ) : (
                  <>
                    <ImagePlus className="w-4 h-4" /> Tạo hình ảnh
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Output Column */}
        <div className="lg:col-span-6 glass-panel p-6 rounded-3xl space-y-4 border border-[#0879D9]/15 bg-white">
          <h3 className="text-xs font-extrabold text-[#071827] uppercase tracking-wider flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[#0879D9]" /> Xem Trước Ảnh Chọn Làm Featured Image
          </h3>

          {selectedImage ? (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-[#0879D9]/30 bg-[#F8FAFC] group">
                <img src={selectedImage.url} alt={selectedImage.altText} className="w-full h-80 object-cover" />
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/90 text-[10px] font-extrabold text-[#0879D9] border border-[#0879D9]/30 shadow-sm">
                  {selectedImage.source === 'upload'
                    ? 'ẢNH TẢI LÊN TỪ MÁY TÍNH'
                    : 'LEONARDO BANANA 2'}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#F0F9FF] border border-[#0879D9]/15 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-semibold text-slate-700">
                  <Tag className="w-3.5 h-3.5 text-[#0879D9]" /> Filename SEO: <span className="font-mono text-[#0879D9] font-bold">{selectedImage.fileName}</span>
                </div>
                <div className="flex items-center gap-2 font-semibold text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0879D9]" /> Alt Text SEO: <span className="text-slate-900 font-bold">{selectedImage.altText}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  onImageGenerated(selectedImage);
                  alert('Đã áp dụng ảnh này làm ảnh đại diện cho bài viết.');
                }}
                className="w-full gradient-bg-omfit-btn px-4 py-3 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 shadow-md shadow-[#0879D9]/20"
              >
                <CheckCircle2 className="w-4 h-4" /> Đặt Làm Featured Image Cho Bài Viết OMFIT <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="text-center py-20 bg-[#F8FAFC] rounded-2xl border border-dashed border-slate-200 space-y-3">
              <ImageIcon className="w-12 h-12 text-[#0879D9]/30 mx-auto" />
              <p className="text-xs font-bold text-slate-600">Chưa có hình ảnh nào được tải lên hoặc sinh ra.</p>
              <p className="text-[11px] text-slate-400">Chọn tệp ảnh từ máy tính ở cột trái hoặc tạo ảnh mới.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
