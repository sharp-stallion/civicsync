import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, isConfigured } from './env';

// One client for the whole app. When unconfigured we still construct a dummy
// client so imports never throw; the Setup gate stops any real call first.
export const supabase = createClient(
  isConfigured() ? SUPABASE_URL : 'http://localhost:54321',
  isConfigured() ? SUPABASE_KEY : 'public-anon-placeholder',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);
