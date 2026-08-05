export const INTERNAL_AUTH_EMAIL_DOMAINS = Object.freeze(['omfit.local', 'omfit.app']);

export function normalizeInternalPhone(value) {
  let phone = String(value || '').replace(/\D/g, '');
  if (phone.startsWith('84') && phone.length === 11) {
    phone = `0${phone.slice(2)}`;
  }
  return /^0\d{9}$/.test(phone) ? phone : '';
}

export function buildInternalLoginEmails(value) {
  const phone = normalizeInternalPhone(value);
  return phone ? INTERNAL_AUTH_EMAIL_DOMAINS.map((domain) => `${phone}@${domain}`) : [];
}

export function isInvalidCredentialsError(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return code === 'invalid_credentials' || message.includes('invalid login credentials');
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

export async function signInInternalUser(auth, phoneInput, password) {
  const emails = buildInternalLoginEmails(phoneInput);
  if (!emails.length) {
    throw Object.assign(new Error('Invalid internal phone number.'), { code: 'invalid_phone' });
  }

  let lastCredentialsError = null;
  for (const email of emails) {
    const { error } = await auth.signInWithPassword({ email, password });
    if (!error) return;
    if (!isInvalidCredentialsError(error)) throw error;
    lastCredentialsError = error;
  }

  throw lastCredentialsError || Object.assign(new Error('Invalid login credentials.'), {
    code: 'invalid_credentials'
  });
}
