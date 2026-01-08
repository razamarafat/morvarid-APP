-- Migration: Add missing 'module' column to system_logs for audit auditing.
-- Fix for Error 42703: column "module" of relation "system_logs" does not exist

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'system_logs' 
        AND column_name = 'module'
    ) THEN
        ALTER TABLE public.system_logs ADD COLUMN module TEXT;
        COMMENT ON COLUMN public.system_logs.module IS 'System module or component name for audit logs';
    END IF;
END $$;
