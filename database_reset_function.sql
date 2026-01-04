-- ==========================================
-- SYSTEM RESET FUNCTION - SUPER ADMIN ONLY
-- Version: 1.0.0 (Critical System Function)
-- Description: Complete system reset for testing purposes
-- ==========================================

-- Create super admin reset function
CREATE OR REPLACE FUNCTION public.perform_system_reset(
    admin_username TEXT,
    admin_password TEXT,
    confirmation_text TEXT
) RETURNS JSON AS $$
DECLARE
    reset_result JSON;
    record_counts JSON;
    super_admin_id UUID;
BEGIN
    -- SECURITY CHECK 1: Verify super admin credentials (hardcoded)
    IF admin_username != 'rezamarefat' OR admin_password != '1385raza' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'unauthorized',
            'message', 'دسترسی غیر مجاز - اعتبارسنجی ناموفق'
        );
    END IF;
    
    -- SECURITY CHECK 2: Verify confirmation text
    IF confirmation_text != 'RESET_COMPLETE_SYSTEM' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'invalid_confirmation',
            'message', 'متن تایید نادرست است'
        );
    END IF;
    
    -- Log the reset attempt
    INSERT INTO public.system_logs (level, message, module, metadata)
    VALUES ('CRITICAL', 'System reset initiated', 'SYSTEM_RESET', 
            json_build_object('admin_username', admin_username, 'timestamp', now()));
    
    -- Count existing records before deletion
    SELECT json_build_object(
        'users_count', (SELECT count(*) FROM auth.users),
        'profiles_count', (SELECT count(*) FROM public.profiles),
        'farms_count', (SELECT count(*) FROM public.farms),
        'user_farms_count', (SELECT count(*) FROM public.user_farms),
        'daily_statistics_count', (SELECT count(*) FROM public.daily_statistics),
        'invoices_count', (SELECT count(*) FROM public.invoices),
        'push_subscriptions_count', (SELECT count(*) FROM public.push_subscriptions),
        'system_logs_count', (SELECT count(*) FROM public.system_logs),
        'error_logs_count', (SELECT count(*) FROM public.error_logs)
    ) INTO record_counts;
    
    BEGIN
        -- PHASE 1: Delete all user data (in correct order to respect FK constraints)
        DELETE FROM public.push_subscriptions;
        DELETE FROM public.daily_statistics;
        DELETE FROM public.invoices;
        DELETE FROM public.user_farms;
        DELETE FROM public.profiles;
        DELETE FROM public.farms;
        DELETE FROM public.error_logs;
        
        -- PHASE 2: Delete authentication users (this will cascade)
        -- Note: We'll recreate the super admin immediately after
        DELETE FROM auth.users;
        
        -- PHASE 3: Reset sequences and clean up
        -- Reset any sequences if needed
        PERFORM setval(pg_get_serial_sequence('public.farms', 'id'), 1, false);
        
        -- PHASE 4: Create super admin user
        -- Insert into auth.users first
        INSERT INTO auth.users (
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            created_at,
            updated_at,
            confirmation_token,
            recovery_token,
            email_change_token_new,
            email_change,
            raw_app_meta_data,
            raw_user_meta_data,
            is_super_admin,
            last_sign_in_at
        ) VALUES (
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            'admin@morvarid.system',
            crypt('1385raza', gen_salt('bf')),
            now(),
            now(),
            now(),
            '',
            '',
            '',
            '',
            '{"provider": "email", "providers": ["email"]}',
            json_build_object(
                'username', 'rezamarefat',
                'full_name', 'Super Administrator',
                'role', 'ADMIN'
            ),
            false,
            now()
        ) RETURNING id INTO super_admin_id;
        
        -- Insert corresponding profile
        INSERT INTO public.profiles (
            id,
            username,
            full_name,
            role,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            super_admin_id,
            'rezamarefat',
            'Super Administrator',
            'ADMIN',
            true,
            now(),
            now()
        );
        
        -- Log successful reset
        INSERT INTO public.system_logs (level, message, module, user_id, metadata)
        VALUES ('CRITICAL', 'System reset completed successfully', 'SYSTEM_RESET', 
                super_admin_id,
                json_build_object(
                    'previous_counts', record_counts,
                    'super_admin_id', super_admin_id,
                    'timestamp', now()
                ));
        
        -- Return success response
        SELECT json_build_object(
            'success', true,
            'message', 'سیستم با موفقیت به حالت اولیه بازنشانی شد',
            'super_admin_id', super_admin_id,
            'previous_counts', record_counts,
            'timestamp', now()
        ) INTO reset_result;
        
        RETURN reset_result;
        
    EXCEPTION WHEN OTHERS THEN
        -- Log the error
        INSERT INTO public.system_logs (level, message, module, metadata)
        VALUES ('ERROR', 'System reset failed', 'SYSTEM_RESET', 
                json_build_object('error', SQLERRM, 'timestamp', now()));
        
        -- Return error response
        RETURN json_build_object(
            'success', false,
            'error', 'reset_failed',
            'message', 'خطا در بازنشانی سیستم: ' || SQLERRM
        );
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to verify super admin access
CREATE OR REPLACE FUNCTION public.verify_super_admin_access(
    admin_username TEXT,
    admin_password TEXT
) RETURNS JSON AS $$
BEGIN
    IF admin_username = 'rezamarefat' AND admin_password = '1385raza' THEN
        RETURN json_build_object(
            'success', true,
            'message', 'دسترسی مدیر اصلی تایید شد',
            'timestamp', now()
        );
    ELSE
        RETURN json_build_object(
            'success', false,
            'error', 'unauthorized',
            'message', 'دسترسی غیر مجاز'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (security is handled within functions)
GRANT EXECUTE ON FUNCTION public.perform_system_reset(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_super_admin_access(TEXT, TEXT) TO authenticated;