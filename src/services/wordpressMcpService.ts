import type { GeneratedArticle } from '../types';
import { authenticatedFetch } from './apiClient';

export interface PublishPostResult {
  postId: number;
  postUrl: string;
  status: string;
  featuredMediaId?: number;
  logs: string[];
}

export class WordpressMcpService {
  constructor(_legacySiteUrl?: string) {}

  async publishArticleWithMcp(
    article: GeneratedArticle,
    status: 'draft' | 'publish' = 'publish'
  ): Promise<PublishPostResult> {
    return authenticatedFetch('/api/wordpress/publish', {
      method: 'POST',
      body: JSON.stringify({ article, status })
    }) as Promise<PublishPostResult>;
  }
}
