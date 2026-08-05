export function normalizeInternalPhone(value) {
  let phone = String(value || '').replace(/\D/g, '');
  if (phone.startsWith('84') && phone.length === 11) {
    phone = `0${phone.slice(2)}`;
  }
  return /^0\d{9}$/.test(phone) ? phone : '';
}

export function isInvalidCredentialsError(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  const status = Number(error?.status || 0);
  return code === 'invalid_credentials'
    || message.includes('invalid login credentials')
    || (!code && status === 401);
}

export function getInternalLoginErrorMessage(error) {
  const code = String(error?.code || '').toLowerCase();
  const status = Number(error?.status || 0);
  if (code === 'invalid_phone') {
    return 'Số điện thoại không hợp lệ. Vui lòng nhập 10 số, bắt đầu bằng 0.';
  }
  if (isInvalidCredentialsError(error)) {
    return 'Số điện thoại hoặc mật khẩu không đúng.';
  }
  if (code === 'email_not_confirmed') {
    return 'Tài khoản chưa được kích hoạt.';
  }
  if (status === 429 || code.includes('rate_limit')) {
    return 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng chờ rồi thử lại.';
  }
  return 'Không thể kết nối hệ thống xác thực. Vui lòng thử lại.';
}

export async function signInInternalUser(auth, phoneInput, password, fetchImplementation = fetch) {
  const phone = normalizeInternalPhone(phoneInput);
  if (!phone) {
    throw Object.assign(new Error('Invalid internal phone number.'), { code: 'invalid_phone' });
  }
  const response = await fetchImplementation('/api/auth/internal-login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(payload.error || 'Internal login failed.'), {
      code: payload.code || '',
      status: response.status
    });
  }
  const { error } = await auth.verifyOtp({
    token_hash: payload.tokenHash,
    type: payload.verificationType || 'magiclink'
  });
  if (error) throw error;
}
