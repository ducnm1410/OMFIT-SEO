import crypto from 'node:crypto';

export const GEMINI_VIDEO_EDITOR_MODEL = 'gemini-omni-flash-preview';
export const VIDEO_EDITOR_SOURCE_BUCKET = 'omfit-video-inputs';
export const VIDEO_EDITOR_OUTPUT_BUCKET = 'omfit-video-assets';
export const VIDEO_EDITOR_SOURCE_TICKET_TTL_MS = 47 * 60 * 60 * 1000;
export const VIDEO_EDITOR_JOB_TICKET_TTL_MS = 2 * 60 * 60 * 1000;
export const VIDEO_EDITOR_PROVIDER_REQUEST_TIMEOUT_MS = 5 * 60 * 1000;
export const VIDEO_EDITOR_POLL_REQUEST_TIMEOUT_MS = 2 * 60 * 1000;
export const VIDEO_EDITOR_MEDIA_TRANSFER_TIMEOUT_MS = 10 * 60 * 1000;
export const VIDEO_EDITOR_MAX_BYTES = 100 * 1024 * 1024;
export const VIDEO_EDITOR_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const VIDEO_EDITOR_FILE_RECOVERY_LIMIT = 2;
export const GEMINI_OMNI_INPUT_USD_PER_MILLION_TOKENS = 1.5;
export const GEMINI_OMNI_TEXT_OUTPUT_USD_PER_MILLION_TOKENS = 9;
export const GEMINI_OMNI_VIDEO_OUTPUT_USD_PER_MILLION_TOKENS = 17.5;
export const GEMINI_OMNI_VIDEO_TOKENS_PER_SECOND = 5_792;

export const VIDEO_EDITOR_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm'
]);

export const VIDEO_EDITOR_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp'
]);

export function buildGoogleFileUploadConfig(mimeType, sizeBytes) {
  const normalizedMimeType = String(mimeType || '').trim().toLowerCase();
  const normalizedSizeBytes = Number(sizeBytes);
  if (!normalizedMimeType || !Number.isFinite(normalizedSizeBytes) || normalizedSizeBytes < 0) {
    throw new TypeError('Google file upload requires a MIME type and file size.');
  }

  // @google/genai replaces its resumable-upload defaults when request-level
  // httpOptions are supplied. Preserve those required headers while keeping
  // the longer Railway transfer timeout.
  return {
    mimeType: normalizedMimeType,
    httpOptions: {
      apiVersion: '',
      timeout: VIDEO_EDITOR_MEDIA_TRANSFER_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(normalizedSizeBytes),
        'X-Goog-Upload-Header-Content-Type': normalizedMimeType
      }
    }
  };
}

function parseJsonError(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(normalized);
    return parsed?.error && typeof parsed.error === 'object' ? parsed.error : parsed;
  } catch {
    return null;
  }
}

export function normalizeGoogleApiError(error) {
  const parsed = parseJsonError(error?.message);
  const rawStatus = error?.statusCode
    ?? error?.status
    ?? parsed?.code
    ?? (typeof error?.code === 'number' ? error.code : undefined);
  const status = Number(rawStatus) || undefined;
  const parsedMessage = String(parsed?.message || '').trim();
  const rawMessage = String(error?.message || '').trim();
  const message = parsedMessage || (parseJsonError(rawMessage) ? '' : rawMessage);
  return { status, message };
}

export function isGoogleFileNotFoundError(error) {
  return normalizeGoogleApiError(error).status === 404;
}

export function friendlyGoogleApiError(error) {
  const { status, message } = normalizeGoogleApiError(error);
  if (status === 404) {
    return 'Google Gemini không còn tìm thấy tệp video. Hệ thống đã thử tải lại nhưng chưa thành công.';
  }
  if (status === 429) {
    return 'Google Gemini đang giới hạn lượt xử lý hoặc tài khoản đã hết quota. Vui lòng thử lại sau.';
  }
  if (status === 401 || status === 403) {
    return 'GEMINI_API_KEY không hợp lệ hoặc chưa được cấp quyền dùng AI Video Editor.';
  }
  return message || 'Google Gemini không thể xử lý video ở thời điểm này.';
}

export function normalizeOwnedVideoInputPath(ownerId, bucket, storagePath) {
  const normalizedOwnerId = String(ownerId || '').trim().toLowerCase();
  const normalizedBucket = String(bucket || '').trim();
  const normalizedPath = String(storagePath || '').trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(normalizedOwnerId)
    || normalizedBucket !== VIDEO_EDITOR_SOURCE_BUCKET
    || !normalizedPath
    || normalizedPath.length > 1_000
    || normalizedPath.includes('\\')
    || !/^[a-z0-9._/-]+$/i.test(normalizedPath)
    || /[\u0000-\u001f\u007f]/.test(normalizedPath)
  ) return '';

  const segments = normalizedPath.split('/');
  if (
    segments.length < 3
    || segments[0].toLowerCase() !== normalizedOwnerId
    || segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) return '';
  return normalizedPath;
}

export function buildGeminiVideoEditRequest({
  prompt,
  mode = 'edit-video',
  fileUri,
  imageData,
  mimeType = 'video/mp4',
  previousInteractionId,
  aspectRatio = '16:9'
}) {
  const input = previousInteractionId
    ? prompt
    : mode === 'text-to-video'
      ? prompt
      : mode === 'image-to-video'
        ? [
            { type: 'image', data: imageData, mime_type: mimeType },
            { type: 'text', text: prompt }
          ]
        : [
        {
          type: 'document',
          uri: fileUri,
          mime_type: mimeType
        },
        { type: 'text', text: prompt }
      ];

  // Gemini's uploaded-video edit flow infers the task from the File API URI.
  // Forcing `task: edit` currently makes the provider validate the document as
  // if it were an inline video and reject it with "Exactly one input video".
  const task = mode === 'image-to-video'
    ? 'image_to_video'
    : mode === 'text-to-video' ? 'text_to_video' : null;

  return {
    model: GEMINI_VIDEO_EDITOR_MODEL,
    input,
    store: true,
    background: true,
    response_format: {
      type: 'video',
      delivery: 'uri',
      aspect_ratio: aspectRatio === '9:16' ? '9:16' : '16:9'
    },
    ...(task ? { generation_config: { video_config: { task } } } : {}),
    ...(previousInteractionId ? { previous_interaction_id: previousInteractionId } : {})
  };
}

function numericValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function modalityTokens(entries, modality) {
  return (Array.isArray(entries) ? entries : []).reduce((total, entry) => (
    String(entry?.modality || '').toLowerCase() === modality
      ? total + numericValue(entry?.tokens)
      : total
  ), 0);
}

export function readMp4DurationSeconds(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  for (let index = 4; index + 32 < buffer.length; index += 1) {
    if (buffer.toString('ascii', index, index + 4) !== 'mvhd') continue;
    const version = buffer[index + 4];
    if (version === 1 && index + 36 <= buffer.length) {
      const timescale = buffer.readUInt32BE(index + 24);
      const duration = Number(buffer.readBigUInt64BE(index + 28));
      return timescale > 0 && duration >= 0 ? duration / timescale : null;
    }
    if (version === 0 && index + 24 <= buffer.length) {
      const timescale = buffer.readUInt32BE(index + 16);
      const duration = buffer.readUInt32BE(index + 20);
      return timescale > 0 ? duration / timescale : null;
    }
  }
  return null;
}

export function calculateVideoTelemetry(usage, videoBuffer) {
  const inputTokens = numericValue(usage?.total_input_tokens);
  const outputVideoTokens = modalityTokens(usage?.output_tokens_by_modality, 'video');
  const outputTextTokens = modalityTokens(usage?.output_tokens_by_modality, 'text');
  const unclassifiedOutputTokens = outputVideoTokens || outputTextTokens
    ? 0
    : numericValue(usage?.total_output_tokens);
  const parsedDuration = readMp4DurationSeconds(videoBuffer);
  const outputDurationSeconds = outputVideoTokens > 0
    ? outputVideoTokens / GEMINI_OMNI_VIDEO_TOKENS_PER_SECOND
    : parsedDuration;
  const outputCost = (
    outputVideoTokens * GEMINI_OMNI_VIDEO_OUTPUT_USD_PER_MILLION_TOKENS
    + outputTextTokens * GEMINI_OMNI_TEXT_OUTPUT_USD_PER_MILLION_TOKENS
    + unclassifiedOutputTokens * GEMINI_OMNI_VIDEO_OUTPUT_USD_PER_MILLION_TOKENS
  ) / 1_000_000;
  const estimatedCostUsd = (
    inputTokens * GEMINI_OMNI_INPUT_USD_PER_MILLION_TOKENS / 1_000_000
    + outputCost
  );
  const durationFallbackCost = outputDurationSeconds
    ? outputDurationSeconds * 0.1
    : 0;

  return {
    inputTokens,
    outputVideoTokens: outputVideoTokens || unclassifiedOutputTokens,
    outputDurationSeconds: outputDurationSeconds || null,
    estimatedCostUsd: estimatedCostUsd || durationFallbackCost || null
  };
}

export function createVideoEditorTicket(payload, secret) {
  if (!secret) throw new TypeError('Video editor ticket secret is required');
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyVideoEditorTicket(ticket, secret) {
  if (!secret || typeof ticket !== 'string' || ticket.length > 64_000) return null;
  const separatorIndex = ticket.lastIndexOf('.');
  if (separatorIndex <= 0) return null;
  const encoded = ticket.slice(0, separatorIndex);
  const signature = ticket.slice(separatorIndex + 1);
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest();
  let provided;
  try {
    provided = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function videoContentToResult(value) {
  if (!value) return null;
  const mimeType = value.mime_type || value.mimeType || 'video/mp4';
  if (value.data) return { base64: value.data, mimeType };
  if (value.uri && /^https:\/\//.test(String(value.uri))) {
    return { uri: String(value.uri), mimeType };
  }
  const inline = value.inlineData || value.inline_data;
  if (inline?.data) {
    return {
      base64: inline.data,
      mimeType: inline.mimeType || inline.mime_type || mimeType
    };
  }
  return null;
}

export function extractVideoFromInteraction(interaction) {
  const primary = videoContentToResult(interaction?.output_video);
  if (primary) return primary;

  for (const step of Array.isArray(interaction?.steps) ? interaction.steps : []) {
    for (const content of Array.isArray(step?.content) ? step.content : []) {
      if (
        content?.type === 'video'
        || String(content?.mime_type || content?.mimeType || '').startsWith('video/')
      ) {
        const result = videoContentToResult(content);
        if (result) return result;
      }
    }
  }

  for (const output of Array.isArray(interaction?.outputs) ? interaction.outputs : []) {
    const candidates = Array.isArray(output?.parts)
      ? output.parts
      : Array.isArray(output?.content) ? output.content : [output];
    for (const candidate of candidates) {
      const result = videoContentToResult(candidate);
      if (result) return result;
    }
  }
  return null;
}
