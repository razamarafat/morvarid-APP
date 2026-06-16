-- ============================================================================
-- Migration: Fix Sales Voucher List Visibility
-- Date: 2026-06-16
-- Purpose: Fix three root causes of "voucher saved but not visible in list":
--
--   ROOT CAUSE 1 (PRIMARY): sales_vouchers.created_by and updated_by columns
--   have NO foreign key constraint to profiles(id). PostgREST requires FK
--   constraints to resolve relationship hints like profiles!created_by().
--   Without the FK, the entire SELECT query fails silently → vouchers: []
--
--   ROOT CAUSE 2 (SECONDARY): farms!inner(name) in the store query applies
--   farms RLS, which only allows admins or users with user_farms entries.
--   SALES users who can see all vouchers (via can_view_sales_voucher) may
--   have vouchers filtered out because the INNER JOIN to farms fails.
--
--   ROOT CAUSE 3 (TERTIARY): Farms RLS policy has no SALES role exception.
--   SALES users need to see all farms (they create vouchers across all farms),
--   but the policy only checks is_admin() and can_access_farm().
-- ============================================================================

-- ======================================================
-- FIX 1: Add is_sales() SECURITY DEFINER helper function
-- ======================================================
-- Used by the farms RLS policy below. Consistent with is_admin() pattern
-- and prevents breakage if profiles RLS is ever tightened again.

CREATE OR REPLACE FUNCTION public.is_sales()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'SALES'
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;

-- ======================================================
-- FIX 2: Add FK constraints for PostgREST relationship resolution
-- ======================================================

-- Add FK from sales_vouchers.created_by → profiles.id
-- This allows PostgREST to resolve: profiles!created_by(full_name, role)
-- NOTE: created_by is NOT NULL, so we use ON DELETE RESTRICT.
-- This prevents accidental hard-delete of profiles from destroying voucher history.
-- The app uses soft-delete (is_active=false), so RESTRICT never blocks normal operations.
DO $$
BEGIN
  -- Safety: orphaned created_by values would block FK creation.
  -- IMPORTANT: Disable the inventory reversal trigger during cleanup to avoid
  -- inserting sale_reversal rows into inventory_transactions (which would fail
  -- due to RLS when no authenticated user context exists during migration).
  ALTER TABLE public.sales_voucher_lines DISABLE TRIGGER tr_sales_voucher_line_inventory_del;

  DELETE FROM public.sales_voucher_lines l
  WHERE NOT EXISTS (
    SELECT 1 FROM public.sales_vouchers sv
    JOIN public.profiles p ON p.id = sv.created_by
    WHERE sv.id = l.voucher_id
  );

  DELETE FROM public.sales_vouchers sv
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = sv.created_by);

  ALTER TABLE public.sales_voucher_lines ENABLE TRIGGER tr_sales_voucher_line_inventory_del;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'sales_vouchers'
      AND constraint_name = 'sales_vouchers_created_by_fkey'
  ) THEN
    ALTER TABLE public.sales_vouchers
      ADD CONSTRAINT sales_vouchers_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Add FK from sales_vouchers.updated_by → profiles.id
-- This allows PostgREST to resolve: profiles!updated_by(full_name)
DO $$
BEGIN
  -- Safety: orphaned updated_by values would block FK creation.
  UPDATE public.sales_vouchers SET updated_by = NULL
  WHERE updated_by IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = updated_by);

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'sales_vouchers'
      AND constraint_name = 'sales_vouchers_updated_by_fkey'
  ) THEN
    ALTER TABLE public.sales_vouchers
      ADD CONSTRAINT sales_vouchers_updated_by_fkey
      FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ======================================================
-- FIX 3: Update Farms RLS to allow SALES users to see all farms
-- ======================================================
-- SALES users need to see ALL farms because:
--   a) They create vouchers across all farms
--   b) The store query joins farms for display
--   c) The farm selector shows all active farms for SALES users
-- Uses the is_sales() SECURITY DEFINER function for safety.

DROP POLICY IF EXISTS "Farms: View assigned" ON public.farms;
CREATE POLICY "Farms: View assigned" ON public.farms FOR SELECT
USING (
  public.is_admin()
  OR public.is_sales()
  OR public.can_access_farm(farms.id)
);
