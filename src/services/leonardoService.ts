import type { GeneratedImage, ImageAspectRatio } from '../types';
import { ApiClientError, authenticatedFetch } from './apiClient';

interface LeonardoGenerationOptions {
  keyword?: string;
  articleId?: string;
  logoAssetId?: string;
  aspectRatio: ImageAspectRatio;
}

interface PendingLeonardoGeneration {
  status: 'pending';
  ticket: string;
}

function isPendingGeneration(value: unknown): value is PendingLeonardoGeneration {
  return Boolean(
    value
    && typeof value === 'object'
    && (value as PendingLeonardoGeneration).status === 'pending'
    && typeof (value as PendingLeonardoGeneration).ticket === 'string'
  );
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function isRetryablePollError(error: unknown) {
  if (!(error instanceof ApiClientError)) return false;
  if (error.status === 429 || error.status === 503 || error.status === 504) return true;
  if (error.status !== 502) return false;
  return !error.code || [
    'leonardo_poll_failed',
    'leonardo_download_failed',
    'image_storage_failed',
    'media_metadata_failed',
    'leonardo_media_lookup_failed'
  ].includes(error.code);
}

export class LeonardoService {
  constructor(_legacyBrowserKey?: string) {}

  async generateImage(
    prompt: string,
    style: string,
    options: LeonardoGenerationOptions
  ): Promise<GeneratedImage> {
    let result = await authenticatedFetch('/api/images/generate', {
      method: 'POST',
      body: JSON.stringify({
        operation: 'start',
        prompt,
        style,
        keyword: options.keyword || 'omfit-seo',
        articleId: options.articleId,
        logoAssetId: options.logoAssetId,
        aspectRatio: options.aspectRatio
      })
    }) as GeneratedImage | PendingLeonardoGeneration;

    for (let attempt = 0; isPendingGeneration(result) && attempt < 100; attempt += 1) {
      await wait(3000);
      try {
        result = await authenticatedFetch('/api/images/generate', {
          method: 'POST',
          body: JSON.stringify({ operation: 'poll', ticket: result.ticket })
        }) as GeneratedImage | PendingLeonardoGeneration;
      } catch (error) {
        if (!isRetryablePollError(error)) throw error;
      }
    }

    if (isPendingGeneration(result)) {
      throw new Error('GPT Image 2 vẫn đang xử lý sau 5 phút. Vui lòng thử lại sau.');
    }
    return result;
  }
}
