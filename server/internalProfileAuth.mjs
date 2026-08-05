import crypto from 'node:crypto';

const INTERNAL_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const INTERNAL_LOGIN_MAX_ATTEMPTS = 10;

export class InternalProfileAuthError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function normalizeInternalPhone(value) {
  let phone = String(value || '').replace(/\D/g, '');
  if (phone.startsWith('84') && phone.length === 11) {
    phone = `0${phone.slice(2)}`;
  }
  return /^0\d{9}$/.test(phone) ? phone : '';
}

export function createInternalLoginRateLimiter({
  maxAttempts = INTERNAL_LOGIN_MAX_ATTEMPTS,
  windowMs = INTERNAL_LOGIN_WINDOW_MS
} = {}) {
  const attempts = new Map();
  return {
    consume(key, now = Date.now()) {
      const current = attempts.get(key);
      if (!current || current.resetAt <= now) {
        attempts.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, retryAfterSeconds: 0 };
      }
      if (current.count >= maxAttempts) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
        };
      }
      current.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    },
    reset(key) {
      attempts.delete(key);
    }
  };
}

function profileEmailCandidates(phone) {
  return [`${phone}@omfit.local`, `${phone}@omfit.app`];
}

async function findAuthUser(admin, profile, phone) {
  const candidateIds = [...new Set([profile.auth_user_id, profile.profile_id].filter(Boolean))];
  for (const id of candidateIds) {
    const { data, error } = await admin.auth.admin.getUserById(id);
    if (!error && data?.user) return data.user;
    if (error && Number(error.status || 0) !== 404 && error.code !== 'user_not_found') throw error;
  }

  const candidateEmails = new Set(profileEmailCandidates(phone));
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users.find((user) => candidateEmails.has(String(user.email || '').toLowerCase())) || null;
}

async function updateProfileAuthUser(admin, profileId, authUserId) {
  const { error } = await admin
    .from('profiles')
    .update({ auth_user_id: authUserId })
    .eq('id', profileId);
  if (error) throw error;
}

async function updateAuthUserMetadata(admin, user, profile) {
  const { data, error } = await admin.auth.admin.updateUserById(user.id, {
    email_confirm: true,
    user_metadata: {
      ...(user.user_metadata || {}),
      full_name: profile.full_name || user.user_metadata?.full_name || ''
    },
    app_metadata: {
      ...(user.app_metadata || {}),
      role: profile.role || 'user',
      profile_id: profile.profile_id
    }
  });
  if (error) throw error;
  return data.user;
}

export async function issueInternalProfileLogin({ admin, phoneInput, password }) {
  const phone = normalizeInternalPhone(phoneInput);
  if (!phone) {
    throw new InternalProfileAuthError(400, 'Số điện thoại không hợp lệ.', 'invalid_phone');
  }
  if (!password || String(password).length > 256) {
    throw new InternalProfileAuthError(401, 'Số điện thoại hoặc mật khẩu không đúng.', 'invalid_credentials');
  }

  const { data, error } = await admin.rpc('verify_internal_profile_credentials', {
    input_phone: phone,
    input_password: String(password)
  });
  if (error) {
    throw new InternalProfileAuthError(503, 'Chưa thể xác thực tài khoản lúc này.', 'profile_auth_unavailable');
  }
  const profile = Array.isArray(data) ? data[0] : data;
  if (!profile) {
    throw new InternalProfileAuthError(401, 'Số điện thoại hoặc mật khẩu không đúng.', 'invalid_credentials');
  }

  let user = await findAuthUser(admin, profile, phone);
  let linkData;
  if (!user) {
    const { data: generated, error: generateError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: profileEmailCandidates(phone)[0],
      options: { data: { full_name: profile.full_name || '' } }
    });
    if (generateError || !generated?.user) throw generateError || new Error('Auth user was not created.');
    user = generated.user;
    linkData = generated;
  }

  user = await updateAuthUserMetadata(admin, user, profile);
  if (profile.auth_user_id !== user.id) {
    await updateProfileAuthUser(admin, profile.profile_id, user.id);
  }

  if (!linkData) {
    const { data: generated, error: generateError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email
    });
    if (generateError) throw generateError;
    linkData = generated;
  }

  const tokenHash = String(linkData?.properties?.hashed_token || '');
  const verificationType = String(linkData?.properties?.verification_type || 'magiclink');
  if (!tokenHash) throw new Error('Supabase did not return a login token.');
  return { tokenHash, verificationType };
}

export function registerInternalProfileAuthRoute({ app, getSupabaseAdmin }) {
  const rateLimiter = createInternalLoginRateLimiter();

  app.post('/api/auth/internal-login', async (request, response) => {
    const phone = normalizeInternalPhone(request.body?.phone);
    const key = crypto.createHash('sha256').update(phone || String(request.body?.phone || '')).digest('hex');
    const rateLimit = rateLimiter.consume(key);
    if (!rateLimit.allowed) {
      response.set('Retry-After', String(rateLimit.retryAfterSeconds));
      return response.status(429).json({
        error: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng chờ rồi thử lại.',
        code: 'login_rate_limited'
      });
    }

    try {
      const result = await issueInternalProfileLogin({
        admin: getSupabaseAdmin(),
        phoneInput: request.body?.phone,
        password: request.body?.password
      });
      rateLimiter.reset(key);
      return response.json(result);
    } catch (error) {
      if (error instanceof InternalProfileAuthError) {
        return response.status(error.statusCode).json({ error: error.message, code: error.code });
      }
      return response.status(503).json({
        error: 'Không thể kết nối hệ thống xác thực. Vui lòng thử lại.',
        code: 'internal_auth_failed'
      });
    }
  });
}
