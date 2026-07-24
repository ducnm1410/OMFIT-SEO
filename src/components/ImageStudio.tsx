import React, { useState } from 'react';
import { Image as ImageIcon, Upload, Sparkles, Wand2, CheckCircle2, Tag, Crown } from 'lucide-react';
import type { GeneratedImage } from '../types';
import { OpenAiService } from '../services/openaiService';

interface ImageStudioProps {
  openaiService: OpenAiService;
  currentKeyword: string;
  onImageGenerated: (image: GeneratedImage) => void;
}

export const ImageStudio: React.FC<ImageStudioProps> = ({
  openaiService,
  currentKeyword,
  onImageGenerated
}) => {
  const [prompt, setPrompt] = useState(
    `Hình ảnh studio sang trọng về ${currentKeyword || 'tập pilates omfit'}, phòng tập hiện đại với ánh sáng ấm vàng kim champagne, máy Reformer nhập khẩu cao cấp`
  );
  const [style, setStyle] = useState('Photorealistic 4K');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);

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

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt) return;
    setIsGenerating(true);
    try {
      const newImg = await openaiService.generateImage(
        prompt,
        style,
        referenceImage || undefined,
        currentKeyword || 'omfit-seo'
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
      <div className="glass-panel p-6 rounded-2xl space-y-2 border border-[#2a2822]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-[#c5a059]" /> Generative AI Image Studio (OpenAI DALL-E 3)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Upload ảnh mẫu + điền Prompt để sinh ảnh thương hiệu OM FIT độc quyền chuẩn SEO cho bài viết WordPress.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#c5a059]/15 border border-[#c5a059]/40 text-[#e6c687] text-xs font-semibold flex items-center gap-1">
            <Crown className="w-3.5 h-3.5" /> OM FIT Luxury Studio
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form Column */}
        <div className="lg:col-span-6 glass-panel p-6 rounded-2xl space-y-5 border border-[#2a2822]">
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Upload Ảnh Mẫu Thương Hiệu OM FIT (Reference Image)
              </label>
              <div className="relative border-2 border-dashed border-[#332f27] hover:border-[#c5a059]/60 rounded-xl p-4 text-center transition bg-[#101014]">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleReferenceUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {referenceImage ? (
                  <div className="flex items-center justify-center gap-3">
                    <img src={referenceImage} alt="Sample reference" className="w-16 h-16 object-cover rounded-lg border border-[#c5a059]" />
                    <div className="text-left text-xs">
                      <p className="font-bold text-[#e6c687]">✓ Đã tải ảnh mẫu thành công</p>
                      <p className="text-slate-400 text-[11px]">AI sẽ học bố cục & màu sắc từ ảnh này</p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReferenceImage(null);
                        }}
                        className="text-[10px] text-rose-400 hover:underline mt-1"
                      >
                        Xóa ảnh mẫu
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="w-6 h-6 text-[#c5a059] mx-auto" />
                    <p className="text-xs font-semibold text-slate-300">Kéo thả hoặc click để chọn ảnh mẫu OM FIT</p>
                    <p className="text-[10px] text-slate-500">Hỗ trợ PNG, JPG, WEBP</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mô Tả Hình Ảnh (AI Prompt)
              </label>
              <textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Nhập prompt hình ảnh phòng tập, lớp pilates..."
                className="w-full px-4 py-3 rounded-xl bg-[#101014] border border-[#332f27] text-slate-100 text-xs focus:outline-none focus:border-[#c5a059] transition font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Phong Cách Hình Ảnh (Visual Style)</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#101014] border border-[#332f27] text-slate-100 text-xs focus:outline-none focus:border-[#c5a059] transition"
              >
                <option value="Photorealistic 4K">Photorealistic 4K (Chân thực studio OM FIT)</option>
                <option value="Modern Tech 3D Render">Modern Tech 3D Render (Đồ họa 3D ấn tượng)</option>
                <option value="Corporate Minimalist">Corporate Minimalist (Đơn giản sang trọng)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isGenerating}
              className="w-full gradient-bg-gold-btn px-6 py-3 rounded-xl text-xs font-bold text-[#0c0c0e] flex items-center justify-center gap-2 shadow-lg shadow-[#c5a059]/20 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#0c0c0e] border-t-transparent rounded-full animate-spin" />
                  OpenAI DALL-E 3 Đang Sinh Ảnh...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" /> Sinh Ảnh Độc Quyền Với DALL-E 3
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Output Column */}
        <div className="lg:col-span-6 glass-panel p-6 rounded-2xl space-y-4 border border-[#2a2822]">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[#c5a059]" /> Xem Trước Kết Quả Ảnh Đã Sinh
          </h3>

          {selectedImage ? (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-[#c5a059]/40 bg-[#101014] group">
                <img src={selectedImage.url} alt={selectedImage.altText} className="w-full h-72 object-cover" />
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-[#101014]/90 text-[10px] font-bold text-[#e6c687] border border-[#c5a059]/40">
                  {selectedImage.source.toUpperCase()}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#101014] border border-[#2a2822] space-y-2 text-xs">
                <div className="flex items-center gap-2 font-semibold text-slate-300">
                  <Tag className="w-3.5 h-3.5 text-[#c5a059]" /> Filename SEO: <span className="font-mono text-[#e6c687]">{selectedImage.fileName}</span>
                </div>
                <div className="flex items-center gap-2 font-semibold text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#c5a059]" /> Alt Text SEO: <span className="text-slate-200">{selectedImage.altText}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  onImageGenerated(selectedImage);
                  alert('✓ Đã chọn ảnh này làm Featured Image cho bài viết!');
                }}
                className="w-full gradient-bg-gold-btn px-4 py-2.5 rounded-xl text-xs font-bold text-[#0c0c0e] flex items-center justify-center gap-2 shadow-md shadow-[#c5a059]/20"
              >
                <CheckCircle2 className="w-4 h-4" /> Đặt Làm Featured Image Cho Bài Viết OM FIT
              </button>
            </div>
          ) : (
            <div className="text-center py-16 bg-[#101014] rounded-xl border border-dashed border-[#2a2822] space-y-2">
              <ImageIcon className="w-12 h-12 text-[#c5a059]/40 mx-auto" />
              <p className="text-xs font-medium text-slate-400">Chưa có hình ảnh nào được sinh.</p>
              <p className="text-[11px] text-slate-500">Điền prompt và bấm nút sinh ảnh để bắt đầu.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
