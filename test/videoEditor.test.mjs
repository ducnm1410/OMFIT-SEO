import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildGeminiVideoEditRequest,
  calculateVideoTelemetry,
  createVideoEditorTicket,
  friendlyGoogleApiError,
  GEMINI_VIDEO_EDITOR_MODEL,
  isGoogleFileNotFoundError,
  normalizeOwnedVideoInputPath,
  readMp4DurationSeconds,
  VIDEO_EDITOR_JOB_TICKET_TTL_MS,
  VIDEO_EDITOR_MEDIA_TRANSFER_TIMEOUT_MS,
  VIDEO_EDITOR_POLL_REQUEST_TIMEOUT_MS,
  VIDEO_EDITOR_PROVIDER_REQUEST_TIMEOUT_MS,
  verifyVideoEditorTicket
} from '../server/geminiVideoEditor.mjs';

test('AI Video Editor chuẩn hóa lỗi Files API 404 và không hiện JSON thô', () => {
  const error = new Error('{"error":{"message":"","code":404,"status":"Not Found"}}');
  assert.equal(isGoogleFileNotFoundError(error), true);
  const message = friendlyGoogleApiError(error);
  assert.match(message, /không còn tìm thấy tệp video/i);
  assert.doesNotMatch(message, /\{"error"/);
});

test('AI Video Editor tạo background interaction và hỗ trợ chuỗi chỉnh sửa', () => {
  const first = buildGeminiVideoEditRequest({
    prompt: 'Make the lighting cinematic',
    fileUri: 'https://generativelanguage.googleapis.com/v1beta/files/source',
    mimeType: 'video/mp4',
    resolution: '1080p'
  });
  assert.equal(first.model, GEMINI_VIDEO_EDITOR_MODEL);
  assert.equal(first.background, true);
  assert.equal(first.store, true);
  assert.deepEqual(first.response_format, {
    type: 'video',
    delivery: 'uri',
    aspect_ratio: '16:9'
  });
  assert.equal(first.generation_config.video_config.task, 'edit');
  assert.equal(first.input[0].type, 'document');
  assert.equal(first.input[0].resolution, 'ultra_high');

  const chained = buildGeminiVideoEditRequest({
    prompt: 'Add light rain',
    previousInteractionId: 'v1_previous',
    resolution: '720p'
  });
  assert.equal(chained.input, 'Add light rain');
  assert.equal(chained.previous_interaction_id, 'v1_previous');
  assert.equal(chained.generation_config.video_config.task, 'edit');
});

test('AI Video Editor hỗ trợ text, ảnh và tỷ lệ dọc/ngang đúng schema Gemini Omni', () => {
  const textRequest = buildGeminiVideoEditRequest({
    mode: 'text-to-video',
    prompt: 'A calm Pilates studio',
    aspectRatio: '9:16'
  });
  assert.equal(textRequest.input, 'A calm Pilates studio');
  assert.equal(textRequest.response_format.aspect_ratio, '9:16');
  assert.equal(textRequest.generation_config.video_config.task, 'text_to_video');

  const imageRequest = buildGeminiVideoEditRequest({
    mode: 'image-to-video',
    prompt: 'Slow camera push in',
    imageData: 'aW1hZ2U=',
    mimeType: 'image/jpeg',
    aspectRatio: '16:9'
  });
  assert.deepEqual(imageRequest.input, [
    { type: 'image', data: 'aW1hZ2U=', mime_type: 'image/jpeg' },
    { type: 'text', text: 'Slow camera push in' }
  ]);
  assert.equal(imageRequest.generation_config.video_config.task, 'image_to_video');
});

test('telemetry video tính thời lượng MP4 và chi phí từ usage Gemini', () => {
  const buffer = Buffer.alloc(64);
  buffer.writeUInt32BE(32, 0);
  buffer.write('mvhd', 4, 'ascii');
  buffer.writeUInt8(0, 8);
  buffer.writeUInt32BE(1_000, 20);
  buffer.writeUInt32BE(8_000, 24);
  assert.equal(readMp4DurationSeconds(buffer), 8);

  const telemetry = calculateVideoTelemetry({
    total_input_tokens: 1_000,
    output_tokens_by_modality: [
      { modality: 'video', tokens: 57_920 }
    ]
  }, buffer);
  assert.equal(telemetry.outputDurationSeconds, 10);
  assert.equal(telemetry.outputVideoTokens, 57_920);
  assert.ok(telemetry.estimatedCostUsd > 1);
});

test('Railway cho phép Video Editor render 60 phút và transfer tối đa 10 phút', async () => {
  assert.equal(VIDEO_EDITOR_JOB_TICKET_TTL_MS, 2 * 60 * 60 * 1000);
  assert.equal(VIDEO_EDITOR_PROVIDER_REQUEST_TIMEOUT_MS, 5 * 60 * 1000);
  assert.equal(VIDEO_EDITOR_POLL_REQUEST_TIMEOUT_MS, 2 * 60 * 1000);
  assert.equal(VIDEO_EDITOR_MEDIA_TRANSFER_TIMEOUT_MS, 10 * 60 * 1000);
  const [service, route] = await Promise.all([
    readFile(new URL('../src/services/videoEditorService.ts', import.meta.url), 'utf8'),
    readFile(new URL('../server/videoEditorRoute.mjs', import.meta.url), 'utf8')
  ]);
  assert.match(service, /sourceMaxPollAttempts = 400/);
  assert.match(service, /renderMaxPollAttempts = 720/);
  assert.match(service, /sau 20 phút/);
  assert.match(service, /sau 60 phút/);
  assert.match(route, /timeout_ms: VIDEO_EDITOR_PROVIDER_REQUEST_TIMEOUT_MS/);
  assert.match(route, /timeout_ms: VIDEO_EDITOR_POLL_REQUEST_TIMEOUT_MS/);
  assert.match(route, /AbortSignal\.timeout\(VIDEO_EDITOR_MEDIA_TRANSFER_TIMEOUT_MS\)/);
});

test('AI Video Editor giới hạn video nguồn và output ở 100 MB', async () => {
  const [component, service, helper, route, migration] = await Promise.all([
    readFile(new URL('../src/components/AIVideoEditor.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/videoEditorService.ts', import.meta.url), 'utf8'),
    readFile(new URL('../server/geminiVideoEditor.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../server/videoEditorRoute.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/202608050001_ai_video_editor.sql', import.meta.url), 'utf8')
  ]);
  assert.doesNotMatch(component, /Chỉnh sửa video nhiều lượt bằng ngôn ngữ tự nhiên/);
  assert.match(component, /tối đa 100 MB/);
  assert.match(service, /100 \* 1024 \* 1024/);
  assert.match(helper, /VIDEO_EDITOR_MAX_BYTES = 100 \* 1024 \* 1024/);
  assert.match(route, /giới hạn 100 MB/);
  assert.match(migration, /104857600/);
  assert.doesNotMatch([component, service, helper, route, migration].join('\n'), /200 MB|209715200/);
});

test('ticket video ràng buộc job và storage path ràng buộc đúng owner', () => {
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const job = { version: 1, kind: 'edit', ownerId, issuedAt: Date.now(), interactionId: 'v1_abc' };
  const ticket = createVideoEditorTicket(job, 'test-secret');
  assert.deepEqual(verifyVideoEditorTicket(ticket, 'test-secret'), job);
  assert.equal(verifyVideoEditorTicket(`${ticket}x`, 'test-secret'), null);
  assert.equal(
    normalizeOwnedVideoInputPath(ownerId, 'omfit-video-inputs', `${ownerId}/video-editor/source.mp4`),
    `${ownerId}/video-editor/source.mp4`
  );
  assert.equal(
    normalizeOwnedVideoInputPath(ownerId, 'omfit-video-inputs', `22222222-2222-4222-8222-222222222222/video-editor/source.mp4`),
    ''
  );
});

test('UI tải video trực tiếp lên Supabase và API dùng start/poll thay vì request 10 phút', async () => {
  const [component, service, route, migration, app, sidebar] = await Promise.all([
    readFile(new URL('../src/components/AIVideoEditor.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/videoEditorService.ts', import.meta.url), 'utf8'),
    readFile(new URL('../server/videoEditorRoute.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/202608050001_ai_video_editor.sql', import.meta.url), 'utf8'),
    readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/Sidebar.tsx', import.meta.url), 'utf8')
  ]);

  assert.match(component, /AI Video Editor/);
  assert.match(component, /Lịch sử chỉnh sửa/);
  assert.match(component, /Tiếp tục từ bản này/);
  assert.match(component, /Tạo từ prompt/);
  assert.match(component, /Ảnh thành video/);
  assert.match(component, /So sánh Before \/ After/);
  assert.match(component, /Tỷ lệ video được sử dụng/);
  assert.match(component, /promptLocked/);
  assert.match(service, /\.from\(sourceBucket\)[\s\S]*?\.upload\(storagePath, file/);
  assert.match(service, /operation: 'prepare'/);
  assert.match(service, /operation: 'start'/);
  assert.match(service, /operation: 'poll'/);
  assert.doesNotMatch(service, /readAsDataURL|videoBase64/);
  assert.match(route, /background: true|buildGeminiVideoEditRequest/);
  assert.match(route, /:download/);
  assert.match(route, /timeout_ms: VIDEO_EDITOR_PROVIDER_REQUEST_TIMEOUT_MS/);
  assert.match(route, /\.eq\('owner_id', ownerId\)/);
  assert.match(route, /VIDEO_EDITOR_OUTPUT_BUCKET/);
  const previousAssetLookup = route.slice(
    route.indexOf("const previousAssetId"),
    route.indexOf("const promptEn")
  );
  assert.doesNotMatch(previousAssetLookup, /\.eq\('owner_id', ownerId\)/);
  assert.match(route, /isGoogleFileNotFoundError/);
  assert.match(route, /uploadGoogleSource/);
  assert.match(migration, /create table if not exists public\.video_assets/i);
  assert.match(migration, /video_assets_owner_select/);
  assert.match(migration, /omfit-video-inputs/);
  assert.match(migration, /omfit-video-assets/);
  assert.match(migration, /revoke insert, update, delete on public\.video_assets/i);
  assert.match(app, /const AIVideoEditor = lazy/);
  assert.match(app, /activeTab === 'videoeditor'/);
  assert.match(sidebar, /id: 'videoeditor'/);
});

test('dashboard video lưu telemetry và migration hỗ trợ usage cùng ảnh nguồn', async () => {
  const [service, route, migration] = await Promise.all([
    readFile(new URL('../src/services/videoEditorService.ts', import.meta.url), 'utf8'),
    readFile(new URL('../server/videoEditorRoute.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/202608050004_video_editor_productivity.sql', import.meta.url), 'utf8')
  ]);
  assert.match(service, /loadVideoEditorAnalytics/);
  assert.match(service, /rpc\('get_video_editor_analytics'\)/);
  assert.match(service, /markVideoUsed/);
  assert.match(service, /loadVideoComparisonSource/);
  assert.match(route, /render_duration_ms/);
  assert.match(route, /estimated_cost_usd/);
  assert.match(route, /operation === 'mark_used'/);
  assert.match(route, /operation === 'comparison_source'/);
  assert.match(migration, /generation_mode/);
  assert.match(migration, /aspect_ratio/);
  assert.match(migration, /image\/jpeg/);
  assert.match(migration, /used_at/);
  assert.match(migration, /create or replace function public\.get_video_editor_analytics/);
  assert.match(migration, /public\.is_internal_profile_user\(\)/);
});

test('lịch sử video dùng chung cho người dùng nội bộ', async () => {
  const [service, migration] = await Promise.all([
    readFile(new URL('../src/services/videoEditorService.ts', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/202608050003_shared_internal_history.sql', import.meta.url), 'utf8')
  ]);
  const loadHistory = service.slice(service.indexOf('export async function loadVideoLibrary'));
  assert.doesNotMatch(loadHistory, /\.eq\('owner_id'/);
  assert.match(migration, /video_assets_internal_history_select/);
  assert.match(migration, /is_internal_profile_user/);
});
