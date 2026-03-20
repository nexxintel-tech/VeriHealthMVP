import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://invalid.localhost';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'invalid-anon-key';

export const supabaseConfigError = !import.meta.env.VITE_SUPABASE_URL
  ? 'VITE_SUPABASE_URL is not configured.'
  : !import.meta.env.VITE_SUPABASE_ANON_KEY
    ? 'VITE_SUPABASE_ANON_KEY is not configured.'
    : null;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
