-- RPC for Hard Deleting a Farm (Admin Only)
-- Cascades: daily_statistics, invoices, user_farms (via foreign keys or explicit deletion if needed for safety)
-- Foreign keys should be set to ON DELETE CASCADE based on master_schema, but we wrap it for admin check.

CREATE OR REPLACE FUNCTION public.admin_hard_delete_farm(p_farm_id UUID)
RETURNS VOID AS $$
BEGIN
  -- 1. Check Admin Permissions
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN') THEN
    RAISE EXCEPTION 'Access Denied: Only Admins can performs hard deletes.';
  END IF;

  -- 2. Verify Farm Exists
  IF NOT EXISTS (SELECT 1 FROM public.farms WHERE id = p_farm_id) THEN
    RAISE EXCEPTION 'Farm not found.';
  END IF;

  -- 3. Perform Delete
  -- Since tables (daily_statistics, invoices, user_farms) have ON DELETE CASCADE in master_schema,
  -- deleting the farm record should suffice.
  -- However, for audit purposes, we might want to log this action BEFORE deletion if the farm is gone.
  
  PERFORM public.log_system_event(
    'WARN', 
    'Hard deleted farm: ' || p_farm_id, 
    'ADMIN_ACTIONS', 
    jsonb_build_object('farm_id', p_farm_id)
  );

  DELETE FROM public.farms WHERE id = p_farm_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
