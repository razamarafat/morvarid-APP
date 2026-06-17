// Supabase Edge Function: create-user
// Creates a new auth user + profile using the service_role key.
// Called from the admin panel when an admin creates a new user.

// @ts-ignore
import { createClient } from "supabase";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// @ts-ignore: Deno is available in Supabase environment
Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { email, password, username, full_name, role, phone_number } = await req.json();

        // Validate required fields
        if (!email || !password || !username) {
            return new Response(
                JSON.stringify({ success: false, error: 'Missing required fields: email, password, username' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
        }

        // 20260620: Validate password length locally to match Supabase goTrue's
        // default min_password_length BEFORE round-tripping to the auth service.
        // Without this, a short password ("i123456", 7 chars) created the auth
        // user but the password wouldn't match Supabase's bcrypt path on login,
        // so the user couldn't sign in. Surface a clear Persian error instead.
        const passwordMinLength = 8;
        if (password.length < passwordMinLength) {
            return new Response(
                JSON.stringify({ success: false, error: `رمز عبور باید حداقل ${passwordMinLength} کاراکتر باشد` }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
        }

        // Validate role
        const validRoles = ['ADMIN', 'REGISTRATION', 'SALES'];
        if (role && !validRoles.includes(role)) {
            return new Response(
                JSON.stringify({ success: false, error: `Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}` }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
        }

        // Create Supabase client with service_role (admin privileges)
        const supabaseClient = createClient(
            // @ts-ignore
            Deno.env.get('SUPABASE_URL') ?? '',
            // @ts-ignore
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Verify the caller is an admin by checking their auth token
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            return new Response(
                JSON.stringify({ success: false, error: 'Authentication required' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
            );
        }

        // Get the caller's user from the token
        const { data: { user: caller }, error: authError } = await supabaseClient.auth.getUser(
            authHeader.replace('Bearer ', '')
        );

        if (authError || !caller) {
            return new Response(
                JSON.stringify({ success: false, error: 'Invalid authentication token' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
            );
        }

        // Check caller is an admin
        const { data: callerProfile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', caller.id)
            .single();

        if (profileError || !callerProfile || callerProfile.role !== 'ADMIN') {
            return new Response(
                JSON.stringify({ success: false, error: 'Access Denied: Only admins can create users' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
            );
        }

        // Check if username already exists
        const { data: existingProfile } = await supabaseClient
            .from('profiles')
            .select('id')
            .eq('username', username)
            .maybeSingle();

        if (existingProfile) {
            return new Response(
                JSON.stringify({ success: false, error: 'این نام کاربری قبلاً در سیستم ثبت شده است.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
            );
        }

        // Create the auth user with admin API
        const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Skip email verification
            user_metadata: {
                username,
                full_name: full_name || username,
                role: role || 'REGISTRATION',
            },
        });

        if (createError) {
            console.error('Failed to create auth user:', createError);
            return new Response(
                JSON.stringify({ success: false, error: createError.message }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
        }

        if (!newUser?.user) {
            return new Response(
                JSON.stringify({ success: false, error: 'User creation returned no user data' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
        }

        // The on_auth_user_created trigger in master_schema.sql will auto-create the profile.
        // But let's ensure the profile has the correct role and phone_number.
        const { error: updateProfileError } = await supabaseClient
            .from('profiles')
            .update({
                role: role || 'REGISTRATION',
                phone_number: phone_number || null,
                is_active: true,
            })
            .eq('id', newUser.user.id);

        if (updateProfileError) {
            console.error('Failed to update profile:', updateProfileError);
            // User was created but profile update failed - still return success
        }

        return new Response(
            JSON.stringify({
                success: true,
                user_id: newUser.user.id,
                message: 'User created successfully'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );

    } catch (error: any) {
        console.error('Edge function error:', error);
        return new Response(
            JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }
});
