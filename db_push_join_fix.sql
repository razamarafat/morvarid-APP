-- FIX: Join relationship between push_subscriptions and profiles
-- Run this in the Supabase SQL Editor

DO $$ 
BEGIN
    -- Drop the old FK pointing to auth.users
    ALTER TABLE IF EXISTS push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_fkey;
    
    -- Add the new FK pointing to public.profiles
    -- This allows PostgREST to join profiles in the public schema
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'push_subscriptions' AND column_name = 'user_id') THEN
        ALTER TABLE push_subscriptions 
        ADD CONSTRAINT push_subscriptions_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
END $$;
