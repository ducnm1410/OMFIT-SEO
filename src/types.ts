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

export interface GoogleAdsConnection {
  connected: boolean;
  selectedCustomerId: string;
  accounts: {
    id: string;
    label: string;
  }[];
  reconnectRequired?: boolean;
  error?: string;
}

export interface SeoOutline {
  title: string;
  metaTitle: string;
  metaDescription: string;
  slug: string;
  focusKeyword: string;
  secondaryKeywords?: string[];
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

export interface ContentBrief {
  keyword: string;
  secondaryKeywords: string[];
  searchIntent: 'Informational' | 'Commercial' | 'Transactional' | 'Navigational';
  service: string;
  audience: string;
  conversionGoal: string;
  tone: string;
  wordCount: number;
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
  wpPostUrl?: string;
  updatedAt?: string;
  brandProfileId?: string;
  seoIssues?: SeoIssue[];
  sources?: ArticleSource[];
}

export type ImageAspectRatio = '1:1' | '2:3' | '3:2' | '16:9' | '9:16';

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  altText: string;
  fileName: string;
  style: string;
  source: 'upload' | 'leonardo-nano-banana-2' | 'leonardo-chatgpt-2' | 'leonardo-gpt-image-2';
  width?: number;
  height?: number;
  aspectRatio?: ImageAspectRatio;
  storagePath?: string;
  providerGenerationId?: string;
  referenceAssetId?: string;
  referenceAssetType?: 'logo' | 'reference';
  referenceAssetName?: string;
  createdAt?: string;
  caption?: string;
  role?: 'featured' | 'inline';
}

export interface GeneratedVideo {
  id: string;
  url: string;
  interactionId: string;
  parentAssetId?: string;
  promptVi: string;
  promptEn: string;
  resolution: '720p' | '1080p';
  fileName: string;
  mimeType: string;
  storagePath: string;
  sourceStoragePath?: string;
  bytes?: number;
  createdAt: string;
}

export interface SeoIssue {
  code: string;
  level: 'error' | 'warning' | 'success';
  message: string;
}

export interface SeoAuditResult {
  score: number;
  readabilityScore: number;
  passed: boolean;
  issues: SeoIssue[];
  metrics: Record<string, number | string | boolean>;
}

export interface ArticleSource {
  id: string;
  articleId: string;
  url: string;
  canonicalUrl?: string;
  title: string;
  publisher: string;
  domain: string;
  publishedAt?: string;
  accessedAt: string;
  sourceType: string;
  claimText: string;
  groundingData?: Record<string, unknown>;
  approved: boolean;
  status: 'candidate' | 'verified' | 'approved' | 'rejected' | 'broken';
  createdAt?: string;
  updatedAt?: string;
}

export interface EditorialSettings {
  authorName: string;
  authorUrl: string;
  authorJobTitle: string;
  reviewerName: string;
  reviewerUrl: string;
  reviewerCredentials: string;
}

export interface BrandProfile {
  id?: string;
  name: string;
  version: number;
  mission: string;
  positioning: string;
  audience: string[];
  voice: Record<string, unknown>;
  colors: Record<string, string>;
  typography: Record<string, string>;
  visualRules: Record<string, unknown>;
  prohibitedElements: string[];
  approvedClaims: string[];
  promptTemplate: string;
  negativePrompt: string;
  guidelineNotes: string;
  companyInfo: {
    displayName: string;
    legalName: string;
    tagline: string;
    website: string;
    hotline: string;
    email: string;
  };
  branches: BrandBranch[];
  footerSettings: {
    enabled: boolean;
    heading: string;
    description: string;
    ctaLabel: string;
    ctaUrl: string;
  };
  editorialSettings: EditorialSettings;
}

export interface BrandBranch {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  services: string[];
  ctaUrl: string;
}

export interface BrandAsset {
  id: string;
  brandProfileId: string;
  assetType: 'logo' | 'guideline' | 'reference' | 'texture' | 'font_sample';
  name: string;
  bucket: string;
  storagePath: string;
  url?: string;
  mimeType?: string;
}

export interface ApiSettings {
  geminiApiKey: string;
  leonardoApiKey?: string;
  wpSiteUrl: string;
  wpMcpConnected: boolean;
  defaultStatus: 'draft' | 'publish';
  defaultAuthor: string;
}

export type ActiveTab = 'overview' | 'keywords' | 'generator' | 'imagestudio' | 'videoeditor' | 'editor' | 'history' | 'settings';

export type SeoWorkflowStep = 1 | 2 | 3 | 4;

export type WorkflowSaveStatus = 'idle' | 'saving' | 'saved' | 'error';
