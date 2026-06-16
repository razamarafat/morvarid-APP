-- ============================================================================
-- Migration: Remove Cancel/Draft Concepts & Simplify Sales Voucher System
-- Date: 2026-06-16
-- Purpose:
--   1. Remove cancel/draft concepts: status defaults to 'submitted'
--   2. Inventory now tracked at line-level via triggers (INSERT/UPDATE/DELETE)
--   3. Simplify RLS (no more status='draft' gating)
--   4. Drop obsolete triggers (status-change inventory, reverse, check_update)
-- ============================================================================

-- 1. Table defaults: new vouchers are immediately registered
ALTER TABLE public.sales_vouchers
  ALTER COLUMN status SET DEFAULT 'submitted'::public.sales_voucher_status,
  ALTER COLUMN inventory_applied SET DEFAULT true,
  ALTER COLUMN submitted_at SET DEFAULT now();

-- 2. Clean up old triggers/functions
DROP TRIGGER IF EXISTS tr_sales_voucher_inventory ON public.sales_vouchers;
DROP TRIGGER IF EXISTS tr_sales_voucher_reverse ON public.sales_vouchers;
DROP TRIGGER IF EXISTS tr_sales_voucher_check_update ON public.sales_vouchers;

DROP FUNCTION IF EXISTS public.process_sales_voucher_inventory();
DROP FUNCTION IF EXISTS public.reverse_sales_voucher_inventory();
DROP FUNCTION IF EXISTS public.check_sales_voucher_update();

-- 3. Simplify RLS helper functions (remove status='draft' checks)
CREATE OR REPLACE FUNCTION public.can_update_sales_voucher(v_created_by UUID, v_status public.sales_voucher_status)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
      OR (v_created_by = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'SALES'));
END;
$$;

CREATE OR REPLACE FUNCTION public.can_delete_sales_voucher(v_created_by UUID, v_status public.sales_voucher_status)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
      OR (v_created_by = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'SALES'));
END;
$$;

CREATE OR REPLACE FUNCTION public.can_insert_sales_voucher_line(v_voucher_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_created_by uuid;
BEGIN
  SELECT created_by INTO v_created_by FROM public.sales_vouchers WHERE id = v_voucher_id;
  RETURN EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.role = 'ADMIN' OR (p.role = 'SALES' AND v_created_by = auth.uid())));
END;
$$;

CREATE OR REPLACE FUNCTION public.can_modify_sales_voucher_line(v_voucher_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_created_by uuid;
BEGIN
  SELECT created_by INTO v_created_by FROM public.sales_vouchers WHERE id = v_voucher_id;
  RETURN EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.role = 'ADMIN' OR (p.role = 'SALES' AND v_created_by = auth.uid())));
END;
$$;

-- 4. Line-level inventory trigger (handles INSERT/UPDATE/DELETE on lines)
CREATE OR REPLACE FUNCTION public.process_sales_voucher_line_inventory()
RETURNS TRIGGER AS $$
DECLARE
  v_farm_id UUID;
  v_voucher_date TEXT;
  v_voucher_number TEXT;
  v_created_by UUID;
  v_exists INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT farm_id, voucher_date, voucher_number, created_by 
      INTO v_farm_id, v_voucher_date, v_voucher_number, v_created_by
      FROM public.sales_vouchers WHERE id = NEW.voucher_id;
      
    INSERT INTO public.inventory_transactions (
      farm_id, product_id, txn_type, txn_date, qty_out, qty_out_kg,
      source_type, source_id, reference_number, notes, created_by
    ) VALUES (
      v_farm_id, NEW.product_id, 'sale', v_voucher_date, NEW.quantity, 0,
      'sales_voucher', NEW.voucher_id, v_voucher_number,
      'فروش - حواله ' || COALESCE(v_voucher_number, ''), v_created_by
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.quantity != NEW.quantity OR OLD.product_id != NEW.product_id THEN
      SELECT farm_id, voucher_date, voucher_number, created_by 
        INTO v_farm_id, v_voucher_date, v_voucher_number, v_created_by
        FROM public.sales_vouchers WHERE id = NEW.voucher_id;
        
      -- Reverse old line
      INSERT INTO public.inventory_transactions (
        farm_id, product_id, txn_type, txn_date, qty_in, qty_in_kg,
        source_type, source_id, reference_number, notes, created_by
      ) VALUES (
        v_farm_id, OLD.product_id, 'sale_reversal', v_voucher_date, OLD.quantity, 0,
        'sales_voucher', OLD.voucher_id, v_voucher_number,
        'ویرایش - برگشت ' || COALESCE(v_voucher_number, ''), v_created_by
      );
      
      -- Apply new line
      INSERT INTO public.inventory_transactions (
        farm_id, product_id, txn_type, txn_date, qty_out, qty_out_kg,
        source_type, source_id, reference_number, notes, created_by
      ) VALUES (
        v_farm_id, NEW.product_id, 'sale', v_voucher_date, NEW.quantity, 0,
        'sales_voucher', NEW.voucher_id, v_voucher_number,
        'ویرایش - ثبت جدید ' || COALESCE(v_voucher_number, ''), v_created_by
      );
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Check if parent voucher still exists (for CASCADE deletes)
    SELECT COUNT(*) INTO v_exists FROM public.sales_vouchers WHERE id = OLD.voucher_id;
    IF v_exists > 0 THEN
      SELECT farm_id, voucher_date, voucher_number, created_by 
        INTO v_farm_id, v_voucher_date, v_voucher_number, v_created_by
        FROM public.sales_vouchers WHERE id = OLD.voucher_id;
    END IF;
      
    INSERT INTO public.inventory_transactions (
      farm_id, product_id, txn_type, txn_date, qty_in, qty_in_kg,
      source_type, source_id, reference_number, notes, created_by
    ) VALUES (
      v_farm_id, OLD.product_id, 'sale_reversal', v_voucher_date, OLD.quantity, 0,
      'sales_voucher', OLD.voucher_id, v_voucher_number,
      'حذف - برگشت ' || COALESCE(v_voucher_number, ''), v_created_by
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. Attach line-level triggers
DROP TRIGGER IF EXISTS tr_sales_voucher_line_inventory_ins_upd ON public.sales_voucher_lines;
CREATE TRIGGER tr_sales_voucher_line_inventory_ins_upd
  AFTER INSERT OR UPDATE ON public.sales_voucher_lines
  FOR EACH ROW EXECUTE FUNCTION public.process_sales_voucher_line_inventory();

DROP TRIGGER IF EXISTS tr_sales_voucher_line_inventory_del ON public.sales_voucher_lines;
CREATE TRIGGER tr_sales_voucher_line_inventory_del
  BEFORE DELETE ON public.sales_voucher_lines
  FOR EACH ROW EXECUTE FUNCTION public.process_sales_voucher_line_inventory();

-- 6. Update existing data: set all non-cancelled vouchers to 'submitted'
UPDATE public.sales_vouchers
SET status = 'submitted',
    inventory_applied = true,
    submitted_at = COALESCE(submitted_at, created_at, now())
WHERE status = 'draft';
