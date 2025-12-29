
import { createClient } from '@supabase/supabase-js';

// Security: Strictly load keys from environment variables.
// No hardcoded fallbacks are allowed in production code.
// TypeScript workaround for import.meta.env if types are missing
const env = (import.meta as any).env;
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

// Fail Fast: Halt application execution if keys are missing
if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = 
    '[CRITICAL SECURITY ERROR] Supabase configuration missing.\n' +
    'Please create a .env file in the project root with the following keys:\n' +
    '- VITE_SUPABASE_URL\n' +
    '- VITE_SUPABASE_ANON_KEY';
  
  // Log to console for developer visibility
  console.error(errorMsg);
  
  // In development, throw an error to stop execution visually
  throw new Error(errorMsg);
}

// Export specific variables as they are used in store/userStore.ts
export { supabaseUrl, supabaseAnonKey };

// Initialize Supabase Client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // Maintain session across refreshes
    autoRefreshToken: true, // Automatically refresh token before expiry
    detectSessionInUrl: false, // Disable PKCE flow detection on hash router unless needed
  },
  // Global fetch configuration (optional: for timeout handling)
  global: {
    headers: { 'x-application-name': 'morvarid-mis-client' },
  },
});
