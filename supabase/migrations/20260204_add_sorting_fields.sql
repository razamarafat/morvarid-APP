-- Migration: Add Sorting Fields for Smart Inventory Logic
-- Date: 2026-02-04
-- Description: Adds separation_amount to daily_statistics and is_sorted to invoices

-- Add separation_amount to daily_statistics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'daily_statistics' 
    AND column_name = 'separation_amount'
  ) THEN
    ALTER TABLE public.daily_statistics 
      ADD COLUMN separation_amount NUMERIC NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add is_sorted to invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'invoices' 
    AND column_name = 'is_sorted'
  ) THEN
    ALTER TABLE public.invoices 
      ADD COLUMN is_sorted BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN public.daily_statistics.separation_amount IS 'مقدار تقریبی جداسازی/ضایعات سورت';
COMMENT ON COLUMN public.invoices.is_sorted IS 'آیا فروش از موجودی سورت شده است';
