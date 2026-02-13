import { createClient } from "supabase";
import webpush from "web-push";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { id, message, targetFarmId, farmName, action, senderId } = await req.json();

        const subject = 'mailto:admin@morvarid.app';
        // Try both VITE_ prefix (legacy) and standard naming for robustness
        const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') || Deno.env.get('VITE_VAPID_PUBLIC_KEY');
        const privateKey = Deno.env.get('VAPID_PRIVATE_KEY') || Deno.env.get('VITE_VAPID_PRIVATE_KEY');

        if (!publicKey || !privateKey) {
            throw new Error('Missing VAPID keys in Edge Function environment (Standard or VITE_ prefix).');
        }

        webpush.setVapidDetails(subject, publicKey, privateKey);

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        let targetUserIds = [];

        if (targetFarmId) {
            const { data: assignedUsers, error: farmError } = await supabaseClient
                .from('user_farms')
                .select('user_id')
                .eq('farm_id', targetFarmId);

            if (farmError) throw farmError;

            const { data: admins, error: adminError } = await supabaseClient
                .from('profiles')
                .select('id')
                .eq('role', 'ADMIN');

            if (adminError) throw adminError;

            const assignedIds = assignedUsers?.map((u) => u.user_id) || [];
            const adminIds = admins?.map((a) => a.id) || [];
            targetUserIds = [...new Set([...assignedIds, ...adminIds])];
        }

        if (senderId) {
            targetUserIds = targetUserIds.filter(id => id !== senderId);
        }

        if (targetUserIds.length === 0) {
            return new Response(JSON.stringify({ message: 'No target users found.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        const { data: subscriptions, error: subError } = await supabaseClient
            .from('push_subscriptions')
            .select('subscription')
            .in('user_id', targetUserIds);

        if (subError) throw subError;

        if (!subscriptions || subscriptions.length === 0) {
            return new Response(JSON.stringify({ message: 'No subscriptions found.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        const notificationPayload = JSON.stringify({
            title: `⚠️ هشدار: ${farmName}`,
            body: message,
            icon: '/icons/icon-192x192.png',
            tag: id || 'farm-alert',
            data: { url: '/#/sales', alertId: id },
        });

        const sendPromises = subscriptions.map((sub) =>
            webpush.sendNotification(sub.subscription, notificationPayload)
                .catch((err) => console.error('Failed to send push:', err))
        );

        await Promise.all(sendPromises);

        return new Response(JSON.stringify({ success: true, count: subscriptions.length }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
