
import { createClient } from '@supabase/supabase-js';

// Security: Strictly load keys from environment variables.
// No hardcoded fallbacks are allowed in production code.
// TypeScript workaround for import.meta.env if types are missing
const env = (import.meta as any).env;
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

// Fail Fast: Halt application execution immediately if critical keys are missing.
// This prevents the app from running in an undefined state.
if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your-project-id')) {
  const errorMsg = 
    '\n🔴 [CRITICAL CONFIG ERROR] 🔴\n' +
    '---------------------------------------------------\n' +
    'Supabase configuration keys are missing or invalid.\n' +
    'The application cannot start without a valid database connection.\n\n' +
    'ACTION REQUIRED:\n' +
    '1. Create a ".env" file in the project root (use .env.example as a guide).\n' +
    '2. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.\n' +
    '3. Restart the development server.\n' +
    '---------------------------------------------------\n';
  
  // Log to console for developer visibility
  console.error(errorMsg);
  
  // Throw error to stop execution and show error overlay in development
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
