import dotenv from 'dotenv';
import express from 'express';
import crypto from 'node:crypto';

dotenv.config({ override: true, quiet: true });

const app = express();
const port = Number(process.env.API_PORT || 8787);

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

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

async function fetchGoogleKeywordIdeas({ query, industry, pageUrl, request }) {
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
  const loginCustomerId = auth.loginCustomerId
    || cleanCustomerId(getEnv('GOOGLE_ADS_LOGIN_CUSTOMER_ID'));
  const apiVersion = getEnv('GOOGLE_ADS_API_VERSION', 'v25');
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'developer-token': getEnv('GOOGLE_ADS_DEVELOPER_TOKEN')
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
        language: `languageConstants/${getEnv('GOOGLE_ADS_LANGUAGE_ID', '1040')}`,
        geoTargetConstants: [`geoTargetConstants/${getEnv('GOOGLE_ADS_GEO_TARGET_ID', '2704')}`],
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

app.get('/api/health', (_request, response) => {
  const missing = requiredGoogleAdsEnv.filter((name) => !getEnv(name));
  response.json({
    ok: true,
    googleAdsConfigured: missing.length === 0,
    modelConfigured: Boolean(process.env.GEMINI_API_KEY),
    missing
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

    const ideas = await fetchGoogleKeywordIdeas({ query, industry, pageUrl, request });
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
