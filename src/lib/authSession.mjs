export const AUTH_SESSION_REFRESH_BUFFER_SECONDS = 90;

const refreshRequests = new WeakMap();
const clearSessionRequests = new WeakMap();

export class AuthSessionExpiredError extends Error {
  constructor() {
    super('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    this.name = 'AuthSessionExpiredError';
    this.code = 'auth_session_expired';
  }
}

async function clearLocalSession(auth) {
  const existingRequest = clearSessionRequests.get(auth);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    try {
      await auth.signOut({ scope: 'local' });
    } catch {
      // The local auth state will also be cleared by the next successful login.
    }
  })();
  clearSessionRequests.set(auth, request);
  try {
    return await request;
  } finally {
    if (clearSessionRequests.get(auth) === request) clearSessionRequests.delete(auth);
  }
}

async function refreshSession(auth) {
  const existingRequest = refreshRequests.get(auth);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    try {
      const refreshed = await auth.refreshSession();
      return refreshed?.data?.session?.access_token ? refreshed.data.session : null;
    } catch {
      return null;
    }
  })();
  refreshRequests.set(auth, request);
  try {
    return await request;
  } finally {
    if (refreshRequests.get(auth) === request) refreshRequests.delete(auth);
  }
}

function hasUnexpiredToken(session, nowSeconds) {
  if (!session?.access_token) return false;
  const expiresAt = Number(session.expires_at || 0);
  return !expiresAt || expiresAt > nowSeconds;
}

export async function getAuthenticatedSession(
  auth,
  {
    forceRefresh = false,
    nowSeconds = Math.floor(Date.now() / 1000),
    refreshBufferSeconds = AUTH_SESSION_REFRESH_BUFFER_SECONDS
  } = {}
) {
  let session = null;
  try {
    const current = await auth.getSession();
    session = current?.data?.session || null;
  } catch {
    // A refresh below is still able to recover a persisted refresh token.
  }

  const expiresAt = Number(session?.expires_at || 0);
  const expiresSoon = Boolean(
    expiresAt && expiresAt <= nowSeconds + Math.max(0, Number(refreshBufferSeconds) || 0)
  );
  if (!forceRefresh && session?.access_token && !expiresSoon) return session;

  const refreshedSession = await refreshSession(auth);
  if (refreshedSession) return refreshedSession;

  if (!forceRefresh && hasUnexpiredToken(session, nowSeconds)) return session;

  await clearLocalSession(auth);
  throw new AuthSessionExpiredError();
}

export async function getAuthenticatedAccessToken(auth, options) {
  return (await getAuthenticatedSession(auth, options)).access_token;
}

export async function getAuthenticatedUserId(auth, options) {
  const session = await getAuthenticatedSession(auth, options);
  const userId = String(session.user?.id || '').trim();
  if (userId) return userId;
  await clearLocalSession(auth);
  throw new AuthSessionExpiredError();
}

function isAuthenticationQueryError(error) {
  const status = Number(error?.status || error?.statusCode || 0);
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return status === 401
    || /unauthorized|invalid[_ ]api[_ ]key|jwt.*(?:expired|invalid)|token.*(?:expired|invalid)/i
      .test(`${code} ${message}`);
}

export async function withAuthenticatedSupabaseRetry(auth, operation) {
  let result = await operation();
  if (!isAuthenticationQueryError(result?.error)) return result;
  await getAuthenticatedSession(auth, { forceRefresh: true });
  result = await operation();
  return result;
}
