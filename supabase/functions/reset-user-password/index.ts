// Supabase Edge Function: reset-user-password
// Admin-initiated password reset for any user in the system.
//
// Flow:
//   1. Caller MUST present a valid Supabase JWT AND pass is_admin().
//   2. Function validates (targetUserId, newPassword) BEFORE touching auth.
//   3. Calls `supabase.auth.admin.updateUserById(targetUserId, { password })`
//      using service-role so the admin can overwrite ANY user's password
//      (the caller's JWT alone cannot do this — admin auth APIs are
//      restricted to trusted server contexts only).
//   4. Calls SECURITY DEFINER RPC `admin_set_visible_password` to keep the
//      admin-visible vault in sync.
//
// On any failure at step 3 or 4 the function returns a clear Persian error so
// the React admin UI surfaces a red toast. We never silently proceed past a
// partial sync — the auth password can change while the visible_password
// doesn't, leaving the admin panel showing a STALE password for that user.

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
        // 1. Authentication: must be a logged-in admin caller.
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(
                JSON.stringify({ success: false, error: 'ابتدا وارد حساب کاربری خود شوید.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
            );
        }

        // 2. Parse + validate body.
        const { target_user_id, new_password } = await req.json();
        if (!target_user_id || typeof target_user_id !== 'string') {
            return new Response(
                JSON.stringify({ success: false, error: 'شناسه کاربر ارسال نشده است.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
        }
        if (!new_password || typeof new_password !== 'string') {
            return new Response(
                JSON.stringify({ success: false, error: 'رمز عبور جدید ارسال نشده است.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
        }
        // Mirror create-user / change-password validation. Same hardening for
        // a 3-attack-vector-defence-in-depth: client Zod -> userStore -> EF.
        // The minimum is currently 6 after the business owner finalised the
        // policy on 1405/03/30 (down from 8).
        const passwordMinLength = 6;
        const passwordMinLengthLabel = passwordMinLength.toLocaleString('fa-IR');
        if (new_password.length < passwordMinLength) {
            return new Response(
                JSON.stringify({ success: false, error: `رمز عبور باید حداقل ${passwordMinLengthLabel} کاراکتر باشد.` }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
        }
        if (!/[A-Za-z]/.test(new_password) || !/\d/.test(new_password)) {
            return new Response(
                JSON.stringify({ success: false, error: 'رمز عبور باید شامل حرف و عدد باشد.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
        }

        // 3. Service-role client used for the privileged `auth.admin.updateUserById`.
        // @ts-ignore
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
        // @ts-ignore
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

        const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
        });

        // 4. Verify caller is admin by reading their JWT then their profile role.
        const callerClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
            global: { headers: { Authorization: authHeader } },
            auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser(
            authHeader.replace('Bearer ', '')
        );
        if (callerErr || !caller) {
            return new Response(
                JSON.stringify({ success: false, error: 'توکن معتبر نیست. لطفاً دوباره وارد شوید.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
            );
        }

        const { data: callerProfile, error: profileErr } = await adminClient
            .from('profiles')
            .select('role')
            .eq('id', caller.id)
            .single();
        if (profileErr || !callerProfile || callerProfile.role !== 'ADMIN') {
            return new Response(
                JSON.stringify({ success: false, error: 'دسترسی غیرمجاز: فقط مدیر سیستم می‌تواند رمز عبور کاربران را تغییر دهد.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
            );
        }

        // 5. Reject self-reset via this flow: an admin should use the
        // self-change flow (which triggers activity re-stamps) so they don't
        // accidentally lock themselves out of their OWN visible_password.
        if (caller.id === target_user_id) {
            return new Response(
                JSON.stringify({ success: false, error: 'برای تغییر رمز عبور خودتان از منوی «تغییر رمز عبور» استفاده کنید.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
        }

        // 6. Confirm target user exists.
        const { data: targetProfile, error: targetErr } = await adminClient
            .from('profiles')
            .select('id, username')
            .eq('id', target_user_id)
            .maybeSingle();
        if (targetErr) {
            return new Response(
                JSON.stringify({ success: false, error: 'خطا در یافتن کاربر هدف.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
        }
        if (!targetProfile) {
            return new Response(
                JSON.stringify({ success: false, error: 'کاربر مورد نظر یافت نشد.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
            );
        }

        // 7. Step A — overwrite auth.users password via admin API.
        const { error: updateAuthErr } = await adminClient.auth.admin.updateUserById(
            target_user_id,
            { password: new_password }
        );
        if (updateAuthErr) {
            console.error('[reset-user-password] admin.updateUserById failed:', updateAuthErr);
            return new Response(
                JSON.stringify({ success: false, error: 'تغییر رمز عبور ناموفق بود. لطفاً دوباره تلاش کنید.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
        }

        // 8. Step B — sync profiles.visible_password via SEC-DEF RPC. The
        // adminClient is on the service role which has BOTH the column-level
        // SELECT (bypass REVOKE) AND it can call the RPC freely because
        // service_role has GRANT EXECUTE on all functions by default; the
        // RPC's `is_admin()` check inside the body is a belt-and-suspenders.
        const { error: rpcErr } = await adminClient.rpc('admin_set_visible_password', {
            p_user_id: target_user_id,
            p_password: new_password,
        });
        if (rpcErr) {
            console.error('[reset-user-password] CRITICAL desync for target', target_user_id, ':', rpcErr);
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'رمز عبور تغییر کرد ولی همگام‌سازی با پنل مدیر ناموفق بود. لطفاً دوباره تلاش کنید.',
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
        }

        // 9. System log for audit (passes silently if logging fails so we
        // don't block the user-visible success).
        try {
            await adminClient.rpc('log_system_event', {
                p_level: 'WARN',
                p_message: 'Admin reset user password',
                p_module: 'USER_MANAGEMENT',
                p_metadata: { target_user_id, target_username: targetProfile.username },
            });
        } catch (_e) {
            // ignore — audit is best-effort
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: `رمز عبور کاربر ${targetProfile.username} با موفقیت تغییر کرد.`,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
    } catch (error: any) {
        console.error('[reset-user-password] edge function error:', error);
        return new Response(
            JSON.stringify({ success: false, error: error.message || 'خطای داخلی سرور.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }
});
