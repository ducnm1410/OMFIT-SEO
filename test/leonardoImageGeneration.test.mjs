import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildLeonardoGenerationRequest,
  createLeonardoGenerationTicket,
  DEFAULT_LEONARDO_ASPECT_RATIO,
  LEONARDO_ASPECT_RATIOS,
  LEONARDO_IMAGE_MODEL,
  resolveLeonardoAspectRatio,
  verifyLeonardoGenerationTicket
} from '../server/leonardoImageGeneration.mjs';

test('GPT Image 2 dùng đúng model và năm preset aspect ratio của Leonardo', () => {
  assert.equal(LEONARDO_IMAGE_MODEL, 'gpt-image-2');
  assert.equal(DEFAULT_LEONARDO_ASPECT_RATIO, '16:9');
  assert.deepEqual(LEONARDO_ASPECT_RATIOS, {
    '1:1': { width: 1024, height: 1024 },
    '2:3': { width: 848, height: 1264 },
    '3:2': { width: 1264, height: 848 },
    '16:9': { width: 1376, height: 768 },
    '9:16': { width: 768, height: 1376 }
  });

  for (const dimensions of Object.values(LEONARDO_ASPECT_RATIOS)) {
    assert.equal(dimensions.width % 16, 0);
    assert.equal(dimensions.height % 16, 0);
    assert.ok(dimensions.width * dimensions.height >= 655_360);
    assert.ok(dimensions.width * dimensions.height <= 8_294_400);
  }
});

test('payload GPT Image 2 gửi quality và reference đúng schema, không gửi strength hoặc style_ids', () => {
  const payload = buildLeonardoGenerationRequest({
    prompt: 'Premium OMFIT Pilates studio',
    aspectRatio: '2:3',
    uploadedImageId: '00000000-0000-0000-0000-000000000001'
  });

  assert.equal(payload.public, false);
  assert.equal(payload.model, 'gpt-image-2');
  assert.equal(payload.parameters.quality, 'MEDIUM');
  assert.equal(payload.parameters.width, 848);
  assert.equal(payload.parameters.height, 1264);
  assert.equal(payload.parameters.quantity, 1);
  assert.equal(payload.parameters.prompt_enhance, 'OFF');
  assert.deepEqual(payload.parameters.guidances.image_reference, [{
    image: {
      id: '00000000-0000-0000-0000-000000000001',
      type: 'UPLOADED'
    }
  }]);
  assert.equal('strength' in payload.parameters.guidances.image_reference[0], false);
  assert.equal('style_ids' in payload.parameters, false);
  assert.equal('size' in payload.parameters, false);
});

test('aspect ratio không hợp lệ bị từ chối và UI gửi lựa chọn tới server', async () => {
  assert.equal(resolveLeonardoAspectRatio('4:3'), null);
  assert.throws(
    () => buildLeonardoGenerationRequest({ prompt: 'test prompt', aspectRatio: '4:3' }),
    /Unsupported Leonardo aspect ratio/
  );

  const [studio, selector, service, server] = await Promise.all([
    readFile(new URL('../src/components/ImageStudio.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/ImageAspectRatioSelector.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/leonardoService.ts', import.meta.url), 'utf8'),
    readFile(new URL('../server/index.mjs', import.meta.url), 'utf8')
  ]);
  assert.match(studio, /<ImageAspectRatioSelector/);
  assert.match(selector, /Aspect Ratio Settings/);
  assert.match(service, /aspectRatio: options\.aspectRatio/);
  assert.match(server, /resolveLeonardoAspectRatio\(request\.body\?\.aspectRatio\)/);
  assert.match(server, /model: LEONARDO_IMAGE_MODEL/);
});

test('generation ticket được ký, chống sửa nội dung và ràng buộc job polling', () => {
  const secret = 'test-only-secret';
  const job = {
    version: 1,
    issuedAt: 1785900000000,
    ownerId: '11111111-1111-4111-8111-111111111111',
    generationId: '22222222-2222-4222-8222-222222222222',
    aspectRatio: '16:9'
  };
  const ticket = createLeonardoGenerationTicket(job, secret);
  assert.deepEqual(verifyLeonardoGenerationTicket(ticket, secret), job);
  assert.equal(verifyLeonardoGenerationTicket(`${ticket}tampered`, secret), null);
  assert.equal(verifyLeonardoGenerationTicket(ticket, 'wrong-secret'), null);
});

test('luồng GPT Image 2 dùng request start/poll ngắn thay cho vòng chờ 45 giây trên server', async () => {
  const [service, server] = await Promise.all([
    readFile(new URL('../src/services/leonardoService.ts', import.meta.url), 'utf8'),
    readFile(new URL('../server/index.mjs', import.meta.url), 'utf8')
  ]);
  assert.match(service, /operation: 'start'/);
  assert.match(service, /operation: 'poll'/);
  assert.match(service, /attempt < 100/);
  assert.match(server, /response\.status\(202\)\.json\(\{ status: 'pending', ticket \}\)/);
  assert.match(server, /verifyLeonardoGenerationTicket/);
  assert.doesNotMatch(server, /attempt < 18/);
  assert.doesNotMatch(server, /leonardo_timeout/);
});

test('logo và ảnh mẫu đều được gửi làm image reference và lưu provenance', async () => {
  const [studio, service, server] = await Promise.all([
    readFile(new URL('../src/components/ImageStudio.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/leonardoService.ts', import.meta.url), 'utf8'),
    readFile(new URL('../server/index.mjs', import.meta.url), 'utf8')
  ]);

  assert.match(studio, /asset\.assetType === 'logo' \|\| asset\.assetType === 'reference'/);
  assert.match(studio, /uploadBrandAsset\(file, brandProfile\.id, assetType\)/);
  assert.match(studio, /referenceAssetId/);
  assert.match(service, /referenceAssetId: options\.referenceAssetId/);
  assert.match(server, /\.in\('asset_type', \['logo', 'reference'\]\)/);
  assert.match(server, /uploadedImageId: leonardoReferenceId/);
  assert.match(server, /referenceAssetName: job\.referenceAssetName \|\| null/);
});
