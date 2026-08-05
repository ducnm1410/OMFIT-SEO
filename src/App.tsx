import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { SeoWorkflowBar } from './components/SeoWorkflowBar';
import type {
  ActiveTab,
  ApiSettings,
  BrandAsset,
  BrandProfile,
  ContentBrief,
  GeneratedArticle,
  GeneratedImage,
  SeoAuditResult,
  SeoWorkflowStep,
  WorkflowSaveStatus
} from './types';
import { GeminiService } from './services/geminiService';
import { LeonardoService } from './services/leonardoService';
import { WordpressMcpService } from './services/wordpressMcpService';
import { disconnectGoogleAds } from './services/keywordResearchService';
import { supabase } from './lib/supabase';
import { getAuthenticatedSession } from './lib/authSession.mjs';
import {
  ensureBrandProfile,
  deleteDraftArticle,
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

const OverviewDashboard = lazy(() => import('./components/OverviewDashboard')
  .then((module) => ({ default: module.OverviewDashboard })));
const KeywordTrendFinder = lazy(() => import('./components/KeywordTrendFinder')
  .then((module) => ({ default: module.KeywordTrendFinder })));
const SeoContentGenerator = lazy(() => import('./components/SeoContentGenerator')
  .then((module) => ({ default: module.SeoContentGenerator })));
const ImageStudio = lazy(() => import('./components/ImageStudio')
  .then((module) => ({ default: module.ImageStudio })));
const AIVideoEditor = lazy(() => import('./components/AIVideoEditor')
  .then((module) => ({ default: module.AIVideoEditor })));
const LiveEditorPublisher = lazy(() => import('./components/LiveEditorPublisher')
  .then((module) => ({ default: module.LiveEditorPublisher })));
const PostHistory = lazy(() => import('./components/PostHistory')
  .then((module) => ({ default: module.PostHistory })));
const BrandSettings = lazy(() => import('./components/BrandSettings')
  .then((module) => ({ default: module.BrandSettings })));

const workflowStorageKey = 'omfit-seo-workflow-v2';
const sidebarCollapsedStorageKey = 'omfit-seo-sidebar-collapsed';

const defaultContentBrief: ContentBrief = {
  keyword: '',
  secondaryKeywords: [],
  searchIntent: 'Informational',
  service: 'OMFIT PILATES',
  audience: 'Người Việt quan tâm đến sức khỏe, vóc dáng và lối sống cân bằng',
  conversionGoal: 'Đăng ký tư vấn hoặc trải nghiệm dịch vụ OMFIT',
  tone: 'Chuyên nghiệp, truyền cảm hứng, cân bằng',
  wordCount: 1500
};

interface StoredWorkflow {
  activeTab?: ActiveTab;
  activeStep?: SeoWorkflowStep;
  articleId?: string;
  brief?: Partial<ContentBrief>;
  lastSavedAt?: string;
}

function readStoredWorkflow(): StoredWorkflow {
  try {
    const raw = window.localStorage.getItem(workflowStorageKey);
    return raw ? JSON.parse(raw) as StoredWorkflow : {};
  } catch {
    return {};
  }
}

export function App() {
  const initialWorkflow = useMemo(() => readStoredWorkflow(), []);
  const [session, setSession] = useState<Session | null>();
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    const allowedTabs: ActiveTab[] = ['overview', 'keywords', 'generator', 'imagestudio', 'videoeditor', 'editor', 'history', 'settings'];
    if (allowedTabs.includes(requestedTab as ActiveTab)) return requestedTab as ActiveTab;
    return allowedTabs.includes(initialWorkflow.activeTab as ActiveTab)
      ? initialWorkflow.activeTab as ActiveTab
      : 'overview';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(sidebarCollapsedStorageKey) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(sidebarCollapsedStorageKey, String(isSidebarCollapsed));
    } catch {
      // Sidebar collapse remains available for the current session.
    }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    let cancelled = false;
    void getAuthenticatedSession(supabase.auth)
      .then((currentSession) => {
        if (!cancelled) setSession(currentSession);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
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
  const [contentBrief, setContentBrief] = useState<ContentBrief>(() => ({
    ...defaultContentBrief,
    ...(initialWorkflow.brief || {})
  }));
  const [selectedKeyword, setSelectedKeyword] = useState(
    initialWorkflow.brief?.keyword || ''
  );
  const [workflowStep, setWorkflowStep] = useState<SeoWorkflowStep>(
    initialWorkflow.activeStep || 1
  );
  const [saveStatus, setSaveStatus] = useState<WorkflowSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState(initialWorkflow.lastSavedAt || '');
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [brandAssets, setBrandAssets] = useState<BrandAsset[]>([]);
  const saveOperationRef = useRef(0);

  useEffect(() => {
    const stored: StoredWorkflow = {
      activeTab,
      activeStep: workflowStep,
      articleId: selectedArticle?.id,
      brief: contentBrief,
      lastSavedAt
    };
    try {
      window.localStorage.setItem(workflowStorageKey, JSON.stringify(stored));
    } catch {
      // The workflow remains usable even when browser storage is unavailable.
    }
  }, [activeTab, contentBrief, lastSavedAt, selectedArticle?.id, workflowStep]);

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
        setSelectedArticle((current) => {
          const restoresArticle = initialWorkflow.activeTab === 'editor'
            || initialWorkflow.activeTab === 'imagestudio';
          const preferredArticleId = current?.id || (restoresArticle ? initialWorkflow.articleId : undefined);
          return preferredArticleId
            ? storedArticles.find((article) => article.id === preferredArticleId) || null
            : null;
        });
      })
      .catch((error) => console.error('Không thể tải kho bài viết:', error));
    void syncWordpressIndex().catch((error) => console.error('Không thể đồng bộ WordPress index:', error));
    return () => {
      cancelled = true;
    };
  }, [initialWorkflow.articleId, session?.user.id]);

  const persistArticle = async (
    article: GeneratedArticle,
    audit?: SeoAuditResult
  ) => {
    const operation = ++saveOperationRef.current;
    setSaveStatus('saving');
    try {
      await saveArticle(article, audit);
      if (operation === saveOperationRef.current) {
        const savedAt = new Date().toISOString();
        setSaveStatus('saved');
        setLastSavedAt(savedAt);
      }
    } catch (error) {
      if (operation === saveOperationRef.current) setSaveStatus('error');
      throw error;
    }
  };

  const resetToNewBrief = () => {
    setSelectedArticle(null);
    setSelectedKeyword('');
    setContentBrief(defaultContentBrief);
    setWorkflowStep(1);
    setSaveStatus('idle');
    setLastSavedAt('');
  };

  const navigateToTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'keywords') {
      resetToNewBrief();
      return;
    }
    if (tab === 'generator') setWorkflowStep(2);
    if (tab === 'imagestudio') setWorkflowStep(3);
    if (tab === 'editor') {
      setWorkflowStep((current) => (current < 3 ? 3 : current));
    }
  };

  const navigateToWorkflowStep = (step: SeoWorkflowStep) => {
    if (step === 1) {
      resetToNewBrief();
      setActiveTab('keywords');
      return;
    }
    if (step >= 3 && !selectedArticle) {
      setWorkflowStep(2);
      setActiveTab('generator');
      return;
    }
    setWorkflowStep(step);
    if (step === 2) setActiveTab('generator');
    if (step === 3 || step === 4) setActiveTab('editor');
  };

  const handleBriefChange = (brief: ContentBrief) => {
    setContentBrief(brief);
    setSelectedKeyword(brief.keyword);
    setWorkflowStep(2);
    if (selectedArticle) {
      setSelectedArticle(null);
      setSaveStatus('idle');
      setLastSavedAt('');
    }
  };

  const handleKeywordSelected = (keyword: string, secondaryKeywords: string[] = []) => {
    setSelectedArticle(null);
    setSelectedKeyword(keyword);
    setContentBrief((current) => ({ ...current, keyword, secondaryKeywords }));
    setWorkflowStep(2);
    setSaveStatus('idle');
    setLastSavedAt('');
  };

  const handleStartNewArticle = () => {
    resetToNewBrief();
    setActiveTab('keywords');
  };

  const handleDeleteDraftArticle = async (article: GeneratedArticle) => {
    if (article.status !== 'draft') {
      throw new Error('Chỉ có thể xóa bài viết đang ở trạng thái bản nháp.');
    }
    await deleteDraftArticle(article.id);
    setArticles((previous) => previous.filter((item) => item.id !== article.id));
    if (selectedArticle?.id === article.id) {
      setSelectedArticle(null);
      setWorkflowStep(1);
      setSaveStatus('idle');
      setLastSavedAt('');
    }
  };

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

  const handleArticleGenerated = async (newArticle: GeneratedArticle) => {
    const provisional = prepareArticle(newArticle);
    setArticles((previous) => [
      provisional.article,
      ...previous.filter((item) => item.id !== provisional.article.id)
    ]);
    setSelectedArticle(provisional.article);
    setWorkflowStep(3);

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
    await persistArticle(prepared.article, prepared.audit);
    setArticles((previous) => [prepared.article, ...previous.filter((item) => item.id !== prepared.article.id)]);
    setSelectedArticle(prepared.article);
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
      setSaveStatus('saved');
      setLastSavedAt(new Date().toISOString());
      if (authoritativeArticle.status === 'published') setWorkflowStep(4);
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
    void persistArticle(prepared.article, prepared.audit)
      .catch((error) => console.error('Không thể lưu bài viết:', error));
  };

  const handleImageGenerated = (newImage: GeneratedImage) => {
    if (!selectedArticle) return;
    handleSaveArticle({
      ...selectedArticle,
      featuredImage: { ...newImage, role: 'featured' }
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
    setContentBrief(defaultContentBrief);
    setWorkflowStep(1);
    setSaveStatus('idle');
    setLastSavedAt('');
    setBrandProfile(null);
    setBrandAssets([]);
    setActiveTab('overview');
    window.localStorage.removeItem(workflowStorageKey);
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
    <div className="ui-app-shell min-h-dvh text-[#17191D] flex">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={navigateToTab}
        wpConnected={settings.wpMcpConnected}
        isOpen={isSidebarOpen}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapsed={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          activeTab={activeTab}
          settings={settings}
          userLabel={userLabel}
          currentArticleTitle={selectedArticle?.title}
          saveStatus={saveStatus}
          onLogout={() => void handleLogout()}
          onQuickGenerate={handleStartNewArticle}
          onMenuToggle={() => setIsSidebarOpen((open) => !open)}
        />

        <main className="app-main flex-1 px-4 py-5 sm:px-6 sm:py-6 xl:px-10 xl:py-8">
          {(['keywords', 'generator', 'imagestudio', 'editor'] as ActiveTab[]).includes(activeTab) && (
            <div className="mb-6">
              <SeoWorkflowBar
                activeStep={workflowStep}
                brief={contentBrief}
                article={selectedArticle}
                saveStatus={saveStatus}
                lastSavedAt={lastSavedAt}
                onStepChange={navigateToWorkflowStep}
              />
            </div>
          )}

          <Suspense fallback={(
            <div className="ui-panel grid min-h-48 place-items-center p-8" role="status">
              <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#0879D9] border-t-transparent" />
                Đang tải khu vực làm việc…
              </div>
            </div>
          )}>
          {activeTab === 'overview' && (
            <OverviewDashboard
              articles={articles}
              wpConnected={settings.wpMcpConnected}
              setActiveTab={navigateToTab}
              onSelectArticleForEdit={(article) => {
                setSelectedArticle(article);
                setWorkflowStep(article.status === 'published' ? 4 : 3);
                setActiveTab('editor');
              }}
            />
          )}

          {activeTab === 'keywords' && (
            <KeywordTrendFinder
              onSelectKeywordForArticle={handleKeywordSelected}
              setActiveTab={navigateToTab}
            />
          )}

          {activeTab === 'generator' && (
            <SeoContentGenerator
              selectedKeyword={selectedKeyword}
              brief={contentBrief}
              geminiService={geminiService}
              onBriefChange={handleBriefChange}
              onArticleGenerated={handleArticleGenerated}
              setActiveTab={navigateToTab}
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
              onSetFeaturedImage={selectedArticle ? handleImageGenerated : undefined}
              onInsertInline={selectedArticle ? handleInlineImage : undefined}
            />
          )}

          {activeTab === 'videoeditor' && <AIVideoEditor />}

          {activeTab === 'editor' && (
            <LiveEditorPublisher
              article={selectedArticle}
              wpService={wpService}
              leonardoService={leonardoService}
              onSaveArticle={handleSaveArticle}
              setActiveTab={navigateToTab}
              workflowStep={workflowStep}
              onWorkflowStepChange={navigateToWorkflowStep}
            />
          )}

          {activeTab === 'history' && (
            <PostHistory
              articles={articles}
              onSelectArticleForEdit={(article) => {
                setSelectedArticle(article);
                setWorkflowStep(article.status === 'published' ? 4 : 3);
                setActiveTab('editor');
              }}
              onDeleteDraft={handleDeleteDraftArticle}
              setActiveTab={navigateToTab}
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
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export default App;
