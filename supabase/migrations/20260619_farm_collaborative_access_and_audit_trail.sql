-- ============================================================================
-- Migration: Farm-Level Collaborative Access & Audit Trail (20260619)
--
-- Adds `updated_by` audit column on `invoices` and `daily_statistics` so the
-- UI can render "آخرین ویرایش توسط: <Name>" exactly like `sales_vouchers`
-- already does (added in 20260615_add_updated_by_audit.sql).
--
-- RLS NOTE: No new RLS policies are required. The existing
--   `Invoices: Farm based access FOR ALL`  (20260616_harden_all_rls_policies.sql)
--   `Stats:   Farm based access FOR ALL`  (same)
-- already grant REGISTRATION-role users full CRUD on rows whose `farm_id`
-- matches one of their `public.user_farms` assignments. The bug was that
-- the FRONTEND was filtering out other operators' records; that is fixed
-- in the React layer rather than here.
--
-- This migration only adds:
--   1. updated_by column on invoices
--   2. updated_by column on daily_statistics
--   3. BEFORE UPDATE trigger that sets updated_by = auth.uid()
--      (updated_at is already handled by the generic set_updated_at trigger)
--   4. Clean named FK from updated_by → public.profiles(id) so the
--      PostgREST embedded resource query `editor:profiles!updated_by(full_name)`
--      resolves identically to the sales_vouchers pattern.
-- ============================================================================

-- =========================
-- 1. invoices.updated_by
-- =========================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.invoices
      ADD COLUMN updated_by UUID;
  END IF;
END $$;

-- Clean orphan rows BEFORE adding the FK so the constraint can be created.
UPDATE public.invoices i
SET updated_by = NULL
WHERE updated_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = i.updated_by);

-- Add named FK → public.profiles(id) ON DELETE SET NULL.
-- Drops any pre-existing FK on updated_by via FOR LOOP first (safe when
-- the query returns zero rows — `EXECUTE (NULL)` would throw
-- `query string argument of EXECUTE is null`).
DO $$
DECLARE
  v_sql TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'invoices'
      AND constraint_name = 'invoices_updated_by_fkey'
  ) THEN
    FOR v_sql IN (
      SELECT format('ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS %I', c.conname)
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
      WHERE c.conrelid = 'public.invoices'::regclass
        AND c.contype  = 'f'
        AND a.attname  = 'updated_by'
    ) LOOP
      EXECUTE v_sql;
    END LOOP;

    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_updated_by_fkey
      FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =========================
-- 2. daily_statistics.updated_by
-- =========================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'daily_statistics'
      AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.daily_statistics
      ADD COLUMN updated_by UUID;
  END IF;
END $$;

-- Clean orphan rows BEFORE adding the FK.
UPDATE public.daily_statistics s
SET updated_by = NULL
WHERE updated_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = s.updated_by);

-- Add named FK → public.profiles(id) ON DELETE SET NULL.
DO $$
DECLARE
  v_sql TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'daily_statistics'
      AND constraint_name = 'daily_statistics_updated_by_fkey'
  ) THEN
    FOR v_sql IN (
      SELECT format('ALTER TABLE public.daily_statistics DROP CONSTRAINT IF EXISTS %I', c.conname)
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
      WHERE c.conrelid = 'public.daily_statistics'::regclass
        AND c.contype  = 'f'
        AND a.attname  = 'updated_by'
    ) LOOP
      EXECUTE v_sql;
    END LOOP;

    ALTER TABLE public.daily_statistics
      ADD CONSTRAINT daily_statistics_updated_by_fkey
      FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =========================
-- 3. BEFORE UPDATE trigger — set updated_by = auth.uid()
--    (updated_at is already covered by the generic set_updated_at trigger)
-- =========================

CREATE OR REPLACE FUNCTION public.set_invoices_updated_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_daily_statistics_updated_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_invoices_updated_audit ON public.invoices;
CREATE TRIGGER tr_invoices_updated_audit
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_invoices_updated_audit();

DROP TRIGGER IF EXISTS tr_daily_statistics_updated_audit ON public.daily_statistics;
CREATE TRIGGER tr_daily_statistics_updated_audit
  BEFORE UPDATE ON public.daily_statistics
  FOR EACH ROW
  EXECUTE FUNCTION public.set_daily_statistics_updated_audit();

-- =========================
-- 4. Refresh PostgREST schema cache so embedded-resource joins resolve
-- =========================
NOTIFY pgrst, 'reload schema';
