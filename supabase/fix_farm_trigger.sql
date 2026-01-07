-- Run this script in the Supabase SQL Editor to fix the "FOREACH expression must yield an array" error.

CREATE OR REPLACE FUNCTION public.validate_farm_product_ids()
RETURNS TRIGGER AS $$
DECLARE
  pid TEXT;
  pid_uuid UUID;
  p_ids JSONB;
BEGIN
  IF NEW.product_ids IS NULL THEN
    -- Default to empty array if null
    IF pg_typeof(NEW.product_ids) = 'jsonb'::regtype THEN
       NEW.product_ids := '[]'::jsonb;
    ELSE
       NEW.product_ids := '{}';
    END IF;
    RETURN NEW;
  END IF;

  -- Unified iteration handling (works for TEXT[] and JSONB)
  p_ids := to_jsonb(NEW.product_ids);

  IF jsonb_typeof(p_ids) = 'array' THEN
    FOR pid IN SELECT * FROM jsonb_array_elements_text(p_ids) LOOP
      BEGIN
        pid_uuid := pid::uuid;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid product id in farms.product_ids: %', pid;
      END;

      IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = pid_uuid) THEN
        RAISE EXCEPTION 'Unknown product id in farms.product_ids: %', pid;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
