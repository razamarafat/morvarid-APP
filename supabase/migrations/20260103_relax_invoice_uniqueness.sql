-- Relax invoice number uniqueness to allow multiple products per invoice
-- 1. Identify the existing unique constraint (usually named automatically by Supabase or previously set)
-- 2. Replace it with a composite constraint on (invoice_number, product_id)

DO $$ 
BEGIN
    -- Drop the old constraint if it exists. 
    -- It might be named simple 'invoices_invoice_number_key' if created via dashboard or raw SQL.
    ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;
    
    -- Also check for common auto-generated names just in case
    ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_unique;

    -- Add the new relaxed constraint: One invoice number can have multiple products,
    -- but the SAME product cannot be repeated for the SAME invoice number (prevents double entry).
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'invoices_invoice_number_product_id_key') THEN
        ALTER TABLE invoices 
        ADD CONSTRAINT invoices_invoice_number_product_id_key UNIQUE (invoice_number, product_id);
    END IF;
END $$;
