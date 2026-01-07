-- Migration: fix_invoice_constraint.sql

-- 1. Drop the old unique constraint on invoice_number alone
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;

-- 2. Add new composite unique constraint on (invoice_number, product_id)
-- This allows the same invoice number to be used for different products
ALTER TABLE invoices ADD CONSTRAINT invoices_invoice_number_product_id_key UNIQUE (invoice_number, product_id);
