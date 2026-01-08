-- Migration: Fix missing columns in system_logs to match master_schema.sql
-- Fixes Error 42703 (missing module, metadata, etc.)

DO $$
BEGIN
    -- 1. Add 'module' if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_logs' AND column_name = 'module') THEN
        ALTER TABLE public.system_logs ADD COLUMN module TEXT;
    END IF;

    -- 2. Add 'metadata' if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_logs' AND column_name = 'metadata') THEN
        ALTER TABLE public.system_logs ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}';
    END IF;

    -- 3. Add 'session_id' if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_logs' AND column_name = 'session_id') THEN
        ALTER TABLE public.system_logs ADD COLUMN session_id TEXT;
    END IF;

    -- 4. Add 'ip_address' if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_logs' AND column_name = 'ip_address') THEN
        ALTER TABLE public.system_logs ADD COLUMN ip_address INET;
    END IF;

    -- 5. Add 'user_agent' if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_logs' AND column_name = 'user_agent') THEN
        ALTER TABLE public.system_logs ADD COLUMN user_agent TEXT;
    END IF;

END $$;

-- Update comments
COMMENT ON TABLE public.system_logs IS 'System audit and activity logs';
COMMENT ON COLUMN public.system_logs.module IS 'Source module or component';
COMMENT ON COLUMN public.system_logs.metadata IS 'Structured contextual data for the log entry';
