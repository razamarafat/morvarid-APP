-- MORVARID SYSTEM: MASTER DATABASE SCHEMA (Supabase/Postgres)
-- Idempotent + Production-oriented

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Add missing columns safely when tables already exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='profiles' AND column_name='notifications_enabled'
    ) THEN
      ALTER TABLE public.profiles ADD COLUMN notifications_enabled BOOLEAN NOT NULL DEFAULT true;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='profiles' AND column_name='updated_at'
    ) THEN
      ALTER TABLE public.profiles ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='products') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='products' AND column_name='updated_at'
    ) THEN
      ALTER TABLE public.products ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('ADMIN', 'REGISTRATION', 'SALES');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'farm_type') THEN
    CREATE TYPE public.farm_type AS ENUM ('MORVARIDI', 'MOTEFEREGHE');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_unit') THEN
    CREATE TYPE public.product_unit AS ENUM ('CARTON', 'KILOGRAM');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'log_level') THEN
    CREATE TYPE public.log_level AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL');
  END IF;
END $$;

-- =========================
-- TABLES
-- =========================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role public.user_role NOT NULL DEFAULT 'REGISTRATION',
  phone_number TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  last_visit TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_username_len_chk CHECK (char_length(username) >= 3)
);

CREATE TABLE IF NOT EXISTS public.farms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type public.farm_type NOT NULL DEFAULT 'MORVARIDI',
  is_active BOOLEAN NOT NULL DEFAULT true,
  product_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  unit public.product_unit NOT NULL DEFAULT 'CARTON',
  has_kilogram_unit BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_farms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, farm_id)
);

CREATE TABLE IF NOT EXISTS public.daily_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  previous_balance NUMERIC NOT NULL DEFAULT 0,
  previous_balance_kg NUMERIC NOT NULL DEFAULT 0,
  production NUMERIC NOT NULL DEFAULT 0,
  production_kg NUMERIC NOT NULL DEFAULT 0,
  sales NUMERIC NOT NULL DEFAULT 0,
  sales_kg NUMERIC NOT NULL DEFAULT 0,
  current_inventory NUMERIC NOT NULL DEFAULT 0,
  current_inventory_kg NUMERIC NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(farm_id, product_id, date),
  CONSTRAINT daily_statistics_date_format_chk CHECK (date ~ '^[0-9]{4}/[0-9]{2}/[0-9]{2}$')
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  total_cartons NUMERIC NOT NULL DEFAULT 0,
  total_weight NUMERIC NOT NULL DEFAULT 0,
  driver_name TEXT,
  driver_phone TEXT,
  plate_number TEXT,
  description TEXT,
  is_yesterday BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT invoices_date_format_chk CHECK (date ~ '^[0-9]{4}/[0-9]{2}/[0-9]{2}$')
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='invoices' AND constraint_name='invoices_invoice_number_key'
  ) THEN
    ALTER TABLE public.invoices DROP CONSTRAINT invoices_invoice_number_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='invoices' AND constraint_name='invoices_invoice_number_product_id_key'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_invoice_number_product_id_key UNIQUE (invoice_number, product_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, user_agent)
);

CREATE TABLE IF NOT EXISTS public.system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level public.log_level NOT NULL DEFAULT 'INFO',
  message TEXT NOT NULL,
  module TEXT,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT,
  stack TEXT,
  component_stack TEXT,
  user_id UUID,
  username TEXT,
  user_agent TEXT,
  url TEXT,
  app_version TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Missing table used by quoteService
CREATE TABLE IF NOT EXISTS public.daily_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_key TEXT NOT NULL,
  quote TEXT NOT NULL,
  source TEXT,
  author TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(date_key)
);

-- =========================
-- FUNCTIONS / TRIGGERS
-- =========================

-- Helper to avoid RLS recursion in policies (especially on public.profiles)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'ADMIN'
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.check_profile_update_permissions()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role) OR (NEW.is_active IS DISTINCT FROM OLD.is_active) THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN') THEN
      RAISE EXCEPTION 'Access Denied: You are not authorized to update sensitive fields.';
    END IF;
  END IF;

  IF NEW.username IS DISTINCT FROM OLD.username THEN
    NEW.username := btrim(NEW.username);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.log_system_event(
  p_level public.log_level,
  p_message TEXT,
  p_module TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.system_logs (level, message, module, user_id, metadata)
  VALUES (p_level, p_message, p_module, auth.uid(), p_metadata)
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.soft_delete_user(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN') THEN
    RAISE EXCEPTION 'Access Denied: Only Admins can deactivate users.';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Operation Failed: You cannot deactivate your own account.';
  END IF;

  UPDATE public.profiles SET is_active = FALSE WHERE id = target_user_id;
  DELETE FROM public.user_farms WHERE user_id = target_user_id;

  BEGIN
    PERFORM public.log_system_event('WARN', 'User account deactivated', 'USER_MANAGEMENT',
      jsonb_build_object('deactivated_user_id', target_user_id));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, role, notifications_enabled)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'full_name',
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'REGISTRATION'::public.user_role),
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Farm product_ids integrity: ensure every element exists in products.id
CREATE OR REPLACE FUNCTION public.validate_farm_product_ids()
RETURNS TRIGGER AS $$
DECLARE
  pid TEXT;
  pid_uuid UUID;
BEGIN
  IF NEW.product_ids IS NULL THEN
    NEW.product_ids := '{}';
    RETURN NEW;
  END IF;

  FOREACH pid IN ARRAY NEW.product_ids LOOP
    BEGIN
      pid_uuid := pid::uuid;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid product id in farms.product_ids: %', pid;
    END;

    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = pid_uuid) THEN
      RAISE EXCEPTION 'Unknown product id in farms.product_ids: %', pid;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- RPC used by frontend: create_new_user
-- NOTE: This tries to call auth.admin_create_user if present (signature varies by Supabase version).
-- If not available, it raises a clear error (see docs/MIGRATION_GUIDE_FA.md for the Edge Function alternative).
CREATE OR REPLACE FUNCTION public.create_new_user(
  email TEXT,
  password TEXT,
  user_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  new_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN') THEN
    RAISE EXCEPTION 'Access Denied: Only Admins can create users.';
  END IF;

  -- Try multiple known signatures safely via dynamic SQL
  IF to_regprocedure('auth.admin_create_user(jsonb)') IS NOT NULL THEN
    EXECUTE 'SELECT (auth.admin_create_user($1)).id'
      USING jsonb_build_object('email', email, 'password', password, 'user_metadata', user_metadata)
      INTO new_id;
  ELSIF to_regprocedure('auth.admin_create_user(text,text,jsonb)') IS NOT NULL THEN
    EXECUTE 'SELECT (auth.admin_create_user($1,$2,$3)).id'
      USING email, password, user_metadata
      INTO new_id;
  ELSIF to_regprocedure('auth.admin_create_user(text,text,jsonb,jsonb)') IS NOT NULL THEN
    EXECUTE 'SELECT (auth.admin_create_user($1,$2,$3,$4)).id'
      USING email, password, user_metadata, '{}'::jsonb
      INTO new_id;
  ELSE
    RAISE EXCEPTION 'auth.admin_create_user is not available in this project. Use an Edge Function with service_role to create Auth users.';
  END IF;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Triggers
DO $$
BEGIN
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
END $$;

DO $$
BEGIN
  DROP TRIGGER IF EXISTS on_profile_sensitive_update ON public.profiles;
  CREATE TRIGGER on_profile_sensitive_update
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.check_profile_update_permissions();
END $$;

DO $$
BEGIN
  DROP TRIGGER IF EXISTS tr_set_updated_at ON public.profiles;
  CREATE TRIGGER tr_set_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

  DROP TRIGGER IF EXISTS tr_set_updated_at ON public.farms;
  CREATE TRIGGER tr_set_updated_at BEFORE UPDATE ON public.farms
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

  DROP TRIGGER IF EXISTS tr_set_updated_at ON public.products;
  CREATE TRIGGER tr_set_updated_at BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

  DROP TRIGGER IF EXISTS tr_set_updated_at ON public.daily_statistics;
  CREATE TRIGGER tr_set_updated_at BEFORE UPDATE ON public.daily_statistics
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

  DROP TRIGGER IF EXISTS tr_set_updated_at ON public.invoices;
  CREATE TRIGGER tr_set_updated_at BEFORE UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

  DROP TRIGGER IF EXISTS tr_set_updated_at ON public.push_subscriptions;
  CREATE TRIGGER tr_set_updated_at BEFORE UPDATE ON public.push_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

  DROP TRIGGER IF EXISTS tr_validate_farm_product_ids ON public.farms;
  CREATE TRIGGER tr_validate_farm_product_ids
    BEFORE INSERT OR UPDATE OF product_ids ON public.farms
    FOR EACH ROW EXECUTE FUNCTION public.validate_farm_product_ids();
END $$;

-- =========================
-- RLS
-- =========================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_quotes ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "Profiles: Admin full access" ON public.profiles;
CREATE POLICY "Profiles: Admin full access" ON public.profiles FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Profiles: View authenticated" ON public.profiles;
CREATE POLICY "Profiles: View authenticated" ON public.profiles FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Profiles: Update own" ON public.profiles;
CREATE POLICY "Profiles: Update own" ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Farms
DROP POLICY IF EXISTS "Farms: Admins full access" ON public.farms;
CREATE POLICY "Farms: Admins full access" ON public.farms FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Farms: View assigned" ON public.farms;
CREATE POLICY "Farms: View assigned" ON public.farms FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.user_farms uf WHERE uf.user_id = auth.uid() AND uf.farm_id = farms.id)
  OR public.is_admin()
);

-- Products
DROP POLICY IF EXISTS "Products: View authenticated" ON public.products;
CREATE POLICY "Products: View authenticated" ON public.products FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Products: Admin manage" ON public.products;
CREATE POLICY "Products: Admin manage" ON public.products FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- user_farms
DROP POLICY IF EXISTS "UserFarms: Admin manage" ON public.user_farms;
CREATE POLICY "UserFarms: Admin manage" ON public.user_farms FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "UserFarms: View own" ON public.user_farms;
CREATE POLICY "UserFarms: View own" ON public.user_farms FOR SELECT
USING (user_id = auth.uid());

-- daily_statistics
DROP POLICY IF EXISTS "Stats: Farm based access" ON public.daily_statistics;
CREATE POLICY "Stats: Farm based access" ON public.daily_statistics FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.user_farms uf WHERE uf.user_id = auth.uid() AND uf.farm_id = daily_statistics.farm_id)
  OR public.is_admin()
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_farms uf WHERE uf.user_id = auth.uid() AND uf.farm_id = daily_statistics.farm_id)
  OR public.is_admin()
);

-- invoices
DROP POLICY IF EXISTS "Invoices: Farm based access" ON public.invoices;
CREATE POLICY "Invoices: Farm based access" ON public.invoices FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.user_farms uf WHERE uf.user_id = auth.uid() AND uf.farm_id = invoices.farm_id)
  OR public.is_admin()
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_farms uf WHERE uf.user_id = auth.uid() AND uf.farm_id = invoices.farm_id)
  OR public.is_admin()
);

-- push_subscriptions
DROP POLICY IF EXISTS "push_subscriptions_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_own" ON public.push_subscriptions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subscriptions_admin_select" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_admin_select" ON public.push_subscriptions FOR SELECT
USING (public.is_admin());

-- system_logs
DROP POLICY IF EXISTS "system_logs_admin_view" ON public.system_logs;
CREATE POLICY "system_logs_admin_view" ON public.system_logs FOR SELECT
USING (public.is_admin());

DROP POLICY IF EXISTS "system_logs_insert" ON public.system_logs;
CREATE POLICY "system_logs_insert" ON public.system_logs FOR INSERT
WITH CHECK (true);

-- error_logs
DROP POLICY IF EXISTS "ErrorLogs: Public insert" ON public.error_logs;
CREATE POLICY "ErrorLogs: Public insert" ON public.error_logs FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "ErrorLogs: Admins view" ON public.error_logs;
CREATE POLICY "ErrorLogs: Admins view" ON public.error_logs FOR SELECT
USING (public.is_admin());

-- daily_quotes
DROP POLICY IF EXISTS "daily_quotes_read_authenticated" ON public.daily_quotes;
CREATE POLICY "daily_quotes_read_authenticated" ON public.daily_quotes FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "daily_quotes_admin_insert" ON public.daily_quotes;
CREATE POLICY "daily_quotes_admin_insert" ON public.daily_quotes FOR INSERT
WITH CHECK (public.is_admin());

-- =========================
-- INDEXES
-- =========================

CREATE INDEX IF NOT EXISTS idx_daily_statistics_farm_date ON public.daily_statistics(farm_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_statistics_product ON public.daily_statistics(product_id);
CREATE INDEX IF NOT EXISTS idx_invoices_farm_date ON public.invoices(farm_id, date);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_user_farms_user ON public.user_farms(user_id);
CREATE INDEX IF NOT EXISTS idx_user_farms_farm ON public.user_farms(farm_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_time ON public.system_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_time ON public.error_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_daily_quotes_date_key ON public.daily_quotes(date_key);

-- =========================
-- VIEWS
-- =========================

CREATE OR REPLACE VIEW public.v_farm_daily_summary AS
SELECT
  f.name as farm_name,
  f.type as farm_type,
  ds.date,
  p.name as product_name,
  ds.production,
  ds.sales,
  ds.current_inventory,
  pr.full_name as created_by_name
FROM public.daily_statistics ds
JOIN public.farms f ON ds.farm_id = f.id
JOIN public.products p ON ds.product_id = p.id
LEFT JOIN public.profiles pr ON ds.created_by = pr.id
WHERE f.is_active = true;

-- =========================
-- REALTIME
-- =========================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_statistics;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- =========================
-- SEED
-- =========================

INSERT INTO public.products (id, name, description, unit, has_kilogram_unit, is_default, is_custom)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'شیرینگ پک ۶ شانه ساده', 'محصول پیش‌فرض سیستم', 'CARTON', false, true, false),
  ('22222222-2222-2222-2222-222222222222', 'شیرینگ پک ۶ شانه پرینتی', 'محصول پیش‌فرض سیستم', 'CARTON', false, true, false)
ON CONFLICT (id) DO NOTHING;
