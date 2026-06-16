-- ============================================================================
-- Migration: Fix voucher_number whitespace handling + unique index
-- Date: 2026-06-16
-- Purpose:
--   1. Clean existing voucher numbers with trailing spaces
--   2. Replace the full unique index with a TRIM-based partial index
--      that excludes cancelled vouchers, preventing false duplicate errors
--      from whitespace mismatches and allowing cancelled numbers to be reused.
-- ============================================================================

-- 1. Clean existing data: trim whitespace from all voucher numbers
UPDATE public.sales_vouchers
SET voucher_number = TRIM(voucher_number)
WHERE voucher_number != TRIM(voucher_number);

-- 2. Drop the old full unique index that doesn't handle whitespace
DROP INDEX IF EXISTS public.idx_sales_vouchers_number_unique;

-- 3. Create new unique index on TRIMMED voucher_number,
--    excluding cancelled vouchers so their numbers can be reused.
--    This is a safe approach: cancelled vouchers are historical records
--    but should not permanently lock their numbers.
CREATE UNIQUE INDEX idx_sales_vouchers_number_active_unique
ON public.sales_vouchers (TRIM(voucher_number))
WHERE status != 'cancelled';
