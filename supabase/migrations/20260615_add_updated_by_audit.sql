-- Migration: Add updated_by audit tracking to sales_vouchers
-- Date: 2026-06-15
-- Purpose: Track who last edited each sales voucher

-- 1. Add updated_by column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales_vouchers'
      AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.sales_vouchers
    ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- 2. Update the set_sales_voucher_updated_at trigger to also set updated_by
CREATE OR REPLACE FUNCTION public.set_sales_voucher_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;
