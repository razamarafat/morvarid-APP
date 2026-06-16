-- ============================================================================
-- Migration: Fix sales_vouchers INSERT RLS + comprehensive policy hardening
-- Date: 2026-06-16
-- Purpose: Ensure sales_vouchers INSERT works for SALES/ADMIN users by using
-- SECURITY DEFINER functions that bypass profiles RLS during policy evaluation.
-- Also ensures UPDATE and DELETE policies are correctly configured.
-- ============================================================================

-- 1. Ensure SECURITY DEFINER helper functions exist for all operations
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

-- 2. Drop all existing sales_vouchers policies to avoid conflicts
DROP POLICY IF EXISTS "SalesVouchers: Insert by sales" ON public.sales_vouchers;
DROP POLICY IF EXISTS "SalesVouchers: View access" ON public.sales_vouchers;
DROP POLICY IF EXISTS "SalesVouchers: Update draft" ON public.sales_vouchers;
DROP POLICY IF EXISTS "SalesVouchers: Update by creator or admin" ON public.sales_vouchers;
DROP POLICY IF EXISTS "SalesVouchers: Delete by admin" ON public.sales_vouchers;
DROP POLICY IF EXISTS "SalesVouchers: Delete by admin or sales owner" ON public.sales_vouchers;

-- 3. Create definitive policies using SECURITY DEFINER functions
CREATE POLICY "SalesVouchers: Insert by sales" ON public.sales_vouchers FOR INSERT
WITH CHECK (public.can_insert_sales_voucher());

CREATE POLICY "SalesVouchers: View access" ON public.sales_vouchers FOR SELECT
USING (public.can_view_sales_voucher(farm_id));

CREATE POLICY "SalesVouchers: Update by creator or admin" ON public.sales_vouchers FOR UPDATE
USING (public.can_update_sales_voucher(created_by, status))
WITH CHECK (public.can_update_sales_voucher(created_by, status));

CREATE POLICY "SalesVouchers: Delete by admin or sales owner" ON public.sales_vouchers FOR DELETE
USING (public.can_delete_sales_voucher(created_by, status));

-- 4. Re-apply lines RLS policies with SECURITY DEFINER functions
CREATE OR REPLACE FUNCTION public.can_insert_sales_voucher_line(v_voucher_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_status text;
  v_created_by uuid;
BEGIN
  SELECT status, created_by INTO v_status, v_created_by
  FROM public.sales_vouchers
  WHERE id = v_voucher_id;

  IF v_status IS NULL OR v_status != 'draft' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.role = 'ADMIN' OR (p.role = 'SALES' AND v_created_by = auth.uid()))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_modify_sales_voucher_line(v_voucher_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_status text;
  v_created_by uuid;
BEGIN
  SELECT status, created_by INTO v_status, v_created_by
  FROM public.sales_vouchers
  WHERE id = v_voucher_id;

  IF v_status IS NULL OR v_status != 'draft' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.role = 'ADMIN' OR (p.role = 'SALES' AND v_created_by = auth.uid()))
  );
END;
$$;

-- Drop and recreate lines policies
DROP POLICY IF EXISTS "SalesVoucherLines: Insert by sales" ON public.sales_voucher_lines;
DROP POLICY IF EXISTS "SalesVoucherLines: Update draft" ON public.sales_voucher_lines;
DROP POLICY IF EXISTS "SalesVoucherLines: Delete draft" ON public.sales_voucher_lines;

CREATE POLICY "SalesVoucherLines: Insert by sales" ON public.sales_voucher_lines
  FOR INSERT
  WITH CHECK (public.can_insert_sales_voucher_line(voucher_id));

CREATE POLICY "SalesVoucherLines: Update draft" ON public.sales_voucher_lines
  FOR UPDATE
  USING (public.can_modify_sales_voucher_line(voucher_id))
  WITH CHECK (public.can_modify_sales_voucher_line(voucher_id));

CREATE POLICY "SalesVoucherLines: Delete draft" ON public.sales_voucher_lines
  FOR DELETE
  USING (public.can_modify_sales_voucher_line(voucher_id));

-- 5. Also fix the sales_voucher_lines SELECT policy to use SECURITY DEFINER
DROP POLICY IF EXISTS "SalesVoucherLines: View access" ON public.sales_voucher_lines;

CREATE OR REPLACE FUNCTION public.can_view_sales_voucher_lines(v_voucher_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_farm_id uuid;
BEGIN
  SELECT farm_id INTO v_farm_id
  FROM public.sales_vouchers
  WHERE id = v_voucher_id;

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
$$;

CREATE POLICY "SalesVoucherLines: View access" ON public.sales_voucher_lines FOR SELECT
USING (public.can_view_sales_voucher_lines(voucher_id));
