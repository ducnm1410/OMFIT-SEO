import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { normalizeRuntimeEnvValue } from '../src/lib/runtimeEnv.mjs';

test('biến Railway có dấu nháy bao ngoài được chuẩn hóa trước khi gọi Supabase', async () => {
  assert.equal(normalizeRuntimeEnvValue('  "public-key"  '), 'public-key');
  assert.equal(normalizeRuntimeEnvValue("'https://project.supabase.co'"), 'https://project.supabase.co');
  assert.equal(normalizeRuntimeEnvValue('plain-value'), 'plain-value');
  assert.equal(normalizeRuntimeEnvValue('"\'nested\'"'), 'nested');

  const [clientSource, serverSource] = await Promise.all([
    readFile(new URL('../src/lib/supabase.ts', import.meta.url), 'utf8'),
    readFile(new URL('../server/index.mjs', import.meta.url), 'utf8')
  ]);
  assert.match(clientSource, /normalizeRuntimeEnvValue\(import\.meta\.env\.VITE_SUPABASE_ANON_KEY\)/);
  assert.match(serverSource, /const supabaseAnonKey = getEnv\('SUPABASE_ANON_KEY'\)/);
});
