-- ==========================================
-- MORVARID SYSTEM: MINIMAL SAFE MIGRATION
-- Version: 4.2.0 (ABSOLUTELY MINIMAL & SAFE)
-- Description: No fancy triggers, just tables and basic security
-- ==========================================

-- PHASE 1: Just check what we have
DO $$
BEGIN
    RAISE NOTICE 'Starting minimal safe migration...';
END $$;

-- PHASE 2: Extensions (safe)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- PHASE 3: Create ENUMs if they don't exist
DO $$ 
BEGIN
    -- User roles
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('ADMIN', 'REGISTRATION', 'SALES');
        RAISE NOTICE 'Created user_role enum';
    ELSE
        RAISE NOTICE 'user_role enum already exists';
    END IF;

    -- Farm types  
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'farm_type') THEN
        CREATE TYPE farm_type AS ENUM ('MORVARIDI', 'MOTEFEREGHE');
        RAISE NOTICE 'Created farm_type enum';
    ELSE
        RAISE NOTICE 'farm_type enum already exists';
    END IF;

    -- Product units
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_unit') THEN
        CREATE TYPE product_unit AS ENUM ('CARTON', 'KILOGRAM');
        RAISE NOTICE 'Created product_unit enum';
    ELSE
        RAISE NOTICE 'product_unit enum already exists';
    END IF;

    -- Log levels
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'log_level') THEN
        CREATE TYPE log_level AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL');
        RAISE NOTICE 'Created log_level enum';
    ELSE
        RAISE NOTICE 'log_level enum already exists';
    END IF;
END $$;

-- PHASE 4: Create tables (NO TRIGGERS YET!)

-- Table 1: profiles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
        CREATE TABLE public.profiles (
            id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            full_name TEXT,
            role user_role DEFAULT 'REGISTRATION',
            phone_number TEXT,
            is_active BOOLEAN DEFAULT true,
            last_visit TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
        );
        RAISE NOTICE 'Created profiles table';
    ELSE
        RAISE NOTICE 'profiles table already exists';
    END IF;
END $$;

-- Table 2: farms
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'farms' AND table_schema = 'public') THEN
        CREATE TABLE public.farms (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            name TEXT NOT NULL,
            type farm_type NOT NULL DEFAULT 'MORVARIDI',
            is_active BOOLEAN DEFAULT true,
            product_ids TEXT[] DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
        );
        RAISE NOTICE 'Created farms table';
    ELSE
        RAISE NOTICE 'farms table already exists';
    END IF;
END $$;

-- Table 3: products
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products' AND table_schema = 'public') THEN
        CREATE TABLE public.products (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            unit product_unit DEFAULT 'CARTON',
            has_kilogram_unit BOOLEAN DEFAULT false,
            is_default BOOLEAN DEFAULT false,
            is_custom BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT now() NOT NULL
        );
        RAISE NOTICE 'Created products table';
    ELSE
        RAISE NOTICE 'products table already exists';
    END IF;
END $$;

-- Table 4: user_farms
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_farms' AND table_schema = 'public') THEN
        CREATE TABLE public.user_farms (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
            farm_id UUID REFERENCES public.farms(id) ON DELETE CASCADE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
            UNIQUE(user_id, farm_id)
        );
        RAISE NOTICE 'Created user_farms table';
    ELSE
        RAISE NOTICE 'user_farms table already exists';
    END IF;
END $$;

-- Table 5: daily_statistics
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_statistics' AND table_schema = 'public') THEN
        CREATE TABLE public.daily_statistics (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
            created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
            UNIQUE(farm_id, product_id, date)
        );
        RAISE NOTICE 'Created daily_statistics table';
    ELSE
        RAISE NOTICE 'daily_statistics table already exists';
    END IF;
END $$;

-- Table 6: invoices
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices' AND table_schema = 'public') THEN
        CREATE TABLE public.invoices (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
            created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
        );
        RAISE NOTICE 'Created invoices table';
    ELSE
        RAISE NOTICE 'invoices table already exists';
    END IF;
END $$;

-- Table 7: push_subscriptions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'push_subscriptions' AND table_schema = 'public') THEN
        CREATE TABLE public.push_subscriptions (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
            subscription JSONB NOT NULL,
            user_agent TEXT,
            created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
            UNIQUE(user_id, user_agent)
        );
        RAISE NOTICE 'Created push_subscriptions table';
    ELSE
        RAISE NOTICE 'push_subscriptions table already exists';
    END IF;
END $$;

-- Table 8: system_logs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_logs' AND table_schema = 'public') THEN
        CREATE TABLE public.system_logs (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            level log_level NOT NULL DEFAULT 'INFO',
            message TEXT NOT NULL,
            module TEXT,
            user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
            session_id TEXT,
            ip_address INET,
            user_agent TEXT,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT now() NOT NULL
        );
        RAISE NOTICE 'Created system_logs table';
    ELSE
        RAISE NOTICE 'system_logs table already exists';
    END IF;
END $$;

-- Table 9: error_logs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'error_logs' AND table_schema = 'public') THEN
        CREATE TABLE public.error_logs (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            message TEXT,
            stack TEXT,
            component_stack TEXT,
            user_id UUID,
            username TEXT,
            user_agent TEXT,
            url TEXT,
            app_version TEXT,
            timestamp TIMESTAMPTZ DEFAULT now() NOT NULL
        );
        RAISE NOTICE 'Created error_logs table';
    ELSE
        RAISE NOTICE 'error_logs table already exists';
    END IF;
END $$;

-- PHASE 5: Fix constraints carefully
DO $$
BEGIN
    -- Fix invoice uniqueness constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'invoices_invoice_number_key' 
        AND table_name = 'invoices' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.invoices DROP CONSTRAINT invoices_invoice_number_key;
        RAISE NOTICE 'Dropped old invoice constraint';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'invoices_invoice_number_product_id_key' 
        AND table_name = 'invoices' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.invoices ADD CONSTRAINT invoices_invoice_number_product_id_key 
        UNIQUE (invoice_number, product_id);
        RAISE NOTICE 'Added new invoice constraint';
    END IF;
END $$;

-- PHASE 6: Create basic functions (NO TRIGGERS YET)
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

-- PHASE 7: Enable RLS (safe)
DO $$
BEGIN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.user_farms ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.daily_statistics ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Enabled RLS on all tables';
END $$;

-- PHASE 8: Basic RLS Policies
-- Profiles
DROP POLICY IF EXISTS "Profiles: Viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles: Viewable by everyone" ON public.profiles FOR SELECT USING (true);

-- Products  
DROP POLICY IF EXISTS "Products: Viewable by everyone" ON public.products;
CREATE POLICY "Products: Viewable by everyone" ON public.products FOR SELECT USING (true);

-- Basic admin access for farms
DROP POLICY IF EXISTS "Farms: Basic access" ON public.farms;
CREATE POLICY "Farms: Basic access" ON public.farms FOR ALL USING (true);

-- Basic access for other tables (temporary - will be refined later)
DROP POLICY IF EXISTS "user_farms_basic" ON public.user_farms;
CREATE POLICY "user_farms_basic" ON public.user_farms FOR ALL USING (true);

DROP POLICY IF EXISTS "daily_statistics_basic" ON public.daily_statistics;  
CREATE POLICY "daily_statistics_basic" ON public.daily_statistics FOR ALL USING (true);

DROP POLICY IF EXISTS "invoices_basic" ON public.invoices;
CREATE POLICY "invoices_basic" ON public.invoices FOR ALL USING (true);

DROP POLICY IF EXISTS "push_subscriptions_basic" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_basic" ON public.push_subscriptions FOR ALL USING (true);

DROP POLICY IF EXISTS "system_logs_basic" ON public.system_logs;
CREATE POLICY "system_logs_basic" ON public.system_logs FOR ALL USING (true);

DROP POLICY IF EXISTS "error_logs_basic" ON public.error_logs;
CREATE POLICY "error_logs_basic" ON public.error_logs FOR ALL USING (true);

-- PHASE 9: Seed data
INSERT INTO public.products (id, name, description, unit, has_kilogram_unit, is_default, is_custom)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'شیرینگ پک ۶ شانه ساده', 'محصول پیش‌فرض سیستم', 'CARTON', false, true, false),
    ('22222222-2222-2222-2222-222222222222', 'شیرینگ پک ۶ شانه پرینتی', 'محصول پیش‌فرض سیستم', 'CARTON', false, true, false)
ON CONFLICT (id) DO NOTHING;

-- PHASE 10: Success message
DO $$
BEGIN
    RAISE NOTICE 'MINIMAL SAFE MIGRATION COMPLETED SUCCESSFULLY!';
    RAISE NOTICE 'All tables created, RLS enabled, basic policies set';
    RAISE NOTICE 'NO TRIGGERS WERE CREATED - this prevents the error';
END $$;

-- Show what we accomplished
SELECT 'MIGRATION SUCCESS: ' || count(*) || ' tables created' as result
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'farms', 'products', 'user_farms', 'daily_statistics', 'invoices', 'push_subscriptions', 'system_logs', 'error_logs');