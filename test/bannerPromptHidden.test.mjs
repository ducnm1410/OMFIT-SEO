import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Prompt Art Director không hiển thị cho người dùng. API vẫn trả về bình thường
// và prompt vẫn được lưu kèm banner trong thư viện — chỉ là không render ra màn hình.
test('màn hình kết quả banner không hiển thị prompt cho người dùng', async () => {
  const component = await readFile(
    new URL('../src/components/BannerAds.tsx', import.meta.url),
    'utf8'
  );

  assert.doesNotMatch(component, /Art Director Prompt/);
  assert.doesNotMatch(component, /Sao chép Prompt/);
  assert.doesNotMatch(component, /clipboard\.writeText/);
  // promptUsed chỉ được phép nằm trong state và payload lưu thư viện,
  // không xuất hiện trong JSX
  assert.doesNotMatch(component, /\{singleResult\.promptUsed\}/);
  assert.doesNotMatch(component, /\{localizeResult\.promptUsed\}/);
});

test('prompt vẫn được lưu kèm banner khi bấm lưu vào thư viện', async () => {
  const component = await readFile(
    new URL('../src/components/BannerAds.tsx', import.meta.url),
    'utf8'
  );
  const saveHandler = component.slice(
    component.indexOf('const handleSaveSingleBanner'),
    component.indexOf('// ── Batch Mode Handlers')
  );
  assert.match(saveHandler, /prompt: singleResult\.promptUsed/);
});
