import { supabase } from '../lib/supabase';
import {
  getAuthenticatedUserId,
  withAuthenticatedSupabaseRetry
} from '../lib/authSession.mjs';
import type {
  GeneratedVideo,
  VideoAspectRatio,
  VideoEditorMode
} from '../types';
import { ApiClientError, authenticatedFetch } from './apiClient';

const sourceBucket = 'omfit-video-inputs';
const allowedMimeTypes = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const allowedImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxVideoBytes = 100 * 1024 * 1024;
const maxImageBytes = 10 * 1024 * 1024;
const sourcePollIntervalMs = 3_000;
const sourceMaxPollAttempts = 400;
const renderPollIntervalMs = 5_000;
const renderMaxPollAttempts = 720;

function resolveVideoMimeType(file: File) {
  const browserMimeType = String(file.type || '').split(';')[0].trim().toLowerCase();
  if (allowedMimeTypes.has(browserMimeType)) return browserMimeType;
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'mov') return 'video/quicktime';
  if (extension === 'webm') return 'video/webm';
  if (extension === 'mp4') return 'video/mp4';
  return '';
}

interface PendingVideoOperation {
  status: 'processing' | 'pending';
  ticket: string;
}

export interface PreparedSourceVideo {
  ticket: string;
  storagePath: string;
  mimeType: string;
  fileName: string;
  inputKind: 'image' | 'video';
}

export interface VideoEditorAnalytics {
  totalVideos: number;
  averageRenderSeconds: number | null;
  estimatedCostUsd: number;
  usedVideos: number;
  usageRate: number;
}

export interface VideoComparisonSource {
  url: string;
  kind: 'image' | 'video';
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function isPending(value: unknown): value is PendingVideoOperation {
  return Boolean(
    value
    && typeof value === 'object'
    && ((value as PendingVideoOperation).status === 'processing'
      || (value as PendingVideoOperation).status === 'pending')
    && typeof (value as PendingVideoOperation).ticket === 'string'
  );
}

function isRetryable(error: unknown) {
  return error instanceof ApiClientError
    && [429, 502, 503, 504].includes(error.status);
}

function safeFileName(fileName: string) {
  return fileName
    .replace(/\.[^/.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'omfit-video';
}

export async function prepareSourceVideo(file: File): Promise<PreparedSourceVideo> {
  return prepareSourceMedia(file, 'video');
}

function resolveImageMimeType(file: File) {
  const browserMimeType = String(file.type || '').split(';')[0].trim().toLowerCase();
  if (allowedImageMimeTypes.has(browserMimeType)) return browserMimeType;
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return '';
}

export async function prepareSourceMedia(
  file: File,
  inputKind: 'image' | 'video'
): Promise<PreparedSourceVideo> {
  const mimeType = inputKind === 'image'
    ? resolveImageMimeType(file)
    : resolveVideoMimeType(file);
  if (!mimeType) {
    throw new Error(inputKind === 'image'
      ? 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.'
      : 'Chỉ hỗ trợ video MP4, MOV hoặc WEBM.');
  }
  if (inputKind === 'image' && file.size > maxImageBytes) {
    throw new Error('Ảnh vượt quá giới hạn 10 MB.');
  }
  if (inputKind === 'video' && file.size > maxVideoBytes) {
    throw new Error('Video vượt quá giới hạn 100 MB.');
  }

  const ownerId = await getAuthenticatedUserId(supabase.auth);
  const extension = mimeType === 'video/quicktime' ? 'mov'
    : mimeType === 'video/webm' ? 'webm'
      : mimeType === 'image/jpeg' ? 'jpg'
        : mimeType === 'image/png' ? 'png'
          : mimeType === 'image/webp' ? 'webp' : 'mp4';
  const storagePath = `${ownerId}/video-editor/${Date.now()}-${safeFileName(file.name)}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(sourceBucket)
    .upload(storagePath, file, { contentType: mimeType, upsert: false });
  if (uploadError) throw uploadError;

  try {
    let result = await authenticatedFetch('/api/video/editor', {
      method: 'POST',
      body: JSON.stringify({
        operation: 'prepare',
        bucket: sourceBucket,
        storagePath,
        mimeType,
        fileName: file.name,
        inputKind
      })
    }) as PendingVideoOperation | { status: 'ready'; ticket: string };

    for (let attempt = 0; isPending(result) && attempt < sourceMaxPollAttempts; attempt += 1) {
      await wait(sourcePollIntervalMs);
      try {
        result = await authenticatedFetch('/api/video/editor', {
          method: 'POST',
          body: JSON.stringify({ operation: 'prepare_poll', ticket: result.ticket })
        }) as PendingVideoOperation | { status: 'ready'; ticket: string };
      } catch (error) {
        if (!isRetryable(error)) throw error;
      }
    }
    if (isPending(result)) throw new Error('Video nguồn vẫn đang xử lý sau 20 phút.');
    return { ticket: result.ticket, storagePath, mimeType, fileName: file.name, inputKind };
  } catch (error) {
    await supabase.storage.from(sourceBucket).remove([storagePath]).catch(() => undefined);
    throw error;
  }
}

export async function generateVideoEdit(options: {
  promptVi: string;
  resolution: '720p' | '1080p';
  aspectRatio: VideoAspectRatio;
  mode: VideoEditorMode;
  sourceTicket?: string;
  previousAssetId?: string;
}): Promise<GeneratedVideo> {
  let result = await authenticatedFetch('/api/video/editor', {
    method: 'POST',
    body: JSON.stringify({ operation: 'start', ...options })
  }) as GeneratedVideo | PendingVideoOperation;

  for (let attempt = 0; isPending(result) && attempt < renderMaxPollAttempts; attempt += 1) {
    await wait(renderPollIntervalMs);
    try {
      result = await authenticatedFetch('/api/video/editor', {
        method: 'POST',
        body: JSON.stringify({ operation: 'poll', ticket: result.ticket })
      }) as GeneratedVideo | PendingVideoOperation;
    } catch (error) {
      if (!isRetryable(error)) throw error;
    }
  }
  if (isPending(result)) throw new Error('Video vẫn đang render sau 60 phút. Vui lòng thử lại sau.');
  return result;
}

export async function loadVideoLibrary(limit = 30): Promise<GeneratedVideo[]> {
  const { data, error } = await withAuthenticatedSupabaseRetry(
    supabase.auth,
    () => supabase
      .from('video_assets')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(Math.max(1, Math.min(100, Math.round(limit))))
  );
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    ownerId: row.owner_id || undefined,
    url: row.public_url,
    interactionId: row.provider_interaction_id,
    parentAssetId: row.parent_asset_id || undefined,
    promptVi: row.prompt_vi || '',
    promptEn: row.prompt_en || '',
    resolution: row.resolution === '1080p' ? '1080p' : '720p',
    aspectRatio: row.aspect_ratio === '9:16' ? '9:16' : '16:9',
    generationMode: ['text-to-video', 'image-to-video', 'edit-video', 'continue'].includes(row.generation_mode)
      ? row.generation_mode as VideoEditorMode
      : 'edit-video',
    fileName: row.file_name,
    mimeType: row.mime_type || 'video/mp4',
    storagePath: row.storage_path,
    sourceStoragePath: row.source_storage_path || undefined,
    bytes: Number(row.bytes) || undefined,
    renderDurationMs: Number(row.render_duration_ms) || undefined,
    estimatedCostUsd: Number(row.estimated_cost_usd) || undefined,
    outputDurationSeconds: Number(row.output_duration_seconds) || undefined,
    usedAt: row.used_at || undefined,
    useCount: Number(row.use_count) || 0,
    createdAt: row.created_at
  }));
}

export async function loadVideoEditorAnalytics(): Promise<VideoEditorAnalytics> {
  const { data, error } = await withAuthenticatedSupabaseRetry(
    supabase.auth,
    () => supabase.rpc('get_video_editor_analytics').single()
  );
  if (error) throw error;
  return {
    totalVideos: Number(data?.total_videos) || 0,
    averageRenderSeconds: Number(data?.average_render_seconds) || null,
    estimatedCostUsd: Number(data?.estimated_cost_usd) || 0,
    usedVideos: Number(data?.used_videos) || 0,
    usageRate: Number(data?.usage_rate) || 0
  };
}

export async function markVideoUsed(
  assetId: string,
  action: 'download' | 'selected' = 'download'
): Promise<GeneratedVideo> {
  return authenticatedFetch('/api/video/editor', {
    method: 'POST',
    body: JSON.stringify({ operation: 'mark_used', assetId, action })
  }) as Promise<GeneratedVideo>;
}

export async function loadVideoComparisonSource(
  assetId: string
): Promise<VideoComparisonSource | null> {
  const result = await authenticatedFetch('/api/video/editor', {
    method: 'POST',
    body: JSON.stringify({ operation: 'comparison_source', assetId })
  }) as { source?: VideoComparisonSource | null };
  return result.source || null;
}
