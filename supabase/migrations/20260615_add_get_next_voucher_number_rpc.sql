-- ============================================================================
-- MORVARID SYSTEM: Fix missing get_next_sales_voucher_number RPC
-- Migration: 20260615_add_get_next_voucher_number_rpc.sql
-- The original migration created a sequence and trigger for auto-generating
-- voucher numbers on INSERT, but forgot to create the RPC function that the
-- frontend calls to preview the next voucher number before creation.
-- ============================================================================

-- RPC function to get the next sales voucher number without consuming it
-- Used by the frontend to show the user what number their voucher will have
CREATE OR REPLACE FUNCTION public.get_next_sales_voucher_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  -- Get the next value from the sequence without advancing it
  SELECT last_value + 1 INTO next_num FROM public.sales_voucher_number_seq;
  
  -- If sequence hasn't been used yet, start from 1
  IF next_num IS NULL THEN
    next_num := 1;
  END IF;
  
  RETURN 'SV-' || LPAD(next_num::TEXT, 4, '0');
END;
$$;
