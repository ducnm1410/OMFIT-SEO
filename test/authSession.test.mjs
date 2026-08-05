import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  AuthSessionExpiredError,
  getAuthenticatedAccessToken,
  getAuthenticatedSession,
  getAuthenticatedUserId,
  withAuthenticatedSupabaseRetry
} from '../src/lib/authSession.mjs';

function createAuth({ currentSession = null, refreshedSession = null, refreshError = null } = {}) {
  const calls = [];
  return {
    calls,
    async getSession() {
      calls.push('getSession');
      return { data: { session: currentSession }, error: null };
    },
    async refreshSession() {
      calls.push('refreshSession');
      return { data: { session: refreshedSession }, error: refreshError };
    },
    async signOut(options) {
      calls.push(['signOut', options]);
      return { error: null };
    }
  };
}

test('session còn hạn được tái sử dụng mà không refresh', async () => {
  const auth = createAuth({
    currentSession: {
      access_token: 'current-token',
      expires_at: 2_000,
      user: { id: 'user-1' }
    }
  });
  const session = await getAuthenticatedSession(auth, { nowSeconds: 1_000 });
  assert.equal(session.access_token, 'current-token');
  assert.deepEqual(auth.calls, ['getSession']);
  assert.equal(await getAuthenticatedUserId(auth, { nowSeconds: 1_000 }), 'user-1');
});

test('session sắp hết hạn được refresh trước khi AI Editor gọi API', async () => {
  const auth = createAuth({
    currentSession: {
      access_token: 'old-token',
      expires_at: 1_030,
      user: { id: 'user-1' }
    },
    refreshedSession: {
      access_token: 'fresh-token',
      expires_at: 2_000,
      user: { id: 'user-1' }
    }
  });
  assert.equal(
    await getAuthenticatedAccessToken(auth, { nowSeconds: 1_000 }),
    'fresh-token'
  );
  assert.deepEqual(auth.calls, ['getSession', 'refreshSession']);
});

test('retry 401 buộc refresh dù access token cũ vẫn còn hạn', async () => {
  const auth = createAuth({
    currentSession: {
      access_token: 'rejected-token',
      expires_at: 2_000,
      user: { id: 'user-1' }
    },
    refreshedSession: {
      access_token: 'replacement-token',
      expires_at: 3_000,
      user: { id: 'user-1' }
    }
  });
  const session = await getAuthenticatedSession(auth, {
    forceRefresh: true,
    nowSeconds: 1_000
  });
  assert.equal(session.access_token, 'replacement-token');
  assert.deepEqual(auth.calls, ['getSession', 'refreshSession']);
});

test('query Supabase 401 refresh session rồi chạy lại đúng một lần', async () => {
  const auth = createAuth({
    currentSession: {
      access_token: 'rejected-token',
      expires_at: 2_000,
      user: { id: 'user-1' }
    },
    refreshedSession: {
      access_token: 'replacement-token',
      expires_at: 3_000,
      user: { id: 'user-1' }
    }
  });
  let queryCalls = 0;
  const result = await withAuthenticatedSupabaseRetry(auth, async () => {
    queryCalls += 1;
    return queryCalls === 1
      ? { data: null, error: { status: 401, code: 'UNAUTHORIZED_INVALID_API_KEY' } }
      : { data: ['restored'], error: null };
  });
  assert.deepEqual(result, { data: ['restored'], error: null });
  assert.equal(queryCalls, 2);
  assert.deepEqual(auth.calls, ['getSession', 'refreshSession']);
});

test('refresh token hết hạn sẽ xóa session local và yêu cầu đăng nhập lại', async () => {
  const auth = createAuth({
    currentSession: null,
    refreshedSession: null,
    refreshError: new Error('refresh token invalid')
  });
  await assert.rejects(
    () => getAuthenticatedSession(auth, { nowSeconds: 1_000 }),
    (error) => error instanceof AuthSessionExpiredError
      && error.code === 'auth_session_expired'
  );
  assert.deepEqual(auth.calls, [
    'getSession',
    'refreshSession',
    ['signOut', { scope: 'local' }]
  ]);
});

test('mọi luồng dữ liệu dùng chung session helper thay cho getUser trực tiếp', async () => {
  const [apiClient, videoEditor, contentRepository, keywordResearch, app] = await Promise.all([
    readFile(new URL('../src/services/apiClient.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/videoEditorService.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/contentRepository.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/keywordResearchService.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  ]);
  assert.match(apiClient, /response\.status === 401[\s\S]*forceRefresh: true/);
  assert.match(videoEditor, /withAuthenticatedSupabaseRetry/);
  assert.match(contentRepository, /withAuthenticatedSupabaseRetry/);
  assert.doesNotMatch(videoEditor, /supabase\.auth\.getUser\(/);
  assert.doesNotMatch(contentRepository, /supabase\.auth\.getUser\(/);
  assert.doesNotMatch(keywordResearch, /supabase\.auth\.getSession\(/);
  assert.match(app, /getAuthenticatedSession\(\s*supabase\.auth,\s*\{ forceRefresh: true \}\s*\)/);
  assert.match(app, /event === 'INITIAL_SESSION'/);
  assert.ok(
    app.indexOf('await getAuthenticatedSession')
      < app.indexOf('supabase.auth.onAuthStateChange'),
    'listener phải được đăng ký sau khi session ban đầu đã refresh xong'
  );
});
