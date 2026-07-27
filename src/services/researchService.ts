import type { ArticleSource } from '../types';
import { authenticatedFetch } from './apiClient';

export interface ResearchSourcesResponse {
  sources: ArticleSource[];
  summary?: string;
  searchQueries?: string[];
  searchEntryPointHtml?: string;
  reusedExistingSources?: boolean;
  retryable?: boolean;
}

export interface ApplySourcesResponse {
  sources: ArticleSource[];
  contentHtml: string;
}

export function getArticleSources(articleId: string): Promise<ResearchSourcesResponse> {
  const query = new URLSearchParams({ articleId });
  return authenticatedFetch(`/api/research/sources?${query.toString()}`) as Promise<ResearchSourcesResponse>;
}

export function researchArticleSources(input: {
  articleId: string;
  title: string;
  focusKeyword: string;
  contentHtml: string;
}): Promise<ResearchSourcesResponse> {
  return authenticatedFetch('/api/research/sources', {
    method: 'POST',
    body: JSON.stringify(input)
  }) as Promise<ResearchSourcesResponse>;
}

export function applyApprovedArticleSources(input: {
  articleId: string;
  approvedSourceIds: string[];
  contentHtml: string;
}): Promise<ApplySourcesResponse> {
  return authenticatedFetch('/api/research/sources', {
    method: 'PATCH',
    body: JSON.stringify(input)
  }) as Promise<ApplySourcesResponse>;
}
