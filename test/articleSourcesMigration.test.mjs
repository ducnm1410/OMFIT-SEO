import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('article_sources chỉ cho client đăng nhập đọc và dành mutation cho service role', async () => {
  const sql = await readFile(
    new URL('../supabase/migrations/202607270002_article_sources_security.sql', import.meta.url),
    'utf8'
  );
  assert.match(sql, /for select to authenticated/i);
  assert.match(sql, /revoke insert, update, delete on public\.article_sources from authenticated/i);
  assert.match(sql, /grant all privileges on public\.article_sources to service_role/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /revoke all on function public\.omfit_apply_article_source_approvals[\s\S]*authenticated/i);
});
