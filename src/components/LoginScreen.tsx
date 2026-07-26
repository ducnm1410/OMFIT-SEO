import React, { useState } from 'react';
import { Activity, Eye, EyeOff, LockKeyhole } from 'lucide-react';
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
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#F8FAFC] px-4 py-10">
      <div className="pointer-events-none absolute -left-28 top-[-140px] h-80 w-80 rounded-full bg-sky-200/45 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-36 right-[-100px] h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />

      <section className="relative w-full max-w-md rounded-3xl border border-[#0879D9]/15 bg-white p-6 shadow-2xl shadow-sky-950/10 sm:p-8">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-tr from-[#0879D9] to-[#0284C7] text-white shadow-lg shadow-[#0879D9]/20">
            <Activity className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#071827]">OMFIT SEO</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Đăng nhập bằng tài khoản nội bộ để truy cập hệ thống.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="login" className="mb-1.5 block text-xs font-bold text-slate-700">
              Số điện thoại hoặc email
            </label>
            <input
              id="login"
              type="text"
              autoComplete="username"
              required
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-[#071827] outline-none transition focus:border-[#0879D9] focus:bg-white focus:ring-4 focus:ring-sky-100"
              placeholder="Nhập tài khoản"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-bold text-slate-700">
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
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-11 text-sm font-medium text-[#071827] outline-none transition focus:border-[#0879D9] focus:bg-white focus:ring-4 focus:ring-sky-100"
                placeholder="Nhập mật khẩu"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="gradient-bg-omfit-btn flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-bold text-white shadow-lg shadow-[#0879D9]/20 transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </section>
    </main>
  );
};
