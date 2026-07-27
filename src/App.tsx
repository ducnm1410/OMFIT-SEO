import React, { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { OverviewDashboard } from './components/OverviewDashboard';
import { KeywordTrendFinder } from './components/KeywordTrendFinder';
import { SeoContentGenerator } from './components/SeoContentGenerator';
import { ImageStudio } from './components/ImageStudio';
import { LiveEditorPublisher } from './components/LiveEditorPublisher';
import { PostHistory } from './components/PostHistory';
import { BrandSettings } from './components/BrandSettings';
import type {
  ActiveTab,
  ApiSettings,
  BrandAsset,
  BrandProfile,
  GeneratedArticle,
  GeneratedImage,
  SeoAuditResult
} from './types';
import { GeminiService } from './services/geminiService';
import { LeonardoService } from './services/leonardoService';
import { WordpressMcpService } from './services/wordpressMcpService';
import { disconnectGoogleAds } from './services/keywordResearchService';
import { supabase } from './lib/supabase';
import {
  ensureBrandProfile,
  loadBrandAssets,
  loadArticles,
  saveArticle,
  suggestInternalLinks,
  syncWordpressIndex
} from './services/contentRepository';
import { auditArticle, enhanceArticleSeoHtml } from './services/seoAuditService';
import {
  articleContainsImage,
  buildArticleImageMarkup,
  collectArticleAltTexts,
  mergeUniqueArticleImages,
  sectionHasImage
} from './utils/articleImageMarkup';

export function App() {
  const [session, setSession] = useState<Session | null>();
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    const allowedTabs: ActiveTab[] = ['overview', 'keywords', 'generator', 'imagestudio', 'editor', 'history', 'settings'];
    return allowedTabs.includes(requestedTab as ActiveTab) ? requestedTab as ActiveTab : 'overview';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  const [settings] = useState<ApiSettings>({
    geminiApiKey: '',
    leonardoApiKey: '',
    wpSiteUrl: import.meta.env.VITE_WP_SITE_URL || 'https://omfit.com.vn',
    wpMcpConnected: true,
    defaultStatus: 'publish',
    defaultAuthor: 'OMFIT Admin'
  });

  const geminiService = useMemo(() => new GeminiService(settings.geminiApiKey), [settings.geminiApiKey]);
  const leonardoService = useMemo(() => new LeonardoService(settings.leonardoApiKey || ''), [settings.leonardoApiKey]);
  const wpService = useMemo(() => new WordpressMcpService(settings.wpSiteUrl), [settings.wpSiteUrl]);

  const [articles, setArticles] = useState<GeneratedArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<GeneratedArticle | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState('');
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [brandAssets, setBrandAssets] = useState<BrandAsset[]>([]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    void Promise.all([loadArticles(), ensureBrandProfile()])
      .then(async ([storedArticles, brand]) => {
        if (cancelled) return;
        const assets = brand.id ? await loadBrandAssets(brand.id) : [];
        if (cancelled) return;
        setArticles(storedArticles);
        setBrandProfile(brand);
        setBrandAssets(assets);
        setSelectedArticle((current) => (
          current ? storedArticles.find((article) => article.id === current.id) || null : null
        ));
      })
      .catch((error) => console.error('Không thể tải kho bài viết:', error));
    void syncWordpressIndex().catch((error) => console.error('Không thể đồng bộ WordPress index:', error));
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  const prepareArticle = (
    article: GeneratedArticle,
    profileOverride: BrandProfile | null = brandProfile
  ) => {
    const logoUrl = brandAssets.find((asset) => asset.assetType === 'logo')?.url;
    const contentHtml = enhanceArticleSeoHtml(
      article.contentHtml,
      article.focusKeyword,
      undefined,
      profileOverride,
      logoUrl
    );
    const plainText = contentHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const prepared = {
      ...article,
      contentHtml,
      wordCount: plainText.split(' ').filter(Boolean).length,
      updatedAt: new Date().toISOString()
    };
    const audit = auditArticle(prepared);
    return {
      article: {
        ...prepared,
        seoScore: audit.score,
        readabilityScore: audit.readabilityScore,
        seoIssues: audit.issues
      },
      audit
    };
  };

  const handleArticleGenerated = (newArticle: GeneratedArticle) => {
    void (async () => {
      const brand = await ensureBrandProfile();
      setBrandProfile(brand);
      const suggestedLinks = await suggestInternalLinks(newArticle.focusKeyword).catch(() => []);
      const prepared = prepareArticle({
        ...newArticle,
        brandProfileId: brand.id,
        contentHtml: enhanceArticleSeoHtml(
          newArticle.contentHtml,
          newArticle.focusKeyword,
          suggestedLinks,
          brand,
          brandAssets.find((asset) => asset.assetType === 'logo')?.url
        )
      }, brand);
      await saveArticle(prepared.article, prepared.audit);
      setArticles((previous) => [prepared.article, ...previous.filter((item) => item.id !== prepared.article.id)]);
      setSelectedArticle(prepared.article);
      const document = new DOMParser().parseFromString(
        `<main>${prepared.article.contentHtml}</main>`,
        'text/html'
      );
      const main = document.querySelector('main');
      const headings = [...document.querySelectorAll('main h2')]
        .filter((heading) => !heading.closest('.omfit-related-content, .omfit-article-cta, .omfit-article-footer'))
        .filter((heading) => !sectionHasImage(heading))
        .slice(0, 2);
      const generatedImages: GeneratedImage[] = [];
      for (const heading of headings) {
        try {
          const sectionTitle = heading.textContent?.trim() || prepared.article.focusKeyword;
          const image = await leonardoService.generateImage(
            `Minh họa cho chủ đề "${sectionTitle}" trong bài viết "${prepared.article.title}". Hình ảnh thực tế tại không gian fitness và wellness cao cấp, chuyển động an toàn, không có chữ trong ảnh.`,
            'Photorealistic 4K',
            undefined,
            prepared.article.focusKeyword,
            'nano-banana-2',
            prepared.article.id
          );
          if (!main || articleContainsImage(main, image)) continue;
          const markup = buildArticleImageMarkup({
            image,
            caption: sectionTitle,
            sectionTitle,
            articleTitle: prepared.article.title,
            focusKeyword: prepared.article.focusKeyword,
            existingAltTexts: collectArticleAltTexts(main)
          });
          generatedImages.push({
            ...image,
            role: 'inline' as const,
            altText: markup.altText,
            caption: markup.caption
          });
          heading.insertAdjacentHTML('afterend', markup.html);
        } catch (error) {
          console.error('Không thể tự động tạo ảnh cho section:', error);
        }
      }
      if (generatedImages.length > 0) {
        const withImages = prepareArticle({
          ...prepared.article,
          contentHtml: main?.innerHTML || prepared.article.contentHtml,
          articleImages: mergeUniqueArticleImages(prepared.article.articleImages, generatedImages)
        });
        await saveArticle(withImages.article, withImages.audit);
        setArticles((previous) => previous.map((item) => (
          item.id === withImages.article.id ? withImages.article : item
        )));
        setSelectedArticle(withImages.article);
      }
    })().catch((error) => console.error('Không thể lưu bài viết mới:', error));
  };

  const handleSaveArticle = (
    updatedArticle: GeneratedArticle,
    options: { serverAuthoritative?: boolean; audit?: SeoAuditResult } = {}
  ) => {
    if (options.serverAuthoritative) {
      const plainText = updatedArticle.contentHtml
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const authoritativeArticle = {
        ...updatedArticle,
        wordCount: plainText.split(' ').filter(Boolean).length,
        seoScore: options.audit?.score ?? updatedArticle.seoScore,
        readabilityScore: options.audit?.readabilityScore ?? updatedArticle.readabilityScore,
        seoIssues: options.audit?.issues ?? updatedArticle.seoIssues,
        updatedAt: new Date().toISOString()
      };
      setArticles((previous) => previous.map((article) => (
        article.id === authoritativeArticle.id ? authoritativeArticle : article
      )));
      setSelectedArticle(authoritativeArticle);
      // The publish endpoint has already persisted content, audit and seo_status
      // in one server-owned flow. Writing it again from the browser would let the
      // client-side audit overwrite that authoritative result.
      return;
    }
    const prepared = prepareArticle(updatedArticle);
    setArticles((previous) => previous.map((article) => (
      article.id === prepared.article.id ? prepared.article : article
    )));
    setSelectedArticle(prepared.article);
    void saveArticle(prepared.article, prepared.audit)
      .catch((error) => console.error('Không thể lưu bài viết:', error));
  };

  const handleImageGenerated = (newImage: GeneratedImage) => {
    if (!selectedArticle) return;
    handleSaveArticle({
      ...selectedArticle,
      featuredImage: newImage
    });
  };

  const handleInlineImage = (newImage: GeneratedImage) => {
    if (!selectedArticle) return;
    const document = new DOMParser().parseFromString(
      `<main>${selectedArticle.contentHtml}</main>`,
      'text/html'
    );
    const main = document.querySelector('main');
    if (!main) return;
    if (articleContainsImage(main, newImage)) {
      handleSaveArticle({
        ...selectedArticle,
        articleImages: mergeUniqueArticleImages(selectedArticle.articleImages, [
          { ...newImage, role: 'inline' }
        ])
      });
      return;
    }
    const heading = [...document.querySelectorAll('main h2')]
      .find((item) => (
        !item.closest('.omfit-related-content, .omfit-article-cta, .omfit-article-footer')
        && !sectionHasImage(item)
      ));
    const sectionTitle = heading?.textContent?.trim();
    const markup = buildArticleImageMarkup({
      image: newImage,
      caption: newImage.caption,
      sectionTitle,
      articleTitle: selectedArticle.title,
      focusKeyword: selectedArticle.focusKeyword,
      existingAltTexts: collectArticleAltTexts(main)
    });
    if (heading) heading.insertAdjacentHTML('afterend', markup.html);
    else main.insertAdjacentHTML('beforeend', markup.html);
    const inlineImage = {
      ...newImage,
      role: 'inline' as const,
      altText: markup.altText,
      caption: markup.caption
    };
    handleSaveArticle({
      ...selectedArticle,
      contentHtml: main.innerHTML,
      articleImages: mergeUniqueArticleImages(selectedArticle.articleImages, [inlineImage])
    });
  };

  const handleLogout = async () => {
    try {
      await disconnectGoogleAds();
    } catch {
      // Supabase logout must still complete if Google Ads was never connected.
    }
    await supabase.auth.signOut();
    setArticles([]);
    setSelectedArticle(null);
    setSelectedKeyword('');
    setBrandProfile(null);
    setBrandAssets([]);
    setActiveTab('overview');
  };

  if (session === undefined) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#F8FAFC]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0879D9] border-t-transparent" />
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  const userLabel = String(
    session.user.user_metadata?.full_name
    || session.user.email?.replace('@omfit.local', '')
    || 'Người dùng OMFIT'
  );

  return (
    <div className="min-h-dvh bg-[#F8FAFC] text-[#071827] flex">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        wpConnected={settings.wpMcpConnected}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          settings={settings}
          userLabel={userLabel}
          onLogout={() => void handleLogout()}
          onQuickGenerate={() => setActiveTab('generator')}
          onMenuToggle={() => setIsSidebarOpen((open) => !open)}
        />

        <main className="app-main p-4 sm:p-6 xl:p-8 flex-1">
          {activeTab === 'overview' && (
            <OverviewDashboard
              articles={articles}
              wpConnected={settings.wpMcpConnected}
              setActiveTab={setActiveTab}
              onSelectArticleForEdit={(article) => {
                setSelectedArticle(article);
                setActiveTab('editor');
              }}
            />
          )}

          {activeTab === 'keywords' && (
            <KeywordTrendFinder
              onSelectKeywordForArticle={setSelectedKeyword}
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
              articleId={selectedArticle?.id}
              brandProfile={brandProfile}
              brandAssets={brandAssets}
              onBrandAssetUploaded={(asset) => setBrandAssets((previous) => [
                asset,
                ...previous.filter((item) => item.id !== asset.id)
              ])}
              onImageGenerated={handleImageGenerated}
              onInsertInline={selectedArticle ? handleInlineImage : undefined}
            />
          )}

          {activeTab === 'editor' && (
            <LiveEditorPublisher
              article={selectedArticle}
              wpService={wpService}
              leonardoService={leonardoService}
              onSaveArticle={handleSaveArticle}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'history' && (
            <PostHistory
              articles={articles}
              onSelectArticleForEdit={(article) => {
                setSelectedArticle(article);
                setActiveTab('editor');
              }}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'settings' && (
            <BrandSettings
              profile={brandProfile}
              assets={brandAssets}
              onProfileSaved={setBrandProfile}
              onAssetUploaded={(asset) => setBrandAssets((previous) => [
                asset,
                ...previous.filter((item) => item.id !== asset.id)
              ])}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
