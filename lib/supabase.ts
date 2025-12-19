
import { createClient } from '@supabase/supabase-js';

// Fallback credentials provided for this project
const FALLBACK_URL = 'https://bcdyieczslyynvvsfmmm.supabase.co';
const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjZHlpZWN6c2x5eW52dnNmbW1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNDc4NzgsImV4cCI6MjA4MTcyMzg3OH0.Sun1mdhVqg1J22TR99zZhxQzqAkqByEW4-AWLy9umDY';

// Safely access env vars without crashing if import.meta.env is undefined
const meta = (import.meta as any) || {};
const env = meta.env || {};

export const supabaseUrl = env.VITE_SUPABASE_URL || FALLBACK_URL;
export const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase Environment Variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
