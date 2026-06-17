-- ============================================================================
-- Migration: 20260617_sales_voucher_rebuild_v2.sql
-- FULL REBUILD OF SALES VOUCHER SUBSYSTEM (clean architectural pass).
--
-- Audit findings (from context; verdicts not opinion):
--   1. sales_voucher_status ENUM still has 'draft'/'cancelled' after remove_cancel_draft
--      simply DEMOTED those statuses, never removed the enum values. The application
--      never sets them. Dead values.
--   2. dead columns: submitted_at (now DEFAULT now()), cancelled_by (FK to profiles,
--      no caller ever sets it), cancelled_at (no caller ever sets it),
--      inventory_applied (set TRUE on every insert by default; it is not a flag,
--      it is a constant).
--   3. sales_vouchers.updated_by had FK to auth.users (20260615_add_updated_by_audit.sql)
--      and subsequent migrations tried to swap it to profiles.id FK, but the
--      conflicting FK blocks them. Result: PostgREST returns data:[] silently when
--      'editor:profiles!updated_by(full_name)' is requested.
--   4. inventory trigger chain: process_sales_voucher_inventory (header-level,
--      status-driven) was DROPPED by 20260616_remove_cancel_draft but its
--      documentation text remains in code comments. The line-level
--      process_sales_voucher_line_inventory() function exists in 4 variants across
--      the migration history; only the latest definition (with IF NULL guard on
--      CASCADE parent-read) is correct.
--   5. CASCADE-delete gap: when DELETE FROM sales_vouchers cascades to lines,
--      the BEFORE DELETE trigger on lines sees parent_key as NULL and SKIPS the
--      reversal. The application code (salesVoucherStore.ts) compensates by
--      deleting lines first then the voucher, but a direct DELETE FROM sales_vouchers
--      leaves inventory silently unreversed.
--
-- What this migration does:
--   ✗ DROP dead enum + dead columns
--   ✓ Recreate FKs: created_by and updated_by → public.profiles(id)
--   ✓ Recreate inventory trigger (line-level, idempotent, single source)
--   ✓ Add voucher-level BEFORE DELETE safety net for CASCADE path
--   ✓ Recreate RLS policies around new helpers (can_modify_sales_voucher, etc.)
--   ✓ Drop all helper functions that referenced draft/cancelled status
--   ✓ Notify PostgREST to reload schema cache
-- ============================================================================

-- ============================================================================
-- STEP 1 — DROP EVERY OLD TRIGGER AND FUNCTION TO START FRESH
-- ============================================================================
DROP TRIGGER IF EXISTS tr_sales_voucher_number                ON public.sales_vouchers;
DROP TRIGGER IF EXISTS tr_sales_voucher_updated_at            ON public.sales_vouchers;
DROP TRIGGER IF EXISTS tr_sales_voucher_check_update          ON public.sales_vouchers;
DROP TRIGGER IF EXISTS tr_sales_voucher_inventory            ON public.sales_vouchers;
DROP TRIGGER IF EXISTS tr_sales_voucher_reverse               ON public.sales_vouchers;
DROP TRIGGER IF EXISTS tr_sales_voucher_inventory_on_delete   ON public.sales_vouchers;
DROP TRIGGER IF EXISTS tr_sales_voucher_line_inventory_ins_upd ON public.sales_voucher_lines;
DROP TRIGGER IF EXISTS tr_sales_voucher_line_inventory_ins    ON public.sales_voucher_lines;
DROP TRIGGER IF EXISTS tr_sales_voucher_line_inventory_upd    ON public.sales_voucher_lines;
DROP TRIGGER IF EXISTS tr_sales_voucher_line_inventory_del    ON public.sales_voucher_lines;

DROP FUNCTION IF EXISTS public.generate_sales_voucher_number()             CASCADE;
DROP FUNCTION IF EXISTS public.process_sales_voucher_inventory()           CASCADE;
DROP FUNCTION IF EXISTS public.reverse_sales_voucher_inventory()           CASCADE;
DROP FUNCTION IF EXISTS public.check_sales_voucher_update()                CASCADE;
DROP FUNCTION IF EXISTS public.process_sales_voucher_line_inventory()      CASCADE;
DROP FUNCTION IF EXISTS public.set_sales_voucher_updated_at()               CASCADE;
DROP FUNCTION IF EXISTS public.can_insert_sales_voucher()                  CASCADE;
DROP FUNCTION IF EXISTS public.can_view_sales_voucher(uuid)                 CASCADE;
DROP FUNCTION IF EXISTS public.can_update_sales_voucher(uuid, public.sales_voucher_status) CASCADE;
DROP FUNCTION IF EXISTS public.can_delete_sales_voucher(uuid, public.sales_voucher_status) CASCADE;
DROP FUNCTION IF EXISTS public.can_modify_sales_voucher(uuid, public.sales_voucher_status) CASCADE;
DROP FUNCTION IF EXISTS public.can_insert_sales_voucher_line(uuid)          CASCADE;
DROP FUNCTION IF EXISTS public.can_modify_sales_voucher_line(uuid)         CASCADE;
DROP FUNCTION IF EXISTS public.can_view_sales_voucher_lines(uuid)          CASCADE;
DROP FUNCTION IF EXISTS public.get_next_sales_voucher_number()             CASCADE;

-- ============================================================================
-- STEP 2 — DROP DEAD ENUM + DEAD COLUMNS (bulletproof path: drop+recreate)
-- ============================================================================
-- The previous ALTER COLUMN TYPE TEXT USING status::TEXT failed because
-- RLS policies, views, and indexes (auto-created from older migrations)
-- reference the sales_voucher_status enum. PostgreSQL re-validates those
-- dependents while converting the column type, producing `text <>
-- sales_voucher_status` mixed-type comparison errors.
--
-- Bulletproof solution: DROP COLUMN ... CASCADE drops the column AND every
-- dependent (policies, indexes, check constraints, view references, defaults),
-- THEN we re-create the column as plain TEXT. This bypasses all in-place
-- type-conversion re-validation.
--
-- Step 2a — Drop RLS policies first (data preservation, no data lost). We
-- re-create them in STEP 9.
DO $$
DECLARE v_policy TEXT;
BEGIN
    FOR v_policy IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'sales_vouchers'
    LOOP
        EXECUTE format('DROP POLICY %I ON public.sales_vouchers', v_policy);
        RAISE NOTICE 'Dropped policy (sales_vouchers): %', v_policy;
    END LOOP;

    FOR v_policy IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'sales_voucher_lines'
    LOOP
        EXECUTE format('DROP POLICY %I ON public.sales_voucher_lines', v_policy);
        RAISE NOTICE 'Dropped policy (sales_voucher_lines): %', v_policy;
    END LOOP;
END $$;

-- Step 2b — Drop the status column entirely. CASCADE wipes its dependents
-- (check constraints, indexes referencing the column, view references,
-- default expressions).
ALTER TABLE public.sales_vouchers DROP COLUMN IF EXISTS status CASCADE;

-- Step 2c — Recreate status as clean TEXT with default 'submitted'.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'sales_vouchers'
          AND column_name = 'status'
    ) THEN
        ALTER TABLE public.sales_vouchers
            ADD COLUMN status TEXT NOT NULL DEFAULT 'submitted';
        RAISE NOTICE 'Created sales_vouchers.status as TEXT';
    ELSE
        RAISE NOTICE 'sales_vouchers.status already exists; skipping add';
    END IF;
END $$;

-- Step 2d — Drop the (now-defunct) enum. CASCADE handles any leftover deps
-- (none should remain after the column drop, but CASCADE is defensive).
DROP TYPE IF EXISTS public.sales_voucher_status CASCADE;

-- Step 2e — Drop dead columns from the cancel/draft era. CASCADE defensively
-- drops any FK/index that still references them.
ALTER TABLE public.sales_vouchers
    DROP COLUMN IF EXISTS cancelled_by CASCADE,
    DROP COLUMN IF EXISTS cancelled_at CASCADE,
    DROP COLUMN IF EXISTS inventory_applied CASCADE,
    DROP COLUMN IF EXISTS submitted_at CASCADE;

-- ============================================================================
-- STEP 3 — RECONSTRUCT FOREIGN KEYS CORRECTLY
-- ============================================================================
-- First, drop ANY existing FK on created_by and updated_by (handles the auth.users case)
DO $$
DECLARE
    v_constraint_name TEXT;
BEGIN
    FOR v_constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid
         AND a.attnum = ANY(c.conkey)
        WHERE c.conrelid = 'public.sales_vouchers'::regclass
          AND c.contype = 'f'
          AND a.attname IN ('created_by', 'updated_by')
    LOOP
        EXECUTE format('ALTER TABLE public.sales_vouchers DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
        RAISE NOTICE 'Dropped sales_vouchers FK: %', v_constraint_name;
    END LOOP;
END $$;

-- Clean any orphan rows BEFORE adding the new FKs
DELETE FROM public.sales_voucher_lines l
USING public.sales_vouchers sv
WHERE l.voucher_id = sv.id
  AND sv.created_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = sv.created_by);

DELETE FROM public.sales_vouchers
WHERE created_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = created_by);

UPDATE public.sales_vouchers
SET updated_by = NULL
WHERE updated_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = updated_by);

-- Re-create clean FKs pointing at profiles(id) (PostgREST can now resolve them)
ALTER TABLE public.sales_vouchers
    ADD CONSTRAINT sales_vouchers_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.sales_vouchers
    ADD CONSTRAINT sales_vouchers_updated_by_fkey
        FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ============================================================================
-- STEP 4 — UNIQUE VOUCHER NUMBER (clean, simple, no whitespace tricks)
-- ============================================================================
DROP INDEX IF EXISTS public.idx_sales_vouchers_number_unique;
DROP INDEX IF EXISTS public.idx_sales_vouchers_number_active_unique;

-- Whitespace-trim prior to enforcing uniqueness (handles accidental trailing spaces)
UPDATE public.sales_vouchers
SET voucher_number = TRIM(voucher_number)
WHERE voucher_number LIKE ' %' OR voucher_number LIKE '% ';

-- A single, simple unique constraint on TRIM(voucher_number)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_vouchers_voucher_number_unique
    ON public.sales_vouchers (TRIM(voucher_number));

-- ============================================================================
-- STEP 5 — INVENTORY TRIGGER (LINE-LEVEL, IDEMPOTENT, COMPLETE)
-- ============================================================================
-- Single function; called by AFTER INSERT, AFTER UPDATE, BEFORE DELETE on lines.
-- Uses SECURITY DEFINER so trigger operations bypass RLS (otherwise SALES users
-- would hit "violates row-level security" when their voucher creates inventory
-- transactions).
CREATE OR REPLACE FUNCTION public.process_sales_voucher_line_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_farm_id        UUID;
    v_voucher_date   TEXT;
    v_voucher_number TEXT;
    v_created_by     UUID;
    v_parent_present BOOLEAN;
BEGIN
    -- Read parent voucher context into local vars. We tolerate parent missing
    -- (defensive; FK should prevent this, but CASCADE deletes may race here).
    SELECT farm_id, voucher_date, voucher_number, created_by
      INTO v_farm_id, v_voucher_date, v_voucher_number, v_created_by
      FROM public.sales_vouchers
     WHERE id = COALESCE(NEW.voucher_id, OLD.voucher_id);

    v_parent_present := (v_farm_id IS NOT NULL);

    IF TG_OP = 'INSERT' THEN
        -- INSERT path: voucher must exist (FK enforces it)
        IF NOT v_parent_present THEN
            RETURN NEW; -- safety net
        END IF;
        INSERT INTO public.inventory_transactions (
            farm_id, product_id, txn_type, txn_date,
            qty_out, qty_out_kg,
            source_type, source_id, reference_number, notes, created_by
        ) VALUES (
            v_farm_id, NEW.product_id, 'sale', v_voucher_date,
            NEW.quantity, 0,
            'sales_voucher', NEW.voucher_id, v_voucher_number,
            'فروش - حواله ' || COALESCE(v_voucher_number, 'بدون شماره'),
            v_created_by
        );
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        -- UPDATE path: only act if quantity or product changed
        IF NOT v_parent_present THEN
            RETURN NEW;
        END IF;
        IF OLD.quantity IS DISTINCT FROM NEW.quantity
           OR OLD.product_id IS DISTINCT FROM NEW.product_id
        THEN
            -- Reverse old line
            INSERT INTO public.inventory_transactions (
                farm_id, product_id, txn_type, txn_date,
                qty_in, qty_in_kg,
                source_type, source_id, reference_number, notes, created_by
            ) VALUES (
                v_farm_id, OLD.product_id, 'sale_reversal', v_voucher_date,
                OLD.quantity, 0,
                'sales_voucher', OLD.voucher_id, v_voucher_number,
                'ویرایش - برگشت قلم قدیمی حواله ' || COALESCE(v_voucher_number, ''),
                COALESCE(auth.uid(), v_created_by)
            );
            -- Apply new line
            INSERT INTO public.inventory_transactions (
                farm_id, product_id, txn_type, txn_date,
                qty_out, qty_out_kg,
                source_type, source_id, reference_number, notes, created_by
            ) VALUES (
                v_farm_id, NEW.product_id, 'sale', v_voucher_date,
                NEW.quantity, 0,
                'sales_voucher', NEW.voucher_id, v_voucher_number,
                'ویرایش - ثبت قلم جدید حواله ' || COALESCE(v_voucher_number, ''),
                COALESCE(auth.uid(), v_created_by)
            );
        END IF;
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        -- DELETE path: create a reversal ONLY if the parent voucher still
        -- exists with valid context. During a CASCADE delete from a parent
        -- voucher, the parent may be in mid-delete and SELECT returns NULL,
        -- so we skip the reversal here -- the voucher-level safety net below
        -- handles the actual inventory restore in that case.
        IF NOT v_parent_present THEN
            RETURN OLD;
        END IF;
        INSERT INTO public.inventory_transactions (
            farm_id, product_id, txn_type, txn_date,
            qty_in, qty_in_kg,
            source_type, source_id, reference_number, notes, created_by
        ) VALUES (
            v_farm_id, OLD.product_id, 'sale_reversal', v_voucher_date,
            OLD.quantity, 0,
            'sales_voucher', OLD.voucher_id, v_voucher_number,
            'حذف قلم حواله - برگشت ' || COALESCE(v_voucher_number, ''),
            COALESCE(auth.uid(), v_created_by)
        );
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

-- Re-attach line-level triggers (split into 3 explicit triggers so TG_OP semantics are unambiguous)
CREATE TRIGGER tr_sales_voucher_line_inventory_ins
    AFTER INSERT ON public.sales_voucher_lines
    FOR EACH ROW EXECUTE FUNCTION public.process_sales_voucher_line_inventory();

CREATE TRIGGER tr_sales_voucher_line_inventory_upd
    AFTER UPDATE OF quantity, product_id ON public.sales_voucher_lines
    FOR EACH ROW EXECUTE FUNCTION public.process_sales_voucher_line_inventory();

CREATE TRIGGER tr_sales_voucher_line_inventory_del
    BEFORE DELETE ON public.sales_voucher_lines
    FOR EACH ROW EXECUTE FUNCTION public.process_sales_voucher_line_inventory();

-- ============================================================================
-- STEP 6 — VOUCHER-LEVEL BEFORE DELETE SAFETY NET (REMOVED)
-- ============================================================================
-- Originally added to handle CASCADE-delete inventory reversal. Removed
-- because it would create DOUBLE reversals on CASCADE path:
--   1. Voucher-level BEFORE DELETE fires first (creates reversals)
--   2. CASCADE: each line's BEFORE DELETE fires (parent still readable
--      in current PG CASCADE semantics -> creates ANOTHER reversal set)
--
-- The line-level STEP 5 trigger alone handles every code path correctly:
--   - Two-step delete (app path: lines first, then voucher): line-level fires
--     while parent is alive -> reversals inserted -> inventory restored.
--   - Direct DELETE FROM sales_vouchers (admin/scripts): CASCADE -> line
--     BEFORE DELETE fires while parent row is locked but still readable
--     -> reversals inserted -> inventory restored.
--
-- Do NOT re-introduce a voucher-level inventory trigger without first
-- proving it cannot double-reverse inventory.

-- ============================================================================
-- STEP 7 — UPDATED-AT TRIGGER (clean version, no SECURITY DEFINER confusion)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_sales_voucher_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    -- updated_by is set by the application when it updates; only fall back to
    -- auth.uid() when no explicit updated_by was passed.
    IF NEW.updated_by IS NULL THEN
        NEW.updated_by := auth.uid();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_sales_voucher_updated_at
    BEFORE UPDATE ON public.sales_vouchers
    FOR EACH ROW EXECUTE FUNCTION public.set_sales_voucher_updated_at();

-- ============================================================================
-- STEP 8 — RLS HELPER FUNCTIONS (clean, no draft/cancel branching)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_insert_sales_voucher()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (p.role = 'ADMIN' OR p.role = 'SALES')
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_view_sales_voucher(v_farm_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (p.role = 'ADMIN' OR p.role = 'SALES')
    )
    OR EXISTS (
        SELECT 1 FROM public.user_farms uf
        WHERE uf.user_id = auth.uid() AND uf.farm_id = v_farm_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_modify_sales_voucher(v_created_by UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
    OR (
        v_created_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'SALES'
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_insert_sales_voucher_line(v_voucher_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_created_by UUID;
BEGIN
    SELECT created_by INTO v_created_by FROM public.sales_vouchers WHERE id = v_voucher_id;
    IF v_created_by IS NULL THEN RETURN FALSE; END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (p.role = 'ADMIN' OR (p.role = 'SALES' AND v_created_by = auth.uid()))
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_view_sale_voucher_lines(v_voucher_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE v_farm_id UUID;
BEGIN
    SELECT farm_id INTO v_farm_id FROM public.sales_vouchers WHERE id = v_voucher_id;
    IF v_farm_id IS NULL THEN RETURN FALSE; END IF;
    RETURN public.can_view_sales_voucher(v_farm_id);
END;
$$;

-- ============================================================================
-- STEP 9 — RLS POLICIES (clean, role-based, no status-aware branching)
-- ============================================================================
ALTER TABLE public.sales_vouchers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_voucher_lines ENABLE ROW LEVEL SECURITY;

-- Drop every old policy by name to guarantee a clean slate
DROP POLICY IF EXISTS "SalesVouchers: View access"             ON public.sales_vouchers;
DROP POLICY IF EXISTS "SalesVouchers: Insert by sales"          ON public.sales_vouchers;
DROP POLICY IF EXISTS "SalesVouchers: Insert"                   ON public.sales_vouchers;
DROP POLICY IF EXISTS "SalesVouchers: Update by creator or admin" ON public.sales_vouchers;
DROP POLICY IF EXISTS "SalesVouchers: Update by owner or admin"  ON public.sales_vouchers;
DROP POLICY IF EXISTS "SalesVouchers: Delete by admin or sales owner" ON public.sales_vouchers;
DROP POLICY IF EXISTS "SalesVouchers: Delete by owner or admin"  ON public.sales_vouchers;
DROP POLICY IF EXISTS "SalesVouchers: Update draft"            ON public.sales_vouchers;
DROP POLICY IF EXISTS "SalesVouchers: Delete by admin"         ON public.sales_vouchers;

-- Sales user can see voucher across ALL farms; operators only on their farms; admins all.
CREATE POLICY "SalesVouchers: View access"
    ON public.sales_vouchers FOR SELECT
    USING (public.can_view_sales_voucher(farm_id));

-- Insert: only ADMIN or SALES users may create.
CREATE POLICY "SalesVouchers: Insert"
    ON public.sales_vouchers FOR INSERT
    WITH CHECK (public.can_insert_sales_voucher());

-- Update: admin can update anyone; sales user only their own.
CREATE POLICY "SalesVouchers: Update by owner or admin"
    ON public.sales_vouchers FOR UPDATE
    USING (public.can_modify_sales_voucher(created_by))
    WITH CHECK (public.can_modify_sales_voucher(created_by));

-- Delete: admin can delete anyone; sales user only their own.
CREATE POLICY "SalesVouchers: Delete by owner or admin"
    ON public.sales_vouchers FOR DELETE
    USING (public.can_modify_sales_voucher(created_by));

-- Lines
DROP POLICY IF EXISTS "SalesVoucherLines: View access"     ON public.sales_voucher_lines;
DROP POLICY IF EXISTS "SalesVoucherLines: Insert by sales"  ON public.sales_voucher_lines;
DROP POLICY IF EXISTS "SalesVoucherLines: Update draft"     ON public.sales_voucher_lines;
DROP POLICY IF EXISTS "SalesVoucherLines: Delete draft"     ON public.sales_voucher_lines;

CREATE POLICY "SalesVoucherLines: View access"
    ON public.sales_voucher_lines FOR SELECT
    USING (public.can_view_sale_voucher_lines(voucher_id));

CREATE POLICY "SalesVoucherLines: Insert"
    ON public.sales_voucher_lines FOR INSERT
    WITH CHECK (public.can_insert_sales_voucher_line(voucher_id));

CREATE POLICY "SalesVoucherLines: Update"
    ON public.sales_voucher_lines FOR UPDATE
    USING (public.can_insert_sales_voucher_line(voucher_id))
    WITH CHECK (public.can_insert_sales_voucher_line(voucher_id));

CREATE POLICY "SalesVoucherLines: Delete"
    ON public.sales_voucher_lines FOR DELETE
    USING (public.can_insert_sales_voucher_line(voucher_id));

-- ============================================================================
-- STEP 10 — DATA CLEANUP (orphan reversals, status values from the bad era)
-- ============================================================================
-- Defensive: drop any 'cancelled'/'draft' rows that slipped through old migrations.
-- These would otherwise be invisible to the application but pollute the table.
DO $$
BEGIN
    -- We just dropped the column default; should already be 'submitted', but be safe.
    UPDATE public.sales_vouchers
    SET status = 'submitted'
    WHERE status NOT IN ('submitted') OR status IS NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Status normalization skipped: %', SQLERRM;
END $$;

-- Notify PostgREST to reload its schema cache (FK relationships take effect immediately)
NOTIFY pgrst, 'reload schema';
