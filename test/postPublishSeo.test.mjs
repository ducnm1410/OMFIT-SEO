import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeComparableUrl,
  runPostPublishSeoChecks,
  verifyPostInWordpressSitemap,
  verifyPublishedPage
} from '../server/postPublishSeo.mjs';
import { getGoogleSearchConsoleConfig } from '../server/googleSearchConsole.mjs';

function mockResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    json: async () => JSON.parse(body || '{}')
  };
}

test('hậu kiểm URL yêu cầu HTTP thành công, canonical tự trỏ, indexable và đúng một H1', async () => {
  const postUrl = 'https://omfit.com.vn/bai-moi/';
  const result = await verifyPublishedPage(postUrl, 'https://omfit.com.vn', {
    fetchImpl: async () => mockResponse(`
      <html><head>
        <link rel="canonical" href="${postUrl}">
        <meta name="robots" content="max-image-preview:large">
      </head><body><h1>Bài mới</h1></body></html>
    `)
  });
  assert.equal(result.ok, true);
  assert.equal(result.httpStatus, 200);
  assert.equal(result.canonicalMatches, true);
  assert.equal(result.noindex, false);
  assert.equal(result.h1Count, 1);
});
test('hậu kiểm phát hiện noindex và canonical sai', async () => {
  const result = await verifyPublishedPage(
    'https://omfit.com.vn/bai-moi/',
    'https://omfit.com.vn',
    {
      fetchImpl: async () => mockResponse(`
        <link rel="canonical" href="https://omfit.com.vn/bai-khac/">
        <meta name="robots" content="noindex,follow"><h1>Bài mới</h1>
      `)
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.canonicalMatches, false);
  assert.equal(result.noindex, true);
});

test('tìm bài qua sitemap index và post sitemap WordPress', async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith('/wp-sitemap.xml')) {
      return mockResponse('<sitemapindex><sitemap><loc>https://omfit.com.vn/wp-sitemap-posts-post-1.xml</loc></sitemap></sitemapindex>');
    }
    return mockResponse('<urlset><url><loc>https://omfit.com.vn/bai-moi/</loc></url></urlset>');
  };
  const result = await verifyPostInWordpressSitemap(
    'https://omfit.com.vn/bai-moi',
    'https://omfit.com.vn/',
    { fetchImpl }
  );
  assert.equal(result.found, true);
  assert.equal(result.sitemapUrl, 'https://omfit.com.vn/wp-sitemap-posts-post-1.xml');
  assert.equal(normalizeComparableUrl('https://omfit.com.vn/bai-moi'), 'https://omfit.com.vn/bai-moi/');
});

test('thiếu Search Console credentials không làm hỏng hậu kiểm WordPress', async () => {
  const postUrl = 'https://omfit.com.vn/bai-moi/';
  const result = await runPostPublishSeoChecks({
    postUrl,
    siteUrl: 'https://omfit.com.vn',
    env: {},
    fetchImpl: async (url) => {
      if (url.endsWith('/wp-sitemap.xml')) {
        return mockResponse('<sitemapindex><sitemap><loc>https://omfit.com.vn/wp-sitemap-posts-post-1.xml</loc></sitemap></sitemapindex>');
      }
      if (url.includes('wp-sitemap-posts-post-1.xml')) {
        return mockResponse(`<urlset><url><loc>${postUrl}</loc></url></urlset>`);
      }
      return mockResponse(`<link rel="canonical" href="${postUrl}"><h1>Bài mới</h1>`);
    }
  });
  assert.equal(result.publicPage.ok, true);
  assert.equal(result.sitemap.found, true);
  assert.equal(result.google.configured, false);
  assert.deepEqual(result.google.missing, [
    'GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL',
    'GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY'
  ]);
});

test('Search Console được submit và inspect qua adapter sau khi URL cùng sitemap hợp lệ', async () => {
  const calls = [];
  const postUrl = 'https://omfit.com.vn/bai-moi/';
  const result = await runPostPublishSeoChecks({
    postUrl,
    siteUrl: 'https://omfit.com.vn',
    env: {
      GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL: 'seo@example.iam.gserviceaccount.com',
      GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY: 'test-key',
      GOOGLE_SEARCH_CONSOLE_PROPERTY: 'sc-domain:omfit.com.vn'
    },
    fetchImpl: async (url) => {
      if (url.endsWith('/wp-sitemap.xml')) {
        return mockResponse('<sitemapindex><sitemap><loc>https://omfit.com.vn/wp-sitemap-posts-post-1.xml</loc></sitemap></sitemapindex>');
      }
      if (url.includes('wp-sitemap-posts-post-1.xml')) {
        return mockResponse(`<urlset><url><loc>${postUrl}</loc></url></urlset>`);
      }
      return mockResponse(`<link rel="canonical" href="${postUrl}"><h1>Bài mới</h1>`);
    },
    searchConsole: {
      getAccessToken: async () => 'token',
      submitSitemap: async () => { calls.push('submit'); },
      inspectUrl: async () => {
        calls.push('inspect');
        return { verdict: 'NEUTRAL', coverageState: 'URL is unknown to Google' };
      }
    }
  });
  assert.equal(result.google.sitemapSubmitted, true);
  assert.deepEqual(calls, ['submit', 'inspect']);
  assert.equal(result.google.inspection.coverageState, 'URL is unknown to Google');
});

test('cấu hình Search Console chấp nhận private key dùng ký hiệu newline của hosting', () => {
  const config = getGoogleSearchConsoleConfig({
    GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL: 'seo@example.iam.gserviceaccount.com',
    GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY: 'line-1\\nline-2',
    GOOGLE_SEARCH_CONSOLE_PROPERTY: 'sc-domain:omfit.com.vn'
  }, 'https://omfit.com.vn');
  assert.equal(config.configured, true);
  assert.equal(config.privateKey, 'line-1\nline-2');
  assert.equal(config.sitemapUrl, 'https://omfit.com.vn/wp-sitemap.xml');
});
