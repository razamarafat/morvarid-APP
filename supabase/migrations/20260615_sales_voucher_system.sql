-- ============================================================================
-- MORVARID SYSTEM: Sales Voucher System (سیستم حواله فروش)
-- Migration: 20260615_sales_voucher_system.sql
-- Description: Adds complete sales voucher infrastructure including:
--   - sales_vouchers table (حواله‌های فروش)
--   - sales_voucher_lines table (اقلام حواله فروش)
--   - inventory_transactions table (تراکنش‌های انبار)
--   - inventory_applied flag for double-deduction prevention
--   - RLS policies for SALES, REGISTRATION (OPERATOR), and ADMIN roles
-- ============================================================================

-- =========================
-- 1. CREATE ENUMS
-- =========================

DO $$
BEGIN
  -- Sales voucher status enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sales_voucher_status') THEN
    CREATE TYPE public.sales_voucher_status AS ENUM ('draft', 'submitted', 'cancelled');
  END IF;

  -- Inventory transaction type enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_txn_type') THEN
    CREATE TYPE public.inventory_txn_type AS ENUM (
      'purchase',           -- خرید/ورود به انبار
      'sale',               -- فروش از طریق حواله فروش
      'sale_reversal',      -- برگشت از فروش (کنسل حواله)
      'daily_consumption',  -- مصرف روزانه (حواله ثبت)
      'adjustment',         -- اصلاح موجودی
      'return'              -- مرجوعی
    );
  END IF;
END $$;

-- =========================
-- 2. CREATE TABLES
-- =========================

-- 2a. Inventory Transactions (تراکنش‌های انبار) - New audit trail table
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  txn_type public.inventory_txn_type NOT NULL,
  txn_date TEXT NOT NULL,                          -- تاریخ به فرمت YYYY/MM/DD
  qty_in NUMERIC NOT NULL DEFAULT 0,               -- مقدار ورودی
  qty_out NUMERIC NOT NULL DEFAULT 0,              -- مقدار خروجی
  qty_in_kg NUMERIC NOT NULL DEFAULT 0,            -- مقدار ورودی (کیلوگرم)
  qty_out_kg NUMERIC NOT NULL DEFAULT 0,           -- مقدار خروجی (کیلوگرم)
  unit_price NUMERIC,                               -- قیمت واحد (اختیاری)
  total_price NUMERIC,                              -- قیمت کل (اختیاری)
  source_type TEXT,                                 -- منبع تراکنش: 'sales_voucher', 'invoice', 'manual', 'adjustment'
  source_id UUID,                                   -- آیدی منبع (مثلاً sales_voucher.id)
  reference_number TEXT,                            -- شماره مرجع (شماره حواله یا فاکتور)
  notes TEXT,                                       -- توضیحات
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT inventory_txn_date_format_chk CHECK (txn_date ~ '^[0-9]{4}/[0-9]{2}/[0-9]{2}$'),
  CONSTRAINT inventory_txn_quantity_chk CHECK (
    (qty_in >= 0 AND qty_out >= 0) AND
    (qty_in_kg >= 0 AND qty_out_kg >= 0) AND
    NOT (qty_in > 0 AND qty_out > 0)  -- یک تراکنش نمی‌تواند همزمان هم ورود و هم خروج باشد
  )
);

-- 2b. Sales Vouchers (حواله‌های فروش)
CREATE TABLE IF NOT EXISTS public.sales_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_number TEXT NOT NULL,                     -- شماره حواله (SV-0001, SV-0002, ...)
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  voucher_date TEXT NOT NULL,                       -- تاریخ حواله به فرمت YYYY/MM/DD
  status public.sales_voucher_status NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ,                         -- زمان ثبت نهایی
  notes TEXT,                                       -- توضیحات کلی
  total_amount NUMERIC,                             -- مبلغ کل (ریال/تومان)
  customer_name TEXT,                               -- نام مشتری/خریدار
  customer_phone TEXT,                              -- تلفن مشتری
  vehicle_plate TEXT,                               -- شماره پلاک خودرو
  delivery_address TEXT,                            -- آدرس تحویل
  inventory_applied BOOLEAN NOT NULL DEFAULT false, -- آیا موجودی انبار کسر شده؟ (جلوگیری از کسر مضاعف)
  cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- چه کسی کنسل کرده
  cancelled_at TIMESTAMPTZ,                        -- زمان کنسل شدن
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sales_vouchers_date_format_chk CHECK (voucher_date ~ '^[0-9]{4}/[0-9]{2}/[0-9]{2}$')
);

-- 2c. Sales Voucher Lines (اقلام حواله فروش)
CREATE TABLE IF NOT EXISTS public.sales_voucher_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID NOT NULL REFERENCES public.sales_vouchers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),   -- تعداد
  unit_price NUMERIC,                               -- قیمت واحد
  total_price NUMERIC,                              -- قیمت کل (quantity × unit_price)
  notes TEXT,                                       -- توضیحات
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- 3. INDEXES
-- =========================

-- Inventory transactions indexes
CREATE INDEX IF NOT EXISTS idx_inventory_txn_farm ON public.inventory_transactions(farm_id);
CREATE INDEX IF NOT EXISTS idx_inventory_txn_product ON public.inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_txn_date ON public.inventory_transactions(txn_date);
CREATE INDEX IF NOT EXISTS idx_inventory_txn_type ON public.inventory_transactions(txn_type);
CREATE INDEX IF NOT EXISTS idx_inventory_txn_source ON public.inventory_transactions(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_inventory_txn_farm_date ON public.inventory_transactions(farm_id, txn_date);

-- Sales vouchers indexes
CREATE INDEX IF NOT EXISTS idx_sales_vouchers_farm ON public.sales_vouchers(farm_id);
CREATE INDEX IF NOT EXISTS idx_sales_vouchers_created_by ON public.sales_vouchers(created_by);
CREATE INDEX IF NOT EXISTS idx_sales_vouchers_date ON public.sales_vouchers(voucher_date);
CREATE INDEX IF NOT EXISTS idx_sales_vouchers_status ON public.sales_vouchers(status);
CREATE INDEX IF NOT EXISTS idx_sales_vouchers_farm_date ON public.sales_vouchers(farm_id, voucher_date);

-- Sales voucher lines indexes
CREATE INDEX IF NOT EXISTS idx_sales_voucher_lines_voucher ON public.sales_voucher_lines(voucher_id);
CREATE INDEX IF NOT EXISTS idx_sales_voucher_lines_product ON public.sales_voucher_lines(product_id);

-- Unique constraint on voucher_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_vouchers_number_unique ON public.sales_vouchers(voucher_number);

-- =========================
-- 4. SEQUENCE FOR VOUCHER NUMBERS
-- =========================

CREATE SEQUENCE IF NOT EXISTS public.sales_voucher_number_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

-- =========================
-- 5. FUNCTIONS & TRIGGERS
-- =========================

-- 5a. Auto-update updated_at on sales_vouchers
CREATE OR REPLACE FUNCTION public.set_sales_voucher_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5b. Auto-generate voucher_number on insert
CREATE OR REPLACE FUNCTION public.generate_sales_voucher_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.voucher_number IS NULL OR NEW.voucher_number = '' THEN
    NEW.voucher_number := 'SV-' || LPAD(nextval('public.sales_voucher_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5c. Prevent modification of submitted/cancelled vouchers
CREATE OR REPLACE FUNCTION public.check_sales_voucher_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow updates to draft vouchers
  IF OLD.status != 'draft' AND TG_OP = 'UPDATE' THEN
    -- Allow status changes (draft -> submitted, submitted -> cancelled)
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      -- Allow: draft -> submitted (by creator)
      -- Allow: submitted -> cancelled (by admin)
      -- Allow: draft -> cancelled (by creator)
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'این حواله قابل ویرایش نیست (وضعیت: %)', OLD.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5d. Process inventory on status change to 'submitted'
CREATE OR REPLACE FUNCTION public.process_sales_voucher_inventory()
RETURNS TRIGGER AS $$
DECLARE
  line RECORD;
  txn_count INTEGER;
BEGIN
  -- Only process when changing from draft to submitted
  IF NEW.status = 'submitted' AND (OLD.status = 'draft' OR OLD.status IS NULL) THEN
    -- Safeguard 1: Check if inventory already applied
    IF NEW.inventory_applied = true THEN
      RAISE WARNING 'موجودی انبار قبلاً برای این حواله کسر شده است.';
      RETURN NEW;
    END IF;

    -- Safeguard 2: Check if transactions already exist for this voucher
    SELECT COUNT(*) INTO txn_count
    FROM public.inventory_transactions
    WHERE source_type = 'sales_voucher' AND source_id = NEW.id;

    IF txn_count > 0 THEN
      RAISE WARNING 'تراکنش‌های انبار قبلاً برای این حواله ثبت شده است.';
      RETURN NEW;
    END IF;

    -- Create inventory transactions for each line
    FOR line IN
      SELECT * FROM public.sales_voucher_lines WHERE voucher_id = NEW.id
    LOOP
      INSERT INTO public.inventory_transactions (
        farm_id, product_id, txn_type, txn_date,
        qty_out, qty_out_kg,
        source_type, source_id, reference_number,
        notes, created_by
      ) VALUES (
        NEW.farm_id, line.product_id, 'sale', NEW.voucher_date,
        line.quantity, 0,
        'sales_voucher', NEW.id, NEW.voucher_number,
        'فروش از طریق حواله فروش ' || NEW.voucher_number, NEW.created_by
      );
    END LOOP;

    -- Set inventory_applied flag
    NEW.inventory_applied := true;
    NEW.submitted_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5e. Reverse inventory on cancellation
CREATE OR REPLACE FUNCTION public.reverse_sales_voucher_inventory()
RETURNS TRIGGER AS $$
DECLARE
  line RECORD;
BEGIN
  -- Only process when changing to cancelled
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- If inventory was applied, create reversal transactions
    IF OLD.inventory_applied = true THEN
      FOR line IN
        SELECT * FROM public.sales_voucher_lines WHERE voucher_id = NEW.id
      LOOP
        -- Safeguard: Check if reversal already exists
        IF NOT EXISTS (
          SELECT 1 FROM public.inventory_transactions
          WHERE source_type = 'sales_voucher' AND source_id = NEW.id
            AND txn_type = 'sale_reversal' AND product_id = line.product_id
        ) THEN
          INSERT INTO public.inventory_transactions (
            farm_id, product_id, txn_type, txn_date,
            qty_in, qty_in_kg,
            source_type, source_id, reference_number,
            notes, created_by
          ) VALUES (
            NEW.farm_id, line.product_id, 'sale_reversal', NEW.voucher_date,
            line.quantity, 0,
            'sales_voucher', NEW.id, NEW.voucher_number,
            'برگشت از فروش - کنسل حواله ' || NEW.voucher_number, NEW.created_by
          );
        END IF;
      END LOOP;

      -- Mark inventory as not applied (reversed)
      NEW.inventory_applied := false;
    END IF;

    NEW.cancelled_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================
-- 6. APPLY TRIGGERS
-- =========================

-- updated_at trigger
DO $$
BEGIN
  DROP TRIGGER IF EXISTS tr_sales_voucher_updated_at ON public.sales_vouchers;
  CREATE TRIGGER tr_sales_voucher_updated_at
    BEFORE UPDATE ON public.sales_vouchers
    FOR EACH ROW EXECUTE FUNCTION public.set_sales_voucher_updated_at();
END $$;

-- Auto-generate voucher number
DO $$
BEGIN
  DROP TRIGGER IF EXISTS tr_sales_voucher_number ON public.sales_vouchers;
  CREATE TRIGGER tr_sales_voucher_number
    BEFORE INSERT ON public.sales_vouchers
    FOR EACH ROW EXECUTE FUNCTION public.generate_sales_voucher_number();
END $$;

-- Prevent modification of non-draft vouchers
DO $$
BEGIN
  DROP TRIGGER IF EXISTS tr_sales_voucher_check_update ON public.sales_vouchers;
  CREATE TRIGGER tr_sales_voucher_check_update
    BEFORE UPDATE ON public.sales_vouchers
    FOR EACH ROW EXECUTE FUNCTION public.check_sales_voucher_update();
END $$;

-- Process inventory on submit
DO $$
BEGIN
  DROP TRIGGER IF EXISTS tr_sales_voucher_inventory ON public.sales_vouchers;
  CREATE TRIGGER tr_sales_voucher_inventory
    BEFORE UPDATE OF status ON public.sales_vouchers
    FOR EACH ROW
    WHEN (NEW.status = 'submitted' AND OLD.status = 'draft')
    EXECUTE FUNCTION public.process_sales_voucher_inventory();
END $$;

-- Reverse inventory on cancel
DO $$
BEGIN
  DROP TRIGGER IF EXISTS tr_sales_voucher_reverse ON public.sales_vouchers;
  CREATE TRIGGER tr_sales_voucher_reverse
    BEFORE UPDATE OF status ON public.sales_vouchers
    FOR EACH ROW
    WHEN (NEW.status = 'cancelled' AND OLD.status != 'cancelled')
    EXECUTE FUNCTION public.reverse_sales_voucher_inventory();
END $$;

-- =========================
-- 7. RLS POLICIES
-- =========================

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_voucher_lines ENABLE ROW LEVEL SECURITY;

-- =========================
-- 7a. Inventory Transactions RLS
-- =========================

-- Admin can do everything on inventory_transactions
DROP POLICY IF EXISTS "InventoryTxns: Admin full access" ON public.inventory_transactions;
CREATE POLICY "InventoryTxns: Admin full access" ON public.inventory_transactions FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Authenticated users can view inventory transactions for their assigned farms
DROP POLICY IF EXISTS "InventoryTxns: View farm transactions" ON public.inventory_transactions;
CREATE POLICY "InventoryTxns: View farm transactions" ON public.inventory_transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_farms uf
    WHERE uf.user_id = auth.uid() AND uf.farm_id = inventory_transactions.farm_id
  )
  OR public.is_admin()
);

-- =========================
-- 7b. Sales Vouchers RLS
-- =========================

-- SELECT: Authenticated users can view vouchers for farms they have access to
-- Sales role users can see ALL vouchers (for any farm)
-- Operators can only see vouchers for their assigned farms
DROP POLICY IF EXISTS "SalesVouchers: View access" ON public.sales_vouchers;
CREATE POLICY "SalesVouchers: View access" ON public.sales_vouchers FOR SELECT
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'SALES'
  )
  OR EXISTS (
    SELECT 1 FROM public.user_farms uf
    WHERE uf.user_id = auth.uid() AND uf.farm_id = sales_vouchers.farm_id
  )
);

-- INSERT: Only SALES role users (and admin) can create vouchers
DROP POLICY IF EXISTS "SalesVouchers: Insert by sales" ON public.sales_vouchers;
CREATE POLICY "SalesVouchers: Insert by sales" ON public.sales_vouchers FOR INSERT
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'SALES'
  )
);

-- UPDATE: Creator (sales user) can update only draft vouchers. Admin can update any.
DROP POLICY IF EXISTS "SalesVouchers: Update draft" ON public.sales_vouchers;
CREATE POLICY "SalesVouchers: Update draft" ON public.sales_vouchers FOR UPDATE
USING (
  public.is_admin()
  OR (
    created_by = auth.uid()
    AND status = 'draft'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'SALES'
    )
  )
)
WITH CHECK (
  public.is_admin()
  OR (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'SALES'
    )
  )
);

-- DELETE: Only admin can delete vouchers (and only draft ones)
DROP POLICY IF EXISTS "SalesVouchers: Delete by admin" ON public.sales_vouchers;
CREATE POLICY "SalesVouchers: Delete by admin" ON public.sales_vouchers FOR DELETE
USING (public.is_admin());

-- =========================
-- 7c. Sales Voucher Lines RLS
-- =========================

-- SELECT: Same as parent voucher - view if you can see the parent
DROP POLICY IF EXISTS "SalesVoucherLines: View access" ON public.sales_voucher_lines;
CREATE POLICY "SalesVoucherLines: View access" ON public.sales_voucher_lines FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sales_vouchers sv
    WHERE sv.id = sales_voucher_lines.voucher_id
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'SALES'
      )
      OR EXISTS (
        SELECT 1 FROM public.user_farms uf
        WHERE uf.user_id = auth.uid() AND uf.farm_id = sv.farm_id
      )
    )
  )
);

-- INSERT: Only sales role users while parent is draft
DROP POLICY IF EXISTS "SalesVoucherLines: Insert by sales" ON public.sales_voucher_lines;
CREATE POLICY "SalesVoucherLines: Insert by sales" ON public.sales_voucher_lines FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sales_vouchers sv
    WHERE sv.id = sales_voucher_lines.voucher_id
    AND sv.status = 'draft'
    AND (
      public.is_admin()
      OR (
        sv.created_by = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'SALES'
        )
      )
    )
  )
);

-- UPDATE: Only sales role users, only while parent voucher is draft
DROP POLICY IF EXISTS "SalesVoucherLines: Update draft" ON public.sales_voucher_lines;
CREATE POLICY "SalesVoucherLines: Update draft" ON public.sales_voucher_lines FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.sales_vouchers sv
    WHERE sv.id = sales_voucher_lines.voucher_id
    AND sv.status = 'draft'
    AND (
      public.is_admin()
      OR (
        sv.created_by = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'SALES'
        )
      )
    )
  )
);

-- DELETE: Only while parent voucher is draft (by creator or admin)
DROP POLICY IF EXISTS "SalesVoucherLines: Delete draft" ON public.sales_voucher_lines;
CREATE POLICY "SalesVoucherLines: Delete draft" ON public.sales_voucher_lines FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.sales_vouchers sv
    WHERE sv.id = sales_voucher_lines.voucher_id
    AND sv.status = 'draft'
    AND (
      public.is_admin()
      OR (
        sv.created_by = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'SALES'
        )
      )
    )
  )
);

-- =========================
-- 8. ADD SOURCE FIELDS TO INVOICES TABLE (for copy-to-daily-voucher feature)
-- =========================

DO $$
BEGIN
  -- Add source_sales_voucher_id to invoices to track origin
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'source_sales_voucher_id'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN source_sales_voucher_id UUID REFERENCES public.sales_vouchers(id) ON DELETE SET NULL;
  END IF;

  -- Add source_sales_voucher_line_id to track which line was copied
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'source_sales_voucher_line_id'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN source_sales_voucher_line_id UUID REFERENCES public.sales_voucher_lines(id) ON DELETE SET NULL;
  END IF;

  -- Add is_from_sales_voucher flag for quick checking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'is_from_sales_voucher'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN is_from_sales_voucher BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- =========================
-- 9. UPDATE FACTORY RESET TO INCLUDE NEW TABLES
-- =========================

CREATE OR REPLACE FUNCTION public.factory_reset_system()
RETURNS JSONB AS $$
DECLARE
  caller_id UUID;
  farms_count INTEGER;
  profiles_count INTEGER;
  stats_count INTEGER;
  invoices_count INTEGER;
  logs_count INTEGER;
  error_logs_count INTEGER;
  sales_vouchers_count INTEGER;
  inventory_txn_count INTEGER;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Authentication required');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = caller_id AND role = 'ADMIN') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Access Denied: Only Admins can perform factory reset');
  END IF;

  -- Delete dependent data first
  SELECT COUNT(*) INTO sales_vouchers_count FROM public.sales_voucher_lines;
  DELETE FROM public.sales_voucher_lines WHERE true;

  SELECT COUNT(*) INTO sales_vouchers_count FROM public.sales_vouchers;
  DELETE FROM public.sales_vouchers WHERE true;

  SELECT COUNT(*) INTO inventory_txn_count FROM public.inventory_transactions;
  DELETE FROM public.inventory_transactions WHERE true;

  SELECT COUNT(*) INTO stats_count FROM public.daily_statistics;
  DELETE FROM public.daily_statistics WHERE true;

  SELECT COUNT(*) INTO invoices_count FROM public.invoices;
  DELETE FROM public.invoices WHERE true;

  DELETE FROM public.user_farms WHERE true;

  SELECT COUNT(*) INTO farms_count FROM public.farms;
  DELETE FROM public.farms WHERE true;

  SELECT COUNT(*) INTO profiles_count FROM public.profiles WHERE id != caller_id;
  DELETE FROM public.profiles WHERE id != caller_id;

  SELECT COUNT(*) INTO logs_count FROM public.system_logs;
  DELETE FROM public.system_logs WHERE true;

  SELECT COUNT(*) INTO error_logs_count FROM public.error_logs;
  DELETE FROM public.error_logs WHERE true;

  DELETE FROM public.push_subscriptions WHERE true;
  DELETE FROM public.daily_quotes WHERE true;

  INSERT INTO public.system_logs (level, message, module, user_id, metadata)
  VALUES ('WARN', 'Factory reset performed', 'SYSTEM_RESET', caller_id,
    jsonb_build_object(
      'farms_deleted', farms_count,
      'profiles_deleted', profiles_count,
      'daily_statistics_deleted', stats_count,
      'invoices_deleted', invoices_count,
      'sales_vouchers_deleted', sales_vouchers_count,
      'inventory_transactions_deleted', inventory_txn_count
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'System reset complete',
    'details', jsonb_build_object(
      'farms_deleted', farms_count,
      'profiles_deleted', profiles_count,
      'daily_statistics_deleted', stats_count,
      'invoices_deleted', invoices_count,
      'sales_vouchers_deleted', sales_vouchers_count,
      'inventory_transactions_deleted', inventory_txn_count,
      'system_logs_deleted', logs_count,
      'error_logs_deleted', error_logs_count
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- =========================
-- 10. ADD REALTIME SUPPORT
-- =========================

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_vouchers;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_voucher_lines;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_transactions;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
