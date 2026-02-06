-- Migration: Add Inventory Conversion Tracking Fields
-- Date: 2026-02-04
-- Description: Adds is_converted and source_product_id to invoices for tracking product conversions

-- Add is_converted flag to invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'invoices' 
    AND column_name = 'is_converted'
  ) THEN
    ALTER TABLE public.invoices 
      ADD COLUMN is_converted BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add source_product_id to track original product before conversion
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'invoices' 
    AND column_name = 'source_product_id'
  ) THEN
    ALTER TABLE public.invoices 
      ADD COLUMN source_product_id UUID REFERENCES public.products(id);
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN public.invoices.is_converted IS 'آیا این فروش از تبدیل موجودی محصول دیگر است';
COMMENT ON COLUMN public.invoices.source_product_id IS 'شناسه محصول مبدأ در صورت تبدیل (مثلاً پرینتی که به جای ساده فروخته شد)';
