import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { resolveMultiplexedUrl } from '../server/vercelRouting.mjs';

async function listMjsFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? listMjsFiles(absolutePath) : [absolutePath];
  }));
  return nested.flat().filter((filePath) => filePath.endsWith('.mjs'));
}

test('Vercel Hobby chỉ triển khai tối đa 12 serverless functions', async () => {
  const functionFiles = await listMjsFiles(fileURLToPath(new URL('../api', import.meta.url)));
  assert.ok(functionFiles.length <= 12, `Đang có ${functionFiles.length} functions`);
});

test('các endpoint phụ được multiplex nhưng vẫn giữ query gốc', async () => {
  assert.equal(
    resolveMultiplexedUrl('/api/content/article?__omfit_route=research-sources&articleId=abc'),
    '/api/research/sources?articleId=abc'
  );
  assert.equal(
    resolveMultiplexedUrl('/api/content/article?articleId=abc'),
    '/api/content/article?articleId=abc'
  );
  assert.equal(
    resolveMultiplexedUrl('/api/wordpress/sync-index?__omfit_route=post-publish-seo&source=publish'),
    '/api/wordpress/post-publish-seo?source=publish'
  );

  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const rewrites = new Map(config.rewrites.map((rewrite) => [rewrite.source, rewrite.destination]));
  assert.match(rewrites.get('/api/research/sources'), /__omfit_route=research-sources/);
  assert.match(rewrites.get('/api/media/register'), /__omfit_route=media-register/);
  assert.match(rewrites.get('/api/wordpress/post-publish-seo'), /__omfit_route=post-publish-seo/);
});
