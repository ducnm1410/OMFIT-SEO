import React, { useState, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewDashboard } from './components/OverviewDashboard';
import { KeywordTrendFinder } from './components/KeywordTrendFinder';
import { SeoContentGenerator } from './components/SeoContentGenerator';
import { ImageStudio } from './components/ImageStudio';
import { LiveEditorPublisher } from './components/LiveEditorPublisher';
import { PostHistory } from './components/PostHistory';

import type { ActiveTab, ApiSettings, GeneratedArticle, GeneratedImage } from './types';
import { GeminiService } from './services/geminiService';
import { LeonardoService } from './services/leonardoService';
import { WordpressMcpService } from './services/wordpressMcpService';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  // Load API keys securely from .env environment variables
  const [settings, setSettings] = useState<ApiSettings>({
    geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
    leonardoApiKey: import.meta.env.VITE_LEONARDO_API_KEY || '',
    wpSiteUrl: import.meta.env.VITE_WP_SITE_URL || 'https://omfit.com.vn',
    wpMcpConnected: true,
    defaultStatus: 'publish',
    defaultAuthor: 'OM FIT Admin'
  });

  const geminiService = useMemo(() => new GeminiService(settings.geminiApiKey), [settings.geminiApiKey]);
  const leonardoService = useMemo(() => new LeonardoService(settings.leonardoApiKey || ''), [settings.leonardoApiKey]);
  const wpService = useMemo(() => new WordpressMcpService(settings.wpSiteUrl), [settings.wpSiteUrl]);

  const [articles, setArticles] = useState<GeneratedArticle[]>([
    {
      id: 'art-omfit-demo-1',
      title: 'Khóa Học Nghề PT Pilates Chuyên Nghiệp 2026: Cơ Hội Nâng Tầm Sự Nghiệp Tại OM FIT',
      slug: 'khoa-hoc-nghe-pt-pilates-chuyen-nghiep-2026',
      metaTitle: 'Khóa Học Nghề PT Pilates Chuyên Nghiệp 2026 - OM FIT',
      metaDescription: 'Khám phá khóa học nghề PT Pilates chuyên nghiệp 2026 tại OM FIT. Đào tạo 1:1, bằng chứng chỉ quốc tế, thực hành trên máy Reformer nhập khẩu.',
      focusKeyword: 'khóa học pt pilates',
      contentHtml: `
<div class="seo-toc-container p-4 bg-[#F0F9FF] rounded-xl border border-[#0879D9]/20 mb-6">
  <h3 class="text-lg font-bold text-[#0879D9] mb-2">📌 Mục Lục Bài Viết</h3>
  <ul class="space-y-1 text-sm text-slate-700 font-medium">
    <li><a href="#sec-1" class="hover:text-[#0879D9]">1. Tổng quan tiềm năng ngành HLV Pilates 2026</a></li>
    <li><a href="#sec-2" class="hover:text-[#0879D9]">2. Điểm đặc quyền của khóa đào tạo PT Pilates tại OM FIT</a></li>
    <li><a href="#sec-3" class="hover:text-[#0879D9]">3. Lộ trình học và cơ hội nghề nghiệp</a></li>
  </ul>
</div>

<p class="lead text-lg text-slate-800 mb-4 font-medium">
  Ngành tập luyện Pilates và cải thiện vóc dáng đang chứng kiến sự bùng nổ mạnh mẽ tại Việt Nam. <strong>OM FIT – Balance For Life</strong> tự hào mang đến <strong>Khóa học nghề PT Pilates chuyên nghiệp</strong> giúp bạn làm chủ kỹ thuật và tự tin xây dựng sự nghiệp bền vững.
</p>

<h2 id="sec-1" class="text-2xl font-bold text-[#071827] border-b border-[#0879D9]/20 pb-2 mt-8 mb-4">1. Tổng quan tiềm năng ngành HLV Pilates 2026</h2>
<p>Nhu cầu phục hồi tư thế, trị liệu đau lưng cổ vai gáy qua Pilates tăng trưởng 300% trong 2 năm qua. Việc trở thành HLV Pilates cá nhân (PT) mang lại thu nhập hấp dẫn và môi trường làm việc văn minh.</p>

<blockquote class="my-4">
  "OM FIT - Nơi kiến tạo đội ngũ Huấn luyện viên Pilates chuyên nghiệp hàng đầu với lộ trình chuẩn mực quốc tế."
</blockquote>

<h2 id="sec-2" class="text-2xl font-bold text-[#071827] border-b border-[#0879D9]/20 pb-2 mt-8 mb-4">2. Điểm đặc quyền của khóa đào tạo PT Pilates tại OM FIT</h2>
<ul class="list-disc pl-6 space-y-2 text-slate-700 my-4">
  <li><strong>Thực hành 100% trên dàn máy nhập khẩu:</strong> Máy Reformer, Cadillac, Wunda Chair cao cấp.</li>
  <li><strong>Học trực tiếp cùng Master Trainer:</strong> Hướng dẫn giải phẫu học và sửa tư thế chuẩn xác.</li>
  <li><strong>Cam kết việc làm & chứng chỉ:</strong> Cấp chứng chỉ uy tín và cơ hội làm việc tại hệ thống OM FIT.</li>
</ul>
`,
      wordCount: 1680,
      readabilityScore: 97,
      seoScore: 99,
      categories: ['Khóa Học Nghề PT Pilates', 'Tin Tức OM FIT'],
      tags: ['khóa học pt pilates', 'OM FIT', 'Pilates Reformer', 'Đào Tạo HLV'],
      createdAt: new Date().toISOString(),
      status: 'published',
      wpPostId: 8842,
      featuredImage: {
        id: 'img-omfit-1',
        url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="%23F8FAFC"/><text x="100" y="300" fill="%230879D9" font-family="sans-serif" font-size="44" font-weight="bold">OMFIT • VERTEX AI IMAGEN 3 MODEL</text></svg>',
        prompt: 'Khóa học nghề PT Pilates chuyên nghiệp OM FIT',
        altText: 'Khóa học nghề PT Pilates chuyên nghiệp tại OM FIT',
        fileName: 'khoa-hoc-nghe-pt-pilates-omfit.png',
        style: 'Photorealistic 4K',
        source: 'vertex-imagen-3'
      },
      articleImages: []
    }
  ]);

  const [selectedArticle, setSelectedArticle] = useState<GeneratedArticle | null>(articles[0]);
  const [selectedKeyword, setSelectedKeyword] = useState<string>('khóa học pt pilates chuyên nghiệp');

  const handleArticleGenerated = (newArticle: GeneratedArticle) => {
    setArticles((prev) => [newArticle, ...prev]);
    setSelectedArticle(newArticle);
  };

  const handleSaveArticle = (updatedArticle: GeneratedArticle) => {
    setArticles((prev) => prev.map((art) => (art.id === updatedArticle.id ? updatedArticle : art)));
    setSelectedArticle(updatedArticle);
  };

  const handleImageGenerated = (newImage: GeneratedImage) => {
    if (selectedArticle) {
      const updated = {
        ...selectedArticle,
        featuredImage: newImage
      };
      handleSaveArticle(updated);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#071827] flex font-sans">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} wpConnected={settings.wpMcpConnected} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          settings={settings}
          onQuickGenerate={() => setActiveTab('generator')}
        />

        <main className="p-8 flex-1 overflow-y-auto">
          {activeTab === 'overview' && (
            <OverviewDashboard
              articles={articles}
              setActiveTab={setActiveTab}
              onSelectArticleForEdit={(art) => {
                setSelectedArticle(art);
                setActiveTab('editor');
              }}
            />
          )}

          {activeTab === 'keywords' && (
            <KeywordTrendFinder
              geminiService={geminiService}
              onSelectKeywordForArticle={(kw) => setSelectedKeyword(kw)}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'generator' && (
            <SeoContentGenerator
              selectedKeyword={selectedKeyword}
              geminiService={geminiService}
              onArticleGenerated={handleArticleGenerated}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'imagestudio' && (
            <ImageStudio
              leonardoService={leonardoService}
              currentKeyword={selectedArticle?.focusKeyword || selectedKeyword}
              onImageGenerated={handleImageGenerated}
            />
          )}

          {activeTab === 'editor' && (
            <LiveEditorPublisher
              article={selectedArticle}
              wpService={wpService}
              onSaveArticle={handleSaveArticle}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'history' && (
            <PostHistory
              articles={articles}
              onSelectArticleForEdit={(art) => {
                setSelectedArticle(art);
                setActiveTab('editor');
              }}
              setActiveTab={setActiveTab}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
