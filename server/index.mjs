import dotenv from 'dotenv';
import express from 'express';

dotenv.config({ override: true, quiet: true });

const app = express();
const port = Number(process.env.API_PORT || 8787);

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

const requiredGoogleAdsEnv = [
  'GOOGLE_ADS_CLIENT_ID',
  'GOOGLE_ADS_CLIENT_SECRET',
  'GOOGLE_ADS_REFRESH_TOKEN',
  'GOOGLE_ADS_DEVELOPER_TOKEN',
  'GOOGLE_ADS_CUSTOMER_ID'
];
const keywordCache = new Map();
const cacheTtlMs = Number(process.env.KEYWORD_CACHE_TTL_MS || 21_600_000);
const monthOrder = {
  JANUARY: 1,
  FEBRUARY: 2,
  MARCH: 3,
  APRIL: 4,
  MAY: 5,
  JUNE: 6,
  JULY: 7,
  AUGUST: 8,
  SEPTEMBER: 9,
  OCTOBER: 10,
  NOVEMBER: 11,
  DECEMBER: 12
};

const cleanCustomerId = (value = '') => value.replace(/\D/g, '');
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function formatSearchVolume(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('vi-VN').format(number) + '/tháng';
}

function difficultyFromCompetition(competition) {
  if (competition === 'HIGH') return 'Hard';
  if (competition === 'MEDIUM') return 'Medium';
  return 'Easy';
}

function calculateMomentum(monthlyVolumes = []) {
  const values = [...monthlyVolumes]
    .sort((a, b) => {
      const yearDifference = Number(a.year || 0) - Number(b.year || 0);
      if (yearDifference !== 0) return yearDifference;
      return (monthOrder[a.month] || 0) - (monthOrder[b.month] || 0);
    })
    .map((item) => Number(item.monthlySearches || 0));
  if (values.length < 4) return 0;
  const recent = values.slice(-3);
  const previous = values.slice(-6, -3);
  const recentAverage = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  const previousAverage = previous.length
    ? previous.reduce((sum, value) => sum + value, 0) / previous.length
    : recentAverage;
  if (!previousAverage) return recentAverage > 0 ? 1 : 0;
  return clamp((recentAverage - previousAverage) / previousAverage, -1, 2);
}

function scoreKeyword(item, maxVolume) {
  const metrics = item.keywordIdeaMetrics || {};
  const volume = Number(metrics.avgMonthlySearches || 0);
  const volumeScore = maxVolume > 0 ? Math.log1p(volume) / Math.log1p(maxVolume) : 0;
  const competitionIndex = Number(metrics.competitionIndex ?? 50);
  const opportunityScore = 1 - clamp(competitionIndex / 100, 0, 1);
  const momentum = calculateMomentum(metrics.monthlySearchVolumes);
  const momentumScore = clamp((momentum + 1) / 3, 0, 1);
  return Math.round(clamp((volumeScore * 0.55 + opportunityScore * 0.25 + momentumScore * 0.2) * 100, 0, 100));
}

async function getGoogleAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    }),
    signal: AbortSignal.timeout(20_000)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Không thể làm mới Google OAuth token (${response.status}): ${detail.slice(0, 300)}`);
  }

  const payload = await response.json();
  if (!payload.access_token) throw new Error('Google OAuth không trả về access token.');
  return payload.access_token;
}

async function fetchGoogleKeywordIdeas({ query, industry, pageUrl }) {
  const accessToken = await getGoogleAccessToken();
  const customerId = cleanCustomerId(process.env.GOOGLE_ADS_CUSTOMER_ID);
  const loginCustomerId = cleanCustomerId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  const apiVersion = process.env.GOOGLE_ADS_API_VERSION || 'v25';
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  };

  if (loginCustomerId) headers['login-customer-id'] = loginCustomerId;

  const keywords = [...new Set([query, industry].map((value) => value.trim()).filter(Boolean))];
  const seed = pageUrl
    ? { keywordAndUrlSeed: { keywords, url: pageUrl } }
    : { keywordSeed: { keywords } };

  const response = await fetch(
    `https://googleads.googleapis.com/${apiVersion}/customers/${customerId}:generateKeywordIdeas`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        language: `languageConstants/${process.env.GOOGLE_ADS_LANGUAGE_ID || '1040'}`,
        geoTargetConstants: [`geoTargetConstants/${process.env.GOOGLE_ADS_GEO_TARGET_ID || '2704'}`],
        includeAdultKeywords: false,
        keywordPlanNetwork: 'GOOGLE_SEARCH',
        pageSize: 100,
        ...seed
      }),
      signal: AbortSignal.timeout(35_000)
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google Ads Keyword Planner trả về lỗi ${response.status}: ${detail.slice(0, 600)}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.results) ? payload.results : [];
}

function heuristicIntent(keyword) {
  const value = keyword.toLowerCase();
  if (/(giá|chi phí|đăng ký|mua|khóa học|phòng tập|gần đây)/.test(value)) return 'Transactional';
  if (/(tốt nhất|review|so sánh|nên|top)/.test(value)) return 'Commercial';
  if (/(omfit|địa chỉ|website|liên hệ)/.test(value)) return 'Navigational';
  return 'Informational';
}

function buildHeuristicEnrichments(items, industry) {
  return items.map((item) => ({
    keyword: item.keyword,
    intent: heuristicIntent(item.keyword),
    cluster: industry,
    relatedLsiKeywords: [],
    contentAngle: `Nội dung giải đáp nhu cầu tìm kiếm về ${item.keyword}`
  }));
}

async function enrichKeywordsWithModel(items, industry) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || items.length === 0) {
    return {
      modelApplied: false,
      enrichments: buildHeuristicEnrichments(items, industry)
    };
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Bạn là SEO strategist cho OMFIT. Chỉ phân tích ngữ nghĩa của dữ liệu keyword thật bên dưới.
Không được sửa, ước lượng hoặc phát minh search volume, competition, CPC hay trend score.
Hãy phân loại intent, gom cluster, đề xuất 3 từ khóa liên quan và một content angle ngắn bằng tiếng Việt.
Ngành: ${industry}
Dữ liệu: ${JSON.stringify(items.map(({ keyword, searchVolumeValue, competition, trendScore }) => ({
  keyword,
  searchVolumeValue,
  competition,
  trendScore
})))}`
          }]
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                keyword: { type: 'STRING' },
                intent: {
                  type: 'STRING',
                  enum: ['Informational', 'Transactional', 'Navigational', 'Commercial']
                },
                cluster: { type: 'STRING' },
                relatedLsiKeywords: { type: 'ARRAY', items: { type: 'STRING' } },
                contentAngle: { type: 'STRING' }
              },
              required: ['keyword', 'intent', 'cluster', 'relatedLsiKeywords', 'contentAngle']
            }
          }
        }
      }),
      signal: AbortSignal.timeout(35_000)
    }
  );

  if (!response.ok) {
    throw new Error(`Dịch vụ phân tích SEO trả về lỗi ${response.status}.`);
  }

  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = JSON.parse(text || '[]');
  return { modelApplied: true, enrichments: Array.isArray(parsed) ? parsed : [] };
}

app.get('/api/health', (_request, response) => {
  const missing = requiredGoogleAdsEnv.filter((name) => !process.env[name]);
  response.json({
    ok: true,
    googleAdsConfigured: missing.length === 0,
    modelConfigured: Boolean(process.env.GEMINI_API_KEY),
    missing
  });
});

app.post('/api/keywords/analyze', async (request, response) => {
  const query = String(request.body?.query || '').trim();
  const industry = String(request.body?.industry || '').trim();
  const pageUrl = String(request.body?.pageUrl || process.env.KEYWORD_SEED_URL || '').trim();
  const cacheKey = JSON.stringify({
    query: query.toLocaleLowerCase('vi-VN'),
    industry,
    pageUrl,
    language: process.env.GOOGLE_ADS_LANGUAGE_ID || '1040',
    geo: process.env.GOOGLE_ADS_GEO_TARGET_ID || '2704'
  });

  if (query.length < 2 || query.length > 120) {
    return response.status(400).json({ error: 'Từ khóa chủ đề phải có từ 2 đến 120 ký tự.' });
  }

  const missing = requiredGoogleAdsEnv.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    return response.status(503).json({
      error: 'Chưa cấu hình kết nối Google Ads Keyword Planner.',
      missing
    });
  }

  try {
    const cached = keywordCache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < cacheTtlMs) {
      return response.json({
        ...cached.payload,
        meta: { ...cached.payload.meta, cacheHit: true }
      });
    }

    const ideas = await fetchGoogleKeywordIdeas({ query, industry, pageUrl });
    const maxVolume = Math.max(
      0,
      ...ideas.map((item) => Number(item.keywordIdeaMetrics?.avgMonthlySearches || 0))
    );

    const ranked = ideas
      .map((item) => {
        const metrics = item.keywordIdeaMetrics || {};
        const searchVolumeValue = Number(metrics.avgMonthlySearches || 0);
        return {
          keyword: String(item.text || '').trim(),
          searchVolume: formatSearchVolume(searchVolumeValue),
          searchVolumeValue,
          difficulty: difficultyFromCompetition(metrics.competition),
          competition: metrics.competition || 'UNSPECIFIED',
          competitionIndex: Number(metrics.competitionIndex ?? 0),
          lowTopOfPageBidMicros: Number(metrics.lowTopOfPageBidMicros || 0),
          highTopOfPageBidMicros: Number(metrics.highTopOfPageBidMicros || 0),
          monthlySearchVolumes: metrics.monthlySearchVolumes || [],
          trendScore: scoreKeyword(item, maxVolume)
        };
      })
      .filter((item) => item.keyword && item.searchVolumeValue > 0)
      .sort((a, b) => b.trendScore - a.trendScore || b.searchVolumeValue - a.searchVolumeValue)
      .slice(0, 20);

    const warnings = [];
    let modelApplied = false;
    let enrichments = buildHeuristicEnrichments(ranked, industry);
    try {
      const modelResult = await enrichKeywordsWithModel(ranked, industry);
      modelApplied = modelResult.modelApplied;
      enrichments = modelResult.enrichments;
    } catch (modelError) {
      console.warn('[keyword-enrichment]', modelError);
      warnings.push('Đã lấy dữ liệu Google Ads nhưng bước phân tích SEO bằng model không hoàn tất.');
    }
    const enrichmentByKeyword = new Map(
      enrichments
        .filter((item) => typeof item?.keyword === 'string')
        .map((item) => [item.keyword.toLocaleLowerCase('vi-VN'), item])
    );

    const items = ranked.map((item) => {
      const enrichment = enrichmentByKeyword.get(item.keyword.toLocaleLowerCase('vi-VN'));
      return {
        ...item,
        intent: enrichment?.intent || heuristicIntent(item.keyword),
        cluster: enrichment?.cluster || industry,
        relatedLsiKeywords: Array.isArray(enrichment?.relatedLsiKeywords)
          ? enrichment.relatedLsiKeywords.slice(0, 5)
          : [],
        contentAngle: enrichment?.contentAngle || `Nội dung giải đáp nhu cầu về ${item.keyword}`,
        source: 'google_ads'
      };
    });

    const payload = {
      items,
      meta: {
        source: 'Google Ads KeywordPlanIdeaService',
        modelApplied,
        languageId: process.env.GOOGLE_ADS_LANGUAGE_ID || '1040',
        geoTargetId: process.env.GOOGLE_ADS_GEO_TARGET_ID || '2704',
        generatedAt: new Date().toISOString(),
        warnings,
        cacheHit: false
      }
    };
    keywordCache.set(cacheKey, { createdAt: Date.now(), payload });
    return response.json(payload);
  } catch (error) {
    console.error('[keyword-research]', error);
    return response.status(502).json({
      error: error instanceof Error ? error.message : 'Không thể lấy dữ liệu keyword.'
    });
  }
});

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`OMFIT API listening on http://127.0.0.1:${port}`);
  });
}

export default app;
