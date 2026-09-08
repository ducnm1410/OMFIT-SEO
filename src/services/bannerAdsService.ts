import { authenticatedFetch } from './apiClient';
import type {
  BannerAdAsset,
  BatchResult,
  ResizeResult
} from '../types';

export interface SingleBannerParams {
  competitorRef?: string | null;
  character?: string | null;
  keyMessage: string;
  language?: string;
  size: string;
  quality: string;
  redraw3D?: boolean;
}

export interface SingleBannerResponse {
  imageUrl: string;
  promptUsed: string;
}

export interface BatchBannerParams {
  batchSets: Array<{
    competitorRef?: string | null;
    character?: string | null;
    keyMessage: string;
    redraw3D?: boolean;
  }>;
  size: string;
  quality: string;
  seed?: number;
}

export interface BatchBannerResponse {
  results: BatchResult[];
  seed?: number;
}

export interface ResizeBannerParams {
  imageData: string;
  sizes: string[];
  quality: string;
  seed?: number;
}

export interface ResizeBannerResponse {
  results: ResizeResult[];
  seed?: number;
}

export interface ScanTextResponse {
  detectedText: string;
  suggestedTranslation?: string;
}

export interface LocalizeBannerParams {
  imageData: string;
  targetText: string;
  targetLanguage: string;
  size?: string;
  quality?: string;
}

export interface SaveBannerParams {
  imageUrl: string;
  prompt?: string;
  keyMessage?: string;
  size?: string;
  quality?: string;
  mode?: string;
}

export async function generateSingleBanner(params: SingleBannerParams): Promise<SingleBannerResponse> {
  const data = await authenticatedFetch('/api/banner-ads/generate-single', {
    method: 'POST',
    body: JSON.stringify(params)
  });
  return {
    imageUrl: data.imageUrl || data.imageBase64,
    promptUsed: data.promptUsed || ''
  };
}

export async function generateBatchBanners(params: BatchBannerParams): Promise<BatchBannerResponse> {
  const data = await authenticatedFetch('/api/banner-ads/generate-batch', {
    method: 'POST',
    body: JSON.stringify(params)
  });
  return {
    results: data.results || [],
    seed: data.seed
  };
}

export async function resizeBanner(params: ResizeBannerParams): Promise<ResizeBannerResponse> {
  const data = await authenticatedFetch('/api/banner-ads/resize', {
    method: 'POST',
    body: JSON.stringify(params)
  });
  return {
    results: data.results || [],
    seed: data.seed
  };
}

export async function scanBannerText(imageData: string): Promise<ScanTextResponse> {
  const data = await authenticatedFetch('/api/banner-ads/scan-text', {
    method: 'POST',
    body: JSON.stringify({ imageData })
  });
  return {
    detectedText: data.detectedText || '',
    suggestedTranslation: data.suggestedTranslation || ''
  };
}

export async function localizeBanner(params: LocalizeBannerParams): Promise<{ imageUrl: string; promptUsed?: string }> {
  const data = await authenticatedFetch('/api/banner-ads/localize', {
    method: 'POST',
    body: JSON.stringify(params)
  });
  return {
    imageUrl: data.imageUrl || data.imageBase64,
    promptUsed: data.promptUsed
  };
}

export async function loadBannerHistory(): Promise<BannerAdAsset[]> {
  const data = await authenticatedFetch('/api/banner-ads/history', {
    method: 'GET'
  });
  return Array.isArray(data.items) ? data.items : [];
}

export async function saveBannerToAssets(params: SaveBannerParams): Promise<BannerAdAsset> {
  const data = await authenticatedFetch('/api/banner-ads/save', {
    method: 'POST',
    body: JSON.stringify(params)
  });
  return data.item;
}

export async function downloadBannerImage(imageUrl: string, filename?: string): Promise<void> {
  let downloadUrl = imageUrl;
  let isBlob = false;
  try {
    if (imageUrl.startsWith('http')) {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      downloadUrl = URL.createObjectURL(blob);
      isBlob = true;
    }
  } catch (error) {
    console.warn('Không thể tạo blob tải về, chuyển hướng download trực tiếp:', error);
    downloadUrl = imageUrl;
  }

  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename || `omfit-banner-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (isBlob) {
    URL.revokeObjectURL(downloadUrl);
  }
}
