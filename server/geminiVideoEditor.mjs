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
export const VIDEO_EDITOR_FILE_RECOVERY_LIMIT = 2;

export const VIDEO_EDITOR_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm'
]);

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
  fileUri,
  mimeType = 'video/mp4',
  previousInteractionId,
  resolution = '720p',
  includeResolution = true
}) {
  const mediaResolution = resolution === '1080p' ? 'ultra_high' : 'high';
  const input = previousInteractionId
    ? prompt
    : [
        {
          type: 'document',
          uri: fileUri,
          mime_type: mimeType,
          ...(includeResolution ? { resolution: mediaResolution } : {})
        },
        { type: 'text', text: prompt }
      ];

  return {
    model: GEMINI_VIDEO_EDITOR_MODEL,
    input,
    store: true,
    background: true,
    response_format: { type: 'video', delivery: 'uri' },
    ...(previousInteractionId ? { previous_interaction_id: previousInteractionId } : {})
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
