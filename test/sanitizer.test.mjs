import test from 'node:test';
import assert from 'node:assert/strict';

process.env.VERCEL = '1';
const { sanitizeGeneratedHtml } = await import('../server/index.mjs');

test('sanitizer giữ citation nhưng loại script và event handler', () => {
  const sanitized = sanitizeGeneratedHtml(
    '<p onclick="alert(1)">Nội dung<sup class="omfit-citation"><a href="#omfit-source-1">[1]</a></sup></p><script>alert(1)</script>'
  );
  assert.match(sanitized, /<sup class="omfit-citation">/);
  assert.doesNotMatch(sanitized, /onclick|script|alert\(1\)/);
});
