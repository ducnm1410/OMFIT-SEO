import type { GoogleAdsConnection, KeywordResearchResponse } from '../types';
import { supabase } from '../lib/supabase';

interface AnalyzeKeywordInput {
  query: string;
  industry: string;
  pageUrl?: string;
}

async function getAuthenticatedHeaders(includeJson = false) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  return {
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${accessToken}`
  };
}

export async function analyzeKeywords(input: AnalyzeKeywordInput): Promise<KeywordResearchResponse> {
  const response = await fetch('/api/keywords/analyze', {
    method: 'POST',
    credentials: 'same-origin',
    headers: await getAuthenticatedHeaders(true),
    body: JSON.stringify(input)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const missing = Array.isArray(payload.missing) ? ` Thiếu: ${payload.missing.join(', ')}.` : '';
    throw new Error(`${payload.error || 'Không thể lấy dữ liệu keyword.'}${missing}`);
  }

  return payload as KeywordResearchResponse;
}

export async function getGoogleAdsConnection(): Promise<GoogleAdsConnection> {
  const response = await fetch('/api/auth/google/status', {
    credentials: 'same-origin',
    headers: await getAuthenticatedHeaders()
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && !payload.reconnectRequired) {
    throw new Error(payload.error || 'Không thể kiểm tra kết nối Google Ads.');
  }
  return payload as GoogleAdsConnection;
}

export async function startGoogleAdsConnection() {
  const response = await fetch('/api/auth/google/start', {
    credentials: 'same-origin',
    headers: await getAuthenticatedHeaders()
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.url) {
    throw new Error(payload.error || 'Không thể bắt đầu kết nối Google Ads.');
  }
  window.location.assign(payload.url);
}

export async function selectGoogleAdsAccount(customerId: string): Promise<void> {
  const response = await fetch('/api/auth/google/select-account', {
    method: 'POST',
    credentials: 'same-origin',
    headers: await getAuthenticatedHeaders(true),
    body: JSON.stringify({ customerId })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Không thể chọn tài khoản Google Ads.');
  }
}

export async function disconnectGoogleAds(): Promise<void> {
  const response = await fetch('/api/auth/google/disconnect', {
    method: 'POST',
    credentials: 'same-origin',
    headers: await getAuthenticatedHeaders()
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Không thể ngắt kết nối Google Ads.');
  }
}
