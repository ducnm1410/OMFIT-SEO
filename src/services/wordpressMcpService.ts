import type { GeneratedArticle, SeoAuditResult } from '../types';
import { ApiClientError, authenticatedFetch } from './apiClient';

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
  seoDiscovery?: PostPublishSeoResult;
}

export interface PostPublishSeoResult {
  publicPage: {
    ok: boolean;
    httpStatus?: number;
    canonical?: string;
    canonicalMatches?: boolean;
    noindex?: boolean;
    h1Count?: number;
    error?: string;
  };
  sitemap: {
    found: boolean;
    sitemapIndexUrl?: string;
    sitemapUrl?: string;
    error?: string;
  };
  google: {
    configured: boolean;
    missing: string[];
    sitemapSubmitted: boolean;
    inspection: null | {
      verdict: string;
      coverageState: string;
      indexingState: string;
      pageFetchState: string;
      lastCrawlTime: string;
      googleCanonical: string;
      userCanonical: string;
    };
    error: string;
  };
}

interface MediaSyncResult {
  mediaSyncComplete: boolean;
  syncedMediaCount: number;
  remainingMediaCount: number;
  pendingMediaCount: number;
  nextMediaSyncCursor: number;
  logs: string[];
}

interface PublishOptions {
  reviewerConfirmed?: boolean;
  onProgress?: (message: string) => void;
}

function uniqueArticleMediaCount(article: GeneratedArticle) {
  const ids = [
    article.featuredImage?.id,
    ...(article.articleImages || []).map((image) => image.id)
  ].map((id) => String(id || '').trim()).filter(Boolean);
  return new Set(ids).size;
}

function mergeUniqueLogs(...groups: Array<string[] | undefined>) {
  return [...new Set(groups.flatMap((group) => group || []).filter(Boolean))];
}

function waitForWordpressRetry() {
  return new Promise((resolve) => window.setTimeout(resolve, 750));
}

export class WordpressMcpService {
  constructor(_legacySiteUrl?: string) {}

  async publishArticleWithMcp(
    article: GeneratedArticle,
    status: 'draft' | 'publish' = 'publish',
    options: PublishOptions = {}
  ): Promise<PublishPostResult> {
    const mediaCount = uniqueArticleMediaCount(article);
    const syncLogs: string[] = [];

    if (mediaCount > 0) {
      // The server synchronizes at most three missing assets per invocation so
      // every request remains below Vercel Hobby's 60-second function limit.
      const maxSyncPasses = Math.max(4, (Math.ceil(mediaCount / 3) * 2) + 3);
      let mediaSyncComplete = false;
      let mediaSyncCursor = 0;
      for (let pass = 1; pass <= maxSyncPasses && !mediaSyncComplete; pass += 1) {
        try {
          options.onProgress?.(`Đang chuẩn bị hình ảnh trên WordPress (lượt ${pass})…`);
          const mediaResult = await authenticatedFetch('/api/wordpress/publish', {
            method: 'POST',
            body: JSON.stringify({
              article,
              status,
              reviewerConfirmed: options.reviewerConfirmed === true,
              syncMediaOnly: true,
              mediaSyncCursor
            })
          }) as MediaSyncResult;
          syncLogs.push(...(mediaResult.logs || []));
          mediaSyncComplete = mediaResult.mediaSyncComplete;
          mediaSyncCursor = Math.max(
            mediaSyncCursor,
            Number(mediaResult.nextMediaSyncCursor || 0)
          );
          if (!mediaSyncComplete) {
            options.onProgress?.(
              `Đã chuẩn bị một nhóm ảnh, còn ${mediaResult.remainingMediaCount} ảnh cần đồng bộ…`
            );
          }
        } catch (error) {
          if (
            error instanceof ApiClientError
            && error.code === 'wordpress_publish_deadline_exceeded'
            && pass < maxSyncPasses
          ) {
            options.onProgress?.('WordPress xử lý ảnh lâu hơn dự kiến; đang tiếp tục an toàn…');
            await waitForWordpressRetry();
            continue;
          }
          throw error;
        }
      }
      if (!mediaSyncComplete) {
        throw new Error(
          'WordPress chưa hoàn tất chuẩn bị hình ảnh sau nhiều lượt. Vui lòng thử lại; các ảnh đã xong sẽ không bị tải trùng.'
        );
      }
    }

    const maxPublishAttempts = 2;
    for (let attempt = 1; attempt <= maxPublishAttempts; attempt += 1) {
      try {
        options.onProgress?.(
          attempt === 1 ? 'Đang gửi nội dung bài viết lên WordPress…' : 'Đang tiếp tục bước đăng bài cuối…'
        );
        const result = await authenticatedFetch('/api/wordpress/publish', {
          method: 'POST',
          body: JSON.stringify({
            article,
            status,
            reviewerConfirmed: options.reviewerConfirmed === true
          })
        }) as PublishPostResult;
        let seoDiscovery: PostPublishSeoResult | undefined;
        const resultLogs = mergeUniqueLogs(syncLogs, result.logs);
        if (status === 'publish') {
          options.onProgress?.('Đang xác minh URL công khai, sitemap và Search Console…');
          try {
            seoDiscovery = await authenticatedFetch('/api/wordpress/post-publish-seo', {
              method: 'POST',
              body: JSON.stringify({ postUrl: result.postUrl })
            }) as PostPublishSeoResult;
            if (seoDiscovery.publicPage.ok) resultLogs.push('URL công khai hợp lệ: HTTP, canonical, robots và H1 đã đạt.');
            else resultLogs.push('Cảnh báo: URL công khai chưa vượt qua toàn bộ hậu kiểm SEO.');
            if (seoDiscovery.sitemap.found) resultLogs.push('Bài viết đã xuất hiện trong WordPress sitemap.');
            else resultLogs.push('Cảnh báo: chưa tìm thấy bài viết trong WordPress sitemap.');
            if (seoDiscovery.google.sitemapSubmitted) {
              resultLogs.push('Đã tự động gửi lại sitemap cho Google Search Console.');
            } else if (!seoDiscovery.google.configured) {
              resultLogs.push('Search Console chưa cấu hình; bài vẫn được Google khám phá qua sitemap.');
            } else if (seoDiscovery.google.error) {
              resultLogs.push(`Search Console: ${seoDiscovery.google.error}`);
            }
          } catch (error) {
            const detail = error instanceof Error ? error.message : 'Không thể chạy hậu kiểm.';
            resultLogs.push(`Bài đã đăng nhưng hậu kiểm SEO chưa hoàn tất: ${detail}`);
          }
        }
        return {
          ...result,
          logs: resultLogs,
          seoDiscovery
        };
      } catch (error) {
        if (
          error instanceof ApiClientError
          && error.code === 'wordpress_publish_timeout'
        ) {
          throw new ApiClientError(
            `${error.message} Hệ thống không tự đăng lại để tránh tạo bài trùng; hãy kiểm tra danh sách bài WordPress trước khi thử lại.`,
            {
              status: error.status,
              code: error.code,
              payload: error.payload
            }
          );
        }
        const canSafelyContinue = (
          error instanceof ApiClientError
          && error.code === 'wordpress_publish_deadline_exceeded'
          && attempt < maxPublishAttempts
        );
        if (!canSafelyContinue) throw error;
        await waitForWordpressRetry();
      }
    }

    throw new Error('Không thể hoàn tất bước đăng bài WordPress.');
  }
}
