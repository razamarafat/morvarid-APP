-- ============================================================================
-- Migration: Fix sales_vouchers → profiles FK for PostgREST relationship resolution
-- Date: 2026-06-16
-- Purpose: PostgREST requires clean foreign key constraints to resolve
-- embedded resource queries like profiles!created_by() and profiles!updated_by().
-- 
-- Problem: 
--   1. sales_vouchers.created_by has an implicit auto-named FK to profiles(id)
--      from table creation, but PostgREST couldn't resolve it consistently.
--   2. sales_vouchers.updated_by was created with a FK to auth.users(id) in
--      20260615_add_updated_by_audit.sql, not to profiles(id). PostgREST
--      cannot resolve profiles!updated_by() when the FK points to auth.users.
--   3. The fix_voucher_visibility.sql migration tried to add named FKs but
--      the updated_by FK to auth.users may block or conflict with the new FK.
--
-- Fix:
--   1. Drop the auth.users FK on updated_by if it exists
--   2. Drop any existing auto-named FKs on created_by and updated_by
--   3. Create clean, named FKs from both columns to profiles(id)
-- ============================================================================

-- Step 1: Find and drop the auto-named FK on created_by (if it differs from our named one)
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Find any FK constraint on created_by that isn't our named one
  SELECT c.conname INTO v_constraint_name
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
  WHERE c.conrelid = 'public.sales_vouchers'::regclass
    AND c.contype = 'f'
    AND a.attname = 'created_by'
    AND c.conname != 'sales_vouchers_created_by_fkey'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.sales_vouchers DROP CONSTRAINT %I', v_constraint_name);
    RAISE NOTICE 'Dropped auto-named FK on created_by: %', v_constraint_name;
  END IF;
END $$;

-- Step 2: Drop the auth.users FK on updated_by if it exists
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT c.conname INTO v_constraint_name
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
  WHERE c.conrelid = 'public.sales_vouchers'::regclass
    AND c.contype = 'f'
    AND a.attname = 'updated_by'
    AND c.confrelid = 'auth.users'::regclass
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.sales_vouchers DROP CONSTRAINT %I', v_constraint_name);
    RAISE NOTICE 'Dropped auth.users FK on updated_by: %', v_constraint_name;
  END IF;
END $$;

-- Step 3: Drop any other auto-named FK on updated_by (if it differs from our named one)
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT c.conname INTO v_constraint_name
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
  WHERE c.conrelid = 'public.sales_vouchers'::regclass
    AND c.contype = 'f'
    AND a.attname = 'updated_by'
    AND c.conname != 'sales_vouchers_updated_by_fkey'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.sales_vouchers DROP CONSTRAINT %I', v_constraint_name);
    RAISE NOTICE 'Dropped auto-named FK on updated_by: %', v_constraint_name;
  END IF;
END $$;

-- Step 4: Ensure the named FK from created_by → profiles(id) exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'sales_vouchers'
      AND constraint_name = 'sales_vouchers_created_by_fkey'
  ) THEN
    -- Clean up any orphaned references before creating FK
    DELETE FROM public.sales_voucher_lines l
    WHERE NOT EXISTS (
      SELECT 1 FROM public.sales_vouchers sv
      JOIN public.profiles p ON p.id = sv.created_by
      WHERE sv.id = l.voucher_id
    );

    DELETE FROM public.sales_vouchers sv
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = sv.created_by);

    ALTER TABLE public.sales_vouchers
      ADD CONSTRAINT sales_vouchers_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

    RAISE NOTICE 'Created FK: sales_vouchers_created_by_fkey';
  ELSE
    RAISE NOTICE 'FK sales_vouchers_created_by_fkey already exists';
  END IF;
END $$;

-- Step 5: Ensure the named FK from updated_by → profiles(id) exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'sales_vouchers'
      AND constraint_name = 'sales_vouchers_updated_by_fkey'
  ) THEN
    -- Clean up orphaned references
    UPDATE public.sales_vouchers SET updated_by = NULL
    WHERE updated_by IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = updated_by);

    ALTER TABLE public.sales_vouchers
      ADD CONSTRAINT sales_vouchers_updated_by_fkey
      FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

    RAISE NOTICE 'Created FK: sales_vouchers_updated_by_fkey';
  ELSE
    RAISE NOTICE 'FK sales_vouchers_updated_by_fkey already exists';
  END IF;
END $$;

-- Step 6: Refresh PostgREST schema cache so it picks up the new FKs
NOTIFY pgrst, 'reload schema';
