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
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiClientError(
      payload.error || payload.message || `Yêu cầu thất bại (${response.status}).`,
      {
        status: response.status,
        code: typeof payload.code === 'string' ? payload.code : undefined,
        payload
      }
    );
  }
  return payload;
}
