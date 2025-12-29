
import { createClient } from '@supabase/supabase-js';

// Security: Do not expose actual keys in source code. 
// These must be provided via .env file or build environment variables.
const meta = (import.meta as any) || {};
const env = meta.env || {};

export const supabaseUrl = env.VITE_SUPABASE_URL;
export const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Graceful fallback for development only - prompts developer to check setup
  console.error('[Supabase] Missing Environment Variables! Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);
