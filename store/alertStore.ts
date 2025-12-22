
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useToastStore } from './toastStore';
import { useAuthStore } from './authStore';
import { UserRole } from '../types';

interface AlertPayload {
    targetFarmId: string;
    farmName: string;
    message: string;
    action: string; 
    senderId?: string;
    sentAt: number;
}

interface AlertState {
    isListening: boolean;
    channel: RealtimeChannel | null;
    initListener: () => void;
    checkAndRequestPermission: () => Promise<void>;
    sendAlert: (farmId: string, farmName: string, message: string) => Promise<{ success: boolean; detail: string; bytes: number }>;
    triggerTestNotification: () => Promise<void>;
}

// Helper to show system notification via Service Worker
const showSystemNotification = async (title: string, body: string) => {
    console.log('[Notif System] Attempting to show system notification:', { title, body });
    
    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
        console.warn('[Notif System] Browser does not support Notifications or Service Workers.');
        return;
    }

    if (Notification.permission === "granted") {
        try {
            // Check if SW is ready
            const registration = await navigator.serviceWorker.ready;
            
            if (!registration) {
                 console.error('[Notif System] Service Worker registration not found.');
                 // Fallback to basic notification (might not work on Android Chrome without SW)
                 new Notification(title, { body, icon: "/vite.svg" });
                 return;
            }

            await registration.showNotification(title, {
                body: body,
                icon: "/vite.svg",
                badge: "/vite.svg", // Small icon for Android status bar
                tag: "morvarid-alert", // Overwrites older notifications with same tag
                renotify: true, // Vibrate/Sound again even if tag exists
                vibrate: [200, 100, 200], // Basic vibration
                dir: "rtl",
                lang: "fa-IR",
                requireInteraction: false, // Disappear automatically like standard notifications
                data: {
                    url: window.location.href // Used in sw.js to focus window
                }
            } as any);
            console.log('[Notif System] Notification sent to Service Worker successfully.');

        } catch (e) {
            console.error("[Notif System] Failed to show notification:", e);
        }
    } else {
        console.log('[Notif System] Cannot show notification. Permission status:', Notification.permission);
    }
};

export const useAlertStore = create<AlertState>((set, get) => ({
    isListening: false,
    channel: null,

    // Called on App Mount
    checkAndRequestPermission: async () => {
        if (!("Notification" in window)) {
            console.log('[Notif System] Notifications not supported in this browser.');
            return;
        }

        const currentPermission = Notification.permission;
        console.log(`[Notif System] Startup Permission Check: ${currentPermission}`);

        if (currentPermission === 'default') {
            console.log('[Notif System] Permission is default. Requesting user...');
            try {
                const result = await Notification.requestPermission();
                console.log(`[Notif System] User Response: ${result}`);
                if (result === 'granted') {
                    useToastStore.getState().addToast('دریافت اعلان‌ها فعال شد.', 'success');
                }
            } catch (error) {
                console.error('[Notif System] Request Permission Error:', error);
            }
        } else if (currentPermission === 'denied') {
             console.log('[Notif System] Permission previously denied. Logs recorded.');
        } else {
             console.log('[Notif System] Permission already granted.');
        }
    },

    triggerTestNotification: async () => {
        console.log('[Notif System] Triggering TEST notification...');
        await get().checkAndRequestPermission();
        
        if (Notification.permission === 'granted') {
             // Force show system notification even if app is visible (for testing)
             await showSystemNotification("تست سامانه مروارید", "این یک اعلان آزمایشی جهت بررسی صحت عملکرد است.");
        } else {
             useToastStore.getState().addToast('مجوز نوتیفیکیشن داده نشده است.', 'error');
        }
    },

    initListener: () => {
        if (get().isListening) return;

        // Ensure permissions are checked when listener starts
        get().checkAndRequestPermission();

        const channel = supabase.channel('app_alerts', {
            config: { broadcast: { self: true } }
        });

        channel
            .on(
                'broadcast',
                { event: 'farm_alert' },
                async (event) => {
                    const payload = event.payload as AlertPayload;
                    const currentUser = useAuthStore.getState().user;
                    
                    console.log('[Notif System] Signal Received:', payload);

                    // Don't alert the sender
                    if (!currentUser || payload.senderId === currentUser.id) return;

                    const assignedIds = currentUser.assignedFarms?.map(f => f.id) || [];
                    const isRelevant = currentUser.role === UserRole.ADMIN || assignedIds.includes(payload.targetFarmId);

                    if (isRelevant) {
                        // Logic:
                        // If Tab is Visible -> Toast
                        // If Tab is Hidden/Background -> System Notification
                        
                        if (document.visibilityState === 'visible') {
                            console.log('[Notif System] App is visible. Showing Toast.');
                            useToastStore.getState().addToast(`هشدار فوری: ${payload.message}`, 'error');
                        } else {
                            console.log('[Notif System] App is hidden. Showing System Notification.');
                            await showSystemNotification("سامانه مروارید: وضعیت بحرانی", payload.message);
                        }
                    } else {
                        console.log('[Notif System] Signal ignored (Not relevant to user).');
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[Notif System] Subscribed to alert channel.');
                    set({ isListening: true });
                }
            });
            
        set({ channel });
    },

    sendAlert: async (farmId, farmName, message) => {
        const { user } = useAuthStore.getState();
        if (!user) return { success: false, detail: 'Auth Required', bytes: 0 };

        let channel = get().channel;
        if (!channel) { get().initListener(); channel = get().channel; }
        if (!channel) return { success: false, detail: 'Channel Error', bytes: 0 };

        const payload = { targetFarmId: farmId, farmName, message, senderId: user.id, sentAt: Date.now(), action: 'missing_stats' };
        console.log('[Notif System] Sending Alert:', payload);
        
        const result = await channel.send({ type: 'broadcast', event: 'farm_alert', payload });
        
        return { success: result === 'ok', detail: result as string, bytes: JSON.stringify(payload).length };
    }
}));
