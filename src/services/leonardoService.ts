import type { GeneratedImage } from '../types';
import { authenticatedFetch } from './apiClient';

export class LeonardoService {
  constructor(_legacyBrowserKey?: string) {}

  async generateImage(
    prompt: string,
    style: string,
    referenceImage?: string,
    keyword = 'omfit-seo',
    _modelId = 'nano-banana-2',
    articleId?: string
  ): Promise<GeneratedImage> {
    return authenticatedFetch('/api/images/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt, style, referenceImage, keyword, articleId })
    }) as Promise<GeneratedImage>;
  }
}
