-- Add converted_amount to handle partial conversions in a single record
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS converted_amount INTEGER DEFAULT 0;

-- Comment: This field stores the portion of the total_cartons that was converted from the source_product_id.
-- Example: Sell 150 Simple. 25 avail in Simple, 125 from Printable.
-- Record: Product=Simple, Total=150, converted_amount=125, source=Printable.
-- Logic: Deduct (150-125) from Simple. Deduct 125 from Printable.
