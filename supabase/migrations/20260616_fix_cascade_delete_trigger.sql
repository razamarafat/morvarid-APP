-- ============================================================================
-- Migration: Fix CASCADE delete trigger - handle NULL parent voucher data
-- Date: 2026-06-16
-- Purpose: During CASCADE deletes (DELETE FROM sales_vouchers), the BEFORE DELETE
-- trigger on sales_voucher_lines tries to SELECT from the parent sales_vouchers
-- table. Due to PostgreSQL CASCADE semantics, this SELECT can return NULL values
-- even with SECURITY DEFINER. The INSERT into inventory_transactions then fails
-- with "null value in column farm_id".
--
-- Fix: Add IF v_farm_id IS NOT NULL guard before the reversal INSERT in the
-- DELETE handler. If parent data can't be read (CASCADE), skip the reversal.
-- If parent data IS readable (direct line deletion), create the reversal.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_sales_voucher_line_inventory()
RETURNS TRIGGER AS $$
DECLARE
  v_farm_id UUID;
  v_voucher_date TEXT;
  v_voucher_number TEXT;
  v_created_by UUID;
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
        
      INSERT INTO public.inventory_transactions (
        farm_id, product_id, txn_type, txn_date, qty_in, qty_in_kg,
        source_type, source_id, reference_number, notes, created_by
      ) VALUES (
        v_farm_id, OLD.product_id, 'sale_reversal', v_voucher_date, OLD.quantity, 0,
        'sales_voucher', OLD.voucher_id, v_voucher_number,
        'ویرایش - برگشت ' || COALESCE(v_voucher_number, ''), v_created_by
      );
      
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
    SELECT farm_id, voucher_date, voucher_number, created_by 
      INTO v_farm_id, v_voucher_date, v_voucher_number, v_created_by
      FROM public.sales_vouchers WHERE id = OLD.voucher_id;
    
    -- Guard: skip reversal if parent data couldn't be read (CASCADE delete)
    IF v_farm_id IS NOT NULL THEN
      INSERT INTO public.inventory_transactions (
        farm_id, product_id, txn_type, txn_date, qty_in, qty_in_kg,
        source_type, source_id, reference_number, notes, created_by
      ) VALUES (
        v_farm_id, OLD.product_id, 'sale_reversal', v_voucher_date, OLD.quantity, 0,
        'sales_voucher', OLD.voucher_id, v_voucher_number,
        'حذف - برگشت ' || COALESCE(v_voucher_number, ''), v_created_by
      );
    END IF;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
