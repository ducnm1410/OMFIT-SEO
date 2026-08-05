import { createClient } from '@supabase/supabase-js';
import { normalizeRuntimeEnvValue } from './runtimeEnv.mjs';

const supabaseUrl = normalizeRuntimeEnvValue(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = normalizeRuntimeEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
