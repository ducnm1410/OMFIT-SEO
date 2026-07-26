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
import type { ActiveTab, ApiSettings, GeneratedArticle, GeneratedImage } from './types';
import { GeminiService } from './services/geminiService';
import { LeonardoService } from './services/leonardoService';
import { WordpressMcpService } from './services/wordpressMcpService';
import { disconnectGoogleAds } from './services/keywordResearchService';
import { supabase } from './lib/supabase';

export function App() {
  const [session, setSession] = useState<Session | null>();
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    const allowedTabs: ActiveTab[] = ['overview', 'keywords', 'generator', 'imagestudio', 'editor', 'history'];
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
    geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
    leonardoApiKey: import.meta.env.VITE_LEONARDO_API_KEY || '',
    wpSiteUrl: import.meta.env.VITE_WP_SITE_URL || 'https://omfit.com.vn',
    wpMcpConnected: Boolean(import.meta.env.VITE_WP_USERNAME && import.meta.env.VITE_WP_APP_PASSWORD),
    defaultStatus: 'publish',
    defaultAuthor: 'OMFIT Admin'
  });

  const geminiService = useMemo(() => new GeminiService(settings.geminiApiKey), [settings.geminiApiKey]);
  const leonardoService = useMemo(() => new LeonardoService(settings.leonardoApiKey || ''), [settings.leonardoApiKey]);
  const wpService = useMemo(() => new WordpressMcpService(settings.wpSiteUrl), [settings.wpSiteUrl]);

  const [articles, setArticles] = useState<GeneratedArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<GeneratedArticle | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState('');

  const handleArticleGenerated = (newArticle: GeneratedArticle) => {
    setArticles((previous) => [newArticle, ...previous]);
    setSelectedArticle(newArticle);
  };

  const handleSaveArticle = (updatedArticle: GeneratedArticle) => {
    setArticles((previous) => previous.map((article) => (
      article.id === updatedArticle.id ? updatedArticle : article
    )));
    setSelectedArticle(updatedArticle);
  };

  const handleImageGenerated = (newImage: GeneratedImage) => {
    if (!selectedArticle) return;
    handleSaveArticle({
      ...selectedArticle,
      featuredImage: newImage
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
              onSelectArticleForEdit={(article) => {
                setSelectedArticle(article);
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
