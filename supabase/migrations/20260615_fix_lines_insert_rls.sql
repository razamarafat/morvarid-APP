-- Migration: Fix cross-table RLS for sales_voucher_lines INSERT
-- Date: 2026-06-15
-- Problem: The INSERT policy on sales_voucher_lines had inline EXISTS checks
-- on sales_vouchers and profiles tables that ran without SECURITY DEFINER,
-- causing RLS violations when sales users created vouchers with line items.

-- 1. Create a SECURITY DEFINER helper function for line INSERT check
CREATE OR REPLACE FUNCTION public.can_insert_sales_voucher_line(v_voucher_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_created_by uuid;
BEGIN
  -- Get the voucher's status and creator
  SELECT status, created_by INTO v_status, v_created_by
  FROM public.sales_vouchers
  WHERE id = v_voucher_id;

  -- Voucher must exist and be in draft status
  IF v_status IS NULL OR v_status != 'draft' THEN
    RETURN false;
  END IF;

  -- User must be admin OR the sales user who created the voucher
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.role = 'ADMIN' OR (p.role = 'SALES' AND v_created_by = auth.uid()))
  );
END;
$$;

-- 2. Drop the old INSERT policy
DROP POLICY IF EXISTS "SalesVoucherLines: Insert by sales" ON public.sales_voucher_lines;

-- 3. Create the new INSERT policy using the SECURITY DEFINER function
CREATE POLICY "SalesVoucherLines: Insert by sales" ON public.sales_voucher_lines
  FOR INSERT
  WITH CHECK (public.can_insert_sales_voucher_line(voucher_id));

-- 4. Also fix UPDATE and DELETE policies for sales_voucher_lines (same cross-table RLS issue)
CREATE OR REPLACE FUNCTION public.can_modify_sales_voucher_line(v_voucher_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

DROP POLICY IF EXISTS "SalesVoucherLines: Update draft" ON public.sales_voucher_lines;
CREATE POLICY "SalesVoucherLines: Update draft" ON public.sales_voucher_lines
  FOR UPDATE
  USING (public.can_modify_sales_voucher_line(voucher_id))
  WITH CHECK (public.can_modify_sales_voucher_line(voucher_id));

DROP POLICY IF EXISTS "SalesVoucherLines: Delete draft" ON public.sales_voucher_lines;
CREATE POLICY "SalesVoucherLines: Delete draft" ON public.sales_voucher_lines
  FOR DELETE
  USING (public.can_modify_sales_voucher_line(voucher_id));
