import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildInternalLoginEmails,
  getInternalLoginErrorMessage,
  normalizeInternalPhone,
  signInInternalUser
} from '../src/lib/internalAuth.mjs';

test('login nội bộ chỉ nhận số điện thoại Việt Nam và chuẩn hóa đầu số +84', () => {
  assert.equal(normalizeInternalPhone('0912 345 678'), '0912345678');
  assert.equal(normalizeInternalPhone('+84 912 345 678'), '0912345678');
  assert.equal(normalizeInternalPhone('ducnm6@vng.com.vn'), '');
  assert.equal(normalizeInternalPhone('admin'), '');
  assert.deepEqual(buildInternalLoginEmails('0912 345 678'), [
    '0912345678@omfit.local',
    '0912345678@omfit.app'
  ]);
});

test('login thử domain local trước và fallback sang domain app khi tài khoản không tồn tại', async () => {
  const attempts = [];
  const auth = {
    async signInWithPassword(credentials) {
      attempts.push(credentials);
      return credentials.email.endsWith('@omfit.local')
        ? { error: { code: 'invalid_credentials', message: 'Invalid login credentials' } }
        : { error: null };
    }
  };

  await signInInternalUser(auth, '+84 912 345 678', 'test-password');
  assert.deepEqual(attempts.map(({ email }) => email), [
    '0912345678@omfit.local',
    '0912345678@omfit.app'
  ]);
});

test('login không che lỗi hệ thống thành lỗi sai mật khẩu', async () => {
  let attemptCount = 0;
  const networkError = { code: 'request_timeout', message: 'Request timed out' };
  const auth = {
    async signInWithPassword() {
      attemptCount += 1;
      return { error: networkError };
    }
  };

  await assert.rejects(() => signInInternalUser(auth, '0912345678', 'test-password'), networkError);
  assert.equal(attemptCount, 1);
  assert.equal(getInternalLoginErrorMessage(networkError), 'Không thể kết nối hệ thống xác thực. Vui lòng thử lại.');
  assert.equal(
    getInternalLoginErrorMessage({ code: 'invalid_credentials' }),
    'Số điện thoại hoặc mật khẩu không đúng.'
  );
});
