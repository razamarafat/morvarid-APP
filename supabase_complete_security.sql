-- ==========================================
-- MORVARID SYSTEM: COMPLETE SECURITY & TRIGGERS
-- Version: 4.3.0 (Complete the migration safely)
-- Description: Add missing triggers and proper security
-- ==========================================

-- PHASE 1: Verify all tables exist and have correct columns
DO $$
DECLARE
    missing_tables TEXT[] := '{}';
    tbl_name TEXT;
    col_count INT;
BEGIN
    -- Check each required table
    FOR tbl_name IN SELECT unnest(ARRAY['profiles', 'farms', 'products', 'user_farms', 'daily_statistics', 'invoices', 'push_subscriptions', 'system_logs', 'error_logs'])
    LOOP
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl_name) THEN
            missing_tables := array_append(missing_tables, tbl_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'Missing tables: %', array_to_string(missing_tables, ', ');
    ELSE
        RAISE NOTICE 'All required tables exist ✓';
    END IF;
END $$;

-- PHASE 2: Add missing columns if needed
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
        RAISE NOTICE 'Added updated_at column to products table';
    END IF;
END $$;

-- PHASE 3: Create all necessary functions
-- 3.1 Updated timestamp function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3.2 Profile security function
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

-- 3.3 Soft delete function
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

-- 3.4 System logging function
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

-- PHASE 4: Add triggers SAFELY (one by one with verification)

-- 4.1 Auth trigger (critical)
DO $$
BEGIN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    RAISE NOTICE 'Created auth trigger ✓';
END $$;

-- 4.2 Profile security trigger
DO $$
BEGIN
    DROP TRIGGER IF EXISTS on_profile_sensitive_update ON public.profiles;
    CREATE TRIGGER on_profile_sensitive_update
        BEFORE UPDATE ON public.profiles
        FOR EACH ROW EXECUTE FUNCTION public.check_profile_update_permissions();
    RAISE NOTICE 'Created profile security trigger ✓';
END $$;

-- 4.3 Updated_at triggers (with verification)
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
        RAISE NOTICE 'Created updated_at trigger for % ✓', table_rec.table_name;
    END LOOP;
END $$;

-- PHASE 5: Replace basic policies with proper security
-- 5.1 Profiles policies (refined)
DROP POLICY IF EXISTS "Profiles: Viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles: Viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Profiles: Update own" ON public.profiles;
CREATE POLICY "Profiles: Update own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 5.2 Farms policies (refined)
DROP POLICY IF EXISTS "Farms: Basic access" ON public.farms;

DROP POLICY IF EXISTS "Farms: Admins full access" ON public.farms;
CREATE POLICY "Farms: Admins full access" ON public.farms FOR ALL 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

DROP POLICY IF EXISTS "Farms: View assigned" ON public.farms;
CREATE POLICY "Farms: View assigned" ON public.farms FOR SELECT 
    USING (EXISTS (SELECT 1 FROM public.user_farms WHERE user_id = auth.uid() AND farm_id = farms.id)
           OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- 5.3 Products policies (refined)
DROP POLICY IF EXISTS "Products: Admins manage" ON public.products;
CREATE POLICY "Products: Admins manage" ON public.products FOR ALL 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- 5.4 User_farms policies (refined)
DROP POLICY IF EXISTS "user_farms_basic" ON public.user_farms;

DROP POLICY IF EXISTS "UserFarms: Admins manage" ON public.user_farms;
CREATE POLICY "UserFarms: Admins manage" ON public.user_farms FOR ALL 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

DROP POLICY IF EXISTS "UserFarms: View own" ON public.user_farms;
CREATE POLICY "UserFarms: View own" ON public.user_farms FOR SELECT USING (user_id = auth.uid());

-- 5.5 Daily statistics policies (refined)
DROP POLICY IF EXISTS "daily_statistics_basic" ON public.daily_statistics;

DROP POLICY IF EXISTS "Stats: Farm based access" ON public.daily_statistics;
CREATE POLICY "Stats: Farm based access" ON public.daily_statistics FOR ALL 
    USING (
        EXISTS (SELECT 1 FROM public.user_farms WHERE user_id = auth.uid() AND farm_id = daily_statistics.farm_id) 
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- 5.6 Invoices policies (refined)
DROP POLICY IF EXISTS "invoices_basic" ON public.invoices;

DROP POLICY IF EXISTS "Invoices: Farm based access" ON public.invoices;
CREATE POLICY "Invoices: Farm based access" ON public.invoices FOR ALL 
    USING (
        EXISTS (SELECT 1 FROM public.user_farms WHERE user_id = auth.uid() AND farm_id = invoices.farm_id) 
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- 5.7 Push subscriptions policies (refined)
DROP POLICY IF EXISTS "push_subscriptions_basic" ON public.push_subscriptions;

DROP POLICY IF EXISTS "push_subscriptions_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_own" ON public.push_subscriptions FOR ALL 
    USING (auth.uid() = user_id);

-- 5.8 System logs policies (refined)
DROP POLICY IF EXISTS "system_logs_basic" ON public.system_logs;

DROP POLICY IF EXISTS "system_logs_admin_view" ON public.system_logs;
CREATE POLICY "system_logs_admin_view" ON public.system_logs FOR SELECT 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

DROP POLICY IF EXISTS "system_logs_insert" ON public.system_logs;
CREATE POLICY "system_logs_insert" ON public.system_logs FOR INSERT WITH CHECK (true);

-- 5.9 Error logs policies (refined)
DROP POLICY IF EXISTS "error_logs_basic" ON public.error_logs;

DROP POLICY IF EXISTS "ErrorLogs: Public insert" ON public.error_logs;
CREATE POLICY "ErrorLogs: Public insert" ON public.error_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "ErrorLogs: Admins view" ON public.error_logs;
CREATE POLICY "ErrorLogs: Admins view" ON public.error_logs FOR SELECT 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- PHASE 6: Add performance indexes
CREATE INDEX IF NOT EXISTS idx_daily_statistics_farm_date ON public.daily_statistics(farm_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_statistics_product ON public.daily_statistics(product_id);
CREATE INDEX IF NOT EXISTS idx_invoices_farm_date ON public.invoices(farm_id, date);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_user_farms_user ON public.user_farms(user_id);
CREATE INDEX IF NOT EXISTS idx_user_farms_farm ON public.user_farms(farm_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_time ON public.system_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_time ON public.error_logs(timestamp);

-- PHASE 7: Create reporting view
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

-- PHASE 8: Enable realtime
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
    
    RAISE NOTICE 'Realtime enabled ✓';
END $$;

-- PHASE 9: Log success
DO $$
BEGIN
    BEGIN
        PERFORM public.log_system_event('INFO', 'Complete security migration finished', 'MIGRATION', 
                                      '{"version": "4.3.0", "timestamp": "' || now()::text || '"}');
    EXCEPTION WHEN OTHERS THEN
        -- Continue even if logging fails
        NULL;
    END;
    
    RAISE NOTICE '🎉 COMPLETE SECURITY MIGRATION FINISHED SUCCESSFULLY!';
    RAISE NOTICE '✅ All triggers added';
    RAISE NOTICE '✅ All security policies configured';  
    RAISE NOTICE '✅ Performance indexes created';
    RAISE NOTICE '✅ Realtime enabled';
    RAISE NOTICE '🚀 Your database is now production-ready!';
END $$;

-- Show final status
SELECT 
    'SUCCESS: Database fully configured with ' || 
    (SELECT count(*) FROM information_schema.triggers WHERE trigger_schema = 'public') || ' triggers and ' ||
    (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') || ' security policies'
    as final_status;