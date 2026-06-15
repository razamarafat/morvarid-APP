-- ============================================================================
-- Fix: RLS INSERT policy on sales_vouchers - SECURITY DEFINER wrapper
-- 
-- Problem: The inline EXISTS(SELECT 1 FROM profiles...) in the INSERT policy
-- runs without SECURITY DEFINER, so profiles table RLS is also enforced during
-- policy evaluation. This can cause "new row violates row-level security policy"
-- errors when the profiles RLS evaluation fails.
--
-- Solution: Wrap all role checks in SECURITY DEFINER functions that bypass
-- profiles RLS during policy evaluation.
-- ============================================================================

-- 1. Create SECURITY DEFINER helper functions
CREATE OR REPLACE FUNCTION public.can_insert_sales_voucher()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.role = 'ADMIN' OR p.role = 'SALES')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.can_view_sales_voucher(v_farm_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.role = 'ADMIN' OR p.role = 'SALES')
  )
  OR EXISTS (
    SELECT 1 FROM public.user_farms uf
    WHERE uf.user_id = auth.uid() AND uf.farm_id = v_farm_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.can_update_sales_voucher(v_created_by UUID, v_status public.sales_voucher_status)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'ADMIN'
  )
  OR (
    v_created_by = auth.uid()
    AND v_status = 'draft'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'SALES'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.can_delete_sales_voucher(v_created_by UUID, v_status public.sales_voucher_status)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'ADMIN'
  )
  OR (
    v_created_by = auth.uid()
    AND v_status = 'draft'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'SALES'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 2. Replace all RLS policies to use the new functions
DROP POLICY IF EXISTS "SalesVouchers: Insert by sales" ON public.sales_vouchers;
CREATE POLICY "SalesVouchers: Insert by sales" ON public.sales_vouchers FOR INSERT
WITH CHECK (public.can_insert_sales_voucher());

DROP POLICY IF EXISTS "SalesVouchers: View access" ON public.sales_vouchers;
CREATE POLICY "SalesVouchers: View access" ON public.sales_vouchers FOR SELECT
USING (public.can_view_sales_voucher(farm_id));

DROP POLICY IF EXISTS "SalesVouchers: Update by creator or admin" ON public.sales_vouchers;
CREATE POLICY "SalesVouchers: Update by creator or admin" ON public.sales_vouchers FOR UPDATE
USING (public.can_update_sales_voucher(created_by, status))
WITH CHECK (public.can_update_sales_voucher(created_by, status));

DROP POLICY IF EXISTS "SalesVouchers: Delete by admin or sales owner" ON public.sales_vouchers;
CREATE POLICY "SalesVouchers: Delete by admin or sales owner" ON public.sales_vouchers FOR DELETE
USING (public.can_delete_sales_voucher(created_by, status));
