import { supabase } from '../lib/supabase';
import {
  getAuthenticatedAccessToken
} from '../lib/authSession.mjs';

export class ApiClientError<TPayload = Record<string, unknown>> extends Error {
  readonly status: number;
  readonly code?: string;
  readonly payload: TPayload;

  constructor(
    message: string,
    options: {
      status: number;
      code?: string;
      payload: TPayload;
    }
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = options.status;
    this.code = options.code;
    this.payload = options.payload;
  }
}

export async function authenticatedFetch(path: string, init: RequestInit = {}) {
  const sendRequest = async (accessToken: string) => {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    return fetch(path, { ...init, headers, credentials: 'same-origin' });
  };

  let accessToken = await getAuthenticatedAccessToken(supabase.auth);
  let response = await sendRequest(accessToken);
  if (response.status === 401) {
    accessToken = await getAuthenticatedAccessToken(supabase.auth, { forceRefresh: true });
    response = await sendRequest(accessToken);
  }
  // Đọc body dạng text trước: API luôn trả JSON, nên khi nhận về HTML nghĩa là
  // response đến từ một lớp trung gian (proxy / CDN / firewall / SPA fallback)
  // chứ không phải từ Express — cần lộ rõ thông tin đó thay vì nuốt lỗi.
  const rawBody = await response.text().catch(() => '');
  const isHtmlBody = /^\s*<(!doctype|html)/i.test(rawBody);
  let payload: any = {};
  if (rawBody.trim() && !isHtmlBody) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = {};
    }
  }

  if (isHtmlBody) {
    const upstream = response.headers.get('server') || response.headers.get('x-served-by') || 'không xác định';
    console.error(
      `[apiClient] ${path} trả về HTML (status ${response.status}, server: ${upstream}).`,
      rawBody.slice(0, 500)
    );
    throw new ApiClientError(describeHtmlResponse(response.status, upstream), {
      status: response.status,
      code: 'non_json_response',
      payload: { rawBody: rawBody.slice(0, 2000), upstream }
    });
  }

  if (!response.ok) {
    throw new ApiClientError(
      payload.error || payload.message || describeStatus(response.status),
      {
        status: response.status,
        code: typeof payload.code === 'string' ? payload.code : undefined,
        payload
      }
    );
  }
  return payload;
}

function describeStatus(status: number): string {
  if (status === 403) {
    return 'Yêu cầu bị từ chối (403). Tài khoản không có quyền, hoặc request bị lớp bảo vệ trước máy chủ chặn.';
  }
  if (status === 413) {
    return 'Dữ liệu tải lên quá lớn so với giới hạn của máy chủ. Vui lòng dùng ảnh/nội dung nhẹ hơn rồi thử lại.';
  }
  return `Yêu cầu thất bại (${status}).`;
}

function describeHtmlResponse(status: number, upstream: string): string {
  if (status === 403) {
    return `Request bị chặn ở lớp trung gian (403 từ "${upstream}"), không đến được API. Thường do WAF/firewall của CDN chặn request có body lớn — cần nới rule hoặc tăng giới hạn upload ở lớp đó.`;
  }
  if (status === 413) {
    return `Body vượt giới hạn của lớp trung gian (413 từ "${upstream}"), request bị chặn trước khi tới API.`;
  }
  return `Máy chủ trả về trang HTML thay vì dữ liệu JSON (status ${status}, từ "${upstream}"). Kiểm tra cấu hình proxy/định tuyến của /api.`;
}
