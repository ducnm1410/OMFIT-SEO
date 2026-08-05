export const AUTH_SESSION_REFRESH_BUFFER_SECONDS = 90;

export class AuthSessionExpiredError extends Error {
  constructor() {
    super('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    this.name = 'AuthSessionExpiredError';
    this.code = 'auth_session_expired';
  }
}

async function clearLocalSession(auth) {
  try {
    await auth.signOut({ scope: 'local' });
  } catch {
    // The local auth state will also be cleared by the next successful login.
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

  try {
    const refreshed = await auth.refreshSession();
    if (refreshed?.data?.session?.access_token) return refreshed.data.session;
  } catch {
    // A still-valid access token can be used until its actual expiry.
  }

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
