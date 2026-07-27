import React, { useState } from 'react';
import { Activity, CheckCircle2, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { supabase } from '../lib/supabase';

function normalizeLogin(value: string) {
  const trimmed = value.trim();
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  let phone = trimmed.replace(/\D/g, '');
  if (phone.startsWith('84') && phone.length === 11) {
    phone = `0${phone.slice(2)}`;
  }
  return phone ? `${phone}@omfit.local` : trimmed;
}

export const LoginScreen: React.FC = () => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizeLogin(login),
        password
      });
      if (signInError) throw signInError;
    } catch {
      setError('Thông tin đăng nhập không đúng hoặc tài khoản chưa được kích hoạt.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="ui-login-shell grid min-h-dvh place-items-center px-4 py-8 sm:px-6">
      <section className="grid min-w-0 w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.10)] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative hidden min-h-[620px] overflow-hidden bg-[#17191D] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-white text-[#17191D]">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-base font-semibold">OMFIT SEO</p>
                <p className="text-xs text-white/55">Content workspace</p>
              </div>
            </div>
            <div className="mt-24 max-w-md">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-300">Balance for life</p>
              <h1 className="mt-4 text-4xl font-semibold leading-[1.12] tracking-[-0.035em]">
                Một không gian rõ ràng cho toàn bộ quy trình SEO.
              </h1>
              <p className="mt-5 text-sm leading-7 text-white/65">
                Nghiên cứu từ khóa, soạn nội dung, kiểm duyệt hình ảnh và xuất bản WordPress trong một luồng làm việc thống nhất.
              </p>
            </div>
          </div>
          <div className="grid gap-3 text-sm text-white/75">
            {['Dữ liệu Google Ads được xác thực', 'Kiểm tra SEO trước khi xuất bản', 'Kết nối trực tiếp với omfit.com.vn'].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-sky-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 min-h-[560px] items-center p-6 sm:p-10 lg:min-h-[620px] lg:p-12">
          <div className="mx-auto min-w-0 w-full max-w-sm">
            <div className="mb-8">
              <div className="mb-5 flex items-center gap-3 lg:hidden">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#17191D] text-white">
                  <Activity className="h-5 w-5" />
                </div>
                <span className="text-base font-semibold text-[#17191D]">OMFIT SEO</span>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#076FBD]">Đăng nhập hệ thống</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#17191D]">Chào mừng trở lại</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Sử dụng tài khoản nội bộ OMFIT để tiếp tục.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="min-w-0 space-y-5">
              {error && (
                <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="login" className="mb-2 block text-xs font-semibold text-slate-700">
                  Số điện thoại hoặc email
                </label>
                <input
                  id="login"
                  type="text"
                  autoComplete="username"
                  required
                  value={login}
                  onChange={(event) => setLogin(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-[#17191D] outline-none transition placeholder:text-slate-400 focus:border-[#0879D9] focus:ring-4 focus:ring-sky-100"
                  placeholder="Nhập tài khoản"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-xs font-semibold text-slate-700">
                  Mật khẩu
                </label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-11 text-sm font-medium text-[#17191D] outline-none transition placeholder:text-slate-400 focus:border-[#0879D9] focus:ring-4 focus:ring-sky-100"
                    placeholder="Nhập mật khẩu"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="gradient-bg-omfit-btn flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>
            </form>

            <p className="mt-6 text-center text-xs leading-5 text-slate-500">
              Hệ thống dành riêng cho đội ngũ nội bộ OMFIT.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};
