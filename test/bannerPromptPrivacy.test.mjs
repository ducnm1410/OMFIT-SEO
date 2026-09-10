import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Prompt Art Director là know-how nội bộ: không trả về client, không hiển thị
// trên UI. Trước đây nó vừa nằm trong response vừa in ra màn hình kết quả.

test('server không trả prompt về client ở bất kỳ route banner nào', async () => {
  const source = await readFile(
    new URL('../server/bannerAdsRoute.mjs', import.meta.url),
    'utf8'
  );

  // Mọi lời gọi response.json() trong file không được chứa prompt
  for (const match of source.matchAll(/response\.json\(\{[\s\S]*?\}\)/g)) {
    assert.doesNotMatch(
      match[0],
      /prompt/i,
      `response.json() còn trả prompt về client:\n${match[0].slice(0, 200)}`
    );
  }

  // Kết quả từng bộ trong batch cũng vậy
  const batchResult = source.slice(
    source.indexOf("          results.push({\n            setIndex: i,\n            status: 'success'"),
    source.indexOf("        } catch (err) {\n          results.push({\n            setIndex: i,\n            status: 'error'")
  );
  assert.ok(batchResult.length > 0, 'không tìm thấy khối kết quả batch — test cần cập nhật');
  assert.doesNotMatch(batchResult, /prompt/i);
});

test('prompt lưu vào thư viện lấy từ cache của server, không nhận từ client', async () => {
  const source = await readFile(
    new URL('../server/bannerAdsRoute.mjs', import.meta.url),
    'utf8'
  );
  const saveRoute = source.slice(source.indexOf("app.post('/api/banner-ads/save'"));

  // Không destructure prompt từ request body
  assert.doesNotMatch(saveRoute.slice(0, 600), /const \{[^}]*\bprompt\b[^}]*\} = request\.body/);
  assert.match(saveRoute, /const prompt = takeRememberedPrompt\(imageUrl\)/);

  // Cache phải có hạn dùng và trần số phần tử, tránh giữ prompt vô hạn trong RAM
  assert.match(source, /const PROMPT_CACHE_TTL_MS = /);
  assert.match(source, /const PROMPT_CACHE_MAX_ENTRIES = /);
  assert.match(source, /while \(promptByImageUrl\.size >= PROMPT_CACHE_MAX_ENTRIES\)/);
  assert.match(source, /entry\.expiresAt > Date\.now\(\)/);
});

test('UI banner không hiển thị hay gửi kèm prompt', async () => {
  const [component, service] = await Promise.all([
    readFile(new URL('../src/components/BannerAds.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/bannerAdsService.ts', import.meta.url), 'utf8')
  ]);

  assert.doesNotMatch(component, /promptUsed/);
  assert.doesNotMatch(component, /Sao chép Prompt/);
  assert.doesNotMatch(component, /Art Director Prompt/);
  assert.doesNotMatch(service, /promptUsed/);

  // saveBannerToAssets không còn nhận prompt từ phía client
  const saveParams = service.slice(
    service.indexOf('export interface SaveBannerParams'),
    service.indexOf('}', service.indexOf('export interface SaveBannerParams'))
  );
  assert.doesNotMatch(saveParams, /prompt/);
});
