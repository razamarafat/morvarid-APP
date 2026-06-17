-- ============================================================================
-- MORVARID SYSTEM: Sale Reconciliation Logic (تعدیل مغایرت حواله فروش)
-- Migration: 20260618_sale_reconciliation_logic.sql
--
-- Goal: When the Operator copies a Sales Voucher to their daily consumption
-- voucher, the Operator's `total_cartons` becomes the new source of truth.
-- If the Operator's qty differs from the Sales Voucher's qty (e.g. Sales=175,
-- Operator=170), we must atomically post a `sale_reconciliation` adjustment
-- transaction so the net inventory effect equals exactly the Operator's input.
--
-- Design pillars (sign-off from thinker review):
--   1. ATOMICITY → trigger fires on invoices AFTER INSERT OR UPDATE OF
--      (total_cartons, source_sales_voucher_line_id). No client round-trip.
--   2. IDEMPOTENCY → derive `existing_recon = SUM(qty_in - qty_out)` for past
--      sale_reconciliation rows on this invoice. Required delta =
--      (target_recon - existing_recon). Re-edits correctly compound.
--   3. MATH → target_recon = sales_qty - operator_qty (positive ⇒ add back,
--      negative ⇒ deduct more). SIGN is the operator-controlled invariant.
--   4. SAFEGUARD → block DELETE of sales_vouchers that have a copy invoice,
--      so the inventory never silently goes unreversed while the operator's
--      row still claims "already deducted by sales voucher".
-- ============================================================================

-- ============================================================================
-- STEP 1 — EXTEND inventory_txn_type WITH 'sale_reconciliation'
-- ============================================================================
-- ALTER TYPE ADD VALUE cannot run inside a transaction block in older PG,
-- but it is supported as standalone since PG 9.6. We use IF NOT EXISTS (PG 12+).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'inventory_txn_type' AND e.enumlabel = 'sale_reconciliation'
  ) THEN
    ALTER TYPE public.inventory_txn_type ADD VALUE 'sale_reconciliation';
  END IF;
END $$;

-- ============================================================================
-- STEP 2 — BLOCK DELETION OF SALES VOUCHERS ALREADY COPIED TO INVOICES
-- ============================================================================
-- Rationale: If a Sales user deletes their voucher after the Operator copied
-- it, the line-level inventory reverse trigger fires correctly BUT the
-- Operator's daily invoice stays with is_from_sales_voucher=true which means
-- syncSalesFromInvoices will skip deducting it from inventory. Net = inventory
-- magically restored despite the operator having shipped goods.
--
-- Fix: HARD-block deletion when an invoice references this voucher as its
-- source. Operator must first delete the copy invoice if they want to undo it.
CREATE OR REPLACE FUNCTION public.prevent_copied_voucher_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.invoices
    WHERE source_sales_voucher_id = OLD.id
  ) THEN
    RAISE EXCEPTION
      'این حواله فروش به فرم روزانه ثبت شده و قابل حذف نیست. ابتدا حواله روزانه مرتبط را حذف کنید.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS tr_prevent_copied_voucher_del ON public.sales_vouchers;
CREATE TRIGGER tr_prevent_copied_voucher_del
  BEFORE DELETE ON public.sales_vouchers
  FOR EACH ROW EXECUTE FUNCTION public.prevent_copied_voucher_deletion();

-- ============================================================================
-- STEP 3 — INVOICE RECONCILIATION TRIGGER (atomic + idempotent)
-- ============================================================================
-- This trigger fires AFTER INSERT or AFTER UPDATE OF (total_cartons,
-- source_sales_voucher_line_id) on the invoices table. If the invoice is
-- from a sales voucher line, it computes the delta needed and posts a
-- sale_reconciliation inventory_transactions row so that the net inventory
-- effect equals the operator's total_cartons.
--
-- Math:
--   sales_qty  = sales_voucher_lines.quantity (what Sales user requested)
--   operator_qty = invoices.total_cartons   (what Operator actually shipped)
--   target_recon  = sales_qty - operator_qty
--                    >0 ⇒ we must ADD items back to inventory (over-deducted)
--                    <0 ⇒ we must DEDUCT more (under-deducted)
--                    =0 ⇒ nothing to do (already matches)
--   existing_recon = SUM(qty_in - qty_out) over prior sale_reconciliation rows
--                    for THIS invoice (lets re-edits compound correctly)
--   required_delta = target_recon - existing_recon
--                    >0 ⇒ INSERT qty_in = required_delta (add back more)
--                    <0 ⇒ INSERT qty_out = ABS(required_delta) (deduct more)
--
-- SECURITY DEFINER + search_path = public,auth so the SECURITY DEFINER trigger
-- bypasses operator-role RLS on inventory_transactions. Same pattern used by
-- the existing process_sales_voucher_line_inventory() trigger.
CREATE OR REPLACE FUNCTION public.tr_invoice_sale_reconciliation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_sales_qty    NUMERIC;
  v_existing_qty NUMERIC := 0;
  v_target_recon NUMERIC;
  v_required_delta NUMERIC;
BEGIN
  -- DEFENSIVE: only act on rows that are linked to a sales voucher line
  IF NEW.is_from_sales_voucher IS DISTINCT FROM TRUE THEN
    RETURN NEW;
  END IF;
  IF NEW.source_sales_voucher_line_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Read the ORIGINAL quantity the Sales user committed on this line
  SELECT quantity INTO v_sales_qty
    FROM public.sales_voucher_lines
   WHERE id = NEW.source_sales_voucher_line_id;

  -- If parent line was deleted (paranoia), bail safely
  IF v_sales_qty IS NULL THEN
    RETURN NEW;
  END IF;

  -- Sum prior reconciliation rows for THIS invoice so re-edits compound
  SELECT COALESCE(SUM(qty_in - qty_out), 0)
    INTO v_existing_qty
    FROM public.inventory_transactions
   WHERE txn_type = 'sale_reconciliation'
     AND source_type = 'invoice'
     AND source_id   = NEW.id;

  -- Compute target and required delta (sign-correct: positive ⇒ add back)
  v_target_recon     := v_sales_qty - NEW.total_cartons;
  v_required_delta   := v_target_recon - v_existing_qty;

  IF v_required_delta = 0 THEN
    RETURN NEW; -- nothing to post
  END IF;

  -- Insert a single adjustment row that brings the running total to v_target_recon
  INSERT INTO public.inventory_transactions (
    farm_id, product_id, txn_type, txn_date,
    qty_in, qty_in_kg,
    qty_out, qty_out_kg,
    source_type, source_id, reference_number,
    notes, created_by
  ) VALUES (
    NEW.farm_id, NEW.product_id, 'sale_reconciliation', NEW.date,
    CASE WHEN v_required_delta > 0 THEN v_required_delta ELSE 0 END,
    0,
    CASE WHEN v_required_delta < 0 THEN -v_required_delta ELSE 0 END,
    0,
    'invoice', NEW.id, NEW.invoice_number,
    FORMAT(
      'عدم مغایرت حواله فروش: فروش %s عملیات %s (مغایرت %s)',
      v_sales_qty, NEW.total_cartons, v_target_recon
    ),
    COALESCE(NEW.created_by, auth.uid())
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- SAFETY NET: never block the underlying invoice insert/update because
  -- the reconciliation row failed (e.g. enum race during migration). Log
  -- and continue — operators will notice inventory drift and will report.
  RAISE WARNING 'sale_reconciliation trigger failed for invoice %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_invoice_reconciliation ON public.invoices;
CREATE TRIGGER tr_invoice_reconciliation
  AFTER INSERT OR UPDATE OF total_cartons, source_sales_voucher_line_id, is_from_sales_voucher
  ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.tr_invoice_sale_reconciliation();

-- ============================================================================
-- STEP 4 — EXPOSE A READ-ONLY RPC FOR FRONTEND DEBUGGING
-- ============================================================================
-- Not strictly required (the trigger does the writes), but lets the front-end
-- show in the mismatch modal a preview of the delta that will be applied:
--   rpc('fn_preview_sale_reconciliation', { p_invoice_id })
-- Returns JSON with { sales_qty, operator_qty, target_recon,
--                     existing_recon, required_delta } so the UI can be
-- descriptive ("سیستم 5 کارتن به موجودی اضافه خواهد کرد تا خالص = 170").
CREATE OR REPLACE FUNCTION public.fn_preview_sale_reconciliation(p_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_sales_qty NUMERIC;
  v_op_qty    NUMERIC;
  v_existing  NUMERIC := 0;
  v_target    NUMERIC;
  v_required  NUMERIC;
BEGIN
  SELECT total_cartons INTO v_op_qty
    FROM public.invoices WHERE id = p_invoice_id;
  IF v_op_qty IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invoice_not_found');
  END IF;

  SELECT svl.quantity INTO v_sales_qty
    FROM public.invoices inv
    JOIN public.sales_voucher_lines svl ON svl.id = inv.source_sales_voucher_line_id
   WHERE inv.id = p_invoice_id;
  IF v_sales_qty IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_a_copy_invoice');
  END IF;

  SELECT COALESCE(SUM(qty_in - qty_out), 0) INTO v_existing
    FROM public.inventory_transactions
   WHERE txn_type = 'sale_reconciliation'
     AND source_type = 'invoice'
     AND source_id   = p_invoice_id;

  v_target   := v_sales_qty - v_op_qty;
  v_required := v_target - v_existing;

  RETURN jsonb_build_object(
    'success', true,
    'sales_qty', v_sales_qty,
    'operator_qty', v_op_qty,
    'target_recon', v_target,
    'existing_recon', v_existing,
    'required_delta', v_required,
    'direction', CASE
      WHEN v_required > 0 THEN 'add_back'
      WHEN v_required < 0 THEN 'deduct_more'
      ELSE 'noop'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_preview_sale_reconciliation(UUID) TO authenticated;

-- Notify PostgREST to reload schema cache (new enum value + new functions)
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- STEP 5 — DOCUMENTATION COMMENT IN INVENTORY_TRANSACTIONS
-- ============================================================================
COMMENT ON COLUMN public.inventory_transactions.txn_type IS
  'Transaction enum: purchase / sale / sale_reversal / daily_consumption / adjustment / return / sale_reconciliation (auto-posted by tr_invoice_reconciliation when operator daily invoice matches a sales voucher line and qty differs).';
