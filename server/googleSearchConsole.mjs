import crypto from 'node:crypto';

const searchConsoleScope = 'https://www.googleapis.com/auth/webmasters';
const tokenEndpoint = 'https://oauth2.googleapis.com/token';
const searchConsoleApiBase = 'https://www.googleapis.com/webmasters/v3';
const urlInspectionEndpoint = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';

function encodeBase64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}
function normalizePrivateKey(value) {
  return String(value || '').trim().replace(/\\n/g, '\n');
}

export function getGoogleSearchConsoleConfig(env = process.env, fallbackSiteUrl = '') {
  const clientEmail = String(env.GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL || '').trim();
  const privateKey = normalizePrivateKey(env.GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY);
  const property = String(
    env.GOOGLE_SEARCH_CONSOLE_PROPERTY
      || env.GOOGLE_SEARCH_CONSOLE_SITE_URL
      || fallbackSiteUrl
      || ''
  ).trim();
  const sitemapUrl = String(
    env.GOOGLE_SEARCH_CONSOLE_SITEMAP_URL
      || `${String(fallbackSiteUrl || '').replace(/\/+$/, '')}/wp-sitemap.xml`
  ).trim();
  const missing = [];
  if (!clientEmail) missing.push('GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL');
  if (!privateKey) missing.push('GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY');
  if (!property) missing.push('GOOGLE_SEARCH_CONSOLE_PROPERTY');
  return {
    configured: missing.length === 0,
    missing,
    clientEmail,
    privateKey,
    property,
    sitemapUrl
  };
}

export function createServiceAccountAssertion(config, nowSeconds = Math.floor(Date.now() / 1000)) {
  const header = encodeBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = encodeBase64Url(JSON.stringify({
    iss: config.clientEmail,
    scope: searchConsoleScope,
    aud: tokenEndpoint,
    iat: nowSeconds,
    exp: nowSeconds + 3600
  }));
  const unsigned = `${header}.${claims}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), config.privateKey);
  return `${unsigned}.${encodeBase64Url(signature)}`;
}

let cachedAccessToken = null;

export async function getSearchConsoleAccessToken(
  config,
  { fetchImpl = fetch, now = Date.now } = {}
) {
  const nowMs = now();
  if (cachedAccessToken?.token && cachedAccessToken.expiresAt > nowMs + 60_000) {
    return cachedAccessToken.token;
  }
  const assertion = createServiceAccountAssertion(config, Math.floor(nowMs / 1000));
  const response = await fetchImpl(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    }),
    signal: AbortSignal.timeout(15_000)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    throw new Error(`Google OAuth từ chối service account (${response.status}).`);
  }
  cachedAccessToken = {
    token: body.access_token,
    expiresAt: nowMs + (Number(body.expires_in || 3600) * 1000)
  };
  return cachedAccessToken.token;
}

export async function submitSearchConsoleSitemap(
  config,
  { fetchImpl = fetch, accessToken } = {}
) {
  const token = accessToken || await getSearchConsoleAccessToken(config, { fetchImpl });
  const endpoint = `${searchConsoleApiBase}/sites/${encodeURIComponent(config.property)}`
    + `/sitemaps/${encodeURIComponent(config.sitemapUrl)}`;
  const response = await fetchImpl(endpoint, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Search Console không nhận sitemap (${response.status}): ${detail.slice(0, 240)}`);
  }
  return { submitted: true, sitemapUrl: config.sitemapUrl };
}

export async function inspectSearchConsoleUrl(
  config,
  inspectionUrl,
  { fetchImpl = fetch, accessToken } = {}
) {
  const token = accessToken || await getSearchConsoleAccessToken(config, { fetchImpl });
  const response = await fetchImpl(urlInspectionEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inspectionUrl,
      siteUrl: config.property,
      languageCode: 'vi-VN'
    }),
    signal: AbortSignal.timeout(15_000)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`URL Inspection không trả kết quả (${response.status}).`);
  }
  const status = body?.inspectionResult?.indexStatusResult || {};
  return {
    verdict: String(status.verdict || 'VERDICT_UNSPECIFIED'),
    coverageState: String(status.coverageState || ''),
    indexingState: String(status.indexingState || ''),
    pageFetchState: String(status.pageFetchState || ''),
    lastCrawlTime: String(status.lastCrawlTime || ''),
    googleCanonical: String(status.googleCanonical || ''),
    userCanonical: String(status.userCanonical || '')
  };
}
