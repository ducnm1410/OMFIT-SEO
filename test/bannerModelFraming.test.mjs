import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Bộ prompt Art Director port từ gssea-gamehub viết cho nano-banana-2 và phải
// giữ nguyên văn cho model đó. gpt-image-2 hiểu prompt theo nghĩa đen hơn nên
// cần thêm ràng buộc riêng, không được đụng vào prompt gốc.
test('ràng buộc khung hình chỉ áp cho gpt-image-2', async () => {
  const source = await readFile(
    new URL('../server/bannerAdsRoute.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /const GPT_IMAGE_FRAMING_RULES = /);
  assert.match(
    source,
    /const framingRules = modelId === GPT_IMAGE \? ` \$\{GPT_IMAGE_FRAMING_RULES\}` : '';/,
    'ràng buộc phải gắn theo model, không áp vô điều kiện'
  );

  // Hai lỗi cần chặn: xoá logo/footer và viết chữ tràn mép
  const rules = source.slice(
    source.indexOf('const GPT_IMAGE_FRAMING_RULES = '),
    source.indexOf('\n', source.indexOf('const GPT_IMAGE_FRAMING_RULES = '))
  );
  assert.match(rules, /logo/i);
  assert.match(rules, /footer/i);
  assert.match(rules, /headline message only/i);
  assert.match(rules, /safe margin/i);
});

test('prompt bị cắt vẫn giữ được phần ràng buộc', async () => {
  const source = await readFile(
    new URL('../server/bannerAdsRoute.mjs', import.meta.url),
    'utf8'
  );

  // Cắt theo caps.maxPrompt trước rồi mới nối ràng buộc sẽ làm mất ràng buộc
  // với prompt dài — phải trừ sẵn độ dài của nó ra khỏi ngân sách.
  assert.match(source, /const promptBudget = Math\.max\(0, caps\.maxPrompt - framingRules\.length\)/);
  assert.match(source, /prompt: prompt\.slice\(0, promptBudget\) \+ framingRules/);
  assert.doesNotMatch(source, /prompt\.slice\(0, caps\.maxPrompt\)/);
});

test('prompt gốc của gamehub giữ nguyên văn cho nano-banana-2', async () => {
  const source = await readFile(
    new URL('../server/bannerAdsRoute.mjs', import.meta.url),
    'utf8'
  );

  // Vài câu mốc của bộ prompt gốc — sửa chúng là lệch khỏi hệ thống nguồn
  assert.match(source, /PERFECT CHARACTER SWAP AND TEXT REPLACEMENT/);
  assert.match(source, /PERFECT TEXT REPLACEMENT AND LAYOUT ADAPTATION/);
  assert.match(source, /REPLACE all existing text with exactly/);
  assert.match(source, /MAXIMUM 800 CHARACTERS/);
});
