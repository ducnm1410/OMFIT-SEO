import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildGeminiVideoEditRequest,
  createVideoEditorTicket,
  GEMINI_VIDEO_EDITOR_MODEL,
  normalizeOwnedVideoInputPath,
  verifyVideoEditorTicket
} from '../server/geminiVideoEditor.mjs';

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
  assert.deepEqual(first.response_format, { type: 'video', delivery: 'uri' });
  assert.equal(first.input[0].type, 'document');
  assert.equal(first.input[0].resolution, 'ultra_high');

  const chained = buildGeminiVideoEditRequest({
    prompt: 'Add light rain',
    previousInteractionId: 'v1_previous',
    resolution: '720p'
  });
  assert.equal(chained.input, 'Add light rain');
  assert.equal(chained.previous_interaction_id, 'v1_previous');
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
  assert.match(service, /\.from\(sourceBucket\)[\s\S]*?\.upload\(storagePath, file/);
  assert.match(service, /operation: 'prepare'/);
  assert.match(service, /operation: 'start'/);
  assert.match(service, /operation: 'poll'/);
  assert.doesNotMatch(service, /readAsDataURL|videoBase64/);
  assert.match(route, /background: true|buildGeminiVideoEditRequest/);
  assert.match(route, /:download/);
  assert.match(route, /timeout_ms: 45_000/);
  assert.match(route, /\.eq\('owner_id', ownerId\)/);
  assert.match(route, /VIDEO_EDITOR_OUTPUT_BUCKET/);
  assert.match(migration, /create table if not exists public\.video_assets/i);
  assert.match(migration, /video_assets_owner_select/);
  assert.match(migration, /omfit-video-inputs/);
  assert.match(migration, /omfit-video-assets/);
  assert.match(migration, /revoke insert, update, delete on public\.video_assets/i);
  assert.match(app, /const AIVideoEditor = lazy/);
  assert.match(app, /activeTab === 'videoeditor'/);
  assert.match(sidebar, /id: 'videoeditor'/);
});
