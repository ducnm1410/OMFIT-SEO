import type { KeywordResearchResponse } from '../types';

interface AnalyzeKeywordInput {
  query: string;
  industry: string;
  pageUrl?: string;
}

export async function analyzeKeywords(input: AnalyzeKeywordInput): Promise<KeywordResearchResponse> {
  const response = await fetch('/api/keywords/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const missing = Array.isArray(payload.missing) ? ` Thiếu: ${payload.missing.join(', ')}.` : '';
    throw new Error(`${payload.error || 'Không thể lấy dữ liệu keyword.'}${missing}`);
  }

  return payload as KeywordResearchResponse;
}
