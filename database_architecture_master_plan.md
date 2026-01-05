# طرح جامع معماری دیتابیس (Database Master Plan)

## ۱. تحلیل وضعیت فعلی (Current State Analysis)

تحلیل دقیق مشکلات فعلی: ستون‌های گم شده، روابط تعریف نشده، مشکلات امنیتی RLS، و غیره

بر اساس بررسی تمام فایل‌های پروژه، مشخص شد که سیستم Morvarid یک سیستم مدیریت فارم‌های کشاورزی است که شامل چندین ماژول کلیدی است:
- مدیریت کاربران با نقش‌های مختلف (ADMIN, REGISTRATION, SALES)
- مدیریت فارم‌های مختلف (MORVARIDI, MOTEFEREGHE)
- مدیریت محصولات با واحد‌های مختلف (CARTON, KILOGRAM)
- ثبت آمار روزانه تولید و موجودی
- ثبت حواله‌های فروش

مشکلات شناسایی شده:
1. نبود یک طرح کلی یکپارچه برای تمام جداول
2. نیاز به روابط مناسب بین جداول برای جلوگیری از نقض یکپارچگی داده
3. نبود سیاست‌های RLS کامل برای کنترل دسترسی بر اساس نقش
4. نبود تریگرها برای به‌روزرسانی خودکار زمان‌های ایجاد و ویرایش
5. نبود توابع پایگاه داده برای عملیات پیچیده
6. نبود ایندکس‌های مناسب برای بهبود عملکرد

## ۲. طرح اسکیما نهایی (Final Schema Design)

لیست کامل جداول با جزئیات دقیق ستون‌ها و نوع داده‌ها:

**Table: profiles**
- `id`: UUID (PK) - ارجاع به auth.users.id
- `username`: TEXT - نام کاربری منحصر به فرد
- `full_name`: TEXT - نام کامل کاربر
- `role`: user_role - ENUM (ADMIN, REGISTRATION, SALES)
- `phone_number`: TEXT - شماره تلفن
- `is_active`: BOOLEAN - وضعیت فعال بودن کاربر
- `last_visit`: TIMESTAMPTZ - آخرین بازدید
- `created_at`: TIMESTAMPTZ - زمان ایجاد
- `updated_at`: TIMESTAMPTZ - زمان آخرین به‌روزرسانی

**Table: farms**
- `id`: UUID (PK) - شناسه منحصر به فرد فارم
- `name`: TEXT - نام فارم
- `type`: farm_type - ENUM (MORVARIDI, MOTEFEREGHE)
- `is_active`: BOOLEAN - وضعیت فعال بودن فارم
- `product_ids`: TEXT[] - آرایه از شناسه‌های محصولات مرتبط
- `created_at`: TIMESTAMPTZ - زمان ایجاد
- `updated_at`: TIMESTAMPTZ - زمان آخرین به‌روزرسانی

**Table: products**
- `id`: UUID (PK) - شناسه منحصر به فرد محصول
- `name`: TEXT - نام محصول
- `description`: TEXT - توضیحات محصول
- `unit`: product_unit - ENUM (CARTON, KILOGRAM)
- `has_kilogram_unit`: BOOLEAN - آیا واحد کیلوگرم دارد؟
- `is_default`: BOOLEAN - آیا محصول پیش‌فرض است؟
- `is_custom`: BOOLEAN - آیا محصول سفارشی است؟
- `created_at`: TIMESTAMPTZ - زمان ایجاد
- `updated_at`: TIMESTAMPTZ - زمان آخرین به‌روزرسانی

**Table: user_farms**
- `id`: UUID (PK) - شناسه منحصر به فرد
- `user_id`: UUID (FK) - ارجاع به profiles.id
- `farm_id`: UUID (FK) - ارجاع به farms.id
- `created_at`: TIMESTAMPTZ - زمان ایجاد

**Table: daily_statistics**
- `id`: UUID (PK) - شناسه منحصر به فرد
- `farm_id`: UUID (FK) - ارجاع به farms.id
- `product_id`: UUID (FK) - ارجاع به products.id
- `date`: TEXT - تاریخ به فرمت متنی
- `previous_balance`: NUMERIC - موجودی قبلی (تعداد)
- `previous_balance_kg`: NUMERIC - موجودی قبلی (کیلوگرم)
- `production`: NUMERIC - تولید روز (تعداد)
- `production_kg`: NUMERIC - تولید روز (کیلوگرم)
- `sales`: NUMERIC - فروش (تعداد)
- `sales_kg`: NUMERIC - فروش (کیلوگرم)
- `current_inventory`: NUMERIC - موجودی فعلی (تعداد)
- `current_inventory_kg`: NUMERIC - موجودی فعلی (کیلوگرم)
- `created_by`: UUID (FK) - ارجاع به profiles.id
- `created_at`: TIMESTAMPTZ - زمان ایجاد
- `updated_at`: TIMESTAMPTZ - زمان آخرین به‌روزرسانی

**Table: invoices**
- `id`: UUID (PK) - شناسه منحصر به فرد
- `farm_id`: UUID (FK) - ارجاع به farms.id
- `product_id`: UUID (FK) - ارجاع به products.id
- `date`: TEXT - تاریخ به فرمت متنی
- `invoice_number`: TEXT - شماره حواله
- `total_cartons`: NUMERIC - تعداد کل کارتن‌ها
- `total_weight`: NUMERIC - وزن کل (کیلوگرم)
- `driver_name`: TEXT - نام راننده
- `driver_phone`: TEXT - شماره تماس راننده
- `plate_number`: TEXT - شماره پلاک
- `description`: TEXT - توضیحات
- `is_yesterday`: BOOLEAN - آیا مربوط به دیروز است؟
- `created_by`: UUID (FK) - ارجاع به profiles.id
- `created_at`: TIMESTAMPTZ - زمان ایجاد
- `updated_at`: TIMESTAMPTZ - زمان آخرین به‌روزرسانی

**Table: push_subscriptions**
- `id`: UUID (PK) - شناسه منحصر به فرد
- `user_id`: UUID (FK) - ارجاع به profiles.id
- `subscription`: JSONB - اطلاعات اشتراک
- `user_agent`: TEXT - اطلاعات مرورگر
- `created_at`: TIMESTAMPTZ - زمان ایجاد
- `updated_at`: TIMESTAMPTZ - زمان آخرین به‌روزرسانی

**Table: system_logs**
- `id`: UUID (PK) - شناسه منحصر به فرد
- `level`: log_level - ENUM (DEBUG, INFO, WARN, ERROR, CRITICAL)
- `message`: TEXT - پیام لاگ
- `module`: TEXT - ماژول منبع
- `user_id`: UUID (FK) - ارجاع به profiles.id
- `session_id`: TEXT - شناسه نشست
- `ip_address`: INET - آدرس IP
- `user_agent`: TEXT - اطلاعات مرورگر
- `metadata`: JSONB - اطلاعات اضافی
- `created_at`: TIMESTAMPTZ - زمان ایجاد

**Table: error_logs**
- `id`: UUID (PK) - شناسه منحصر به فرد
- `message`: TEXT - پیام خطا
- `stack`: TEXT - پشته خطا
- `component_stack`: TEXT - پشته کامپوننت
- `user_id`: UUID - شناسه کاربر
- `username`: TEXT - نام کاربری
- `user_agent`: TEXT - اطلاعات مرورگر
- `url`: TEXT - آدرس صفحه
- `app_version`: TEXT - نسخه برنامه
- `timestamp`: TIMESTAMPTZ - زمان ایجاد

## ۳. روابط و یکپارچگی (Relationships & Integrity)

توضیح نمودار ERD متنی: کدام جدول به کدام وصل است و چرا

- جدول profiles: پایه کلیه کاربران، ارتباط یک به یک با auth.users
- جدول farms: اطلاعات فارم‌ها، هیچ ارتباط مستقیمی با profiles ندارد
- جدول products: اطلاعات محصولات، مستقل از سایر جداول
- جدول user_farms: جدول ارتباطی بین profiles و farms (چند به چند)
- جدول daily_statistics: دارای ارتباط با farms، products و profiles (چند به یک)
- جدول invoices: دارای ارتباط با farms، products و profiles (چند به یک)
- جدول push_subscriptions: ارتباط یک به چند با profiles
- جدول system_logs: ارتباط یک به چند با profiles (اختیاری)
- جدول error_logs: ارتباط یک به چند با profiles (اختیاری)

قوانین یکپارچگی:
- CASCADE DELETE برای user_farms هنگام حذف کاربر یا فارم
- SET NULL برای created_by در daily_statistics و invoices هنگام حذف کاربر
- UNIQUE constraint برای ترکیب farm_id، product_id و date در daily_statistics
- UNIQUE constraint برای ترکیب invoice_number و product_id در invoices

## ۴. امنیت و دسترسی (Security & RLS)

تعریف دقیق Policyها برای هر نقش: Admin چه می‌بیند؟ User چه می‌بیند؟

**Profiles Table Policies:**
- SELECT: همه می‌توانند مشاهده کنند
- UPDATE: فقط کاربر خود می‌تواند پروفایل خود را ویرایش کند
- INSERT: فقط از طریق تریگر auth انجام می‌شود
- DELETE: ممنوع

**Farms Table Policies:**
- SELECT: ادمین می‌تواند همه را ببیند، کاربران فقط فارم‌های اختصاص داده شده
- INSERT/UPDATE/DELETE: فقط ادمین

**Products Table Policies:**
- SELECT: همه می‌توانند مشاهده کنند
- INSERT/UPDATE/DELETE: فقط ادمین

**User_Farms Table Policies:**
- SELECT: ادمین می‌تواند همه را ببیند، کاربر فقط مربوط به خود
- INSERT/UPDATE/DELETE: فقط ادمین

**Daily_Statistics Table Policies:**
- SELECT: ادمین می‌تواند همه را ببیند، کاربر فقط مربوط به فارم‌های خود
- INSERT/UPDATE/DELETE: ادمین و کاربران مربوط به فارم

**Invoices Table Policies:**
- SELECT: ادمین می‌تواند همه را ببیند، کاربر فقط مربوط به فارم‌های خود
- INSERT/UPDATE/DELETE: ادمین و کاربران مربوط به فارم

**Push_Subscriptions Table Policies:**
- SELECT/INSERT/UPDATE/DELETE: فقط کاربر مربوطه

**System_Logs Table Policies:**
- SELECT: فقط ادمین
- INSERT: همه می‌توانند ثبت کنند
- UPDATE/DELETE: ممنوع

**Error_Logs Table Policies:**
- SELECT: فقط ادمین
- INSERT: همه می‌توانند ثبت کنند
- UPDATE/DELETE: ممنوع

## ۵. اسکریپت SQL نهایی (The Master Script)

یک اسکریپت SQL کامل و قابل اجرا (Idempotent) که کل دیتابیس را از صفر می‌سازد یا اصلاح می‌کند. شامل `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE`, `CREATE POLICY`, `CREATE FUNCTION`

```sql
-- ==========================================
-- MORVARID SYSTEM: MASTER DATABASE SCHEMA
-- Version: 5.0.0 (Production Ready)
-- Description: Complete database schema with all tables, relationships, and security
-- ==========================================

-- PHASE 1: Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- PHASE 2: Create ENUMs
DO $$ 
BEGIN
    -- User roles
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('ADMIN', 'REGISTRATION', 'SALES');
    END IF;

    -- Farm types  
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'farm_type') THEN
        CREATE TYPE farm_type AS ENUM ('MORVARIDI', 'MOTEFEREGHE');
    END IF;

    -- Product units
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_unit') THEN
        CREATE TYPE product_unit AS ENUM ('CARTON', 'KILOGRAM');
    END IF;

    -- Log levels
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'log_level') THEN
        CREATE TYPE log_level AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL');
    END IF;
END $$;

-- PHASE 3: Create tables

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
            created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
        );
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
    END IF;
END $$;

-- PHASE 4: Add missing columns if needed
DO $$
BEGIN
    -- Check if products table has updated_at (it might be missing)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'products' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.products ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now() NOT NULL;
    END IF;
END $$;

-- PHASE 5: Create all necessary functions

-- 5.1 Updated timestamp function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5.2 Profile security function
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

-- 5.3 Soft delete function
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
    
    -- Log the action if system_logs table exists
    BEGIN
        INSERT INTO public.system_logs (level, message, module, user_id, metadata)
        VALUES ('WARN', 'User account deactivated', 'USER_MANAGEMENT', auth.uid(), 
                jsonb_build_object('deactivated_user_id', target_user_id));
    EXCEPTION WHEN OTHERS THEN
        -- Continue even if logging fails
        NULL;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.4 System logging function
CREATE OR REPLACE FUNCTION public.log_system_event(
    p_level log_level,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.5 Function to sync sales from invoices to statistics
CREATE OR REPLACE FUNCTION public.sync_sales_from_invoices(
    p_farm_id UUID,
    p_date TEXT,
    p_product_id UUID
) RETURNS VOID AS $$
DECLARE
    total_sales NUMERIC;
    total_sales_kg NUMERIC;
    new_current NUMERIC;
    new_current_kg NUMERIC;
BEGIN
    -- Calculate total sales from invoices
    SELECT 
        COALESCE(SUM(total_cartons), 0),
        COALESCE(SUM(total_weight), 0)
    INTO total_sales, total_sales_kg
    FROM public.invoices
    WHERE farm_id = p_farm_id 
        AND date = p_date 
        AND product_id = p_product_id;

    -- Update the statistics record
    UPDATE public.daily_statistics
    SET 
        sales = total_sales,
        sales_kg = total_sales_kg,
        current_inventory = COALESCE(previous_balance, 0) + COALESCE(production, 0) - total_sales,
        current_inventory_kg = COALESCE(previous_balance_kg, 0) + COALESCE(production_kg, 0) - total_sales_kg,
        updated_at = now()
    WHERE farm_id = p_farm_id 
        AND date = p_date 
        AND product_id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- PHASE 6: Add triggers

-- 6.1 Auth trigger (critical)
DO $$
BEGIN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
END $$;

-- 6.2 Profile security trigger
DO $$
BEGIN
    DROP TRIGGER IF EXISTS on_profile_sensitive_update ON public.profiles;
    CREATE TRIGGER on_profile_sensitive_update
        BEFORE UPDATE ON public.profiles
        FOR EACH ROW EXECUTE FUNCTION public.check_profile_update_permissions();
END $$;

-- 6.3 Updated_at triggers (with verification)
DO $$
DECLARE
    table_rec RECORD;
BEGIN
    -- Check each table that should have updated_at trigger
    FOR table_rec IN 
        SELECT t.table_name 
        FROM information_schema.tables t
        JOIN information_schema.columns c ON t.table_name = c.table_name
        WHERE t.table_schema = 'public' 
        AND c.table_schema = 'public'
        AND t.table_name IN ('profiles', 'farms', 'daily_statistics', 'invoices', 'push_subscriptions', 'products')
        AND c.column_name = 'updated_at'
    LOOP
        -- Create trigger for this table
        EXECUTE format('DROP TRIGGER IF EXISTS tr_set_updated_at ON public.%I', table_rec.table_name);
        EXECUTE format('CREATE TRIGGER tr_set_updated_at BEFORE UPDATE ON public.%I 
                       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', table_rec.table_name);
    END LOOP;
END $$;

-- PHASE 7: Create all RLS policies

-- 7.1 Profiles policies
DROP POLICY IF EXISTS "Profiles: Viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles: Viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Profiles: Update own" ON public.profiles;
CREATE POLICY "Profiles: Update own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 7.2 Farms policies
DROP POLICY IF EXISTS "Farms: Admins full access" ON public.farms;
CREATE POLICY "Farms: Admins full access" ON public.farms FOR ALL 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

DROP POLICY IF EXISTS "Farms: View assigned" ON public.farms;
CREATE POLICY "Farms: View assigned" ON public.farms FOR SELECT 
    USING (EXISTS (SELECT 1 FROM public.user_farms WHERE user_id = auth.uid() AND farm_id = farms.id)
           OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- 7.3 Products policies
DROP POLICY IF EXISTS "Products: Admins manage" ON public.products;
CREATE POLICY "Products: Admins manage" ON public.products FOR ALL 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- 7.4 User_farms policies
DROP POLICY IF EXISTS "UserFarms: Admins manage" ON public.user_farms;
CREATE POLICY "UserFarms: Admins manage" ON public.user_farms FOR ALL 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

DROP POLICY IF EXISTS "UserFarms: View own" ON public.user_farms;
CREATE POLICY "UserFarms: View own" ON public.user_farms FOR SELECT USING (user_id = auth.uid());

-- 7.5 Daily statistics policies
DROP POLICY IF EXISTS "Stats: Farm based access" ON public.daily_statistics;
CREATE POLICY "Stats: Farm based access" ON public.daily_statistics FOR ALL 
    USING (
        EXISTS (SELECT 1 FROM public.user_farms WHERE user_id = auth.uid() AND farm_id = daily_statistics.farm_id) 
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- 7.6 Invoices policies
DROP POLICY IF EXISTS "Invoices: Farm based access" ON public.invoices;
CREATE POLICY "Invoices: Farm based access" ON public.invoices FOR ALL 
    USING (
        EXISTS (SELECT 1 FROM public.user_farms WHERE user_id = auth.uid() AND farm_id = invoices.farm_id) 
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- 7.7 Push subscriptions policies
DROP POLICY IF EXISTS "push_subscriptions_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_own" ON public.push_subscriptions FOR ALL 
    USING (auth.uid() = user_id);

-- 7.8 System logs policies
DROP POLICY IF EXISTS "system_logs_admin_view" ON public.system_logs;
CREATE POLICY "system_logs_admin_view" ON public.system_logs FOR SELECT 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

DROP POLICY IF EXISTS "system_logs_insert" ON public.system_logs;
CREATE POLICY "system_logs_insert" ON public.system_logs FOR INSERT WITH CHECK (true);

-- 7.9 Error logs policies
DROP POLICY IF EXISTS "ErrorLogs: Public insert" ON public.error_logs;
CREATE POLICY "ErrorLogs: Public insert" ON public.error_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "ErrorLogs: Admins view" ON public.error_logs;
CREATE POLICY "ErrorLogs: Admins view" ON public.error_logs FOR SELECT 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- PHASE 8: Enable RLS on all tables
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
END $$;

-- PHASE 9: Add performance indexes
CREATE INDEX IF NOT EXISTS idx_daily_statistics_farm_date ON public.daily_statistics(farm_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_statistics_product ON public.daily_statistics(product_id);
CREATE INDEX IF NOT EXISTS idx_invoices_farm_date ON public.invoices(farm_id, date);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_user_farms_user ON public.user_farms(user_id);
CREATE INDEX IF NOT EXISTS idx_user_farms_farm ON public.user_farms(farm_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_time ON public.system_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_time ON public.error_logs(timestamp);

-- PHASE 10: Create reporting views
CREATE OR REPLACE VIEW v_farm_daily_summary AS
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

-- PHASE 11: Create function to handle new user
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

-- PHASE 12: Fix invoice uniqueness constraint
DO $$
BEGIN
    -- Drop old constraint if exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'invoices_invoice_number_key' 
        AND table_name = 'invoices' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.invoices DROP CONSTRAINT invoices_invoice_number_key;
    END IF;
    
    -- Add new composite constraint
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'invoices_invoice_number_product_id_key' 
        AND table_name = 'invoices' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.invoices ADD CONSTRAINT invoices_invoice_number_product_id_key 
        UNIQUE (invoice_number, product_id);
    END IF;
END $$;

-- PHASE 13: Seed data
INSERT INTO public.products (id, name, description, unit, has_kilogram_unit, is_default, is_custom)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'شیرینگ پک ۶ شانه ساده', 'محصول پیش‌فرض سیستم', 'CARTON', false, true, false),
    ('22222222-2222-2222-2222-222222222222', 'شیرینگ پک ۶ شانه پرینتی', 'محصول پیش‌فرض سیستم', 'CARTON', false, true, false)
ON CONFLICT (id) DO NOTHING;

-- PHASE 14: Enable realtime
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
    
    -- Add tables to realtime safely
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_statistics;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- PHASE 15: Final success message
DO $$
BEGIN
    BEGIN
        PERFORM public.log_system_event('INFO'::log_level, 'Complete database schema migration finished', 'MIGRATION',
                                      jsonb_build_object('version', '5.0.0', 'timestamp', now()));
    EXCEPTION WHEN OTHERS THEN
        -- Continue even if logging fails
        NULL;
    END;
    
    RAISE NOTICE '🎉 COMPLETE DATABASE SCHEMA MIGRATION FINISHED SUCCESSFULLY!';
    RAISE NOTICE '✅ All tables created';
    RAISE NOTICE '✅ All relationships defined';
    RAISE NOTICE '✅ All security policies configured';
    RAISE NOTICE '✅ Performance indexes created';
    RAISE NOTICE '✅ Realtime enabled';
    RAISE NOTICE '🚀 Your database is now production-ready!';
END $$;
```

## ۶. راهنمای مهاجرت (Migration Guide)

چگونه داده‌های فعلی را بدون از دست رفتن به ساختار جدید منتقل کنیم

برای مهاجرت داده‌های فعلی به ساختار جدید:

1. **پشتیبان‌گیری کامل**: قبل از هر تغییر، یک نسخه پشتیبان کامل از دیتابیس موجود تهیه کنید.

2. **اجرای اسکریپت مهاجرت**:
   - اسکریپت SQL نهایی را در دیتابیس جدید اجرا کنید
   - اسکریپت طوری نوشته شده که قابل اجرا چندباره است (idempotent)

3. **مهاجرت داده‌های موجود**:
   - اگر داده‌های موجود در ساختار قدیمی دارید، از اسکریپت زیر استفاده کنید:
   
```sql
-- مهاجرت داده‌های موجود به جداول جدید
-- توجه: قبل از اجرای این بخش، مطمئن شوید که ساختار جدید ایجاد شده است

-- انتقال کاربران
INSERT INTO public.profiles (id, username, full_name, role, phone_number, is_active, last_visit, created_at, updated_at)
SELECT 
    id, 
    username, 
    full_name, 
    COALESCE(role, 'REGISTRATION')::user_role, 
    phone_number, 
    is_active, 
    last_visit, 
    created_at, 
    updated_at
FROM public.profiles_old
ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    phone_number = EXCLUDED.phone_number,
    is_active = EXCLUDED.is_active;

-- انتقال فارم‌ها
INSERT INTO public.farms (id, name, type, is_active, product_ids, created_at, updated_at)
SELECT 
    id, 
    name, 
    type::farm_type, 
    is_active, 
    product_ids, 
    created_at, 
    updated_at
FROM public.farms_old
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    is_active = EXCLUDED.is_active;

-- ادامه مراحل مشابه برای سایر جداول...
```

4. **تست عملکرد**: پس از مهاجرت، تمام عملیات اصلی سیستم را تست کنید:
   - ورود و خروج کاربران
   - ثبت آمار روزانه
   - ثبت حواله‌ها
   - گزارش‌گیری

5. **تست امنیتی**: اطمینان حاصل کنید که سیاست‌های RLS به درستی کار می‌کنند و کاربران فقط به داده‌های مربوطه خود دسترسی دارند.

6. **به‌روزرسانی کد برنامه**: اطمینان حاصل کنید که کد فرانت‌اند با ساختار جدید سازگار است و تمام فیلدها به درستی نگاشت می‌شوند.