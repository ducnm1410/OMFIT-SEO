import type { GeneratedArticle, SeoOutline } from '../types';
import { authenticatedFetch } from './apiClient';

const contentRequestTimeoutMs = 65_000;

function createTimeoutSignal(externalSignal?: AbortSignal) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort('timeout'), contentRequestTimeoutMs);
  const abortFromExternalSignal = () => controller.abort(externalSignal?.reason || 'cancelled');

  if (externalSignal?.aborted) abortFromExternalSignal();
  else externalSignal?.addEventListener('abort', abortFromExternalSignal, { once: true });

  return {
    signal: controller.signal,
    dispose: () => {
      window.clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', abortFromExternalSignal);
    }
  };
}

async function requestGeneratedContent<T>(
  path: string,
  body: Record<string, unknown>,
  externalSignal?: AbortSignal
): Promise<T> {
  const request = createTimeoutSignal(externalSignal);
  try {
    return await authenticatedFetch(path, {
      method: 'POST',
      body: JSON.stringify(body),
      signal: request.signal
    }) as T;
  } catch (error) {
    if (request.signal.aborted) {
      if (externalSignal?.aborted) {
        throw new Error('Đã dừng tạo nội dung theo yêu cầu.');
      }
      throw new Error('Gemini phản hồi quá lâu. Vui lòng thử lại sau ít phút.');
    }
    throw error;
  } finally {
    request.dispose();
  }
}

export class GeminiService {
  constructor(_legacyBrowserKey?: string) {}

  async generateOutline(
    keyword: string,
    tone = 'Chuyên nghiệp, truyền cảm hứng, cân bằng',
    secondaryKeywords: string[] = [],
    signal?: AbortSignal
  ): Promise<SeoOutline> {
    return requestGeneratedContent<SeoOutline>(
      '/api/content/outline',
      { keyword, tone, secondaryKeywords },
      signal
    );
  }

  async generateFullArticle(
    outline: SeoOutline,
    targetWordCount = 1500,
    signal?: AbortSignal
  ): Promise<GeneratedArticle> {
    return requestGeneratedContent<GeneratedArticle>(
      '/api/content/article',
      { outline, targetWordCount },
      signal
    );
  }
}
