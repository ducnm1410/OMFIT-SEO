import { supabase } from '../lib/supabase';
import type {
  BrandAsset,
  BrandProfile,
  GeneratedArticle,
  GeneratedImage,
  SeoAuditResult
} from '../types';
import { authenticatedFetch } from './apiClient';

const DEFAULT_BRAND_PROFILE: BrandProfile = {
  name: 'OMFIT',
  version: 1,
  mission: 'Đồng hành cùng người Việt trên hành trình chăm sóc sức khỏe toàn diện và bền vững.',
  positioning: 'Fitness & Wellness cao cấp với triết lý Balance for Life, cân bằng Thân – Tâm – Trí.',
  audience: ['Người quan tâm sức khỏe toàn diện', 'Người tập Pilates, Yoga và Fitness', 'Khách hàng cần lộ trình cá nhân hóa'],
  voice: {
    language: 'Tiếng Việt tự nhiên',
    tone: ['chuyên nghiệp', 'truyền cảm hứng', 'ấm áp', 'đáng tin cậy'],
    avoid: ['giật gân', 'cam kết kết quả', 'phán đoán y khoa']
  },
  colors: {
    primary: '#0879D9',
    secondary: '#0284C7',
    ink: '#071827',
    background: '#F8FAFC',
    white: '#FFFFFF'
  },
  typography: {
    heading: 'Be Vietnam Pro, Arial, sans-serif',
    body: 'Be Vietnam Pro, Arial, sans-serif'
  },
  visualRules: {
    style: 'Photorealistic premium fitness and wellness photography',
    lighting: 'Ánh sáng tự nhiên, trong trẻo, cân bằng, không quá tương phản',
    environment: 'Không gian OMFIT hiện đại, sạch sẽ, cao cấp, thiết bị đúng giải phẫu',
    people: 'Người Việt trưởng thành, chuyển động tự nhiên, trang phục thể thao thanh lịch',
    composition: 'Chừa khoảng thở, chủ thể rõ, phù hợp crop 16:9 và 4:3',
    logo: 'Không yêu cầu AI tự vẽ chữ hoặc logo; logo được compositing sau khi ảnh được duyệt'
  },
  prohibitedElements: [
    'Chữ hoặc logo bị biến dạng',
    'Thiết bị Pilates sai cấu tạo',
    'Tư thế tập nguy hiểm',
    'Hình ảnh before-after',
    'Cam kết giảm cân hoặc chữa bệnh',
    'Không gian đông đúc, lộn xộn'
  ],
  approvedClaims: [
    'OMFIT hướng đến sức khỏe toàn diện',
    'Triết lý Balance for Life',
    'Giải pháp tập luyện được cá nhân hóa theo nhu cầu'
  ],
  promptTemplate: 'Create a premium OMFIT fitness and wellness image. Follow the approved brand colors, natural lighting, clean modern environment, realistic Vietnamese adults and anatomically correct movement. No text in image.',
  negativePrompt: 'distorted anatomy, malformed hands, incorrect fitness equipment, fake logo, text, watermark, medical claim, before and after, clutter, low resolution',
  guidelineNotes: 'Ưu tiên hình ảnh chân thực, cao cấp, sạch sẽ và thể hiện triết lý Balance for Life. Không để mô hình tự vẽ lại logo hoặc chữ OMFIT.',
  companyInfo: {
    displayName: 'OMFIT Fitness & Wellness',
    legalName: 'OMFIT',
    tagline: 'Balance for Life',
    website: 'https://omfit.com.vn',
    hotline: '1900 272779',
    email: ''
  },
  branches: [],
  footerSettings: {
    enabled: true,
    heading: 'Đồng hành cùng OMFIT',
    description: 'Kết nối với OMFIT để được tư vấn lộ trình tập luyện phù hợp.',
    ctaLabel: 'Đăng ký tư vấn',
    ctaUrl: 'https://omfit.com.vn/contact-us/'
  }
};

function hasBrokenVietnameseText(value: unknown) {
  const serialized = typeof value === 'string'
    ? value
    : JSON.stringify(value ?? '');
  return /(?:^|[\s"'])\?{1,2}[\p{L}]|[\p{L}]\?[\p{L}]/u.test(serialized);
}

function useCleanBrandValue<T>(value: T, fallback: T): T {
  return value == null || hasBrokenVietnameseText(value) ? fallback : value;
}

function mapBrandProfile(row: any): BrandProfile {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    mission: useCleanBrandValue(row.mission, DEFAULT_BRAND_PROFILE.mission),
    positioning: useCleanBrandValue(row.positioning, DEFAULT_BRAND_PROFILE.positioning),
    audience: useCleanBrandValue(row.audience, DEFAULT_BRAND_PROFILE.audience),
    voice: useCleanBrandValue(row.voice, DEFAULT_BRAND_PROFILE.voice),
    colors: row.colors || {},
    typography: row.typography || {},
    visualRules: useCleanBrandValue(row.visual_rules, DEFAULT_BRAND_PROFILE.visualRules),
    prohibitedElements: useCleanBrandValue(row.prohibited_elements, DEFAULT_BRAND_PROFILE.prohibitedElements),
    approvedClaims: useCleanBrandValue(row.approved_claims, DEFAULT_BRAND_PROFILE.approvedClaims),
    promptTemplate: row.prompt_template || '',
    negativePrompt: row.negative_prompt || '',
    guidelineNotes: useCleanBrandValue(row.guideline_notes, DEFAULT_BRAND_PROFILE.guidelineNotes),
    companyInfo: {
      ...DEFAULT_BRAND_PROFILE.companyInfo,
      ...useCleanBrandValue(row.company_info, DEFAULT_BRAND_PROFILE.companyInfo)
    },
    branches: Array.isArray(row.branches) ? row.branches : [],
    footerSettings: {
      ...DEFAULT_BRAND_PROFILE.footerSettings,
      ...useCleanBrandValue(row.footer_settings, DEFAULT_BRAND_PROFILE.footerSettings)
    }
  };
}

function mapBrandAsset(row: any, signedUrl?: string): BrandAsset {
  return {
    id: row.id,
    brandProfileId: row.brand_profile_id,
    assetType: row.asset_type,
    name: row.name,
    bucket: row.bucket,
    storagePath: row.storage_path,
    url: row.public_url || signedUrl || undefined,
    mimeType: row.mime_type || undefined
  };
}

function mapImage(row: any): GeneratedImage {
  return {
    id: row.id,
    url: row.public_url || row.source_url || '',
    prompt: row.prompt || '',
    altText: row.alt_text || '',
    fileName: row.file_name || 'omfit-image.webp',
    style: row.style || '',
    source: row.provider === 'upload' ? 'upload' : 'leonardo-nano-banana-2',
    storagePath: row.storage_path,
    providerGenerationId: row.provider_generation_id,
    caption: row.caption || ''
  };
}

function mapArticle(row: any): GeneratedArticle {
  const relations = Array.isArray(row.article_media) ? row.article_media : [];
  const media = relations
    .map((relation: any) => relation.media_assets ? { ...mapImage(relation.media_assets), role: relation.role } : null)
    .filter(Boolean) as GeneratedImage[];
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    metaTitle: row.meta_title || '',
    metaDescription: row.meta_description || '',
    focusKeyword: row.focus_keyword || '',
    contentHtml: row.content_html || '',
    wordCount: row.word_count || 0,
    readabilityScore: row.readability_score || 0,
    seoScore: row.seo_score || 0,
    categories: row.categories || [],
    tags: row.tags || [],
    featuredImage: media.find((image) => image.role === 'featured'),
    articleImages: media.filter((image) => image.role === 'inline'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status === 'published' ? 'published' : 'draft',
    wpPostId: row.wp_post_id || undefined,
    wpPostUrl: row.wp_post_url || undefined,
    brandProfileId: row.brand_profile_id || undefined
  };
}

async function requireUserId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Phiên đăng nhập đã hết hạn.');
  return data.user.id;
}

export async function ensureBrandProfile(): Promise<BrandProfile> {
  const ownerId = await requireUserId();
  const { data: existing, error: readError } = await supabase
    .from('brand_profiles')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readError) throw readError;
  if (existing) return mapBrandProfile(existing);

  const { data, error } = await supabase
    .from('brand_profiles')
    .insert({
      owner_id: ownerId,
      name: DEFAULT_BRAND_PROFILE.name,
      version: DEFAULT_BRAND_PROFILE.version,
      mission: DEFAULT_BRAND_PROFILE.mission,
      positioning: DEFAULT_BRAND_PROFILE.positioning,
      audience: DEFAULT_BRAND_PROFILE.audience,
      voice: DEFAULT_BRAND_PROFILE.voice,
      colors: DEFAULT_BRAND_PROFILE.colors,
      typography: DEFAULT_BRAND_PROFILE.typography,
      visual_rules: DEFAULT_BRAND_PROFILE.visualRules,
      prohibited_elements: DEFAULT_BRAND_PROFILE.prohibitedElements,
      approved_claims: DEFAULT_BRAND_PROFILE.approvedClaims,
      prompt_template: DEFAULT_BRAND_PROFILE.promptTemplate,
      negative_prompt: DEFAULT_BRAND_PROFILE.negativePrompt,
      guideline_notes: DEFAULT_BRAND_PROFILE.guidelineNotes,
      company_info: DEFAULT_BRAND_PROFILE.companyInfo,
      branches: DEFAULT_BRAND_PROFILE.branches,
      footer_settings: DEFAULT_BRAND_PROFILE.footerSettings
    })
    .select('*')
    .single();
  if (error) throw error;
  return { ...DEFAULT_BRAND_PROFILE, id: data.id };
}

export async function saveBrandProfile(profile: BrandProfile): Promise<BrandProfile> {
  const ownerId = await requireUserId();
  const { data, error } = await supabase
    .from('brand_profiles')
    .upsert({
      id: profile.id,
      owner_id: ownerId,
      name: profile.name,
      version: profile.version,
      is_active: true,
      mission: profile.mission,
      positioning: profile.positioning,
      audience: profile.audience,
      voice: profile.voice,
      colors: profile.colors,
      typography: profile.typography,
      visual_rules: profile.visualRules,
      prohibited_elements: profile.prohibitedElements,
      approved_claims: profile.approvedClaims,
      prompt_template: profile.promptTemplate,
      negative_prompt: profile.negativePrompt,
      guideline_notes: profile.guidelineNotes,
      company_info: profile.companyInfo,
      branches: profile.branches,
      footer_settings: profile.footerSettings
    }, { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw error;
  return mapBrandProfile(data);
}

export async function loadBrandAssets(brandProfileId: string): Promise<BrandAsset[]> {
  const { data, error } = await supabase
    .from('brand_assets')
    .select('*')
    .eq('brand_profile_id', brandProfileId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return Promise.all((data || []).map(async (row) => {
    if (row.public_url || row.bucket !== 'omfit-draft-assets') return mapBrandAsset(row);
    const { data: signed } = await supabase.storage
      .from(row.bucket)
      .createSignedUrl(row.storage_path, 3600);
    return mapBrandAsset(row, signed?.signedUrl);
  }));
}

export async function uploadBrandAsset(
  file: File,
  brandProfileId: string,
  assetType: BrandAsset['assetType']
): Promise<BrandAsset> {
  const ownerId = await requireUserId();
  const safeName = file.name
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || assetType;
  const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const bucket = assetType === 'guideline' ? 'omfit-draft-assets' : 'omfit-public-assets';
  const storagePath = `${ownerId}/brand/${brandProfileId}/${Date.now()}-${safeName}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;
  const publicUrl = bucket === 'omfit-public-assets'
    ? supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl
    : null;
  const { data, error } = await supabase
    .from('brand_assets')
    .insert({
      owner_id: ownerId,
      brand_profile_id: brandProfileId,
      asset_type: assetType,
      name: file.name,
      bucket,
      storage_path: storagePath,
      public_url: publicUrl,
      mime_type: file.type,
      metadata: { bytes: file.size }
    })
    .select('*')
    .single();
  if (error) throw error;
  if (publicUrl) return mapBrandAsset(data);
  const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 3600);
  return mapBrandAsset(data, signed?.signedUrl);
}

export async function loadArticles(): Promise<GeneratedArticle[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('*, article_media(role, sort_order, media_assets(*))')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapArticle);
}

export async function saveArticle(article: GeneratedArticle, audit?: SeoAuditResult) {
  const ownerId = await requireUserId();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('articles')
    .upsert({
      id: article.id,
      owner_id: ownerId,
      brand_profile_id: article.brandProfileId || null,
      title: article.title,
      slug: article.slug,
      meta_title: article.metaTitle,
      meta_description: article.metaDescription,
      focus_keyword: article.focusKeyword,
      content_html: article.contentHtml,
      word_count: article.wordCount,
      readability_score: audit?.readabilityScore ?? article.readabilityScore,
      seo_score: audit?.score ?? article.seoScore,
      seo_status: audit ? (audit.passed ? 'ready' : 'needs_review') : 'needs_review',
      categories: article.categories,
      tags: article.tags,
      status: article.status,
      wp_post_id: article.wpPostId || null,
      wp_post_url: article.wpPostUrl || null,
      published_at: article.status === 'published' ? now : null,
      updated_at: now
    }, { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw error;

  const images = [
    ...(article.featuredImage ? [{ ...article.featuredImage, role: 'featured' as const }] : []),
    ...article.articleImages.map((image) => ({ ...image, role: 'inline' as const }))
  ].filter((image) => /^[0-9a-f-]{36}$/i.test(image.id));
  if (images.length > 0) {
    await supabase.from('article_media').upsert(
      images.map((image, index) => ({
        article_id: article.id,
        media_id: image.id,
        owner_id: ownerId,
        role: image.role,
        sort_order: index
      })),
      { onConflict: 'article_id,media_id' }
    );
  }

  if (audit) {
    await supabase.from('seo_audits').insert({
      article_id: article.id,
      owner_id: ownerId,
      score: audit.score,
      readability_score: audit.readabilityScore,
      passed: audit.passed,
      issues: audit.issues,
      metrics: audit.metrics
    });
  }

  const { count } = await supabase
    .from('article_revisions')
    .select('*', { count: 'exact', head: true })
    .eq('article_id', article.id);
  await supabase.from('article_revisions').insert({
    article_id: article.id,
    owner_id: ownerId,
    revision_no: (count || 0) + 1,
    snapshot: { ...article, seoScore: audit?.score, readabilityScore: audit?.readabilityScore },
    change_note: article.status === 'published' ? 'Published to WordPress' : 'Saved from editor'
  });

  return mapArticle({ ...data, article_media: [] });
}

export async function uploadMediaFile(file: File, articleId?: string): Promise<GeneratedImage> {
  const ownerId = await requireUserId();
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safeName = file.name
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const storagePath = `${ownerId}/${articleId || 'library'}/${Date.now()}-${safeName}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from('omfit-public-assets')
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;
  const { data: publicData } = supabase.storage.from('omfit-public-assets').getPublicUrl(storagePath);
  const { data, error } = await supabase
    .from('media_assets')
    .insert({
      owner_id: ownerId,
      article_id: articleId || null,
      provider: 'upload',
      bucket: 'omfit-public-assets',
      storage_path: storagePath,
      public_url: publicData.publicUrl,
      mime_type: file.type,
      bytes: file.size,
      file_name: file.name,
      alt_text: safeName.replace(/-/g, ' '),
      status: 'approved'
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapImage(data);
}

export async function syncWordpressIndex() {
  return authenticatedFetch('/api/wordpress/sync-index', {
    method: 'POST',
    body: JSON.stringify({})
  }) as Promise<{ indexed: number }>;
}

export async function suggestInternalLinks(keyword: string) {
  const normalizeForMatch = (value: string) => value
    .toLocaleLowerCase('vi-VN')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const stopWords = new Set(['cho', 'cua', 'voi', 'tai', 'the', 'nao', 'nhung', 'mot', 'cac', 'omfit']);
  const terms = normalizeForMatch(keyword)
    .split(/\s+/)
    .filter((term) => term.length > 2 && !stopWords.has(term));
  const suspiciousSlug = /(?:nfl|seahawks|quarterback|titans|super-bowl|sam-darnold|geno-smith|nba|baseball|\/\d+-\d+\/?$)/i;
  const { data, error } = await supabase
    .from('site_content_index')
    .select('title,url,keywords,content_type')
    .eq('status', 'publish')
    .limit(200);
  if (error) throw error;
  return (data || [])
    .filter((row) => {
      try {
        const url = new URL(row.url);
        return url.hostname.replace(/^www\./i, '') === 'omfit.com.vn'
          && !suspiciousSlug.test(`${url.pathname} ${row.title}`);
      } catch {
        return false;
      }
    })
    .map((row) => {
      const normalizedTitle = normalizeForMatch(row.title);
      const haystack = normalizeForMatch(`${row.title} ${(row.keywords || []).join(' ')}`);
      const matchedTerms = terms.filter((term) => haystack.split(' ').includes(term));
      return {
        title: row.title,
        url: row.url.replace(/^https:\/\/www\.omfit\.com\.vn/i, 'https://omfit.com.vn'),
        score: matchedTerms.reduce(
          (sum, term) => sum + (normalizedTitle.split(' ').includes(term) ? 3 : 1),
          0
        ),
        matchedTerms: matchedTerms.length
      };
    })
    .sort((a, b) => b.score - a.score)
    .filter((item) => item.matchedTerms > 0 && item.score >= 3)
    .filter((item, index, rows) => rows.findIndex((row) => row.url === item.url) === index)
    .slice(0, 4);
}
