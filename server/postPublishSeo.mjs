import {
  getGoogleSearchConsoleConfig,
  getSearchConsoleAccessToken,
  inspectSearchConsoleUrl,
  submitSearchConsoleSitemap
} from './googleSearchConsole.mjs';

function decodeXml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
export function normalizeComparableUrl(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/`;
    return url.toString();
  } catch {
    return '';
  }
}

function extractCanonical(html) {
  const tag = String(html || '').match(/<link\b[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*>/i)?.[0] || '';
  return tag.match(/href=["']([^"']+)["']/i)?.[1] || '';
}

function extractSitemapLocations(xml) {
  return [...String(xml || '').matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)]
    .map((match) => decodeXml(match[1]).trim())
    .filter(Boolean);
}

async function fetchText(url, fetchImpl, timeoutMs = 15_000) {
  const response = await fetchImpl(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'OMFIT-SEO-Publish-Verification/1.0' },
    signal: AbortSignal.timeout(timeoutMs)
  });
  const text = await response.text();
  return { response, text };
}

export async function verifyPublishedPage(postUrl, siteUrl, { fetchImpl = fetch } = {}) {
  const expectedOrigin = new URL(siteUrl).origin;
  const parsedPostUrl = new URL(postUrl);
  if (parsedPostUrl.origin !== expectedOrigin) {
    throw new Error('URL bài viết không thuộc website WordPress đã cấu hình.');
  }
  const { response, text } = await fetchText(parsedPostUrl.toString(), fetchImpl);
  const canonical = extractCanonical(text);
  const robotsValues = [...text.matchAll(/<meta\b[^>]*name=["']robots["'][^>]*>/gi)]
    .map((match) => match[0].match(/content=["']([^"']*)["']/i)?.[1] || '');
  const noindex = robotsValues.some((value) => /\bnoindex\b/i.test(value));
  const h1Count = (text.match(/<h1\b/gi) || []).length;
  const canonicalMatches = normalizeComparableUrl(canonical) === normalizeComparableUrl(postUrl);
  return {
    ok: response.ok && !noindex && canonicalMatches && h1Count === 1,
    httpStatus: response.status,
    canonical,
    canonicalMatches,
    noindex,
    h1Count
  };
}

export async function verifyPostInWordpressSitemap(postUrl, siteUrl, { fetchImpl = fetch } = {}) {
  const sitemapIndexUrl = `${String(siteUrl).replace(/\/+$/, '')}/wp-sitemap.xml`;
  const indexResult = await fetchText(sitemapIndexUrl, fetchImpl);
  if (!indexResult.response.ok) {
    return { found: false, sitemapIndexUrl, checkedSitemaps: [], error: `HTTP ${indexResult.response.status}` };
  }
  const sitemapUrls = extractSitemapLocations(indexResult.text)
    .filter((url) => /wp-sitemap-posts-post-\d+\.xml/i.test(url));
  const target = normalizeComparableUrl(postUrl);
  const checkedSitemaps = [];
  for (const sitemapUrl of sitemapUrls.slice(0, 20)) {
    const sitemapResult = await fetchText(sitemapUrl, fetchImpl);
    checkedSitemaps.push(sitemapUrl);
    if (!sitemapResult.response.ok) continue;
    const found = extractSitemapLocations(sitemapResult.text)
      .some((url) => normalizeComparableUrl(url) === target);
    if (found) return { found: true, sitemapIndexUrl, sitemapUrl, checkedSitemaps };
  }
  return { found: false, sitemapIndexUrl, checkedSitemaps };
}

export async function runPostPublishSeoChecks({
  postUrl,
  siteUrl,
  env = process.env,
  fetchImpl = fetch,
  searchConsole = {}
}) {
  const [publicPageResult, sitemapResult] = await Promise.allSettled([
    verifyPublishedPage(postUrl, siteUrl, { fetchImpl }),
    verifyPostInWordpressSitemap(postUrl, siteUrl, { fetchImpl })
  ]);
  const publicPage = publicPageResult.status === 'fulfilled'
    ? publicPageResult.value
    : { ok: false, error: publicPageResult.reason?.message || 'Không kiểm tra được URL công khai.' };
  const sitemap = sitemapResult.status === 'fulfilled'
    ? sitemapResult.value
    : { found: false, error: sitemapResult.reason?.message || 'Không kiểm tra được sitemap.' };

  const config = getGoogleSearchConsoleConfig(env, siteUrl);
  const google = {
    configured: config.configured,
    missing: config.missing,
    sitemapSubmitted: false,
    inspection: null,
    error: ''
  };
  if (config.configured && publicPage.ok && sitemap.found) {
    try {
      const getToken = searchConsole.getAccessToken || getSearchConsoleAccessToken;
      const submitSitemap = searchConsole.submitSitemap || submitSearchConsoleSitemap;
      const inspectUrl = searchConsole.inspectUrl || inspectSearchConsoleUrl;
      const accessToken = await getToken(config, { fetchImpl });
      await submitSitemap(config, { fetchImpl, accessToken });
      google.sitemapSubmitted = true;
      google.inspection = await inspectUrl(config, postUrl, { fetchImpl, accessToken });
    } catch (error) {
      google.error = error instanceof Error ? error.message : 'Search Console không phản hồi.';
    }
  }
  return { publicPage, sitemap, google };
}
