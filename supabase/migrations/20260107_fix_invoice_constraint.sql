-- Fix Invoice Duplicate Constraint
-- Allows same invoice number for DIFFERENT products, but prevents SAME PRODUCT in SAME INVOICE twice.
-- This resolves Error 409 Conflict when saving multiple products with same Invoice Number.

DO $$
BEGIN
    -- 1. Drop the old unique constraint on invoice_number alone (if it exists)
    ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;

    -- 2. Add the new composite constraint: (invoice_number, product_id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema='public' AND table_name='invoices' 
        AND constraint_name='invoices_invoice_number_product_id_key'
    ) THEN
        ALTER TABLE public.invoices 
            ADD CONSTRAINT invoices_invoice_number_product_id_key UNIQUE (invoice_number, product_id);
        RAISE NOTICE 'Added composite constraint invoices_invoice_number_product_id_key';
    ELSE
        RAISE NOTICE 'Composite constraint invoices_invoice_number_product_id_key already exists';
    END IF;
END $$;
