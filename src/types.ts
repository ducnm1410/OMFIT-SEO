export interface KeywordTrend {
  keyword: string;
  searchVolume: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  trendScore: number;
  intent: 'Informational' | 'Transactional' | 'Navigational' | 'Commercial';
  relatedLsiKeywords: string[];
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
  source: 'vertex-imagen-3' | 'dall-e-3' | 'gemini' | 'upload' | 'leonardo-nano-banana-2';
}

export interface ApiSettings {
  geminiApiKey: string;
  openaiApiKey: string;
  vertexApiKey?: string;
  vertexProjectId?: string;
  leonardoApiKey?: string;
  wpSiteUrl: string;
  wpMcpConnected: boolean;
  defaultStatus: 'draft' | 'publish';
  defaultAuthor: string;
}

export type ActiveTab = 'overview' | 'keywords' | 'generator' | 'imagestudio' | 'editor' | 'history';
