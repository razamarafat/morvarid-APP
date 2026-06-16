-- ============================================================================
-- Migration: Harden ALL RLS policies to use SECURITY DEFINER functions
-- Date: 2026-06-16
-- Purpose: Replace inline EXISTS(SELECT 1 FROM profiles...) patterns with
-- SECURITY DEFINER functions across ALL tables, preventing the same class
-- of RLS violation that broke sales_vouchers INSERT.
-- Also fixes profiles visibility and ensures invoices/daily_statistics
-- have proper FOR ALL policies.
-- ============================================================================

-- =========================
-- 1. Helper functions (SECURITY DEFINER)
-- =========================

-- Ensure is_admin() exists as SECURITY DEFINER (idempotent)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'ADMIN'
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;

-- Generic farm access check for operators
CREATE OR REPLACE FUNCTION public.can_access_farm(v_farm_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_farms uf
    WHERE uf.user_id = auth.uid() AND uf.farm_id = v_farm_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- =========================
-- 2. Fix profiles RLS (restore proper authenticated view)
--    advisor_fixes.sql restricted profiles to own-row only, which can
--    break cross-table policy evaluation.
-- =========================

DROP POLICY IF EXISTS "Profiles: View authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: Viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles: View authenticated" ON public.profiles FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Profiles: Update own" ON public.profiles;
CREATE POLICY "Profiles: Update own" ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles: Admin full access" ON public.profiles;
CREATE POLICY "Profiles: Admin full access" ON public.profiles FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- =========================
-- 3. Farms policies
-- =========================

DROP POLICY IF EXISTS "Farms: Basic access" ON public.farms;
DROP POLICY IF EXISTS "Farms: Admins full access" ON public.farms;
DROP POLICY IF EXISTS "Farms: View assigned" ON public.farms;

CREATE POLICY "Farms: Admins full access" ON public.farms FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Farms: View assigned" ON public.farms FOR SELECT
USING (
  public.is_admin()
  OR public.can_access_farm(farms.id)
);

-- =========================
-- 4. Products policies
-- =========================

DROP POLICY IF EXISTS "Products: Admins manage" ON public.products;
DROP POLICY IF EXISTS "Products: View authenticated" ON public.products;

CREATE POLICY "Products: View authenticated" ON public.products FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Products: Admin manage" ON public.products FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- =========================
-- 5. User_farms policies
-- =========================

DROP POLICY IF EXISTS "user_farms_basic" ON public.user_farms;
DROP POLICY IF EXISTS "UserFarms: Admins manage" ON public.user_farms;
DROP POLICY IF EXISTS "UserFarms: View own" ON public.user_farms;

CREATE POLICY "UserFarms: Admins manage" ON public.user_farms FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "UserFarms: View own" ON public.user_farms FOR SELECT
USING (user_id = auth.uid());

-- =========================
-- 6. Daily statistics policies (full CRUD for operators)
-- =========================

DROP POLICY IF EXISTS "daily_statistics_basic" ON public.daily_statistics;
DROP POLICY IF EXISTS "Stats: Farm based access" ON public.daily_statistics;

CREATE POLICY "Stats: Farm based access" ON public.daily_statistics FOR ALL
USING (
  public.is_admin()
  OR public.can_access_farm(daily_statistics.farm_id)
)
WITH CHECK (
  public.is_admin()
  OR public.can_access_farm(daily_statistics.farm_id)
);

-- =========================
-- 7. Invoices policies (full CRUD for operators)
-- =========================

DROP POLICY IF EXISTS "invoices_basic" ON public.invoices;
DROP POLICY IF EXISTS "Invoices: Farm based access" ON public.invoices;
DROP POLICY IF EXISTS "Invoices: View assigned" ON public.invoices;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.invoices;

CREATE POLICY "Invoices: Farm based access" ON public.invoices FOR ALL
USING (
  public.is_admin()
  OR public.can_access_farm(invoices.farm_id)
)
WITH CHECK (
  public.is_admin()
  OR public.can_access_farm(invoices.farm_id)
);

-- =========================
-- 8. System logs policies
-- =========================

DROP POLICY IF EXISTS "system_logs_basic" ON public.system_logs;
DROP POLICY IF EXISTS "system_logs_admin_view" ON public.system_logs;
DROP POLICY IF EXISTS "system_logs_insert" ON public.system_logs;

CREATE POLICY "system_logs_admin_view" ON public.system_logs FOR SELECT
USING (public.is_admin());

CREATE POLICY "system_logs_insert" ON public.system_logs FOR INSERT
WITH CHECK (true);

-- =========================
-- 9. Error logs policies
-- =========================

DROP POLICY IF EXISTS "error_logs_basic" ON public.error_logs;
DROP POLICY IF EXISTS "ErrorLogs: Public insert" ON public.error_logs;
DROP POLICY IF EXISTS "ErrorLogs: Admins view" ON public.error_logs;

CREATE POLICY "ErrorLogs: Public insert" ON public.error_logs FOR INSERT
WITH CHECK (true);

CREATE POLICY "ErrorLogs: Admins view" ON public.error_logs FOR SELECT
USING (public.is_admin());

-- =========================
-- 10. Push subscriptions policies
-- =========================

DROP POLICY IF EXISTS "push_subscriptions_basic" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_admin_select" ON public.push_subscriptions;

CREATE POLICY "push_subscriptions_own" ON public.push_subscriptions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_admin_select" ON public.push_subscriptions FOR SELECT
USING (public.is_admin());

-- =========================
-- 11. Inventory transactions policies (harden cross-table user_farms check)
-- =========================

DROP POLICY IF EXISTS "InventoryTxns: Admin full access" ON public.inventory_transactions;
DROP POLICY IF EXISTS "InventoryTxns: View farm transactions" ON public.inventory_transactions;

CREATE POLICY "InventoryTxns: Admin full access" ON public.inventory_transactions FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "InventoryTxns: View farm transactions" ON public.inventory_transactions FOR SELECT
USING (
  public.is_admin()
  OR public.can_access_farm(inventory_transactions.farm_id)
);

-- =========================
-- 12. Daily quotes policies
-- =========================

DROP POLICY IF EXISTS "daily_quotes_read_authenticated" ON public.daily_quotes;
DROP POLICY IF EXISTS "daily_quotes_admin_insert" ON public.daily_quotes;

CREATE POLICY "daily_quotes_read_authenticated" ON public.daily_quotes FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "daily_quotes_admin_insert" ON public.daily_quotes FOR INSERT
WITH CHECK (public.is_admin());
