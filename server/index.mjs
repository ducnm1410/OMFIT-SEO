import dotenv from 'dotenv';
import express from 'express';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ override: true, quiet: true });

const requireServerPackage = createRequire(import.meta.url);
let sanitizeHtmlPackage;

function getHtmlSanitizer() {
  if (!sanitizeHtmlPackage) {
    const loadedPackage = requireServerPackage('sanitize-html');
    sanitizeHtmlPackage = loadedPackage?.default || loadedPackage;
  }
  return sanitizeHtmlPackage;
}

const app = express();
const port = Number(process.env.API_PORT || 8787);

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

const requiredGoogleAdsEnv = [
  'GOOGLE_ADS_CLIENT_ID',
  'GOOGLE_ADS_CLIENT_SECRET',
  'GOOGLE_ADS_DEVELOPER_TOKEN',
  'OAUTH_SESSION_SECRET'
];
const googleAdsScope = 'https://www.googleapis.com/auth/adwords';
const oauthStateCookie = 'omfit_google_ads_state';
const oauthSessionCookie = 'omfit_google_ads_session';
const oauthStateMaxAgeMs = 10 * 60 * 1000;

function getEnv(name, fallback = '') {
  return String(process.env[name] ?? fallback).trim();
}

let supabaseAdminClient;
function getSupabaseAdmin() {
  if (supabaseAdminClient) return supabaseAdminClient;
  const url = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) {
    throw new ApiError(503, 'Chưa cấu hình Supabase service role cho kho nội dung.', 'supabase_admin_missing');
  }
  supabaseAdminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return supabaseAdminClient;
}
const oauthSessionMaxAgeMs = 30 * 24 * 60 * 60 * 1000;
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

class ApiError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function getRequestOrigin(request) {
  const configuredOrigin = String(process.env.OAUTH_REDIRECT_BASE || '').trim().replace(/\/+$/, '');
  if (configuredOrigin) return configuredOrigin;
  const forwardedProto = String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProto || request.protocol || 'http';
  return `${protocol}://${request.get('host')}`;
}

function getCallbackUrl(request) {
  return `${getRequestOrigin(request)}/api/auth/google/callback`;
}

function parseCookies(request) {
  return String(request.headers.cookie || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex < 1) return cookies;
      const name = part.slice(0, separatorIndex);
      const value = part.slice(separatorIndex + 1);
      try {
        cookies[name] = decodeURIComponent(value);
      } catch {
        cookies[name] = value;
      }
      return cookies;
    }, {});
}

function getCookieOptions(request, maxAge) {
  return {
    httpOnly: true,
    secure: getRequestOrigin(request).startsWith('https://'),
    sameSite: 'lax',
    path: '/api',
    maxAge
  };
}

function clearOAuthCookie(request, response, name) {
  response.clearCookie(name, {
    ...getCookieOptions(request, 0),
    maxAge: undefined
  });
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getSessionEncryptionKey() {
  const secret = getEnv('OAUTH_SESSION_SECRET');
  if (!secret) throw new ApiError(503, 'Chưa cấu hình khóa bảo mật cho phiên Google Ads.', 'oauth_not_configured');
  return crypto.createHash('sha256').update(secret).digest();
}

function sealEncryptedPayload(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getSessionEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64url');
}

function openEncryptedPayload(value) {
  if (!value) return null;
  try {
    const packed = Buffer.from(value, 'base64url');
    if (packed.length < 29) return null;
    const iv = packed.subarray(0, 12);
    const authTag = packed.subarray(12, 28);
    const encrypted = packed.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', getSessionEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    return JSON.parse(Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]).toString('utf8'));
  } catch {
    return null;
  }
}

function getOAuthSession(request) {
  const payload = openEncryptedPayload(parseCookies(request)[oauthSessionCookie]);
  return typeof payload?.refreshToken === 'string' && payload.refreshToken ? payload : null;
}

function saveOAuthSession(request, response, payload) {
  response.cookie(
    oauthSessionCookie,
    sealEncryptedPayload(payload),
    getCookieOptions(request, oauthSessionMaxAgeMs)
  );
}

async function requireSupabaseUser(request, response, next) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const authorization = String(request.headers.authorization || '');
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

  if (!supabaseUrl || !supabaseAnonKey) {
    return response.status(503).json({ error: 'Chưa cấu hình Supabase Auth.' });
  }
  if (!accessToken) {
    return response.status(401).json({ error: 'Bạn cần đăng nhập để sử dụng chức năng này.' });
  }

  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`
      },
      signal: AbortSignal.timeout(10_000)
    });
    if (!userResponse.ok) {
      return response.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
    }
    request.supabaseUser = await userResponse.json();
    return next();
  } catch {
    return response.status(503).json({ error: 'Không thể xác thực phiên đăng nhập lúc này.' });
  }
}

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

async function getGoogleAccessToken(refreshToken) {
  if (!refreshToken) {
    throw new ApiError(401, 'Hãy kết nối tài khoản Google Ads trước khi phân tích keyword.', 'google_ads_auth_required');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: getEnv('GOOGLE_ADS_CLIENT_ID'),
      client_secret: getEnv('GOOGLE_ADS_CLIENT_SECRET'),
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }),
    signal: AbortSignal.timeout(20_000)
  });

  if (!response.ok) {
    throw new ApiError(
      401,
      'Phiên Google Ads đã hết hạn hoặc không còn hợp lệ. Vui lòng kết nối lại.',
      'google_ads_reconnect_required'
    );
  }

  const payload = await response.json();
  if (!payload.access_token) throw new Error('Google OAuth không trả về access token.');
  return payload.access_token;
}

async function listAccessibleGoogleAdsCustomers(accessToken) {
  const apiVersion = getEnv('GOOGLE_ADS_API_VERSION', 'v25');
  const response = await fetch(
    `https://googleads.googleapis.com/${apiVersion}/customers:listAccessibleCustomers`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': getEnv('GOOGLE_ADS_DEVELOPER_TOKEN')
      },
      signal: AbortSignal.timeout(20_000)
    }
  );

  if (!response.ok) {
    throw new ApiError(
      502,
      'Không thể đọc danh sách tài khoản Google Ads. Hãy kiểm tra quyền truy cập và Developer Token.',
      'google_ads_accounts_failed'
    );
  }

  const payload = await response.json();
  return (Array.isArray(payload.resourceNames) ? payload.resourceNames : [])
    .map((resourceName) => cleanCustomerId(resourceName))
    .filter(Boolean);
}

function formatGoogleAdsCustomerId(customerId) {
  return `${customerId.slice(0, 3)}-${customerId.slice(3, 6)}-${customerId.slice(6)}`;
}

async function queryGoogleAdsCustomerClients(accessToken, loginCustomerId, customerId) {
  const apiVersion = getEnv('GOOGLE_ADS_API_VERSION', 'v25');
  const response = await fetch(
    `https://googleads.googleapis.com/${apiVersion}/customers/${customerId}/googleAds:search`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'developer-token': getEnv('GOOGLE_ADS_DEVELOPER_TOKEN'),
        'login-customer-id': loginCustomerId
      },
      body: JSON.stringify({
        query: [
          'SELECT customer_client.client_customer, customer_client.id,',
          'customer_client.level, customer_client.manager,',
          'customer_client.descriptive_name, customer_client.status',
          'FROM customer_client',
          'WHERE customer_client.level <= 1'
        ].join(' '),
        pageSize: 10_000
      }),
      signal: AbortSignal.timeout(20_000)
    }
  );

  if (!response.ok) return null;
  const payload = await response.json();
  return Array.isArray(payload.results) ? payload.results : [];
}

async function listSelectableGoogleAdsAccounts(accessToken) {
  const rootCustomerIds = await listAccessibleGoogleAdsCustomers(accessToken);
  const accounts = new Map();

  for (const rootCustomerId of rootCustomerIds) {
    const queue = [rootCustomerId];
    const visited = new Set();
    let hierarchyFound = false;
    let childAccountFound = false;

    while (queue.length > 0) {
      const managerCustomerId = queue.shift();
      if (!managerCustomerId || visited.has(managerCustomerId)) continue;
      visited.add(managerCustomerId);

      const rows = await queryGoogleAdsCustomerClients(
        accessToken,
        rootCustomerId,
        managerCustomerId
      );
      if (!rows) continue;
      hierarchyFound = true;

      for (const row of rows) {
        const customerClient = row?.customerClient;
        const customerId = cleanCustomerId(
          customerClient?.id || customerClient?.clientCustomer
        );
        if (!customerId) continue;

        const level = Number(customerClient.level || 0);
        const isManager = customerClient.manager === true;
        if (level === 1 && isManager) queue.push(customerId);
        if (level === 0 || isManager || customerClient.status === 'CANCELED') continue;

        childAccountFound = true;
        const formattedId = formatGoogleAdsCustomerId(customerId);
        const descriptiveName = String(customerClient.descriptiveName || '').trim();
        accounts.set(customerId, {
          id: customerId,
          loginCustomerId: rootCustomerId,
          label: descriptiveName ? `${descriptiveName} (${formattedId})` : formattedId
        });
      }
    }

    // Directly accessible client accounts don't expose CustomerClient hierarchy
    // rows. Keep them selectable and omit login-customer-id for their API calls.
    if ((!hierarchyFound || !childAccountFound) && !accounts.has(rootCustomerId)) {
      accounts.set(rootCustomerId, {
        id: rootCustomerId,
        loginCustomerId: '',
        label: formatGoogleAdsCustomerId(rootCustomerId)
      });
    }
  }

  return [...accounts.values()];
}

async function resolveGoogleAdsLoginCustomerId(accessToken, customerId) {
  const apiVersion = getEnv('GOOGLE_ADS_API_VERSION', 'v25');
  const accessibleCustomerIds = await listAccessibleGoogleAdsCustomers(accessToken);

  for (const managerCustomerId of accessibleCustomerIds) {
    if (managerCustomerId === customerId) continue;
    try {
      const response = await fetch(
        `https://googleads.googleapis.com/${apiVersion}/customers/${managerCustomerId}/googleAds:searchStream`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'developer-token': getEnv('GOOGLE_ADS_DEVELOPER_TOKEN'),
            'login-customer-id': managerCustomerId
          },
          body: JSON.stringify({
            query: `SELECT customer_client.id FROM customer_client WHERE customer_client.id = ${customerId}`
          }),
          signal: AbortSignal.timeout(20_000)
        }
      );
      if (!response.ok) continue;

      const payload = await response.json();
      const rows = Array.isArray(payload)
        ? payload.flatMap((batch) => batch?.results || [])
        : [];
      if (rows.length > 0) return managerCustomerId;
    } catch {
      // Try the next directly accessible manager.
    }
  }

  return '';
}

function resolveGoogleAdsSession(request) {
  const session = getOAuthSession(request);
  if (session && session.supabaseUserId === request.supabaseUser?.id) {
    return {
      refreshToken: session.refreshToken,
      customerId: cleanCustomerId(session.selectedCustomerId),
      loginCustomerId: cleanCustomerId(session.loginCustomerId)
    };
  }

  return {
    refreshToken: '',
    customerId: '',
    loginCustomerId: ''
  };
}

async function fetchGoogleKeywordIdeas({ query, industry, pageUrl, request, response }) {
  const auth = resolveGoogleAdsSession(request);
  if (!auth.customerId) {
    throw new ApiError(
      409,
      'Hãy chọn tài khoản Google Ads dùng để lấy dữ liệu keyword.',
      'google_ads_account_required'
    );
  }

  const accessToken = await getGoogleAccessToken(auth.refreshToken);
  const customerId = auth.customerId;
  let loginCustomerId = auth.loginCustomerId;
  const apiVersion = getEnv('GOOGLE_ADS_API_VERSION', 'v25');

  const keywords = [...new Set([query, industry].map((value) => value.trim()).filter(Boolean))];
  const seed = pageUrl
    ? { keywordAndUrlSeed: { keywords, url: pageUrl } }
    : { keywordSeed: { keywords } };

  const keywordIdeasUrl =
    `https://googleads.googleapis.com/${apiVersion}/customers/${customerId}:generateKeywordIdeas`;
  const keywordIdeasBody = JSON.stringify({
    language: `languageConstants/${getEnv('GOOGLE_ADS_LANGUAGE_ID', '1040')}`,
    geoTargetConstants: [`geoTargetConstants/${getEnv('GOOGLE_ADS_GEO_TARGET_ID', '2704')}`],
    includeAdultKeywords: false,
    keywordPlanNetwork: 'GOOGLE_SEARCH',
    pageSize: 100,
    ...seed
  });
  const sendKeywordIdeasRequest = (managerCustomerId) => {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'developer-token': getEnv('GOOGLE_ADS_DEVELOPER_TOKEN')
    };
    if (managerCustomerId) headers['login-customer-id'] = managerCustomerId;
    return fetch(keywordIdeasUrl, {
      method: 'POST',
      headers,
      body: keywordIdeasBody,
      signal: AbortSignal.timeout(35_000)
    });
  };

  let googleResponse = await sendKeywordIdeasRequest(loginCustomerId);
  if (googleResponse.status === 403) {
    const resolvedManagerId = await resolveGoogleAdsLoginCustomerId(accessToken, customerId);
    if (resolvedManagerId && resolvedManagerId !== loginCustomerId) {
      loginCustomerId = resolvedManagerId;
      const oauthSession = getOAuthSession(request);
      if (oauthSession) {
        saveOAuthSession(request, response, {
          ...oauthSession,
          loginCustomerId: resolvedManagerId
        });
      }
      googleResponse = await sendKeywordIdeasRequest(resolvedManagerId);
    }
  }

  if (!googleResponse.ok) {
    const detail = await googleResponse.text();
    console.error('[google-ads-keywords]', {
      status: googleResponse.status,
      customerSuffix: customerId.slice(-4),
      loginCustomerSuffix: loginCustomerId ? loginCustomerId.slice(-4) : 'direct',
      requestId: googleResponse.headers.get('request-id') || ''
    });
    throw new Error(`Google Ads Keyword Planner trả về lỗi ${googleResponse.status}: ${detail.slice(0, 600)}`);
  }

  const payload = await googleResponse.json();
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

app.get('/api/auth/google/start', requireSupabaseUser, (request, response) => {
  const missing = requiredGoogleAdsEnv.filter((name) => !getEnv(name));
  if (missing.length > 0) {
    return response.status(503).json({
      error: 'Chưa cấu hình đầy đủ OAuth cho Google Ads.',
      missing
    });
  }

  const state = crypto.randomBytes(32).toString('base64url');
  response.cookie(
    oauthStateCookie,
    sealEncryptedPayload({ nonce: state, supabaseUserId: request.supabaseUser.id }),
    getCookieOptions(request, oauthStateMaxAgeMs)
  );
  const params = new URLSearchParams({
    client_id: getEnv('GOOGLE_ADS_CLIENT_ID'),
    redirect_uri: getCallbackUrl(request),
    response_type: 'code',
    scope: googleAdsScope,
    access_type: 'offline',
    include_granted_scopes: 'true',
    // Always let the user choose the Google account that actually owns or
    // manages the Ads account. This also avoids Google silently reusing a
    // different signed-in account that is not allowed by the OAuth audience.
    prompt: 'select_account consent',
    state
  });
  return response.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
});

app.get('/api/auth/google/callback', async (request, response) => {
  const redirectToApp = (status, detail) => {
    const params = new URLSearchParams({ tab: 'keywords', google_ads: status });
    if (detail) params.set('detail', detail);
    return response.redirect(`${getRequestOrigin(request)}/?${params}`);
  };

  const storedState = openEncryptedPayload(parseCookies(request)[oauthStateCookie]);
  clearOAuthCookie(request, response, oauthStateCookie);

  if (request.query.error) {
    return redirectToApp('denied', String(request.query.error));
  }
  if (
    !request.query.code
    || !request.query.state
    || !storedState?.supabaseUserId
    || !safeEqual(storedState.nonce, request.query.state)
  ) {
    return redirectToApp('error', 'invalid_state');
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(request.query.code),
        client_id: getEnv('GOOGLE_ADS_CLIENT_ID'),
        client_secret: getEnv('GOOGLE_ADS_CLIENT_SECRET'),
        redirect_uri: getCallbackUrl(request),
        grant_type: 'authorization_code'
      }),
      signal: AbortSignal.timeout(20_000)
    });

    if (!tokenResponse.ok) {
      console.error('[google-ads-oauth] Token exchange failed with status', tokenResponse.status);
      return redirectToApp('error', 'token_exchange_failed');
    }

    const tokens = await tokenResponse.json();
    if (!tokens.refresh_token) {
      return redirectToApp('error', 'refresh_token_missing');
    }

    const accounts = await listSelectableGoogleAdsAccounts(tokens.access_token);
    const configuredCustomerId = cleanCustomerId(getEnv('GOOGLE_ADS_CUSTOMER_ID'));
    const selectedAccount = accounts.find((account) => account.id === configuredCustomerId)
      || (accounts.length === 1 ? accounts[0] : null);

    saveOAuthSession(request, response, {
      refreshToken: tokens.refresh_token,
      selectedCustomerId: selectedAccount?.id || '',
      loginCustomerId: selectedAccount?.loginCustomerId || '',
      supabaseUserId: storedState.supabaseUserId,
      connectedAt: new Date().toISOString()
    });

    return redirectToApp(selectedAccount ? 'connected' : 'select_account');
  } catch (error) {
    console.error('[google-ads-oauth]', error instanceof Error ? error.message : error);
    return redirectToApp('error', 'connection_failed');
  }
});

app.get('/api/auth/google/status', requireSupabaseUser, async (request, response) => {
  const session = getOAuthSession(request);
  if (!session || session.supabaseUserId !== request.supabaseUser.id) {
    if (session) clearOAuthCookie(request, response, oauthSessionCookie);
    return response.json({
      connected: false,
      selectedCustomerId: '',
      accounts: []
    });
  }

  try {
    const accessToken = await getGoogleAccessToken(session.refreshToken);
    const accounts = await listSelectableGoogleAdsAccounts(accessToken);
    const selectedAccount = accounts.find(
      (account) => account.id === cleanCustomerId(session.selectedCustomerId)
    );
    if (
      selectedAccount
      && cleanCustomerId(session.loginCustomerId) !== selectedAccount.loginCustomerId
    ) {
      saveOAuthSession(request, response, {
        ...session,
        selectedCustomerId: selectedAccount.id,
        loginCustomerId: selectedAccount.loginCustomerId
      });
    }
    return response.json({
      connected: true,
      selectedCustomerId: selectedAccount?.id || '',
      accounts
    });
  } catch (error) {
    clearOAuthCookie(request, response, oauthSessionCookie);
    return response.status(401).json({
      connected: false,
      selectedCustomerId: '',
      accounts: [],
      reconnectRequired: true,
      error: error instanceof Error ? error.message : 'Phiên Google Ads không còn hợp lệ.'
    });
  }
});

app.post('/api/auth/google/select-account', requireSupabaseUser, async (request, response) => {
  const session = getOAuthSession(request);
  if (!session || session.supabaseUserId !== request.supabaseUser.id) {
    return response.status(401).json({
      error: 'Hãy kết nối tài khoản Google Ads trước.',
      code: 'google_ads_auth_required'
    });
  }

  const customerId = cleanCustomerId(String(request.body?.customerId || ''));
  if (!customerId) {
    return response.status(400).json({ error: 'Customer ID không hợp lệ.' });
  }

  try {
    const accessToken = await getGoogleAccessToken(session.refreshToken);
    const accounts = await listSelectableGoogleAdsAccounts(accessToken);
    const selectedAccount = accounts.find((account) => account.id === customerId);
    if (!selectedAccount) {
      return response.status(403).json({ error: 'Tài khoản Google này không có quyền với Customer ID đã chọn.' });
    }

    saveOAuthSession(request, response, {
      ...session,
      selectedCustomerId: customerId,
      loginCustomerId: selectedAccount.loginCustomerId
    });
    return response.json({ ok: true, selectedCustomerId: customerId });
  } catch (error) {
    return response.status(error instanceof ApiError ? error.statusCode : 502).json({
      error: error instanceof Error ? error.message : 'Không thể chọn tài khoản Google Ads.'
    });
  }
});

app.post('/api/auth/google/disconnect', requireSupabaseUser, (request, response) => {
  clearOAuthCookie(request, response, oauthSessionCookie);
  return response.json({ ok: true });
});

async function generateGeminiContent(prompt, responseMimeType = 'text/plain') {
  const apiKey = getEnv('GEMINI_API_KEY');
  const model = getEnv('GEMINI_MODEL', 'gemini-2.5-flash');
  if (!apiKey) throw new ApiError(503, 'Chưa cấu hình Gemini API trên máy chủ.', 'gemini_missing');
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType }
      }),
      signal: AbortSignal.timeout(55_000)
    }
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new ApiError(502, `Gemini trả về lỗi ${response.status}: ${detail.slice(0, 300)}`, 'gemini_failed');
  }
  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new ApiError(502, 'Gemini không trả về nội dung.', 'gemini_empty');
  return String(text).trim();
}

async function getActiveBrandProfile(ownerId) {
  const { data, error } = await getSupabaseAdmin()
    .from('brand_profiles')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new ApiError(502, 'Không thể đọc OMFIT Brand Guideline.', 'brand_profile_failed');
  return data;
}

function repairGeneratedText(value = '') {
  return String(value)
    // Gemini occasionally produces fragments such as "bỏ l lỡ".
    .replace(/(?<!\p{L})l\s+lỡ(?!\p{L})/giu, 'lỡ')
    .replace(/\.{3,}/g, '.')
    .replace(/[ \t]+([,.;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ');
}

function repairGeneratedHtmlText(content = '') {
  return String(content).replace(/>([^<]+)</g, (_match, text) => `>${repairGeneratedText(text)}<`);
}

function truncateAtWordBoundary(value, maxLength) {
  const normalized = repairGeneratedText(value).replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  const candidate = normalized.slice(0, Math.max(1, maxLength - 1));
  const lastSpace = candidate.lastIndexOf(' ');
  const trimmed = (lastSpace >= Math.floor(maxLength * 0.65) ? candidate.slice(0, lastSpace) : candidate)
    .replace(/[\s,;:!?–—-]+$/g, '');
  return `${trimmed}.`.slice(0, maxLength);
}

function normalizeSeoDescription(value, focusKeyword = '') {
  let description = repairGeneratedText(value)
    .replace(/\s+/g, ' ')
    .replace(/[.!?…]+$/g, '')
    .trim();

  if (description.length < 140) {
    const topic = repairGeneratedText(focusKeyword).replace(/\s+/g, ' ').trim();
    const lead = description ? `${description.replace(/[.!?]+$/g, '')}.` : '';
    const suffixes = [
      topic ? ` Cùng OMFIT tìm hiểu ${topic} và chọn giải pháp phù hợp với nhu cầu của bạn.` : '',
      ' Cùng OMFIT chọn giải pháp phù hợp với nhu cầu của bạn.',
      ' Khám phá thêm cùng OMFIT.'
    ].filter(Boolean);
    const naturalExtension = suffixes.find((suffix) => {
      const length = `${lead}${suffix}`.trim().length;
      return length >= 140 && length <= 155;
    });
    if (naturalExtension) description = `${lead}${naturalExtension}`.trim();
  }

  description = truncateAtWordBoundary(description, 154).replace(/[.!?…]+$/g, '');
  return description ? `${description}.` : '';
}

function normalizeForSearch(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi-VN')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function keywordCoverage(value, keyword) {
  const haystack = new Set(normalizeForSearch(value).split(' ').filter((word) => word.length > 1));
  const needles = normalizeForSearch(keyword).split(' ').filter((word) => word.length > 1);
  if (needles.length === 0) return 0;
  return needles.filter((word) => haystack.has(word)).length / needles.length;
}

function normalizeArticleMetadata(outline, requestedKeyword = '') {
  const focusKeyword = repairGeneratedText(requestedKeyword || outline?.focusKeyword || '')
    .replace(/\s+/g, ' ')
    .trim();
  const titleCandidates = [outline?.title, outline?.metaTitle]
    .map((value) => repairGeneratedText(value).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .sort((left, right) => {
      const coverageDelta = keywordCoverage(right, focusKeyword) - keywordCoverage(left, focusKeyword);
      if (coverageDelta !== 0) return coverageDelta;
      const leftFits = left.length >= 35 && left.length <= 60 ? 1 : 0;
      const rightFits = right.length >= 35 && right.length <= 60 ? 1 : 0;
      return rightFits - leftFits;
    });
  const title = truncateAtWordBoundary(titleCandidates[0] || focusKeyword || 'Bài viết OMFIT', 60);
  return {
    title,
    // Keep the SERP title and visible H1 aligned so the search intent cannot drift.
    metaTitle: title,
    metaDescription: normalizeSeoDescription(outline?.metaDescription, focusKeyword),
    focusKeyword
  };
}

function cleanGeneratedHtml(content) {
  const cleaned = String(content || '')
    .replace(/^```html\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/<h1\b[^>]*>/gi, '<h2>')
    .replace(/<\/h1>/gi, '</h2>')
    .replace(/<(script|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .trim();
  const sanitized = getHtmlSanitizer()(cleaned, {
    allowedTags: [
      'a', 'article', 'aside', 'b', 'blockquote', 'br', 'caption', 'code', 'col',
      'colgroup', 'div', 'em', 'figcaption', 'figure', 'footer', 'h2', 'h3', 'hr', 'i', 'img',
      'li', 'main', 'ol', 'p', 'pre', 'section', 'span', 'strong', 'table', 'tbody',
      'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul'
    ],
    allowedAttributes: {
      '*': ['aria-label', 'class', 'id', 'lang'],
      a: ['href', 'rel', 'target', 'title'],
      col: ['span', 'width'],
      img: ['alt', 'class', 'decoding', 'height', 'loading', 'sizes', 'src', 'srcset', 'title', 'width'],
      figure: ['class', 'data-omfit-section-image'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan', 'scope']
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: {
      img: ['http', 'https']
    },
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    enforceHtmlBoundary: true,
    transformTags: {
      a: (tagName, attributes) => {
        const nextAttributes = { ...attributes };
        if (nextAttributes.target === '_blank') {
          nextAttributes.rel = 'noopener noreferrer';
        }
        return { tagName, attribs: nextAttributes };
      }
    }
  });
  return repairGeneratedHtmlText(sanitized);
}

function escapeWordpressHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function prepareWordpressContent(contentHtml, articleTitle) {
  const safeTitle = escapeWordpressHtml(String(articleTitle || 'Bài viết OMFIT').trim());
  const withoutTitle = String(contentHtml || '')
    .replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi, '')
    .trim();
  return [
    '<article class="omfit-article-content" lang="vi">',
    `<h1 class="omfit-article-title">${safeTitle}</h1>`,
    withoutTitle,
    '</article>'
  ].join('\n');
}

function normalizeWordpressPostTitle(article) {
  return truncateAtWordBoundary(article?.title || article?.metaTitle || 'Bài viết OMFIT', 60);
}

const suspiciousWordpressSlugPattern = /(?:nfl|seahawks|quarterback|titans|super-bowl|sam-darnold|geno-smith|nba|baseball|\/\d+-\d+\/?$)/i;

function isSafeWordpressIndexEntry(row, siteUrl) {
  try {
    const url = new URL(String(row?.link || ''));
    const expectedHost = new URL(siteUrl).hostname.replace(/^www\./i, '');
    const actualHost = url.hostname.replace(/^www\./i, '');
    return actualHost === expectedHost
      && !suspiciousWordpressSlugPattern.test(`${row?.slug || ''} ${url.pathname}`)
      && !/^\/(?:wp-admin|wp-json)\b/i.test(url.pathname);
  } catch {
    return false;
  }
}

app.post('/api/content/outline', requireSupabaseUser, async (request, response) => {
  try {
    const keyword = String(request.body?.keyword || '').trim();
    const tone = String(request.body?.tone || 'Chuyên nghiệp, truyền cảm hứng, cân bằng').trim();
    if (keyword.length < 2 || keyword.length > 120) {
      return response.status(400).json({ error: 'Từ khóa phải có từ 2 đến 120 ký tự.' });
    }
    const brand = await getActiveBrandProfile(request.supabaseUser.id);
    const text = await generateGeminiContent(
      `Tạo dàn ý SEO On-Page bằng tiếng Việt cho thương hiệu OMFIT.
Từ khóa chính: ${keyword}
Giọng văn: ${tone}
Brand context (chỉ sử dụng dữ liệu này, không tự tạo claim): ${JSON.stringify({
        mission: brand?.mission || '',
        positioning: brand?.positioning || '',
        audience: brand?.audience || [],
        voice: brand?.voice || {},
        approvedClaims: brand?.approved_claims || [],
        guidelineNotes: String(brand?.guideline_notes || '').slice(0, 4000),
        companyInfo: brand?.company_info || {},
        branches: Array.isArray(brand?.branches) ? brand.branches.slice(0, 20) : []
      })}

Trả về đúng một JSON object:
{
  "title": "Tiêu đề H1 từ 45 đến 60 ký tự, chứa đúng ý định của từ khóa",
  "metaTitle": "Cùng ý định và cùng thông điệp với H1, từ 45 đến 60 ký tự",
  "metaDescription": "Một câu tự nhiên từ 145 đến 155 ký tự, kết thúc bằng đúng một dấu chấm",
  "slug": "slug-khong-dau",
  "focusKeyword": "${keyword}",
  "headings": [
    { "tag": "h2", "text": "Tiêu đề mục", "points": ["Ý chính có ích"] },
    { "tag": "h3", "text": "Tiêu đề mục con", "points": ["Ý chính có ích"] }
  ],
  "faq": [{ "question": "Câu hỏi?", "answer": "Câu trả lời ngắn, không bịa dữ kiện." }]
}

Bao phủ đúng search intent, giữ nguyên các từ bổ nghĩa quan trọng trong từ khóa (ví dụ "giá rẻ" không được đổi thành "giá trị"), cấu trúc heading logic, không nhồi từ khóa và không thêm Markdown.`,
      'application/json'
    );
    const outline = JSON.parse(text);
    return response.json({
      ...outline,
      ...normalizeArticleMetadata(outline, keyword)
    });
  } catch (error) {
    return response.status(error instanceof ApiError ? error.statusCode : 502).json({
      error: error instanceof Error ? error.message : 'Không thể tạo dàn ý.'
    });
  }
});

app.post('/api/content/article', requireSupabaseUser, async (request, response) => {
  try {
    const outline = request.body?.outline;
    const targetWordCount = clamp(Number(request.body?.targetWordCount || 1500), 800, 2500);
    if (!outline?.title || !outline?.focusKeyword || !Array.isArray(outline?.headings)) {
      return response.status(400).json({ error: 'Dàn ý bài viết không hợp lệ.' });
    }
    const brand = await getActiveBrandProfile(request.supabaseUser.id);
    const content = await generateGeminiContent(
      `Viết bài hoàn chỉnh bằng tiếng Việt dựa đúng trên dàn ý:
${JSON.stringify(outline)}

OMFIT Brand Guideline:
${JSON.stringify({
        mission: brand?.mission || '',
        positioning: brand?.positioning || '',
        audience: brand?.audience || [],
        voice: brand?.voice || {},
        approvedClaims: brand?.approved_claims || [],
        prohibitedElements: brand?.prohibited_elements || [],
        guidelineNotes: String(brand?.guideline_notes || '').slice(0, 4000),
        companyInfo: brand?.company_info || {},
        branches: Array.isArray(brand?.branches) ? brand.branches.slice(0, 20) : []
      })}

Yêu cầu:
- Khoảng ${targetWordCount} từ, hữu ích và đúng search intent.
- Trả về HTML semantic fragment, không có html/body và không có H1.
- Dùng h2, h3, p, ul, ol, blockquote và bảng khi thực sự phù hợp.
- Mỗi đoạn 2–4 câu; câu rõ ràng, tiếng Việt tự nhiên.
- Rà soát chính tả trước khi trả về; không được có từ hoặc ký tự lặp như "l lỡ".
- Heading phải theo thứ tự H2 rồi mới đến H3; không dùng cỡ chữ hay style inline.
- Từ khóa xuất hiện tự nhiên ở phần mở đầu, không nhồi nhét.
- Không tự tạo số liệu, giá, chứng nhận, địa chỉ, cam kết kết quả hoặc lời khuyên y khoa.
- Không chèn URL, ảnh giả, Markdown hay footer website.
- Có FAQ dựa trên dàn ý.

Chỉ trả về HTML.`,
      'text/plain'
    );
    const contentHtml = cleanGeneratedHtml(content);
    const normalizedMetadata = normalizeArticleMetadata(outline, outline.focusKeyword);
    const plainText = contentHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!plainText) throw new ApiError(502, 'Nội dung bài viết trả về rỗng.', 'article_empty');
    return response.json({
      id: crypto.randomUUID(),
      title: normalizedMetadata.title,
      slug: outline.slug,
      metaTitle: normalizedMetadata.metaTitle,
      metaDescription: normalizedMetadata.metaDescription,
      focusKeyword: normalizedMetadata.focusKeyword,
      contentHtml,
      wordCount: plainText.split(' ').filter(Boolean).length,
      readabilityScore: 0,
      seoScore: 0,
      categories: ['Tin Tức OMFIT'],
      tags: [outline.focusKeyword, 'OMFIT'],
      articleImages: [],
      brandProfileId: brand?.id,
      createdAt: new Date().toISOString(),
      status: 'draft'
    });
  } catch (error) {
    return response.status(error instanceof ApiError ? error.statusCode : 502).json({
      error: error instanceof Error ? error.message : 'Không thể tạo bài viết.'
    });
  }
});

function safeAssetName(value, fallback = 'omfit-image') {
  return String(value || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || fallback;
}

app.post('/api/images/generate', requireSupabaseUser, async (request, response) => {
  try {
    const apiKey = getEnv('LEONARDO_API_KEY');
    if (!apiKey) throw new ApiError(503, 'Chưa cấu hình Leonardo API trên máy chủ.', 'leonardo_missing');
    if (request.body?.referenceImage) {
      return response.status(400).json({ error: 'Ảnh tham chiếu cần được tải vào Brand Assets trước khi tạo ảnh.' });
    }
    const prompt = String(request.body?.prompt || '').trim();
    const style = String(request.body?.style || 'Photorealistic 4K').trim();
    const keyword = String(request.body?.keyword || 'omfit-seo').trim();
    const articleId = String(request.body?.articleId || '').trim() || null;
    const logoAssetId = String(request.body?.logoAssetId || '').trim() || null;
    if (prompt.length < 10 || prompt.length > 1200) {
      return response.status(400).json({ error: 'Mô tả ảnh phải có từ 10 đến 1200 ký tự.' });
    }
    if (logoAssetId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(logoAssetId)) {
      return response.status(400).json({ error: 'Mã logo không hợp lệ.' });
    }
    const supabase = getSupabaseAdmin();
    const brand = await getActiveBrandProfile(request.supabaseUser.id);
    let logoAsset = null;
    let leonardoLogoId = null;

    if (logoAssetId) {
      const { data, error } = await supabase
        .from('brand_assets')
        .select('id, name, bucket, storage_path, mime_type')
        .eq('id', logoAssetId)
        .eq('owner_id', request.supabaseUser.id)
        .eq('asset_type', 'logo')
        .maybeSingle();
      if (error) throw new ApiError(502, `Không thể đọc logo thương hiệu: ${error.message}`, 'brand_logo_lookup_failed');
      if (!data) throw new ApiError(400, 'Logo đã chọn không tồn tại hoặc bạn không có quyền sử dụng.', 'brand_logo_invalid');
      logoAsset = data;

      const { data: logoFile, error: logoDownloadError } = await supabase.storage
        .from(data.bucket)
        .download(data.storage_path);
      if (logoDownloadError || !logoFile) {
        throw new ApiError(502, `Không thể tải logo thương hiệu: ${logoDownloadError?.message || 'tệp rỗng'}`, 'brand_logo_download_failed');
      }
      if (logoFile.size > 10 * 1024 * 1024) {
        throw new ApiError(413, 'Logo vượt quá giới hạn 10 MB.', 'brand_logo_too_large');
      }

      const mimeType = data.mime_type || logoFile.type || 'image/png';
      const extension = mimeType.includes('jpeg') || mimeType.includes('jpg')
        ? 'jpg'
        : mimeType.includes('webp') ? 'webp' : 'png';
      const initResponse = await fetch('https://cloud.leonardo.ai/api/rest/v1/init-image', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({ extension }),
        signal: AbortSignal.timeout(30_000)
      });
      if (!initResponse.ok) {
        const detail = await initResponse.text();
        throw new ApiError(502, `Leonardo không thể khởi tạo logo tham chiếu (${initResponse.status}): ${detail.slice(0, 300)}`, 'leonardo_logo_init_failed');
      }
      const initPayload = await initResponse.json();
      const upload = initPayload?.uploadInitImage;
      if (!upload?.id || !upload?.url || !upload?.fields) {
        throw new ApiError(502, 'Leonardo không trả về thông tin tải logo tham chiếu.', 'leonardo_logo_upload_missing');
      }

      const formData = new FormData();
      const uploadFields = typeof upload.fields === 'string' ? JSON.parse(upload.fields) : upload.fields;
      Object.entries(uploadFields || {}).forEach(([key, value]) => formData.append(key, String(value)));
      formData.append('file', logoFile, `brand-logo.${extension}`);
      const uploadResponse = await fetch(upload.url, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(30_000)
      });
      if (!uploadResponse.ok) {
        const detail = await uploadResponse.text();
        throw new ApiError(502, `Không thể tải logo lên Leonardo (${uploadResponse.status}): ${detail.slice(0, 300)}`, 'leonardo_logo_upload_failed');
      }
      leonardoLogoId = upload.id;
    }

    const styleSuffix = style === 'Modern Tech 3D Render'
      ? 'premium modern 3D render, clean composition, realistic materials'
      : style === 'Corporate Minimalist'
        ? 'premium minimalist editorial photography, clean composition'
        : 'photorealistic premium fitness photography, natural light, realistic anatomy';
    const finalPrompt = [
      brand?.prompt_template || 'Premium OMFIT fitness and wellness image.',
      prompt,
      styleSuffix,
      `Brand guideline notes: ${String(brand?.guideline_notes || '').slice(0, 2500)}`,
      `Company and branch context: ${JSON.stringify({
        companyInfo: brand?.company_info || {},
        branches: brand?.branches || []
      }).slice(0, 2500)}`,
      `Visual rules: ${JSON.stringify(brand?.visual_rules || {})}`,
      `Avoid: ${[...(brand?.prohibited_elements || []), brand?.negative_prompt || ''].filter(Boolean).join(', ')}`,
      logoAsset
        ? `Official logo exception: use the supplied reference image ${logoAsset.name} as the only approved OMFIT logo. Preserve its proportions, colors and recognizable mark, place it naturally, and do not invent or redraw a different logo.`
        : 'Do not invent or add a brand logo unless explicitly requested.'
    ].join('\n');
    const generationResponse = await fetch('https://cloud.leonardo.ai/api/rest/v2/generations', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'nano-banana-2',
        parameters: {
          width: 1200,
          height: 896,
          prompt: finalPrompt,
          quantity: 1,
          prompt_enhance: 'OFF',
          style_ids: ['111dc692-d470-4eec-b791-3475abac4c46'],
          ...(leonardoLogoId ? {
            guidances: {
              image_reference: [{
                image: { id: leonardoLogoId, type: 'UPLOADED' },
                strength: 'HIGH'
              }]
            }
          } : {})
        },
        public: false
      }),
      signal: AbortSignal.timeout(30_000)
    });
    if (!generationResponse.ok) {
      const detail = await generationResponse.text();
      throw new ApiError(502, `Leonardo trả về lỗi ${generationResponse.status}: ${detail.slice(0, 300)}`, 'leonardo_failed');
    }
    const generationPayload = await generationResponse.json();
    const generationId = generationPayload?.generate?.generationId
      || generationPayload?.generationId
      || generationPayload?.generation_id
      || generationPayload?.id
      || generationPayload?.data?.generate?.generationId
      || generationPayload?.data?.generationId
      || generationPayload?.data?.generation_id
      || generationPayload?.data?.id
      || generationPayload?.sdGenerationJob?.generationId;
    if (!generationId) {
      const detail = generationPayload?.error?.message
        || generationPayload?.message
        || JSON.stringify(generationPayload || {}).slice(0, 400);
      throw new ApiError(
        502,
        `Leonardo không khởi tạo được generation: ${detail || 'response rỗng'}`,
        'leonardo_generation_missing'
      );
    }

    let sourceUrl = '';
    for (let attempt = 0; attempt < 18 && !sourceUrl; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const pollResponse = await fetch(
        `https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`,
        { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } }
      );
      if (!pollResponse.ok) continue;
      const pollPayload = await pollResponse.json();
      if (pollPayload?.generations_by_pk?.status === 'FAILED') {
        throw new ApiError(502, 'Leonardo không thể tạo ảnh từ prompt này.', 'leonardo_generation_failed');
      }
      if (pollPayload?.generations_by_pk?.status === 'COMPLETE') {
        sourceUrl = pollPayload.generations_by_pk.generated_images?.[0]?.url || '';
      }
    }
    if (!sourceUrl) throw new ApiError(504, 'Leonardo tạo ảnh quá thời gian chờ.', 'leonardo_timeout');

    const imageResponse = await fetch(sourceUrl, { signal: AbortSignal.timeout(30_000) });
    if (!imageResponse.ok) throw new ApiError(502, 'Không thể tải ảnh từ Leonardo CDN.', 'leonardo_download_failed');
    const imageBytes = new Uint8Array(await imageResponse.arrayBuffer());
    if (imageBytes.byteLength > 10 * 1024 * 1024) {
      throw new ApiError(413, 'Ảnh Leonardo vượt quá giới hạn 10 MB.', 'image_too_large');
    }
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const extension = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const fileName = `${safeAssetName(keyword)}-${Date.now()}.${extension}`;
    const storagePath = `${request.supabaseUser.id}/${articleId || 'library'}/${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from('omfit-public-assets')
      .upload(storagePath, imageBytes, { contentType: mimeType, upsert: false });
    if (uploadError) throw new ApiError(502, `Không thể lưu ảnh vào Supabase: ${uploadError.message}`, 'image_storage_failed');
    const { data: publicUrlData } = supabase.storage
      .from('omfit-public-assets')
      .getPublicUrl(storagePath);
    const altText = `OMFIT - ${keyword}`;
    const { data: media, error: mediaError } = await supabase
      .from('media_assets')
      .insert({
        owner_id: request.supabaseUser.id,
        article_id: articleId,
        brand_profile_id: brand?.id || null,
        provider: 'leonardo',
        provider_generation_id: generationId,
        model: 'nano-banana-2',
        bucket: 'omfit-public-assets',
        storage_path: storagePath,
        public_url: publicUrlData.publicUrl,
        source_url: sourceUrl,
        mime_type: mimeType,
        bytes: imageBytes.byteLength,
        file_name: fileName,
        alt_text: altText,
        prompt: finalPrompt,
        negative_prompt: brand?.negative_prompt || '',
        style,
        status: 'approved',
        metadata: { width: 1200, height: 896, brandVersion: brand?.version || 1 }
      })
      .select('*')
      .single();
    if (mediaError) throw new ApiError(502, `Không thể lưu metadata ảnh: ${mediaError.message}`, 'media_metadata_failed');
    return response.json({
      id: media.id,
      url: media.public_url,
      prompt: media.prompt,
      altText: media.alt_text,
      fileName: media.file_name,
      style: media.style,
      source: 'leonardo-nano-banana-2',
      storagePath: media.storage_path,
      providerGenerationId: generationId
    });
  } catch (error) {
    return response.status(error instanceof ApiError ? error.statusCode : 502).json({
      error: error instanceof Error ? error.message : 'Không thể tạo và lưu ảnh.'
    });
  }
});

function getWordpressConfig() {
  const siteUrl = (getEnv('WP_SITE_URL') || getEnv('VITE_WP_SITE_URL', 'https://omfit.com.vn')).replace(/\/+$/, '');
  const username = getEnv('WP_USERNAME') || getEnv('VITE_WP_USERNAME');
  const appPassword = getEnv('WP_APP_PASSWORD') || getEnv('VITE_WP_APP_PASSWORD');
  if (!username || !appPassword) {
    throw new ApiError(503, 'Chưa cấu hình WordPress credentials trên máy chủ.', 'wordpress_missing');
  }
  return {
    siteUrl,
    authHeader: `Basic ${Buffer.from(`${username}:${appPassword}`).toString('base64')}`
  };
}

const wordpressMediaMaxBytes = 10 * 1024 * 1024;
const wordpressMediaUploadsInFlight = new Map();

async function resolveOwnedMediaAsset(ownerId, image) {
  const mediaId = String(image?.id || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(mediaId)) {
    throw new ApiError(400, 'Ảnh chưa được lưu trong kho OMFIT.', 'wordpress_media_invalid');
  }
  const { data, error } = await getSupabaseAdmin()
    .from('media_assets')
    .select('id,public_url,file_name,mime_type,bytes,metadata')
    .eq('id', mediaId)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error || !data?.public_url) {
    throw new ApiError(403, 'Bạn không có quyền sử dụng ảnh này.', 'wordpress_media_forbidden');
  }
  if (Number(data.bytes || 0) > wordpressMediaMaxBytes) {
    throw new ApiError(413, 'Ảnh vượt quá giới hạn 10 MB.', 'wordpress_media_too_large');
  }
  const sourceUrl = new URL(String(data.public_url));
  const storageHost = new URL(getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL')).hostname;
  if (sourceUrl.protocol !== 'https:' || sourceUrl.hostname !== storageHost) {
    throw new ApiError(400, 'Nguồn ảnh không thuộc kho OMFIT.', 'wordpress_media_source_invalid');
  }
  return { ...data, sourceUrl: sourceUrl.toString() };
}

async function downloadWordpressMediaBlob(sourceUrl) {
  const sourceResponse = await fetch(sourceUrl, {
    redirect: 'error',
    signal: AbortSignal.timeout(30_000)
  });
  if (!sourceResponse.ok || !sourceResponse.body) {
    throw new ApiError(502, 'Không thể tải ảnh từ kho OMFIT.', 'wordpress_media_download_failed');
  }
  const contentLength = Number(sourceResponse.headers.get('content-length') || 0);
  if (contentLength > wordpressMediaMaxBytes) {
    throw new ApiError(413, 'Ảnh vượt quá giới hạn 10 MB.', 'wordpress_media_too_large');
  }
  const contentType = String(sourceResponse.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(contentType)) {
    throw new ApiError(415, 'Định dạng ảnh không được hỗ trợ.', 'wordpress_media_type_invalid');
  }
  const reader = sourceResponse.body.getReader();
  const chunks = [];
  let receivedBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedBytes += value.byteLength;
    if (receivedBytes > wordpressMediaMaxBytes) {
      await reader.cancel();
      throw new ApiError(413, 'Ảnh vượt quá giới hạn 10 MB.', 'wordpress_media_too_large');
    }
    chunks.push(value);
  }
  return new Blob(chunks, { type: contentType });
}

function buildWordpressMediaIdentity(asset) {
  const originalBaseName = String(asset.file_name || '')
    .replace(/\.[^.]+$/, '')
    .trim();
  const descriptiveName = safeAssetName(originalBaseName, 'omfit-image').slice(0, 40);
  const assetKey = String(asset.id).replace(/-/g, '').toLowerCase();
  const slug = `${descriptiveName}-${assetKey}`;
  const extensionByMimeType = {
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  };
  return {
    slug,
    fileName: `${slug}.${extensionByMimeType[String(asset.mime_type || '').toLowerCase()] || 'jpg'}`
  };
}

function getStoredWordpressMediaId(asset, config) {
  const mapping = asset?.metadata?.wordpress;
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) return 0;
  const mappedSiteUrl = String(mapping.site_url || '').replace(/\/+$/, '');
  if (mappedSiteUrl !== config.siteUrl) return 0;
  const attachmentId = Number(mapping.attachment_id || 0);
  return Number.isSafeInteger(attachmentId) && attachmentId > 0 ? attachmentId : 0;
}

async function getWordpressMediaById(config, attachmentId) {
  const mediaResponse = await fetch(
    `${config.siteUrl}/wp-json/wp/v2/media/${attachmentId}?context=edit`,
    {
      headers: { Authorization: config.authHeader },
      signal: AbortSignal.timeout(20_000)
    }
  );
  if (mediaResponse.status === 404) return null;
  if (!mediaResponse.ok) {
    const detail = await mediaResponse.text();
    throw new ApiError(
      502,
      `WordPress không thể kiểm tra ảnh ${attachmentId} (${mediaResponse.status}): ${detail.slice(0, 250)}`,
      'wordpress_media_lookup_failed'
    );
  }
  return mediaResponse.json();
}

async function findWordpressMediaBySlug(config, slug) {
  const mediaResponse = await fetch(
    `${config.siteUrl}/wp-json/wp/v2/media?slug=${encodeURIComponent(slug)}&per_page=1&context=edit`,
    {
      headers: { Authorization: config.authHeader },
      signal: AbortSignal.timeout(20_000)
    }
  );
  if (!mediaResponse.ok) {
    const detail = await mediaResponse.text();
    throw new ApiError(
      502,
      `WordPress không thể tìm ảnh đã đồng bộ (${mediaResponse.status}): ${detail.slice(0, 250)}`,
      'wordpress_media_lookup_failed'
    );
  }
  const rows = await mediaResponse.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function updateWordpressMediaText(config, media, image) {
  if (!media?.id) return null;
  const altText = String(image?.altText || '').trim();
  const caption = String(image?.caption || '').trim();
  const currentCaption = String(media?.caption?.raw || media?.caption?.rendered || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (String(media.alt_text || '').trim() === altText && currentCaption === caption) return media;

  const mediaResponse = await fetch(`${config.siteUrl}/wp-json/wp/v2/media/${media.id}`, {
    method: 'POST',
    headers: { Authorization: config.authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ alt_text: altText, caption }),
    signal: AbortSignal.timeout(20_000)
  });
  if (mediaResponse.status === 404) return null;
  if (!mediaResponse.ok) {
    const detail = await mediaResponse.text();
    throw new ApiError(
      502,
      `WordPress không thể cập nhật metadata ảnh (${mediaResponse.status}): ${detail.slice(0, 250)}`,
      'wordpress_media_update_failed'
    );
  }
  return mediaResponse.json();
}

async function persistWordpressMediaMapping(asset, ownerId, config, media, slug) {
  const currentMetadata = asset.metadata && typeof asset.metadata === 'object' && !Array.isArray(asset.metadata)
    ? asset.metadata
    : {};
  const currentWordpressMetadata = currentMetadata.wordpress
    && typeof currentMetadata.wordpress === 'object'
    && !Array.isArray(currentMetadata.wordpress)
    ? currentMetadata.wordpress
    : {};
  const nextMetadata = {
    ...currentMetadata,
    wordpress: {
      ...currentWordpressMetadata,
      site_url: config.siteUrl,
      attachment_id: Number(media.id),
      slug: String(media.slug || slug),
      source_url: String(media.source_url || ''),
      synced_at: new Date().toISOString()
    }
  };
  const { data, error } = await getSupabaseAdmin()
    .from('media_assets')
    .update({ metadata: nextMetadata })
    .eq('id', asset.id)
    .eq('owner_id', ownerId)
    .select('id')
    .maybeSingle();
  if (error || !data) {
    throw new ApiError(
      502,
      'Ảnh đã được đồng bộ lên WordPress nhưng chưa thể lưu liên kết attachment.',
      'wordpress_media_link_failed'
    );
  }
  asset.metadata = nextMetadata;
}

async function removeDuplicateWordpressMedia(config, attachmentId) {
  try {
    await fetch(`${config.siteUrl}/wp-json/wp/v2/media/${attachmentId}?force=true`, {
      method: 'DELETE',
      headers: { Authorization: config.authHeader },
      signal: AbortSignal.timeout(20_000)
    });
  } catch {
    // The canonical attachment is already usable; orphan cleanup is best effort only.
  }
}

async function syncWordpressMedia(config, image, ownerId, asset) {
  const identity = buildWordpressMediaIdentity(asset);
  const storedAttachmentId = getStoredWordpressMediaId(asset, config);
  if (storedAttachmentId) {
    const storedMedia = await getWordpressMediaById(config, storedAttachmentId);
    // media_assets.metadata is user-editable under RLS. Never trust an ID unless
    // the WordPress slug proves that this server created it for this exact asset.
    if (storedMedia && String(storedMedia.slug || '') === identity.slug) {
      const updatedStoredMedia = await updateWordpressMediaText(config, storedMedia, image);
      if (updatedStoredMedia) return updatedStoredMedia;
    }
  }

  const matchedMedia = await findWordpressMediaBySlug(config, identity.slug);
  if (matchedMedia) {
    const updatedMatchedMedia = await updateWordpressMediaText(config, matchedMedia, image);
    if (updatedMatchedMedia) {
      await persistWordpressMediaMapping(asset, ownerId, config, updatedMatchedMedia, identity.slug);
      return updatedMatchedMedia;
    }
  }

  const blob = await downloadWordpressMediaBlob(asset.sourceUrl);
  const formData = new FormData();
  formData.append('file', blob, identity.fileName);
  formData.append('alt_text', image.altText || '');
  formData.append('caption', image.caption || '');
  const mediaResponse = await fetch(`${config.siteUrl}/wp-json/wp/v2/media`, {
    method: 'POST',
    headers: { Authorization: config.authHeader },
    body: formData,
    signal: AbortSignal.timeout(45_000)
  });
  if (!mediaResponse.ok) {
    const detail = await mediaResponse.text();
    throw new Error(`WordPress upload ảnh lỗi ${mediaResponse.status}: ${detail.slice(0, 250)}`);
  }
  const uploadedMedia = await mediaResponse.json();
  if (!Number(uploadedMedia?.id) || !uploadedMedia?.source_url) {
    throw new ApiError(502, 'WordPress không trả về attachment hợp lệ.', 'wordpress_media_response_invalid');
  }

  // A deterministic slug makes retries recoverable even if the database write failed.
  // It also lets concurrent server instances converge on one canonical attachment.
  const canonicalMedia = await findWordpressMediaBySlug(config, identity.slug);
  let media = canonicalMedia || uploadedMedia;
  if (canonicalMedia?.id && Number(canonicalMedia.id) !== Number(uploadedMedia.id)) {
    await removeDuplicateWordpressMedia(config, uploadedMedia.id);
    media = (await updateWordpressMediaText(config, canonicalMedia, image)) || canonicalMedia;
  }
  await persistWordpressMediaMapping(asset, ownerId, config, media, identity.slug);
  return media;
}

async function uploadWordpressMedia(config, image, ownerId) {
  const asset = await resolveOwnedMediaAsset(ownerId, image);
  const inFlightKey = `${config.siteUrl}:${ownerId}:${asset.id}`;
  const existingUpload = wordpressMediaUploadsInFlight.get(inFlightKey);
  if (existingUpload) {
    const media = await existingUpload;
    return (await updateWordpressMediaText(config, media, image)) || syncWordpressMedia(config, image, ownerId, asset);
  }

  const upload = syncWordpressMedia(config, image, ownerId, asset);
  wordpressMediaUploadsInFlight.set(inFlightKey, upload);
  try {
    return await upload;
  } finally {
    if (wordpressMediaUploadsInFlight.get(inFlightKey) === upload) {
      wordpressMediaUploadsInFlight.delete(inFlightKey);
    }
  }
}

async function getOwnedArticlePublishState(ownerId, articleId) {
  const { data, error } = await getSupabaseAdmin()
    .from('articles')
    .select('id,wp_post_id')
    .eq('id', articleId)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error || !data) {
    throw new ApiError(403, 'Bạn không có quyền xuất bản bài viết này.', 'wordpress_article_forbidden');
  }
  return data;
}

function readHtmlAttribute(tag, name) {
  const match = String(tag).match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
}

function contentReferencesImage(contentHtml, image) {
  const sourceUrl = String(image?.url || '').trim();
  if (!sourceUrl) return false;
  return (String(contentHtml).match(/<img\b[^>]*>/gi) || []).some((tag) => {
    const currentSource = readHtmlAttribute(tag, 'src');
    return currentSource === sourceUrl
      || currentSource === escapeWordpressHtml(sourceUrl);
  });
}

function setHtmlAttribute(tag, name, value) {
  const attribute = ` ${name}="${escapeWordpressHtml(String(value))}"`;
  const pattern = new RegExp(`\\s${name}(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?`, 'i');
  if (pattern.test(tag)) return tag.replace(pattern, attribute);
  return tag.replace(/\/?>$/, (ending) => `${attribute}${ending}`);
}

function buildWordpressSrcSet(media) {
  const candidates = Object.values(media?.media_details?.sizes || {})
    .filter((size) => size?.source_url && Number(size?.width) > 0)
    .map((size) => `${size.source_url} ${Number(size.width)}w`);
  const fullWidth = Number(media?.media_details?.width);
  if (media?.source_url && fullWidth > 0) candidates.push(`${media.source_url} ${fullWidth}w`);
  return [...new Set(candidates)].join(', ');
}

function replaceWordpressImageMarkup(contentHtml, image, media) {
  const originalUrl = String(image?.url || '').trim();
  if (!originalUrl || !media?.source_url) return contentHtml;
  const width = Number(media?.media_details?.width) || 1200;
  const height = Number(media?.media_details?.height) || 896;
  const srcSet = buildWordpressSrcSet(media);
  let updatedHtml = String(contentHtml).replace(/<img\b[^>]*>/gi, (tag) => {
    const currentSource = readHtmlAttribute(tag, 'src');
    if (currentSource !== originalUrl && !tag.includes(originalUrl)) return tag;
    let nextTag = setHtmlAttribute(tag, 'src', media.source_url);
    nextTag = setHtmlAttribute(nextTag, 'alt', image.altText || 'Hình ảnh OMFIT');
    nextTag = setHtmlAttribute(nextTag, 'width', width);
    nextTag = setHtmlAttribute(nextTag, 'height', height);
    nextTag = setHtmlAttribute(nextTag, 'loading', 'lazy');
    nextTag = setHtmlAttribute(nextTag, 'decoding', 'async');
    nextTag = setHtmlAttribute(nextTag, 'sizes', '(max-width: 1200px) 100vw, 1200px');
    if (srcSet) nextTag = setHtmlAttribute(nextTag, 'srcset', srcSet);
    return nextTag;
  });
  const caption = repairGeneratedText(image?.caption).replace(/\s+/g, ' ').trim();
  if (!caption) return updatedHtml;
  updatedHtml = updatedHtml.replace(/<figure\b[\s\S]*?<\/figure>/gi, (figure) => {
    const imageTag = figure.match(/<img\b[^>]*>/i)?.[0] || '';
    if (readHtmlAttribute(imageTag, 'src') !== media.source_url) return figure;
    const safeCaption = escapeWordpressHtml(caption);
    if (/<figcaption\b[^>]*>[\s\S]*?<\/figcaption>/i.test(figure)) {
      return figure.replace(
        /<figcaption\b[^>]*>[\s\S]*?<\/figcaption>/i,
        `<figcaption>${safeCaption}</figcaption>`
      );
    }
    return figure.replace(/<\/figure>/i, `<figcaption>${safeCaption}</figcaption></figure>`);
  });
  return updatedHtml;
}

function normalizeUniqueImageText(value, fallback, usedValues, position) {
  const base = repairGeneratedText(value || fallback).replace(/\s+/g, ' ').trim() || fallback;
  const key = normalizeForSearch(base);
  const normalized = usedValues.has(key) ? `${base} – góc nhìn ${position + 1}` : base;
  usedValues.add(normalizeForSearch(normalized));
  return normalized;
}

async function findOrCreateWordpressTerm(config, type, name) {
  const endpoint = type === 'categories' ? 'categories' : 'tags';
  const searchResponse = await fetch(
    `${config.siteUrl}/wp-json/wp/v2/${endpoint}?search=${encodeURIComponent(name)}&per_page=10`,
    { headers: { Authorization: config.authHeader }, signal: AbortSignal.timeout(20_000) }
  );
  if (searchResponse.ok) {
    const rows = await searchResponse.json();
    const exact = rows.find((row) => String(row.name).toLocaleLowerCase('vi-VN') === name.toLocaleLowerCase('vi-VN'));
    if (exact) return exact.id;
  }
  const createResponse = await fetch(`${config.siteUrl}/wp-json/wp/v2/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: config.authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
    signal: AbortSignal.timeout(20_000)
  });
  if (!createResponse.ok) return 0;
  return (await createResponse.json()).id || 0;
}

app.post('/api/wordpress/publish', requireSupabaseUser, async (request, response) => {
  try {
    const article = request.body?.article;
    const status = request.body?.status === 'draft' ? 'draft' : 'publish';
    if (!article?.id || !article?.title || !article?.contentHtml) {
      return response.status(400).json({ error: 'Bài viết không hợp lệ.' });
    }
    const ownedArticle = await getOwnedArticlePublishState(request.supabaseUser.id, article.id);
    const requestedPostId = Number(article.wpPostId || 0);
    const storedPostId = Number(ownedArticle.wp_post_id || 0);
    if (requestedPostId && requestedPostId !== storedPostId) {
      throw new ApiError(403, 'Bài viết WordPress không thuộc bản ghi này.', 'wordpress_post_forbidden');
    }
    const config = getWordpressConfig();
    const logs = ['Bắt đầu đồng bộ nội dung và hình ảnh với WordPress.'];
    const postTitle = normalizeWordpressPostTitle(article);
    let contentHtml = prepareWordpressContent(
      cleanGeneratedHtml(article.contentHtml),
      postTitle
    );
    let featuredMediaId;
    if (article.featuredImage) {
      const media = await uploadWordpressMedia(config, article.featuredImage, request.supabaseUser.id);
      featuredMediaId = media?.id;
      logs.push('Đã đồng bộ featured image.');
    }
    const usedAltTexts = new Set();
    const usedCaptions = new Set();
    const suppliedInlineImages = Array.isArray(article.articleImages) ? article.articleImages : [];
    const seenInlineMediaIds = new Set();
    const seenInlineSources = new Set();
    const inlineImages = suppliedInlineImages.filter((image) => {
      const mediaId = String(image?.id || '').trim();
      const sourceUrl = String(image?.url || '').trim();
      if (
        !contentReferencesImage(contentHtml, image)
        || seenInlineMediaIds.has(mediaId)
        || seenInlineSources.has(sourceUrl)
      ) return false;
      seenInlineMediaIds.add(mediaId);
      seenInlineSources.add(sourceUrl);
      return true;
    });
    const skippedInlineImages = suppliedInlineImages.length - inlineImages.length;
    if (skippedInlineImages > 0) {
      logs.push(`Đã bỏ qua ${skippedInlineImages} ảnh không còn được tham chiếu trong nội dung.`);
    }
    if (inlineImages.length > 10) {
      throw new ApiError(400, 'Mỗi bài viết được upload tối đa 10 ảnh nội dung.', 'wordpress_media_limit');
    }
    for (const [position, image] of inlineImages.entries()) {
      const preparedImage = {
        ...image,
        altText: normalizeUniqueImageText(
          image.altText,
          `${article.focusKeyword || postTitle} tại OMFIT`,
          usedAltTexts,
          position
        ),
        caption: normalizeUniqueImageText(
          image.caption,
          `Hình minh họa cho ${article.focusKeyword || postTitle}`,
          usedCaptions,
          position
        )
      };
      const media = await uploadWordpressMedia(config, preparedImage, request.supabaseUser.id);
      contentHtml = replaceWordpressImageMarkup(contentHtml, preparedImage, media);
    }
    if (inlineImages.length) logs.push(`Đã đồng bộ ${inlineImages.length} ảnh nội dung.`);
    const categoryIds = (await Promise.all(
      (article.categories || []).map((name) => findOrCreateWordpressTerm(config, 'categories', name))
    )).filter(Boolean);
    const tagIds = (await Promise.all(
      (article.tags || []).map((name) => findOrCreateWordpressTerm(config, 'tags', name))
    )).filter(Boolean);
    const postPayload = {
      title: postTitle,
      content: contentHtml,
      excerpt: normalizeSeoDescription(article.metaDescription, article.focusKeyword),
      status,
      slug: article.slug,
      categories: categoryIds,
      tags: tagIds,
      ...(featuredMediaId ? { featured_media: featuredMediaId } : {})
    };
    const postUrl = storedPostId
      ? `${config.siteUrl}/wp-json/wp/v2/posts/${storedPostId}`
      : `${config.siteUrl}/wp-json/wp/v2/posts`;
    const postResponse = await fetch(postUrl, {
      method: 'POST',
      headers: { Authorization: config.authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(postPayload),
      signal: AbortSignal.timeout(55_000)
    });
    if (!postResponse.ok) {
      const detail = await postResponse.text();
      throw new ApiError(502, `WordPress trả về lỗi ${postResponse.status}: ${detail.slice(0, 400)}`, 'wordpress_publish_failed');
    }
    const post = await postResponse.json();
    const { error: articleUpdateError } = await getSupabaseAdmin()
      .from('articles')
      .update({
        wp_post_id: post.id,
        wp_post_url: post.link,
        status: status === 'publish' ? 'published' : 'draft',
        published_at: status === 'publish' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', article.id)
      .eq('owner_id', request.supabaseUser.id);
    if (articleUpdateError) {
      throw new ApiError(502, 'Đã đăng WordPress nhưng chưa thể lưu liên kết bài viết.', 'wordpress_article_link_failed');
    }
    logs.push(status === 'publish' ? 'Đã xuất bản bài viết.' : 'Đã lưu bản nháp WordPress.');
    return response.json({
      postId: post.id,
      postUrl: post.link,
      status: post.status,
      featuredMediaId,
      logs
    });
  } catch (error) {
    return response.status(error instanceof ApiError ? error.statusCode : 502).json({
      error: error instanceof Error ? error.message : 'Không thể đăng bài lên WordPress.'
    });
  }
});

function stripWordpressHtml(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

app.post('/api/wordpress/sync-index', requireSupabaseUser, async (request, response) => {
  try {
    const config = getWordpressConfig();
    const collected = [];
    for (const contentType of ['posts', 'pages']) {
      const indexResponse = await fetch(
        `${config.siteUrl}/wp-json/wp/v2/${contentType}?per_page=100&status=publish&_fields=id,link,slug,title,excerpt,status,modified`,
        { headers: { Authorization: config.authHeader }, signal: AbortSignal.timeout(30_000) }
      );
      if (!indexResponse.ok) continue;
      const rows = await indexResponse.json();
      for (const row of rows) {
        if (!isSafeWordpressIndexEntry(row, config.siteUrl)) continue;
        const title = stripWordpressHtml(row.title?.rendered);
        collected.push({
          owner_id: request.supabaseUser.id,
          wp_post_id: row.id,
          content_type: contentType === 'posts' ? 'post' : 'page',
          title,
          url: row.link,
          slug: row.slug,
          excerpt: stripWordpressHtml(row.excerpt?.rendered),
          keywords: title.toLocaleLowerCase('vi-VN').split(/\s+/).filter((word) => word.length > 3),
          status: row.status || 'publish',
          wp_modified_at: row.modified ? new Date(`${row.modified}Z`).toISOString() : null,
          indexed_at: new Date().toISOString()
        });
      }
    }
    const supabase = getSupabaseAdmin();
    const { error: deleteError } = await supabase
      .from('site_content_index')
      .delete()
      .eq('owner_id', request.supabaseUser.id);
    if (deleteError) {
      throw new ApiError(502, `Không thể làm sạch WordPress index cũ: ${deleteError.message}`, 'wordpress_index_cleanup_failed');
    }
    if (collected.length > 0) {
      const { error } = await supabase
        .from('site_content_index')
        .upsert(collected, { onConflict: 'owner_id,url' });
      if (error) throw new ApiError(502, `Không thể lưu WordPress index: ${error.message}`, 'wordpress_index_failed');
    }
    return response.json({ indexed: collected.length });
  } catch (error) {
    return response.status(error instanceof ApiError ? error.statusCode : 502).json({
      error: error instanceof Error ? error.message : 'Không thể đồng bộ WordPress index.'
    });
  }
});

app.get('/api/health', (_request, response) => {
  const missing = requiredGoogleAdsEnv.filter((name) => !getEnv(name));
  const contentRequired = [
    'GEMINI_API_KEY',
    'LEONARDO_API_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'WP_USERNAME',
    'WP_APP_PASSWORD'
  ];
  const contentMissing = contentRequired.filter((name) => !getEnv(name));
  response.json({
    ok: true,
    googleAdsConfigured: missing.length === 0,
    modelConfigured: Boolean(getEnv('GEMINI_API_KEY')),
    contentPlatformConfigured: contentMissing.length === 0,
    missing,
    contentMissing
  });
});

app.post('/api/keywords/analyze', requireSupabaseUser, async (request, response) => {
  const query = String(request.body?.query || '').trim();
  const industry = String(request.body?.industry || '').trim();
  const pageUrl = String(request.body?.pageUrl || process.env.KEYWORD_SEED_URL || '').trim();
  const authContext = resolveGoogleAdsSession(request);
  const cacheKey = JSON.stringify({
    query: query.toLocaleLowerCase('vi-VN'),
    industry,
    pageUrl,
    customerId: authContext.customerId,
    language: getEnv('GOOGLE_ADS_LANGUAGE_ID', '1040'),
    geo: getEnv('GOOGLE_ADS_GEO_TARGET_ID', '2704')
  });

  if (query.length < 2 || query.length > 120) {
    return response.status(400).json({ error: 'Từ khóa chủ đề phải có từ 2 đến 120 ký tự.' });
  }

  const missing = requiredGoogleAdsEnv.filter((name) => !getEnv(name));
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

    const ideas = await fetchGoogleKeywordIdeas({ query, industry, pageUrl, request, response });
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
        languageId: getEnv('GOOGLE_ADS_LANGUAGE_ID', '1040'),
        geoTargetId: getEnv('GOOGLE_ADS_GEO_TARGET_ID', '2704'),
        generatedAt: new Date().toISOString(),
        warnings,
        cacheHit: false
      }
    };
    keywordCache.set(cacheKey, { createdAt: Date.now(), payload });
    return response.json(payload);
  } catch (error) {
    console.error('[keyword-research]', error);
    const statusCode = error instanceof ApiError ? error.statusCode : 502;
    return response.status(statusCode).json({
      error: error instanceof Error ? error.message : 'Không thể lấy dữ liệu keyword.',
      code: error instanceof ApiError ? error.code : 'keyword_research_failed',
      authRequired: error instanceof ApiError && (
        error.code === 'google_ads_auth_required'
        || error.code === 'google_ads_reconnect_required'
      )
    });
  }
});

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`OMFIT API listening on http://127.0.0.1:${port}`);
  });
}

export default app;
