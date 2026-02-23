-- Fix SECURITY DEFINER view
ALTER VIEW public.v_farm_daily_summary SET (security_invoker = on);

-- Fix Function Search Paths
ALTER FUNCTION public.validate_farm_product_ids() SET search_path = public;
ALTER FUNCTION public.sync_sales_from_invoices() SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.perform_system_reset() SET search_path = public;
ALTER FUNCTION public.verify_super_admin_access() SET search_path = public;

-- Fix Unindexed Foreign Keys
CREATE INDEX IF NOT EXISTS idx_daily_statistics_created_by ON public.daily_statistics(created_by);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON public.error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON public.invoices(created_by);
CREATE INDEX IF NOT EXISTS idx_invoices_product_id ON public.invoices(product_id);
CREATE INDEX IF NOT EXISTS idx_invoices_source_product_id ON public.invoices(source_product_id);

-- Optimize RLS Initialization (auth.uid() -> (select auth.uid()))
-- Profiles
DROP POLICY IF EXISTS "Profiles: View authenticated" ON public.profiles;
CREATE POLICY "Profiles: View authenticated" ON public.profiles FOR SELECT USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Profiles: Update own" ON public.profiles;
CREATE POLICY "Profiles: Update own" ON public.profiles FOR UPDATE USING (id = (SELECT auth.uid()));

-- Invoices (Consolidating and optimizing)
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.invoices;
CREATE POLICY "Invoices: View assigned" ON public.invoices FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_farms WHERE user_id = (SELECT auth.uid()) AND farm_id = invoices.farm_id)
);

-- Farms (Consolidating and optimizing)
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.farms;
CREATE POLICY "Farms: View assigned" ON public.farms FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_farms WHERE user_id = (SELECT auth.uid()) AND farm_id = farms.id)
);
