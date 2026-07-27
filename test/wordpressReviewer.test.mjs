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
