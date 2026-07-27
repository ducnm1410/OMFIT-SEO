import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  normalizeOwnedStoragePath,
  normalizeTrustedWordpressMediaUrl
} from '../server/mediaPolicy.mjs';

const ownerId = '11111111-1111-4111-8111-111111111111';

test('chỉ chấp nhận object ảnh trong public bucket và prefix của đúng owner', () => {
  const validPath = `${ownerId}/article-1/photo.webp`;
  assert.equal(
    normalizeOwnedStoragePath(ownerId, 'omfit-public-assets', validPath),
    validPath
  );
  assert.equal(
    normalizeOwnedStoragePath(ownerId, 'omfit-public-assets', `22222222-2222-4222-8222-222222222222/article/photo.webp`),
    ''
  );
  assert.equal(
    normalizeOwnedStoragePath(ownerId, 'omfit-public-assets', `${ownerId}/../other/photo.webp`),
    ''
  );
  assert.equal(
    normalizeOwnedStoragePath(ownerId, 'omfit-public-assets', `${ownerId}/%2e%2e/other/photo.webp`),
    ''
  );
  assert.equal(
    normalizeOwnedStoragePath(ownerId, 'omfit-public-assets', `${ownerId}/article/photo.webp?download=tracker`),
    ''
  );
  assert.equal(
    normalizeOwnedStoragePath(ownerId, 'omfit-draft-assets', validPath),
    ''
  );
});

test('WordPress mapping chỉ được phép dùng URL HTTPS cùng canonical host', () => {
  assert.equal(
    normalizeTrustedWordpressMediaUrl(
      'https://omfit.com.vn',
      'https://www.omfit.com.vn/wp-content/uploads/2026/07/photo.webp#fragment'
    ),
    'https://www.omfit.com.vn/wp-content/uploads/2026/07/photo.webp'
  );
  assert.equal(
    normalizeTrustedWordpressMediaUrl('https://omfit.com.vn', 'https://tracker.example/pixel.jpg'),
    ''
  );
  assert.equal(
    normalizeTrustedWordpressMediaUrl('https://omfit.com.vn', 'http://omfit.com.vn/photo.jpg'),
    ''
  );
});

test('migration khóa mutation media_assets và giữ WordPress mapping ở service role', async () => {
  const sql = await readFile(
    new URL('../supabase/migrations/202607270003_secure_media_assets.sql', import.meta.url),
    'utf8'
  );
  assert.match(sql, /drop policy if exists "media_assets_owner_all"/i);
  assert.match(sql, /for select to authenticated/i);
  assert.match(sql, /revoke insert, update, delete on public\.media_assets from public, anon, authenticated/i);
  assert.match(sql, /create table if not exists public\.wordpress_media_mappings/i);
  assert.match(sql, /revoke all privileges on public\.wordpress_media_mappings from public, anon, authenticated/i);
  assert.match(sql, /grant all privileges on public\.wordpress_media_mappings to service_role/i);
});

test('upload UI đăng ký metadata qua server thay vì insert media_assets trực tiếp', async () => {
  const source = await readFile(
    new URL('../src/services/contentRepository.ts', import.meta.url),
    'utf8'
  );
  const uploadFunction = source.slice(
    source.indexOf('export async function uploadMediaFile'),
    source.indexOf('export async function syncWordpressIndex')
  );
  assert.match(uploadFunction, /authenticatedFetch\('\/api\/media\/register'/);
  assert.doesNotMatch(uploadFunction, /\.from\('media_assets'\)/);
});
