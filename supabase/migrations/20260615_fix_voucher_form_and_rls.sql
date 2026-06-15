-- ============================================================================
-- MORVARID SYSTEM: Fix voucher form structure + RLS trigger issue
-- Migration: 20260615_fix_voucher_form_and_rls.sql
-- 1. Add driver_name and driver_phone columns to sales_vouchers
-- 2. Fix inventory_transactions RLS violation by making trigger functions
--    SECURITY DEFINER so they can write to inventory_transactions table
-- ============================================================================

-- =========================
-- 1. ADD DRIVER COLUMNS TO sales_vouchers
-- =========================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales_vouchers' AND column_name = 'driver_name'
  ) THEN
    ALTER TABLE public.sales_vouchers ADD COLUMN driver_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales_vouchers' AND column_name = 'driver_phone'
  ) THEN
    ALTER TABLE public.sales_vouchers ADD COLUMN driver_phone TEXT;
  END IF;
END $$;

-- =========================
-- 2. FIX RLS VIOLATION ON inventory_transactions
-- The process_sales_voucher_inventory and reverse_sales_voucher_inventory
-- trigger functions need SECURITY DEFINER to write to inventory_transactions,
-- which has RLS that only allows admin to INSERT.
-- =========================

CREATE OR REPLACE FUNCTION public.process_sales_voucher_inventory()
RETURNS TRIGGER AS $$
DECLARE
  line RECORD;
  txn_count INTEGER;
BEGIN
  -- Only process when changing from draft to submitted
  IF NEW.status = 'submitted' AND (OLD.status = 'draft' OR OLD.status IS NULL) THEN
    -- Safeguard 1: Check if inventory already applied
    IF NEW.inventory_applied = true THEN
      RAISE WARNING 'موجودی انبار قبلاً برای این حواله کسر شده است.';
      RETURN NEW;
    END IF;

    -- Safeguard 2: Check if transactions already exist for this voucher
    SELECT COUNT(*) INTO txn_count
    FROM public.inventory_transactions
    WHERE source_type = 'sales_voucher' AND source_id = NEW.id;

    IF txn_count > 0 THEN
      RAISE WARNING 'تراکنش‌های انبار قبلاً برای این حواله ثبت شده است.';
      RETURN NEW;
    END IF;

    -- Create inventory transactions for each line
    FOR line IN
      SELECT * FROM public.sales_voucher_lines WHERE voucher_id = NEW.id
    LOOP
      INSERT INTO public.inventory_transactions (
        farm_id, product_id, txn_type, txn_date,
        qty_out, qty_out_kg,
        source_type, source_id, reference_number,
        notes, created_by
      ) VALUES (
        NEW.farm_id, line.product_id, 'sale', NEW.voucher_date,
        line.quantity, 0,
        'sales_voucher', NEW.id, NEW.voucher_number,
        'فروش از طریق حواله فروش ' || NEW.voucher_number, NEW.created_by
      );
    END LOOP;

    -- Set inventory_applied flag
    NEW.inventory_applied := true;
    NEW.submitted_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Reverse function also needs SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.reverse_sales_voucher_inventory()
RETURNS TRIGGER AS $$
DECLARE
  line RECORD;
BEGIN
  -- Only process when changing to cancelled
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- If inventory was applied, create reversal transactions
    IF OLD.inventory_applied = true THEN
      FOR line IN
        SELECT * FROM public.sales_voucher_lines WHERE voucher_id = NEW.id
      LOOP
        -- Safeguard: Check if reversal already exists
        IF NOT EXISTS (
          SELECT 1 FROM public.inventory_transactions
          WHERE source_type = 'sales_voucher' AND source_id = NEW.id
            AND txn_type = 'sale_reversal' AND product_id = line.product_id
        ) THEN
          INSERT INTO public.inventory_transactions (
            farm_id, product_id, txn_type, txn_date,
            qty_in, qty_in_kg,
            source_type, source_id, reference_number,
            notes, created_by
          ) VALUES (
            NEW.farm_id, line.product_id, 'sale_reversal', NEW.voucher_date,
            line.quantity, 0,
            'sales_voucher', NEW.id, NEW.voucher_number,
            'برگشت از فروش - کنسل حواله ' || NEW.voucher_number, NEW.created_by
          );
        END IF;
      END LOOP;

      -- Mark inventory as not applied (reversed)
      NEW.inventory_applied := false;
    END IF;

    NEW.cancelled_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
