export interface CompressImageOptions {
  /** Cạnh dài nhất của ảnh sau khi nén (px). */
  maxDimension?: number;
  /** Dung lượng tối đa của data URL sau khi nén (byte). */
  maxBytes?: number;
  /** Chất lượng khởi điểm khi encode JPEG (0-1). */
  quality?: number;
}

const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_MAX_BYTES = 1_200_000;
const DEFAULT_QUALITY = 0.85;
const MIN_QUALITY = 0.4;
const MAX_SOURCE_BYTES = 30 * 1024 * 1024;

/** Ước lượng số byte thật của một data URL base64. */
export function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

async function loadBitmap(file: File): Promise<{ width: number; height: number; source: CanvasImageSource; release: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      source: bitmap,
      release: () => bitmap.close()
    };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Không đọc được nội dung ảnh.'));
      element.src = objectUrl;
    });
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      source: image,
      release: () => URL.revokeObjectURL(objectUrl)
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function drawToDataUrl(
  source: CanvasImageSource,
  width: number,
  height: number,
  quality: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Trình duyệt không hỗ trợ nén ảnh (canvas 2d).');
  // JPEG không có alpha nên nền trong suốt phải được tô trắng trước.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Thu nhỏ + nén ảnh về data URL đủ nhẹ để gửi kèm request JSON.
 * Trần dung lượng do phía gọi quyết định (Banner Ads: 4MB/ảnh, tổng request 45MB
 * so với giới hạn body 50MB của server).
 * Ảnh tham chiếu cho AI không cần độ phân giải gốc, nên đây là cách an toàn
 * để tránh lỗi 413 (payload too large) khi upload ảnh chụp từ điện thoại.
 */
export async function compressImageFile(
  file: File,
  options: CompressImageOptions = {}
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Tệp tải lên không phải là ảnh hợp lệ (PNG, JPG, WebP).');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error(`Ảnh gốc quá lớn (${formatBytes(file.size)}). Vui lòng chọn ảnh dưới ${formatBytes(MAX_SOURCE_BYTES)}.`);
  }

  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const startQuality = options.quality ?? DEFAULT_QUALITY;

  const { width, height, source, release } = await loadBitmap(file);
  try {
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    let targetWidth = width * scale;
    let targetHeight = height * scale;
    let best = '';

    for (let pass = 0; pass < 4; pass += 1) {
      for (let quality = startQuality; quality >= MIN_QUALITY - 0.001; quality -= 0.15) {
        const dataUrl = drawToDataUrl(source, targetWidth, targetHeight, Number(quality.toFixed(2)));
        best = dataUrl;
        if (estimateDataUrlBytes(dataUrl) <= maxBytes) return dataUrl;
      }
      targetWidth *= 0.75;
      targetHeight *= 0.75;
    }

    if (best && estimateDataUrlBytes(best) <= maxBytes * 1.5) return best;
    throw new Error('Không thể nén ảnh xuống mức cho phép. Vui lòng chọn ảnh có kích thước nhỏ hơn.');
  } finally {
    release();
  }
}
