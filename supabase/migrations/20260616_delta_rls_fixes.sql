-- ============================================================================
-- Migration: Delta - is_admin() function + inventory_transactions RLS hardening
-- Date: 2026-06-16
-- Purpose: Ensure is_admin() exists as SECURITY DEFINER and harden
-- inventory_transactions SELECT policy to use can_access_farm().
-- ============================================================================

-- 1. Ensure is_admin() exists as SECURITY DEFINER (idempotent)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'ADMIN'
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;

-- 2. Ensure can_access_farm() exists (idempotent)
CREATE OR REPLACE FUNCTION public.can_access_farm(v_farm_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_farms uf
    WHERE uf.user_id = auth.uid() AND uf.farm_id = v_farm_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 3. Harden inventory_transactions policies
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
