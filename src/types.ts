export interface KeywordTrend {
  keyword: string;
  searchVolume: string;
  searchVolumeValue: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  competition: string;
  competitionIndex: number;
  lowTopOfPageBidMicros: number;
  highTopOfPageBidMicros: number;
  monthlySearchVolumes: {
    year: string;
    month: string;
    monthlySearches: string;
  }[];
  trendScore: number;
  intent: 'Informational' | 'Transactional' | 'Navigational' | 'Commercial';
  cluster: string;
  relatedLsiKeywords: string[];
  contentAngle: string;
  source: 'google_ads';
}

export interface KeywordResearchResponse {
  items: KeywordTrend[];
  meta: {
    source: string;
    modelApplied: boolean;
    languageId: string;
    geoTargetId: string;
    generatedAt: string;
    warnings: string[];
    cacheHit: boolean;
  };
}

export interface SeoOutline {
  title: string;
  metaTitle: string;
  metaDescription: string;
  slug: string;
  focusKeyword: string;
  headings: {
    tag: 'h2' | 'h3';
    text: string;
    points: string[];
  }[];
  faq: {
    question: string;
    answer: string;
  }[];
}

export interface GeneratedArticle {
  id: string;
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  contentHtml: string;
  wordCount: number;
  readabilityScore: number;
  seoScore: number;
  categories: string[];
  tags: string[];
  featuredImage?: GeneratedImage;
  articleImages: GeneratedImage[];
  createdAt: string;
  status: 'draft' | 'published';
  wpPostId?: number;
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  altText: string;
  fileName: string;
  style: string;
  source: 'upload' | 'leonardo-nano-banana-2' | 'leonardo-chatgpt-2';
}

export interface ApiSettings {
  geminiApiKey: string;
  leonardoApiKey?: string;
  wpSiteUrl: string;
  wpMcpConnected: boolean;
  defaultStatus: 'draft' | 'publish';
  defaultAuthor: string;
}

export type ActiveTab = 'overview' | 'keywords' | 'generator' | 'imagestudio' | 'editor' | 'history';
