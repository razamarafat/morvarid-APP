-- ============================================================================
-- MORVARID SYSTEM: Manual Voucher Number + Sales Delete RLS Fix
-- Migration: 20260615_manual_voucher_number_fixes.sql
-- Description:
--   1. Remove auto-generation of voucher_number (trigger, function, sequence, RPC)
--   2. Update RLS delete policy to allow sales users to delete their own draft vouchers
-- ============================================================================

-- =========================
-- 1. REMOVE AUTO-GENERATION TRIGGER
-- =========================
DROP TRIGGER IF EXISTS tr_sales_voucher_number ON public.sales_vouchers;

-- =========================
-- 2. DROP AUTO-GENERATION FUNCTION
-- =========================
DROP FUNCTION IF EXISTS public.generate_sales_voucher_number();

-- =========================
-- 3. DROP THE SEQUENCE
-- =========================
DROP SEQUENCE IF EXISTS public.sales_voucher_number_seq;

-- =========================
-- 4. DROP THE get_next_sales_voucher_number RPC
-- =========================
DROP FUNCTION IF EXISTS public.get_next_sales_voucher_number();

-- =========================
-- 5. UPDATE RLS: Allow sales users to DELETE their own draft vouchers
-- =========================
DROP POLICY IF EXISTS "SalesVouchers: Delete by admin" ON public.sales_vouchers;

CREATE POLICY "SalesVouchers: Delete by admin or sales owner" ON public.sales_vouchers FOR DELETE
USING (
  public.is_admin()
  OR (
    created_by = auth.uid()
    AND status = 'draft'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'SALES'
    )
  )
);

-- =========================
-- 6. UPDATE RLS: Allow sales users to cancel their own submitted vouchers
-- =========================
-- The existing "SalesVouchers: Update draft" policy already allows sales to update draft.
-- But cancellation (submitted -> cancelled) also happens via UPDATE.
-- We need to also allow sales users to update (cancel) their own submitted vouchers.

DROP POLICY IF EXISTS "SalesVouchers: Update draft" ON public.sales_vouchers;

CREATE POLICY "SalesVouchers: Update by creator or admin" ON public.sales_vouchers FOR UPDATE
USING (
  public.is_admin()
  OR (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'SALES'
    )
  )
)
WITH CHECK (
  public.is_admin()
  OR (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'SALES'
    )
  )
);
