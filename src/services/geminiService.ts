import type { GeneratedArticle, SeoOutline } from '../types';
import { authenticatedFetch } from './apiClient';

export class GeminiService {
  constructor(_legacyBrowserKey?: string) {}

  async generateOutline(
    keyword: string,
    tone = 'Chuyên nghiệp, truyền cảm hứng, cân bằng'
  ): Promise<SeoOutline> {
    return authenticatedFetch('/api/content/outline', {
      method: 'POST',
      body: JSON.stringify({ keyword, tone })
    }) as Promise<SeoOutline>;
  }

  async generateFullArticle(
    outline: SeoOutline,
    targetWordCount = 1500
  ): Promise<GeneratedArticle> {
    return authenticatedFetch('/api/content/article', {
      method: 'POST',
      body: JSON.stringify({ outline, targetWordCount })
    }) as Promise<GeneratedArticle>;
  }
}
