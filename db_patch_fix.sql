-- Database Patch: Fix Constraints and Joins
-- Run this in the Supabase SQL Editor

-- 1. Ensure Profiles table has required foreign keys for relational joins
-- (PostgREST requires explicit FKs to support the ! syntax)

DO $$ 
BEGIN
    -- Check FK for daily_statistics
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'daily_statistics_created_by_fkey') THEN
        ALTER TABLE daily_statistics 
        ADD CONSTRAINT daily_statistics_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
    END IF;

    -- Check FK for invoices
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'invoices_created_by_fkey') THEN
        ALTER TABLE invoices 
        ADD CONSTRAINT invoices_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Fix Push Subscriptions Table
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add Unique Constraint for Push Subscriptions Upsert
-- This fixed the "42P10: no unique or exclusion constraint" error
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'push_subscriptions_user_id_user_agent_key') THEN
        ALTER TABLE push_subscriptions 
        ADD CONSTRAINT push_subscriptions_user_id_user_agent_key UNIQUE (user_id, user_agent);
    END IF;
END $$;

-- 4. Enable RLS for Push Subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 5. Add RLS Policy for Push Subscriptions
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own subscriptions') THEN
        CREATE POLICY "Users can manage their own subscriptions" ON push_subscriptions
        FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;
