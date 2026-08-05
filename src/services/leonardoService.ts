import type { GeneratedImage, ImageAspectRatio } from '../types';
import { authenticatedFetch } from './apiClient';

interface LeonardoGenerationOptions {
  keyword?: string;
  articleId?: string;
  logoAssetId?: string;
  aspectRatio: ImageAspectRatio;
}

export class LeonardoService {
  constructor(_legacyBrowserKey?: string) {}

  async generateImage(
    prompt: string,
    style: string,
    options: LeonardoGenerationOptions
  ): Promise<GeneratedImage> {
    return authenticatedFetch('/api/images/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        style,
        keyword: options.keyword || 'omfit-seo',
        articleId: options.articleId,
        logoAssetId: options.logoAssetId,
        aspectRatio: options.aspectRatio
      })
    }) as Promise<GeneratedImage>;
  }
}
