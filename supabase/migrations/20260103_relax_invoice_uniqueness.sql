-- ROBUST SQL: Allow Multiple Products per Invoice
-- This script dynamically finds and drops any existing unique constraint 
-- that is ONLY on the 'invoice_number' column.

DO $$
DECLARE
    constraint_name_var TEXT;
BEGIN
    -- 1. Search for any UNIQUE constraint that includes ONLY 'invoice_number'
    -- This handles cases where the name is auto-generated (e.g., invoices_invoice_number_key)
    SELECT conname INTO constraint_name_var
    FROM pg_constraint con
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
    WHERE con.contype = 'u' 
      AND con.conrelid = 'invoices'::regclass
      AND (SELECT count(*) FROM unnest(con.conkey)) = 1
      AND a.attname = 'invoice_number';

    IF constraint_name_var IS NOT NULL THEN
        EXECUTE 'ALTER TABLE invoices DROP CONSTRAINT ' || constraint_name_var;
        RAISE NOTICE 'Dropped discovered constraint: %', constraint_name_var;
    ELSE
        RAISE NOTICE 'No single-column unique constraint found on invoice_number.';
    END IF;

    -- 2. Explicitly drop common names just in case search logic fails in some PG environments
    ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;
    ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_unique;

    -- 3. Add the new composite constraint: 
    -- Allows same invoice number for DIFFERENT products, 
    -- but prevents SAME PRODUCT in SAME INVOICE twice.
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'invoices_invoice_number_product_id_key') THEN
        ALTER TABLE invoices ADD CONSTRAINT invoices_invoice_number_product_id_key UNIQUE (invoice_number, product_id);
        RAISE NOTICE 'New composite constraint added: (invoice_number, product_id)';
    END IF;
END $$;
