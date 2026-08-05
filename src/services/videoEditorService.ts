import { supabase } from '../lib/supabase';
import { getAuthenticatedUserId } from '../lib/authSession.mjs';
import type { GeneratedVideo } from '../types';
import { ApiClientError, authenticatedFetch } from './apiClient';

const sourceBucket = 'omfit-video-inputs';
const allowedMimeTypes = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const maxVideoBytes = 100 * 1024 * 1024;
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
  const mimeType = resolveVideoMimeType(file);
  if (!mimeType) {
    throw new Error('Chỉ hỗ trợ video MP4, MOV hoặc WEBM.');
  }
  if (file.size > maxVideoBytes) throw new Error('Video vượt quá giới hạn 100 MB.');

  const ownerId = await getAuthenticatedUserId(supabase.auth);
  const extension = mimeType === 'video/quicktime'
    ? 'mov'
    : mimeType === 'video/webm' ? 'webm' : 'mp4';
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
        fileName: file.name
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
    return { ticket: result.ticket, storagePath, mimeType, fileName: file.name };
  } catch (error) {
    await supabase.storage.from(sourceBucket).remove([storagePath]).catch(() => undefined);
    throw error;
  }
}

export async function generateVideoEdit(options: {
  promptVi: string;
  resolution: '720p' | '1080p';
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
  const ownerId = await getAuthenticatedUserId(supabase.auth);
  const { data, error } = await supabase
    .from('video_assets')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(100, Math.round(limit))));
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    url: row.public_url,
    interactionId: row.provider_interaction_id,
    parentAssetId: row.parent_asset_id || undefined,
    promptVi: row.prompt_vi || '',
    promptEn: row.prompt_en || '',
    resolution: row.resolution === '1080p' ? '1080p' : '720p',
    fileName: row.file_name,
    mimeType: row.mime_type || 'video/mp4',
    storagePath: row.storage_path,
    sourceStoragePath: row.source_storage_path || undefined,
    bytes: Number(row.bytes) || undefined,
    createdAt: row.created_at
  }));
}
