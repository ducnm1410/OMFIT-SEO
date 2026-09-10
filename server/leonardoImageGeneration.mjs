import crypto from 'node:crypto';

export const LEONARDO_IMAGE_MODEL = 'gpt-image-2';

// Endpoint Leonardo dùng chung cho mọi tính năng. Bắt buộc có segment "/rest":
// gọi thẳng /api/v2/... sẽ bị Cloudflare của Leonardo trả về trang HTML 403.
export const LEONARDO_GENERATION_ENDPOINT = 'https://cloud.leonardo.ai/api/rest/v2/generations';
export const LEONARDO_INIT_IMAGE_ENDPOINT = 'https://cloud.leonardo.ai/api/rest/v1/init-image';

export function leonardoGenerationStatusEndpoint(generationId) {
  return `https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`;
}

/** Response của Leonardo đổi shape tuỳ model/phiên bản nên phải dò qua nhiều key. */
export function extractLeonardoGenerationId(payload) {
  return payload?.generate?.generationId
    || payload?.generationId
    || payload?.generation_id
    || payload?.id
    || payload?.data?.generate?.generationId
    || payload?.data?.generationId
    || payload?.data?.generation_id
    || payload?.data?.id
    || payload?.sdGenerationJob?.generationId
    || null;
}

export const DEFAULT_LEONARDO_ASPECT_RATIO = '16:9';
export const LEONARDO_GENERATION_TICKET_TTL_MS = 60 * 60 * 1000;
export const LEONARDO_PROVIDER_REQUEST_TIMEOUT_MS = 2 * 60 * 1000;
export const LEONARDO_MEDIA_DOWNLOAD_TIMEOUT_MS = 2 * 60 * 1000;

export const LEONARDO_ASPECT_RATIOS = Object.freeze({
  '1:1': Object.freeze({ width: 1024, height: 1024 }),
  '2:3': Object.freeze({ width: 848, height: 1264 }),
  '3:2': Object.freeze({ width: 1264, height: 848 }),
  '16:9': Object.freeze({ width: 1376, height: 768 }),
  '9:16': Object.freeze({ width: 768, height: 1376 })
});

export function resolveLeonardoAspectRatio(value = DEFAULT_LEONARDO_ASPECT_RATIO) {
  const aspectRatio = String(value || DEFAULT_LEONARDO_ASPECT_RATIO).trim();
  if (!Object.prototype.hasOwnProperty.call(LEONARDO_ASPECT_RATIOS, aspectRatio)) {
    return null;
  }
  return { aspectRatio, ...LEONARDO_ASPECT_RATIOS[aspectRatio] };
}

export function buildLeonardoGenerationRequest({
  prompt,
  aspectRatio = DEFAULT_LEONARDO_ASPECT_RATIO,
  uploadedImageId
}) {
  const dimensions = resolveLeonardoAspectRatio(aspectRatio);
  if (!dimensions) throw new TypeError(`Unsupported Leonardo aspect ratio: ${aspectRatio}`);

  return {
    public: false,
    model: LEONARDO_IMAGE_MODEL,
    parameters: {
      quality: 'MEDIUM',
      prompt,
      quantity: 1,
      width: dimensions.width,
      height: dimensions.height,
      prompt_enhance: 'OFF',
      ...(uploadedImageId ? {
        guidances: {
          image_reference: [{
            image: { id: uploadedImageId, type: 'UPLOADED' }
          }]
        }
      } : {})
    }
  };
}

/**
 * Leonardo có thể trả HTTP 200 kèm mảng lỗi kiểu GraphQL (VALIDATION_ERROR...),
 * nên không thể chỉ dựa vào res.ok để biết yêu cầu có thành công hay không.
 */
export function extractLeonardoErrorMessage(payload) {
  const entries = Array.isArray(payload) ? payload : [payload];
  for (const entry of entries) {
    const details = entry?.extensions?.details;
    const message = details?.errors?.[0]?.message
      || details?.message
      || entry?.error?.message
      || entry?.message
      || (typeof entry?.error === 'string' ? entry.error : null);
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  return null;
}

export function createLeonardoGenerationTicket(job, secret) {
  if (!secret) throw new TypeError('Leonardo generation ticket secret is required');
  const payload = Buffer.from(JSON.stringify(job)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyLeonardoGenerationTicket(ticket, secret) {
  if (!secret || typeof ticket !== 'string' || ticket.length > 64_000) return null;
  const separatorIndex = ticket.lastIndexOf('.');
  if (separatorIndex <= 0) return null;
  const payload = ticket.slice(0, separatorIndex);
  const signature = ticket.slice(separatorIndex + 1);
  const expected = crypto.createHmac('sha256', secret).update(payload).digest();
  let provided;
  try {
    provided = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return null;
  }
  try {
    const job = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return job && typeof job === 'object' ? job : null;
  } catch {
    return null;
  }
}
