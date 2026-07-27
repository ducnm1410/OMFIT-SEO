import type { GeneratedArticle, SeoAuditResult } from '../types';
import { authenticatedFetch } from './apiClient';

export interface PublishPostResult {
  postId: number;
  postUrl: string;
  status: string;
  title?: string;
  featuredMediaId?: number;
  logs: string[];
  audit?: SeoAuditResult;
  contentHtml?: string;
  slug?: string;
}

export class WordpressMcpService {
  constructor(_legacySiteUrl?: string) {}

  async publishArticleWithMcp(
    article: GeneratedArticle,
    status: 'draft' | 'publish' = 'publish',
    options: { reviewerConfirmed?: boolean } = {}
  ): Promise<PublishPostResult> {
    return authenticatedFetch('/api/wordpress/publish', {
      method: 'POST',
      body: JSON.stringify({
        article,
        status,
        reviewerConfirmed: options.reviewerConfirmed === true
      })
    }) as Promise<PublishPostResult>;
  }
}
