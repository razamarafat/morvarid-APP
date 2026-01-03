-- ==========================================
-- MORVARID SYSTEM: MASTER DATABASE SCHEMA
-- Version: 3.0.0 (Clean, Idempotent, Production-Ready)
-- Description: Consolidation of all AI-generated scripts.
-- ==========================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TYPES (Safe Creation)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('ADMIN', 'REGISTRATION', 'SALES');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'farm_type') THEN
        CREATE TYPE farm_type AS ENUM ('MORVARIDI', 'MOTEFEREGHE');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_unit') THEN
        CREATE TYPE product_unit AS ENUM ('CARTON', 'KILOGRAM');
    END IF;
END $$;

-- 3. TABLES (Idempotent)

-- PROFILES (Extended from auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role user_role DEFAULT 'REGISTRATION',
    phone_number TEXT,
    is_active BOOLEAN DEFAULT true,
    last_visit TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- FARMS
CREATE TABLE IF NOT EXISTS public.farms (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    type farm_type NOT NULL DEFAULT 'MORVARIDI',
    is_active BOOLEAN DEFAULT true,
    product_ids TEXT[] DEFAULT '{}', -- Array of Product UUIDs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- PRODUCTS
CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    unit product_unit DEFAULT 'CARTON',
    has_kilogram_unit BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT false,
    is_custom BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- USER_FARMS (Assignment)
CREATE TABLE IF NOT EXISTS public.user_farms (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, farm_id)
);

-- DAILY STATISTICS
-- Note: 'date' is TEXT to support Jalali YYYY/MM/DD without timezone issues
CREATE TABLE IF NOT EXISTS public.daily_statistics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    date TEXT NOT NULL, 
    
    previous_balance NUMERIC DEFAULT 0,
    previous_balance_kg NUMERIC DEFAULT 0,
    production NUMERIC DEFAULT 0,
    production_kg NUMERIC DEFAULT 0,
    sales NUMERIC DEFAULT 0,
    sales_kg NUMERIC DEFAULT 0,
    current_inventory NUMERIC DEFAULT 0,
    current_inventory_kg NUMERIC DEFAULT 0,
    
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    UNIQUE(farm_id, product_id, date)
);

-- INVOICES
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    date TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    
    total_cartons NUMERIC DEFAULT 0,
    total_weight NUMERIC DEFAULT 0,
    
    driver_name TEXT,
    driver_phone TEXT,
    plate_number TEXT,
    description TEXT,
    is_yesterday BOOLEAN DEFAULT false,
    
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RELAX INVOICE UNIQUENESS (Allow multiple products per invoice number)
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_product_id_key;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_invoice_number_product_id_key UNIQUE (invoice_number, product_id);

-- PUSH SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    subscription JSONB NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, user_agent)
);

-- ERROR LOGS
CREATE TABLE IF NOT EXISTS public.error_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    message TEXT,
    stack TEXT,
    component_stack TEXT,
    user_id UUID,
    username TEXT,
    user_agent TEXT,
    url TEXT,
    app_version TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. UTILITY FUNCTIONS & SECURITY TRIGGERS (SECURITY DEFINER)

-- Handle New User Registration
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), 
    new.raw_user_meta_data->>'full_name', 
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'REGISTRATION'::user_role)
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Soft Delete User
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Protection from Sensitive Column Updates (Role/Active)
CREATE OR REPLACE FUNCTION public.check_profile_update_permissions()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role) OR (NEW.is_active IS DISTINCT FROM OLD.is_active) THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN') THEN
      RAISE EXCEPTION 'Access Denied: You are not authorized to update sensitive fields.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. TRIGGER ATTACHMENT

-- Auth Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Security Trigger
DROP TRIGGER IF EXISTS on_profile_sensitive_update ON public.profiles;
CREATE TRIGGER on_profile_sensitive_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.check_profile_update_permissions();

-- Update Timestamps
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('profiles', 'farms', 'daily_statistics', 'invoices', 'push_subscriptions')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS tr_set_updated_at ON public.%I', t);
        EXECUTE format('CREATE TRIGGER tr_set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at()', t);
    END LOOP;
END $$;

-- 6. ROW LEVEL SECURITY (RLS) policies

DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('profiles', 'farms', 'products', 'user_farms', 'daily_statistics', 'invoices', 'push_subscriptions', 'error_logs')
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- POLICIES: PROFILES
DROP POLICY IF EXISTS "Profiles: Viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles: Viewable by everyone" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Profiles: Update own" ON public.profiles;
CREATE POLICY "Profiles: Update own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- POLICIES: FARMS
DROP POLICY IF EXISTS "Farms: Admins full access" ON public.farms;
CREATE POLICY "Farms: Admins full access" ON public.farms FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));
DROP POLICY IF EXISTS "Farms: View assigned" ON public.farms;
CREATE POLICY "Farms: View assigned" ON public.farms FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_farms WHERE user_id = auth.uid() AND farm_id = farms.id) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- POLICIES: PRODUCTS
DROP POLICY IF EXISTS "Products: Viewable by everyone" ON public.products;
CREATE POLICY "Products: Viewable by everyone" ON public.products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Products: Admins manage" ON public.products;
CREATE POLICY "Products: Admins manage" ON public.products FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- POLICIES: STATISTICS & INVOICES (Access based on Farm Assignment)
-- Statistics
DROP POLICY IF EXISTS "Stats: Farm based access" ON public.daily_statistics;
CREATE POLICY "Stats: Farm based access" ON public.daily_statistics FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_farms WHERE user_id = auth.uid() AND farm_id = daily_statistics.farm_id) 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Invoices
DROP POLICY IF EXISTS "Invoices: Farm based access" ON public.invoices;
CREATE POLICY "Invoices: Farm based access" ON public.invoices FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_farms WHERE user_id = auth.uid() AND farm_id = invoices.farm_id) 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- POLICIES: USER_FARMS
DROP POLICY IF EXISTS "UserFarms: Admins manage" ON public.user_farms;
CREATE POLICY "UserFarms: Admins manage" ON public.user_farms FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));
DROP POLICY IF EXISTS "UserFarms: View own" ON public.user_farms;
CREATE POLICY "UserFarms: View own" ON public.user_farms FOR SELECT USING (user_id = auth.uid());

-- POLICIES: ERROR_LOGS
DROP POLICY IF EXISTS "ErrorLogs: Public insert" ON public.error_logs;
CREATE POLICY "ErrorLogs: Public insert" ON public.error_logs FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "ErrorLogs: Admins view" ON public.error_logs;
CREATE POLICY "ErrorLogs: Admins view" ON public.error_logs FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- 7. REALTIME ENABLEMENT
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  -- Safeguard: Adding tables one by one to avoid publication errors
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_statistics;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 8. SEED DATA
INSERT INTO public.products (id, name, description, unit, has_kilogram_unit, is_default, is_custom)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'شیرینگ پک ۶ شانه ساده', 'محصول پیش‌فرض سیستم', 'CARTON', false, true, false),
    ('22222222-2222-2222-2222-222222222222', 'شیرینگ پک ۶ شانه پرینتی', 'محصول پیش‌فرض سیستم', 'CARTON', false, true, false)
ON CONFLICT (id) DO NOTHING;
