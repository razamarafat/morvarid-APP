import "jsr:@supabase/functions-js/edge-runtime.d.ts";
/// <reference lib="deno.ns" />
// @ts-ignore
import webpush from "https://esm.sh/web-push@3.6.7";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
    // 1. Handle CORS preflight requests immediately
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: corsHeaders,
            status: 200
        });
    }

    try {
        const { message, targetFarmId, farmName, action, senderId } = await req.json();

        // VAPID Keys from Environment Variables
        const subject = 'mailto:admin@morvarid.app';
        const publicKey = Deno.env.get('VITE_VAPID_PUBLIC_KEY')!;
        const privateKey = Deno.env.get('VITE_VAPID_PRIVATE_KEY')!;

        if (!publicKey || !privateKey) {
            throw new Error('Missing VAPID keys in Edge Function environment.');
        }

        webpush.setVapidDetails(subject, publicKey, privateKey);

        // Initialize Supabase Client
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Identify target users
        // If targetFarmId is provided, find users assigned to that farm OR admins
        let targetUserIds: string[] = [];

        if (targetFarmId) {
            // Get users assigned to this farm
            const { data: assignedUsers, error: farmError } = await supabaseClient
                .from('user_farms')
                .select('user_id')
                .eq('farm_id', targetFarmId);

            if (farmError) throw farmError;

            // Get admins
            const { data: admins, error: adminError } = await supabaseClient
                .from('profiles')
                .select('id')
                .eq('role', 'ADMIN');

            if (adminError) throw adminError;

            const assignedIds = assignedUsers?.map((u: any) => u.user_id) || [];
            const adminIds = admins?.map((a: any) => a.id) || [];

            // Combine and deduplicate
            targetUserIds = [...new Set([...assignedIds, ...adminIds])];
        }

        // Filter out the sender
        if (senderId) {
            targetUserIds = targetUserIds.filter(id => id !== senderId);
        }

        if (targetUserIds.length === 0) {
            return new Response(JSON.stringify({ message: 'No target users found.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        // 2. Get subscriptions for target users
        const { data: subscriptions, error: subError } = await supabaseClient
            .from('push_subscriptions')
            .select('subscription')
            .in('user_id', targetUserIds);

        if (subError) throw subError;

        if (!subscriptions || subscriptions.length === 0) {
            return new Response(JSON.stringify({ message: 'No subscriptions found for target users.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        // 3. Send notifications
        const notificationPayload = JSON.stringify({
            title: `⚠️ هشدار: ${farmName}`,
            body: message,
            icon: '/icons/icon-192x192.png',
            data: { url: `/#/sales` } // Deep link to sales or relevant page
        });

        const sendPromises = subscriptions.map((sub: any) =>
            webpush.sendNotification(sub.subscription, notificationPayload)
                .catch((err: any) => {
                    console.error('Failed to send push:', err);
                    // Optionally delete invalid subscriptions here
                    if (err.statusCode === 404 || err.statusCode === 410) {
                        // Subscription is gone
                    }
                })
        );

        await Promise.all(sendPromises);

        return new Response(JSON.stringify({ success: true, count: subscriptions.length }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
