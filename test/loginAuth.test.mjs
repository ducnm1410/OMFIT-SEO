import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getInternalLoginErrorMessage,
  isInvalidCredentialsError,
  normalizeInternalPhone,
  signInInternalUser
} from '../src/lib/internalAuth.mjs';
import {
  createInternalLoginRateLimiter,
  InternalProfileAuthError,
  issueInternalProfileLogin
} from '../server/internalProfileAuth.mjs';

test('login nội bộ chỉ nhận số điện thoại Việt Nam và chuẩn hóa đầu số +84', () => {
  assert.equal(normalizeInternalPhone('0912 345 678'), '0912345678');
  assert.equal(normalizeInternalPhone('+84 912 345 678'), '0912345678');
  assert.equal(normalizeInternalPhone('ducnm6@vng.com.vn'), '');
  assert.equal(normalizeInternalPhone('admin'), '');
});

test('frontend gửi số điện thoại tới API profile và dùng token một lần để tạo session', async () => {
  const requests = [];
  const otpCalls = [];
  const auth = {
    async verifyOtp(payload) {
      otpCalls.push(payload);
      return { error: null };
    }
  };
  const fakeFetch = async (path, init) => {
    requests.push({ path, init, body: JSON.parse(init.body) });
    return {
      ok: true,
      status: 200,
      async json() {
        return { tokenHash: 'one-time-hash', verificationType: 'magiclink' };
      }
    };
  };

  await signInInternalUser(auth, '+84 912 345 678', 'test-password', fakeFetch);
  assert.equal(requests[0].path, '/api/auth/internal-login');
  assert.deepEqual(requests[0].body, { phone: '0912345678', password: 'test-password' });
  assert.deepEqual(otpCalls, [{ token_hash: 'one-time-hash', type: 'magiclink' }]);
});

test('login không che lỗi hệ thống thành lỗi sai mật khẩu', async () => {
  const networkError = { code: 'request_timeout', message: 'Request timed out' };
  const auth = { async verifyOtp() { return { error: null }; } };
  const fakeFetch = async () => ({
    ok: false,
    status: 503,
    async json() {
      return { error: networkError.message, code: networkError.code };
    }
  });

  await assert.rejects(
    () => signInInternalUser(auth, '0912345678', 'test-password', fakeFetch),
    (error) => error.code === networkError.code && error.status === 503
  );
  assert.equal(getInternalLoginErrorMessage(networkError), 'Không thể kết nối hệ thống xác thực. Vui lòng thử lại.');
  assert.equal(
    getInternalLoginErrorMessage({ code: 'invalid_credentials' }),
    'Số điện thoại hoặc mật khẩu không đúng.'
  );
  assert.equal(isInvalidCredentialsError({ name: 'AuthApiError', status: 401 }), true);
  assert.equal(isInvalidCredentialsError({ code: 'bad_jwt', status: 401 }), false);
  assert.equal(
    getInternalLoginErrorMessage({ name: 'AuthApiError', status: 401 }),
    'Số điện thoại hoặc mật khẩu không đúng.'
  );
});

test('backend chỉ phát hành magic token sau khi RPC profiles xác thực thành công', async () => {
  const calls = [];
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    email: '0912345678@omfit.local',
    user_metadata: {},
    app_metadata: { provider: 'email' }
  };
  const admin = {
    async rpc(name, payload) {
      calls.push({ method: 'rpc', name, payload });
      return {
        data: [{
          profile_id: user.id,
          auth_user_id: user.id,
          full_name: 'OMFIT Admin',
          role: 'admin'
        }],
        error: null
      };
    },
    auth: {
      admin: {
        async getUserById(id) {
          calls.push({ method: 'getUserById', id });
          return { data: { user }, error: null };
        },
        async updateUserById(id, attributes) {
          calls.push({ method: 'updateUserById', id, attributes });
          return { data: { user: { ...user, ...attributes } }, error: null };
        },
        async generateLink(payload) {
          calls.push({ method: 'generateLink', payload });
          return {
            data: {
              user,
              properties: { hashed_token: 'profile-login-token', verification_type: 'magiclink' }
            },
            error: null
          };
        }
      }
    }
  };

  const result = await issueInternalProfileLogin({
    admin,
    phoneInput: '0912 345 678',
    password: 'legacy-password'
  });
  assert.deepEqual(result, { tokenHash: 'profile-login-token', verificationType: 'magiclink' });
  assert.deepEqual(calls[0], {
    method: 'rpc',
    name: 'verify_internal_profile_credentials',
    payload: { input_phone: '0912345678', input_password: 'legacy-password' }
  });
  assert.equal(calls.find((call) => call.method === 'updateUserById').attributes.app_metadata.role, 'admin');
  assert.equal(calls.find((call) => call.method === 'generateLink').payload.type, 'magiclink');
});

test('backend từ chối profile sai mật khẩu và giới hạn brute force', async () => {
  const admin = {
    async rpc() {
      return { data: [], error: null };
    }
  };
  await assert.rejects(
    () => issueInternalProfileLogin({ admin, phoneInput: '0912345678', password: 'wrong' }),
    (error) => error instanceof InternalProfileAuthError
      && error.statusCode === 401
      && error.code === 'invalid_credentials'
  );

  const limiter = createInternalLoginRateLimiter({ maxAttempts: 2, windowMs: 1000 });
  assert.equal(limiter.consume('phone', 100).allowed, true);
  assert.equal(limiter.consume('phone', 200).allowed, true);
  assert.equal(limiter.consume('phone', 300).allowed, false);
  assert.equal(limiter.consume('phone', 1200).allowed, true);
});

test('migration hash password profiles và khóa anon khỏi dữ liệu đăng nhập', async () => {
  const { readFile } = await import('node:fs/promises');
  const [migration, server] = await Promise.all([
    readFile(new URL('../supabase/migrations/202608050002_secure_profile_login.sql', import.meta.url), 'utf8'),
    readFile(new URL('../server/index.mjs', import.meta.url), 'utf8')
  ]);
  assert.match(migration, /extensions\.crypt\(password, extensions\.gen_salt\('bf', 11\)\)/);
  assert.match(migration, /alter table public\.profiles enable row level security/i);
  assert.match(migration, /revoke all privileges on table public\.profiles from anon, authenticated/i);
  assert.match(migration, /verify_internal_profile_credentials/);
  assert.match(migration, /revoke all on function[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function[\s\S]*to service_role/i);
  assert.match(server, /registerInternalProfileAuthRoute/);
});
