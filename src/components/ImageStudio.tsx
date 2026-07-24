import React, { useState } from 'react';
import { Image as ImageIcon, Upload, Sparkles, Wand2, CheckCircle2, Tag, Activity, Cpu } from 'lucide-react';
import type { GeneratedImage } from '../types';
import { OpenAiService } from '../services/openaiService';
import { VertexAiService } from '../services/vertexAiService';

interface ImageStudioProps {
  openaiService: OpenAiService;
  vertexAiService: VertexAiService;
  currentKeyword: string;
  onImageGenerated: (image: GeneratedImage) => void;
}

export const ImageStudio: React.FC<ImageStudioProps> = ({
  openaiService,
  vertexAiService,
  currentKeyword,
  onImageGenerated
}) => {
  const [modelSource, setModelSource] = useState<'vertex-imagen-3' | 'dall-e-3'>('vertex-imagen-3');
  const [prompt, setPrompt] = useState(
    `Hình ảnh phòng tập Pilates Reformer đẳng cấp OMFIT, không gian sáng mịn tự nhiên, máy Reformer nhập khẩu cao cấp`
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
      let newImg: GeneratedImage;
      if (modelSource === 'vertex-imagen-3') {
        newImg = await vertexAiService.generateImage(
          prompt,
          style,
          referenceImage || undefined,
          currentKeyword || 'omfit-seo'
        );
      } else {
        newImg = await openaiService.generateImage(
          prompt,
          style,
          referenceImage || undefined,
          currentKeyword || 'omfit-seo'
        );
      }

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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-[#071827] flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-[#0879D9]" /> Generative AI Studio: Google Vertex AI (Imagen 3) & OpenAI DALL-E 3
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Upload ảnh mẫu + điền Prompt để sinh ảnh thương hiệu OMFIT chuẩn SEO cho bài viết WordPress.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#E0F2FE] border border-[#0879D9]/30 text-[#0879D9] text-xs font-bold flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" /> OMFIT Studio
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form Column */}
        <div className="lg:col-span-6 glass-panel p-6 rounded-3xl space-y-5 border border-[#0879D9]/15 bg-white">
          <form onSubmit={handleGenerate} className="space-y-4">
            {/* Model Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#0879D9]" /> Chọn AI Model Sinh Ảnh Mới Nhất
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setModelSource('vertex-imagen-3')}
                  className={`p-3 rounded-xl border text-xs font-bold transition flex flex-col items-start gap-1 ${
                    modelSource === 'vertex-imagen-3'
                      ? 'bg-[#E0F2FE] border-[#0879D9] text-[#0879D9] shadow-sm font-extrabold'
                      : 'bg-[#F8FAFC] border-slate-200 text-slate-600 hover:text-[#0879D9]'
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-black">
                    <Sparkles className="w-3.5 h-3.5 text-[#0879D9]" /> Google Vertex AI
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">Imagen 3 Model</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModelSource('dall-e-3')}
                  className={`p-3 rounded-xl border text-xs font-bold transition flex flex-col items-start gap-1 ${
                    modelSource === 'dall-e-3'
                      ? 'bg-[#E0F2FE] border-[#0879D9] text-[#0879D9] shadow-sm font-extrabold'
                      : 'bg-[#F8FAFC] border-slate-200 text-slate-600 hover:text-[#0879D9]'
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-black">
                    <Wand2 className="w-3.5 h-3.5 text-[#0879D9]" /> OpenAI DALL-E 3
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">ChatGPT OpenAI Model</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Upload Ảnh Mẫu Thương Hiệu OMFIT (Reference Image)
              </label>
              <div className="relative border-2 border-dashed border-slate-200 hover:border-[#0879D9] rounded-2xl p-4 text-center transition bg-[#F8FAFC]">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleReferenceUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {referenceImage ? (
                  <div className="flex items-center justify-center gap-3">
                    <img src={referenceImage} alt="Sample reference" className="w-16 h-16 object-cover rounded-lg border border-[#0879D9]" />
                    <div className="text-left text-xs">
                      <p className="font-bold text-[#0879D9]">✓ Đã tải ảnh mẫu thành công</p>
                      <p className="text-slate-500 text-[11px]">AI sẽ học bố cục & màu sắc từ ảnh này</p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReferenceImage(null);
                        }}
                        className="text-[10px] text-rose-500 hover:underline mt-1 font-semibold"
                      >
                        Xóa ảnh mẫu
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="w-6 h-6 text-[#0879D9] mx-auto" />
                    <p className="text-xs font-semibold text-slate-700">Kéo thả hoặc click để chọn ảnh mẫu OMFIT</p>
                    <p className="text-[10px] text-slate-400">Hỗ trợ PNG, JPG, WEBP</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mô Tả Hình Ảnh (AI Prompt)
              </label>
              <textarea
                rows={4}
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
                  {modelSource === 'vertex-imagen-3' ? 'Google Vertex AI (Imagen 3)' : 'OpenAI DALL-E 3'} Đang Sinh Ảnh...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" /> Sinh Ảnh Mới Nhất Với {modelSource === 'vertex-imagen-3' ? 'Vertex AI Imagen 3' : 'OpenAI DALL-E 3'}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Output Column */}
        <div className="lg:col-span-6 glass-panel p-6 rounded-3xl space-y-4 border border-[#0879D9]/15 bg-white">
          <h3 className="text-xs font-extrabold text-[#071827] uppercase tracking-wider flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[#0879D9]" /> Xem Trước Kết Quả Ảnh Đã Sinh
          </h3>

          {selectedImage ? (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-[#0879D9]/30 bg-[#F8FAFC] group">
                <img src={selectedImage.url} alt={selectedImage.altText} className="w-full h-72 object-cover" />
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/90 text-[10px] font-bold text-[#0879D9] border border-[#0879D9]/30 shadow-sm">
                  {selectedImage.source === 'vertex-imagen-3' ? 'GOOGLE VERTEX IMAGEN 3' : 'OPENAI DALL-E 3'}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#F0F9FF] border border-[#0879D9]/15 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-semibold text-slate-700">
                  <Tag className="w-3.5 h-3.5 text-[#0879D9]" /> Filename SEO: <span className="font-mono text-[#0879D9] font-bold">{selectedImage.fileName}</span>
                </div>
                <div className="flex items-center gap-2 font-semibold text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0879D9]" /> Alt Text SEO: <span className="text-slate-900">{selectedImage.altText}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  onImageGenerated(selectedImage);
                  alert('✓ Đã chọn ảnh này làm Featured Image cho bài viết!');
                }}
                className="w-full gradient-bg-omfit-btn px-4 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 shadow-md shadow-[#0879D9]/20"
              >
                <CheckCircle2 className="w-4 h-4" /> Đặt Làm Featured Image Cho Bài Viết OMFIT
              </button>
            </div>
          ) : (
            <div className="text-center py-16 bg-[#F8FAFC] rounded-2xl border border-dashed border-slate-200 space-y-2">
              <ImageIcon className="w-12 h-12 text-[#0879D9]/30 mx-auto" />
              <p className="text-xs font-semibold text-slate-500">Chưa có hình ảnh nào được sinh.</p>
              <p className="text-[11px] text-slate-400">Chọn Model, điền prompt và bấm nút sinh ảnh để bắt đầu.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
