// Supabase Edge Function: change-password
// Self-service password change for an authenticated user.
//
// Flow:
//   1. Caller MUST present a valid Supabase JWT in the Authorization header.
//   2. Function validates the new password (length + content) BEFORE touching
//      the auth system so a short / weak password is caught here with a clear
//      Persian error rather than as Supabase's default goTrue rejection.
//   3. Calls `supabase.auth.updateUser({ password: newPassword })` using the
//      caller's own session JWT so the password change binds to the caller.
//   4. Calls the SECURITY DEFINER RPC `self_set_visible_password` (also
//      invokes `auth.uid()` from the caller's JWT) so profiles.visible_password
//      stays in sync with the real auth.users password for the Admin Panel.
//
// On any failure at step 3 or 4 the function returns 4xx/5xx so the React
// client surfaces a red toast. We never return success on a partial sync.
// Failure handling: if step 3 succeeds but step 4 fails, we return 500 with a
// warning message (the user can still log in with the new password, but the
// Admin Vault will show the OLD password until the operation is retried — the
// admin can fix this via the Admin reset flow).

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
        // 1. Caller authentication — the change-password scope IS the caller's
        // own row. Reject any request without an Authorization header.
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(
                JSON.stringify({ success: false, error: 'ابتدا وارد حساب کاربری خود شوید.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
            );
        }

        // 2. Parse + validate body
        const { new_password } = await req.json();
        if (!new_password || typeof new_password !== 'string') {
            return new Response(
                JSON.stringify({ success: false, error: 'رمز عبور جدید ارسال نشده است.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
        }
        // Mirror UserFormModal Zod regex: minimum chars + at least one letter +
        // digit. Same hardening as create-user so a curl bypass can't land
        // an unusable credential in auth.users. The minimum is currently 6
        // after the business owner finalised the policy on 1405/03/30 (down
        // from 8).
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

        // 3. Build an authenticated client scoped to the CALLER's JWT (so
        // supabase.auth.updateUser writes the caller's row, not anyone else's).
        // @ts-ignore
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
        // @ts-ignore
        const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

        const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: authHeader } },
            auth: { persistSession: false, autoRefreshToken: false },
        });

        // 4. Step A — update auth.users
        const { error: updateAuthErr } = await callerClient.auth.updateUser({
            password: new_password,
        });
        if (updateAuthErr) {
            console.error('[change-password] auth.updateUser failed:', updateAuthErr);
            return new Response(
                JSON.stringify({ success: false, error: 'تغییر رمز عبور ناموفق بود. لطفاً دوباره تلاش کنید.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
        }

        // 5. Step B — sync profiles.visible_password via the SEC-DEF RPC.
        // The RPC reads auth.uid() from the same JWT, so it targets the
        // caller's row.
        const { error: rpcErr } = await callerClient.rpc('self_set_visible_password', {
            p_password: new_password,
        });
        if (rpcErr) {
            // DESYNC WARNING — the auth password has changed but visible_password
            // still holds the old value. Log a critical event so the Admin can
            // reconcile via the admin reset flow. Returning 500 prevents the
            // client from showing "رمز عبور با موفقیت تغییر کرد" toast on a
            // partial sync — the user will retry and the RPC will sync the
            // second time around. The admin panel will display the consistent
            // state after the retry succeeds.
            console.error('[change-password] CRITICAL desync: auth.updateUser succeeded but visible_password RPC failed:', rpcErr);
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'رمز عبور با موفقیت تغییر کرد ولی نمایش آن در پنل مدیر ناموفق بود. لطفاً دوباره تلاش کنید.',
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
        }

        return new Response(
            JSON.stringify({ success: true, message: 'رمز عبور با موفقیت تغییر کرد.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
    } catch (error: any) {
        console.error('[change-password] edge function error:', error);
        return new Response(
            JSON.stringify({ success: false, error: error.message || 'خطای داخلی سرور.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }
});
