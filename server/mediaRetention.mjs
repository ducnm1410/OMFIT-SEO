export const MEDIA_RETENTION_DAYS = 14;
export const MEDIA_RETENTION_BATCH_SIZE = 500;
export const MEDIA_RETENTION_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const MEDIA_RETENTION_INITIAL_DELAY_MS = 30 * 1000;

const VIDEO_INPUT_BUCKET = 'omfit-video-inputs';
const VIDEO_OUTPUT_BUCKET = 'omfit-video-assets';
const IMAGE_BUCKET = 'omfit-public-assets';
const STORAGE_DELETE_BATCH_SIZE = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function chunks(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function mediaRetentionCutoff(now = new Date(), retentionDays = MEDIA_RETENTION_DAYS) {
  const timestamp = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(timestamp)) throw new TypeError('A valid cleanup timestamp is required.');
  const safeDays = Math.max(1, Math.round(Number(retentionDays) || MEDIA_RETENTION_DAYS));
  return new Date(timestamp - safeDays * 24 * 60 * 60 * 1000).toISOString();
}

export function isOwnedMediaStoragePath(ownerId, storagePath) {
  const normalizedOwnerId = String(ownerId || '').trim().toLowerCase();
  const normalizedPath = String(storagePath || '').trim();
  return UUID_PATTERN.test(normalizedOwnerId)
    && normalizedPath.startsWith(`${normalizedOwnerId}/`)
    && !normalizedPath.includes('\\')
    && !normalizedPath.split('/').some((segment) => !segment || segment === '.' || segment === '..');
}

async function removeStorageObjects(supabase, bucket, paths) {
  const deleted = [];
  for (const batch of chunks(unique(paths), STORAGE_DELETE_BATCH_SIZE)) {
    if (batch.length === 0) continue;
    const { error } = await supabase.storage.from(bucket).remove(batch);
    if (error) throw new Error(`Không thể dọn bucket ${bucket}: ${error.message}`);
    deleted.push(...batch);
  }
  return deleted;
}

async function deleteRowsByIds(supabase, table, ids) {
  for (const batch of chunks(unique(ids), STORAGE_DELETE_BATCH_SIZE)) {
    if (batch.length === 0) continue;
    const { error } = await supabase.from(table).delete().in('id', batch);
    if (error) throw new Error(`Không thể dọn bảng ${table}: ${error.message}`);
  }
}

async function deleteSourceRowsByPaths(supabase, paths) {
  for (const batch of chunks(unique(paths), STORAGE_DELETE_BATCH_SIZE)) {
    if (batch.length === 0) continue;
    const { error } = await supabase
      .from('video_source_assets')
      .delete()
      .eq('bucket', VIDEO_INPUT_BUCKET)
      .in('storage_path', batch);
    if (error) throw new Error(`Không thể dọn video nguồn: ${error.message}`);
  }
}

async function loadProtectedImageIds(supabase, mediaIds) {
  const protectedIds = new Set();
  for (const batch of chunks(unique(mediaIds), STORAGE_DELETE_BATCH_SIZE)) {
    if (batch.length === 0) continue;
    const [{ data: articleMedia, error: articleError }, { data: wordpressMedia, error: wordpressError }] = await Promise.all([
      supabase.from('article_media').select('media_id').in('media_id', batch),
      supabase.from('wordpress_media_mappings').select('media_id').in('media_id', batch)
    ]);
    if (articleError) throw new Error(`Không thể kiểm tra ảnh trong bài viết: ${articleError.message}`);
    if (wordpressError) throw new Error(`Không thể kiểm tra ảnh WordPress: ${wordpressError.message}`);
    for (const row of [...(articleMedia || []), ...(wordpressMedia || [])]) {
      if (row.media_id) protectedIds.add(row.media_id);
    }
  }
  return protectedIds;
}

async function loadActiveSourcePaths(supabase, sourcePaths, cutoff) {
  const activePaths = new Set();
  for (const batch of chunks(unique(sourcePaths), STORAGE_DELETE_BATCH_SIZE)) {
    if (batch.length === 0) continue;
    const { data, error } = await supabase
      .from('video_assets')
      .select('source_storage_path')
      .gte('created_at', cutoff)
      .in('source_storage_path', batch);
    if (error) throw new Error(`Không thể kiểm tra video nguồn còn sử dụng: ${error.message}`);
    for (const row of data || []) {
      if (row.source_storage_path) activePaths.add(row.source_storage_path);
    }
  }
  return activePaths;
}

export async function runMediaRetentionCleanup({
  supabase,
  now = new Date(),
  retentionDays = MEDIA_RETENTION_DAYS,
  batchSize = MEDIA_RETENTION_BATCH_SIZE
}) {
  if (!supabase) throw new TypeError('Supabase admin client is required.');
  const cutoff = mediaRetentionCutoff(now, retentionDays);
  const safeBatchSize = Math.max(1, Math.min(1_000, Math.round(Number(batchSize) || MEDIA_RETENTION_BATCH_SIZE)));

  const [videoResult, sourceResult, imageResult] = await Promise.all([
    supabase
      .from('video_assets')
      .select('id,owner_id,bucket,storage_path,source_storage_path,created_at')
      .lt('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(safeBatchSize),
    supabase
      .from('video_source_assets')
      .select('id,owner_id,bucket,storage_path,created_at')
      .lt('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(safeBatchSize),
    supabase
      .from('media_assets')
      .select('id,owner_id,bucket,storage_path,status,created_at')
      .eq('bucket', IMAGE_BUCKET)
      .neq('status', 'published')
      .lt('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(safeBatchSize)
  ]);

  if (videoResult.error) throw new Error(`Không thể đọc lịch sử video hết hạn: ${videoResult.error.message}`);
  if (sourceResult.error) throw new Error(`Không thể đọc video nguồn hết hạn: ${sourceResult.error.message}`);
  if (imageResult.error) throw new Error(`Không thể đọc ảnh hết hạn: ${imageResult.error.message}`);

  const expiredVideos = (videoResult.data || []).filter((row) => (
    row.bucket === VIDEO_OUTPUT_BUCKET
    && isOwnedMediaStoragePath(row.owner_id, row.storage_path)
  ));
  const expiredSources = (sourceResult.data || []).filter((row) => (
    row.bucket === VIDEO_INPUT_BUCKET
    && isOwnedMediaStoragePath(row.owner_id, row.storage_path)
  ));
  const expiredImages = (imageResult.data || []).filter((row) => (
    row.bucket === IMAGE_BUCKET
    && isOwnedMediaStoragePath(row.owner_id, row.storage_path)
  ));

  const protectedImageIds = await loadProtectedImageIds(supabase, expiredImages.map((row) => row.id));
  const removableImages = expiredImages.filter((row) => !protectedImageIds.has(row.id));
  const sourceOwners = new Map();
  for (const row of expiredSources) sourceOwners.set(row.storage_path, row.owner_id);
  for (const row of expiredVideos) {
    if (row.source_storage_path && isOwnedMediaStoragePath(row.owner_id, row.source_storage_path)) {
      sourceOwners.set(row.source_storage_path, row.owner_id);
    }
  }
  const sourceCandidates = [...sourceOwners.keys()];
  const activeSourcePaths = await loadActiveSourcePaths(supabase, sourceCandidates, cutoff);
  const removableSourcePaths = sourceCandidates.filter((path) => !activeSourcePaths.has(path));

  const removedVideoPaths = await removeStorageObjects(
    supabase,
    VIDEO_OUTPUT_BUCKET,
    expiredVideos.map((row) => row.storage_path)
  );
  const removedImagePaths = await removeStorageObjects(
    supabase,
    IMAGE_BUCKET,
    removableImages.map((row) => row.storage_path)
  );
  const removedSourcePaths = await removeStorageObjects(
    supabase,
    VIDEO_INPUT_BUCKET,
    removableSourcePaths
  );

  await deleteRowsByIds(supabase, 'video_assets', expiredVideos.map((row) => row.id));
  await deleteRowsByIds(supabase, 'media_assets', removableImages.map((row) => row.id));
  await deleteSourceRowsByPaths(supabase, removedSourcePaths);

  return {
    cutoff,
    videosDeleted: removedVideoPaths.length,
    videoSourcesDeleted: removedSourcePaths.length,
    imagesDeleted: removedImagePaths.length,
    imagesPreserved: expiredImages.length - removableImages.length
  };
}

export function startMediaRetentionScheduler({
  getSupabase,
  logger = console,
  initialDelayMs = MEDIA_RETENTION_INITIAL_DELAY_MS,
  intervalMs = MEDIA_RETENTION_INTERVAL_MS
}) {
  if (typeof getSupabase !== 'function') throw new TypeError('getSupabase must be a function.');
  let running = false;

  const execute = async () => {
    if (running) return;
    running = true;
    try {
      const result = await runMediaRetentionCleanup({ supabase: getSupabase() });
      logger.info?.('[media-retention]', result);
    } catch (error) {
      logger.error?.('[media-retention]', error);
    } finally {
      running = false;
    }
  };

  const initialTimer = setTimeout(() => void execute(), Math.max(0, initialDelayMs));
  const intervalTimer = setInterval(() => void execute(), Math.max(60_000, intervalMs));
  initialTimer.unref?.();
  intervalTimer.unref?.();

  return () => {
    clearTimeout(initialTimer);
    clearInterval(intervalTimer);
  };
}
