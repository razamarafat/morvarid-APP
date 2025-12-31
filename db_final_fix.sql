-- FINAL DATABASE REPAIR SCRIPT (Morvarid System)
-- Run this in the Supabase SQL Editor

-- 1. FIX: Missing Foreign Keys for Relational Joins
-- These are REQUIRED for the code's .select('*, profiles!created_by(...)') to work.

DO $$ 
BEGIN
    -- Add FK for daily_statistics if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.key_column_usage 
        WHERE table_name = 'daily_statistics' AND column_name = 'created_by'
    ) THEN
        -- Column might be missing or named differently? Let's check.
        RAISE NOTICE 'Column created_by missing in daily_statistics';
    ELSE
        -- Drop existing if any, to ensure it's pointing to profiles(id)
        ALTER TABLE daily_statistics DROP CONSTRAINT IF EXISTS daily_statistics_created_by_fkey;
        ALTER TABLE daily_statistics 
        ADD CONSTRAINT daily_statistics_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
        RAISE NOTICE 'Constraint added: daily_statistics -> profiles';
    END IF;

    -- Add FK for invoices if it doesn't exist
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoices' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_created_by_fkey;
        ALTER TABLE invoices 
        ADD CONSTRAINT invoices_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
        RAISE NOTICE 'Constraint added: invoices -> profiles';
    END IF;
END $$;

-- 2. FIX: Push Subscriptions Table and Unique Constraint
-- The error 42P10 means the UNIQUE constraint on (user_id, user_agent) is missing.

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Force the unique constraint
ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_user_agent_key;
ALTER TABLE push_subscriptions 
ADD CONSTRAINT push_subscriptions_user_id_user_agent_key UNIQUE (user_id, user_agent);

-- 3. FIX: Row Level Security (Ensure enabled)
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Re-create policy
DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON push_subscriptions;
CREATE POLICY "Users can manage their own subscriptions" 
ON push_subscriptions FOR ALL 
USING (auth.uid() = user_id);

-- 4. VERIFICATION QUERY (Run this to check status)
SELECT 
    conname AS constraint_name, 
    relname AS table_name, 
    pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class r ON c.conrelid = r.oid
WHERE relname IN ('daily_statistics', 'invoices', 'push_subscriptions');
