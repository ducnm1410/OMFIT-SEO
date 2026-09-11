import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('WordPress chỉ hiển thị reviewer sau xác nhận riêng cho từng bài', async () => {
  const php = await readFile(
    new URL('../wordpress/omfit-seo-bridge/omfit-seo-bridge.php', import.meta.url),
    'utf8'
  );
  assert.match(php, /register_post_meta\('post', 'omfit_reviewer_confirmed'/);
  assert.match(php, /'default'\s*=>\s*false/);
  assert.match(php, /\$reviewer_confirmed\s*=\s*rest_sanitize_boolean/);
  assert.match(php, /'reviewer_name'\s*=>\s*\$reviewer_confirmed/);
});

test('WordPress hợp nhất URL trùng và loại bài Yoga Bay trùng khỏi sitemap', async () => {
  const php = await readFile(
    new URL('../wordpress/omfit-seo-bridge/omfit-seo-bridge.php', import.meta.url),
    'utf8'
  );
  assert.match(
    php,
    /nhung-loi-co-ban-pho-bien-khi-tap-yoga-bay-va-cach-khac-phuc'[\s\S]*nhung-sai-lam-pho-bien-khi-tap-yoga-bay-va-cach-khac-phuc\//
  );
  assert.match(php, /array\(8399\)/);
  assert.match(php, /is_feed\(\)[\s\S]*X-Robots-Tag: noindex, follow/);
  assert.match(php, /classes\/weight-lifting'/);
  assert.match(php, /product\/fitness-cycling-tool'/);
});
