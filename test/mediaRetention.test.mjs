import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  isOwnedMediaStoragePath,
  MEDIA_RETENTION_DAYS,
  mediaRetentionCutoff,
  runMediaRetentionCleanup
} from '../server/mediaRetention.mjs';

class FakeQuery {
  constructor(database, table) {
    this.database = database;
    this.table = table;
    this.filters = [];
    this.deleteMode = false;
    this.limitValue = Infinity;
    this.ordering = null;
  }

  select() { return this; }
  delete() { this.deleteMode = true; return this; }
  eq(column, value) { this.filters.push((row) => row[column] === value); return this; }
  neq(column, value) { this.filters.push((row) => row[column] !== value); return this; }
  lt(column, value) { this.filters.push((row) => row[column] < value); return this; }
  gte(column, value) { this.filters.push((row) => row[column] >= value); return this; }
  in(column, values) { const accepted = new Set(values); this.filters.push((row) => accepted.has(row[column])); return this; }
  order(column, { ascending }) { this.ordering = { column, ascending }; return this; }
  limit(value) { this.limitValue = value; return this; }

  execute() {
    const rows = this.database[this.table] || [];
    let matched = rows.filter((row) => this.filters.every((filter) => filter(row)));
    if (this.ordering) {
      const direction = this.ordering.ascending ? 1 : -1;
      matched = [...matched].sort((left, right) => (
        String(left[this.ordering.column]).localeCompare(String(right[this.ordering.column])) * direction
      ));
    }
    matched = matched.slice(0, this.limitValue);
    if (this.deleteMode) {
      const deletedIds = new Set(matched.map((row) => row.id));
      this.database[this.table] = rows.filter((row) => !deletedIds.has(row.id));
    }
    return { data: matched.map((row) => ({ ...row })), error: null };
  }

  then(resolve, reject) {
    return Promise.resolve(this.execute()).then(resolve, reject);
  }
}

function fakeSupabase(database, storageObjects) {
  return {
    from(table) {
      return new FakeQuery(database, table);
    },
    storage: {
      from(bucket) {
        return {
          async remove(paths) {
            for (const path of paths) storageObjects[bucket]?.delete(path);
            return { data: paths.map((name) => ({ name })), error: null };
          }
        };
      }
    }
  };
}

test('chính sách media hết hạn chính xác sau 14 ngày và chỉ chấp nhận path thuộc owner', () => {
  assert.equal(MEDIA_RETENTION_DAYS, 14);
  assert.equal(mediaRetentionCutoff(new Date('2026-08-05T00:00:00.000Z')), '2026-07-22T00:00:00.000Z');
  const ownerId = '11111111-1111-4111-8111-111111111111';
  assert.equal(isOwnedMediaStoragePath(ownerId, `${ownerId}/video-editor/source.mp4`), true);
  assert.equal(isOwnedMediaStoragePath(ownerId, '22222222-2222-4222-8222-222222222222/video-editor/source.mp4'), false);
  assert.equal(isOwnedMediaStoragePath(ownerId, `${ownerId}/../source.mp4`), false);
});

test('cleanup xóa media hết hạn nhưng giữ ảnh đang dùng và nguồn của video mới', async () => {
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const oldDate = '2026-07-01T00:00:00.000Z';
  const newDate = '2026-08-01T00:00:00.000Z';
  const sharedSource = `${ownerId}/video-editor/shared.mp4`;
  const orphanSource = `${ownerId}/video-editor/orphan.mp4`;
  const oldOutput = `${ownerId}/video-editor/old-output.mp4`;
  const newOutput = `${ownerId}/video-editor/new-output.mp4`;
  const removableImage = `${ownerId}/library/removable.jpg`;
  const articleImage = `${ownerId}/library/article.jpg`;
  const wordpressImage = `${ownerId}/library/wordpress.jpg`;
  const database = {
    video_assets: [
      { id: 'video-old', owner_id: ownerId, bucket: 'omfit-video-assets', storage_path: oldOutput, source_storage_path: sharedSource, created_at: oldDate },
      { id: 'video-new', owner_id: ownerId, bucket: 'omfit-video-assets', storage_path: newOutput, source_storage_path: sharedSource, created_at: newDate }
    ],
    video_source_assets: [
      { id: 'source-shared', owner_id: ownerId, bucket: 'omfit-video-inputs', storage_path: sharedSource, created_at: oldDate },
      { id: 'source-orphan', owner_id: ownerId, bucket: 'omfit-video-inputs', storage_path: orphanSource, created_at: oldDate }
    ],
    media_assets: [
      { id: 'image-remove', owner_id: ownerId, bucket: 'omfit-public-assets', storage_path: removableImage, status: 'approved', created_at: oldDate },
      { id: 'image-article', owner_id: ownerId, bucket: 'omfit-public-assets', storage_path: articleImage, status: 'approved', created_at: oldDate },
      { id: 'image-wordpress', owner_id: ownerId, bucket: 'omfit-public-assets', storage_path: wordpressImage, status: 'approved', created_at: oldDate }
    ],
    article_media: [{ id: 'article-link', media_id: 'image-article' }],
    wordpress_media_mappings: [{ id: 'wordpress-link', media_id: 'image-wordpress' }]
  };
  const storageObjects = {
    'omfit-video-assets': new Set([oldOutput, newOutput]),
    'omfit-video-inputs': new Set([sharedSource, orphanSource]),
    'omfit-public-assets': new Set([removableImage, articleImage, wordpressImage])
  };

  const result = await runMediaRetentionCleanup({
    supabase: fakeSupabase(database, storageObjects),
    now: new Date('2026-08-05T00:00:00.000Z')
  });

  assert.deepEqual(result, {
    cutoff: '2026-07-22T00:00:00.000Z',
    videosDeleted: 1,
    videoSourcesDeleted: 1,
    imagesDeleted: 1,
    imagesPreserved: 2
  });
  assert.deepEqual(database.video_assets.map((row) => row.id), ['video-new']);
  assert.deepEqual(database.video_source_assets.map((row) => row.id), ['source-shared']);
  assert.deepEqual(database.media_assets.map((row) => row.id).sort(), ['image-article', 'image-wordpress']);
  assert.equal(storageObjects['omfit-video-inputs'].has(sharedSource), true);
  assert.equal(storageObjects['omfit-video-inputs'].has(orphanSource), false);
});

test('Railway bật worker và migration theo dõi nguồn video để cleanup', async () => {
  const [server, route, migration] = await Promise.all([
    readFile(new URL('../server/index.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../server/videoEditorRoute.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/202608050005_media_retention.sql', import.meta.url), 'utf8')
  ]);
  assert.match(server, /startMediaRetentionScheduler/);
  assert.match(server, /MEDIA_RETENTION_ENABLED/);
  assert.match(route, /from\('video_source_assets'\)/);
  assert.match(route, /tự dọn sau 14 ngày/);
  assert.match(migration, /create table if not exists public\.video_source_assets/i);
  assert.match(migration, /video_assets_retention_idx/);
  assert.match(migration, /media_assets_retention_idx/);
});
