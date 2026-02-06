-- Drop the old unique constraint
DROP INDEX IF EXISTS invoices_invoice_number_product_id_key;

-- Create a new unique constraint that allows same product if conversion status differs
-- effectively: (invoice_number, product_id, is_converted)
CREATE UNIQUE INDEX invoices_invoice_number_product_id_converted_key 
ON public.invoices (invoice_number, product_id, is_converted);
