-- Migration: Backfill daily_statistics.current_inventory to include separation_amount
-- Date: 2026-06-10
-- 
-- Context: A bug fix now includes separation_amount in the remaining calculation for
-- non-shrink-pack products. This migration backfills ALL existing rows so the stored
-- current_inventory matches the corrected formula.
--
-- Formula (non-shrink-pack):
--   current_inventory = previous_balance + production + separation_amount - sales
--
-- Formula (shrink pack, unchanged):
--   current_inventory = previous_balance + production - sales
--
-- Shrink pack definition: product name contains ('شیرینگ' OR 'شیرینک') AND '۶'
-- This mirrors the frontend's isShrinkPack() utility in src/utils/sortUtils.ts

-- =========================
-- STEP 1: Backfill non-shrink-pack products
-- =========================
-- Only update rows where current_inventory is NOT already correct.
-- We detect this by checking if the stored value differs from the computed value.
-- This makes the migration idempotent (safe to re-run).

DO $$
DECLARE
    updated_count INTEGER;
    skipped_count INTEGER;
BEGIN
    -- Count how many rows will be updated
    SELECT COUNT(*) INTO updated_count
    FROM public.daily_statistics ds
    JOIN public.products p ON ds.product_id = p.id
    WHERE NOT (
        (p.name LIKE '%شیرینگ%' OR p.name LIKE '%شیرینک%') 
        AND p.name LIKE '%۶%'
    );
    
    RAISE NOTICE 'Total non-shrink-pack statistics rows: %', updated_count;

    -- Perform the update (only rows that actually need it — idempotent)
    WITH updated AS (
        UPDATE public.daily_statistics ds
        SET 
            current_inventory = ds.previous_balance + ds.production + COALESCE(ds.separation_amount, 0) - ds.sales,
            current_inventory_kg = ds.previous_balance_kg + ds.production_kg - ds.sales_kg,
            updated_at = now()
        FROM public.products p
        WHERE ds.product_id = p.id
          AND NOT (
              (p.name LIKE '%شیرینگ%' OR p.name LIKE '%شیرینک%') 
              AND p.name LIKE '%۶%'
          )
          AND ds.current_inventory != (ds.previous_balance + ds.production + COALESCE(ds.separation_amount, 0) - ds.sales)
        RETURNING ds.id
    )
    SELECT COUNT(*) INTO updated_count FROM updated;

    RAISE NOTICE 'Rows backfilled (non-shrink-pack): %', updated_count;
END $$;

-- =========================
-- STEP 2: Verify the backfill
-- =========================
-- Show a sample of recalculated values for manual verification
SELECT 
    p.name AS product_name,
    ds.date,
    ds.previous_balance,
    ds.production,
    COALESCE(ds.separation_amount, 0) AS separation_amount,
    ds.sales,
    ds.current_inventory AS new_current_inventory,
    (ds.previous_balance + ds.production + COALESCE(ds.separation_amount, 0) - ds.sales) AS computed_check,
    CASE 
        WHEN ds.current_inventory = (ds.previous_balance + ds.production + COALESCE(ds.separation_amount, 0) - ds.sales) 
        THEN 'OK' 
        ELSE 'MISMATCH' 
    END AS verification
FROM public.daily_statistics ds
JOIN public.products p ON ds.product_id = p.id
WHERE NOT (
    (p.name LIKE '%شیرینگ%' OR p.name LIKE '%شیرینک%') 
    AND p.name LIKE '%۶%'
)
ORDER BY ds.date DESC, p.name
LIMIT 20;

-- =========================
-- STEP 3: Confirm shrink pack rows are UNCHANGED
-- =========================
SELECT 
    p.name AS product_name,
    COUNT(*) AS row_count,
    'UNCHANGED - shrink pack exclusion applied' AS status
FROM public.daily_statistics ds
JOIN public.products p ON ds.product_id = p.id
WHERE (p.name LIKE '%شیرینگ%' OR p.name LIKE '%شیرینک%') 
  AND p.name LIKE '%۶%'
GROUP BY p.name;
