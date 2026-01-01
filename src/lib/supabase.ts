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

/**
 * Fetch records created by a specific user with date range filter.
 * Handles RLS policies and type casting for UUID comparison.
 */
export async function fetchUserRecords(
  userId: string,
  entityType: 'invoices' | 'daily_statistics',
  startDate: string,
  endDate: string
) {
  try {
    console.log(
      `[fetchUserRecords] 🔍 Querying ${entityType} for user ${userId} from ${startDate} to ${endDate}`
    );

    // Use record 'date' field for UI date-range filtering (created_at is the DB timestamp)
    const query = supabase
      .from(entityType)
      .select('*')
      .eq('created_by', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error(
        `[fetchUserRecords] ❌ Database error for ${entityType}:`,
        { message: error.message, details: error.details, hint: error.hint }
      );
      throw error;
    }

    console.log(`[fetchUserRecords] ✅ Success: Fetched ${data?.length || 0} ${entityType} records`);
    // Log a sample of returned shape so front-end mapping can be validated
    if (data && data.length) {
      console.log('[fetchUserRecords] sample row:', JSON.parse(JSON.stringify(data[0])));
    }
    return data || [];
  } catch (error: any) {
    console.error(`[fetchUserRecords] ❌ Exception:`, error);
    return [];
  }
}