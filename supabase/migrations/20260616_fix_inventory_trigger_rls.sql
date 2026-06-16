-- ============================================================================
-- Migration: Fix inventory trigger RLS violation
-- Date: 2026-06-16
-- Problem: process_sales_voucher_line_inventory() inserts into
--   inventory_transactions without SECURITY DEFINER, causing RLS violation
--   when a SALES user creates a voucher.
-- Fix: Mark the function as SECURITY DEFINER so trigger operations bypass RLS.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_sales_voucher_line_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
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
$$;
