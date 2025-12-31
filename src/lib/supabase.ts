import { createClient } from '@supabase/supabase-js';

// STRICT SECURITY CHECK
// We directy access Vite environment variables.
// If they are missing, the application MUST crash immediately to prevent insecure usage.
// Fix: Type casting import.meta to any to resolve TS error 'Property env does not exist on type ImportMeta'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '🚨 CRITICAL SECURITY ERROR: Supabase environment variables are missing! \n' +
    'Please verify that "VITE_SUPABASE_URL" and "VITE_SUPABASE_ANON_KEY" are correctly defined in your .env file.'
  );
}

// Export validated variables for store usage
export { supabaseUrl, supabaseAnonKey };

// Initialize Singleton Client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: { 'x-application-name': 'morvarid-mis-client-v2.9.62-fix' },
  },
});