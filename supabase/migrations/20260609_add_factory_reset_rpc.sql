-- RPC for Factory Reset System (Admin Only)
-- Deletes ALL data except the calling admin user and auth records
-- Returns JSON with success status and deletion details

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
BEGIN
  -- 1. Verify caller is an admin
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Authentication required');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = caller_id AND role = 'ADMIN') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Access Denied: Only Admins can perform factory reset');
  END IF;

  -- 2. Count & delete all data (order matters for FK dependencies)
  -- Delete daily_statistics first (depends on farms + products)
  SELECT COUNT(*) INTO stats_count FROM public.daily_statistics;
  DELETE FROM public.daily_statistics WHERE true;

  -- Delete invoices (depends on farms)
  SELECT COUNT(*) INTO invoices_count FROM public.invoices;
  DELETE FROM public.invoices WHERE true;

  -- Delete user_farms (depends on farms + profiles)
  DELETE FROM public.user_farms WHERE true;

  -- Delete farms
  SELECT COUNT(*) INTO farms_count FROM public.farms;
  DELETE FROM public.farms WHERE true;

  -- Delete non-admin profiles
  SELECT COUNT(*) INTO profiles_count FROM public.profiles WHERE id != caller_id;
  DELETE FROM public.profiles WHERE id != caller_id;

  -- Delete logs
  SELECT COUNT(*) INTO logs_count FROM public.system_logs;
  DELETE FROM public.system_logs WHERE true;

  SELECT COUNT(*) INTO error_logs_count FROM public.error_logs;
  DELETE FROM public.error_logs WHERE true;

  -- Delete push subscriptions and quotes
  DELETE FROM public.push_subscriptions WHERE true;
  DELETE FROM public.daily_quotes WHERE true;

  -- 3. Log the reset event
  INSERT INTO public.system_logs (level, message, module, user_id, metadata)
  VALUES ('WARN', 'Factory reset performed', 'SYSTEM_RESET', caller_id,
    jsonb_build_object(
      'farms_deleted', farms_count,
      'profiles_deleted', profiles_count,
      'daily_statistics_deleted', stats_count,
      'invoices_deleted', invoices_count
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
      'system_logs_deleted', logs_count,
      'error_logs_deleted', error_logs_count
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
