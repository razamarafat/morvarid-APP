import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useToastStore } from './toastStore';
import { useAuthStore } from './authStore';
import { usePermissionStore } from './permissionStore';
import { UserRole, NotificationItem } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { pushNotificationService } from '../services/pushNotificationService';

// Access VAPID Key from Environment Variables
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Ensure VAPID key is properly configured
if (!VAPID_PUBLIC_KEY) {
    console.warn('[Alert] VAPID Public Key not configured. Push notifications will not work properly.');
}

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
    lastLog: string;
    permissionStatus: NotificationPermission;
    pushSubscription: PushSubscription | null;
    notifications: NotificationItem[];

    initListener: () => void;
    checkAndRequestPermission: () => Promise<boolean>;
    requestPermissionManual: () => Promise<void>;
    sendAlert: (farmId: string, farmName: string, message: string) => Promise<{ success: boolean; detail: string }>;
    triggerTestNotification: () => Promise<void>;

    triggerSystemNotification: (title: string, body: string, tag?: string) => Promise<boolean>;
    sendLocalNotification: (title: string, body: string, tag?: string) => Promise<boolean>;

    subscribeToPushNotifications: () => Promise<void>;
    saveSubscriptionToDb: (sub: PushSubscription) => Promise<void>;
    addLog: (msg: string) => void;
    addNotification: (title: string, message: string, type?: 'info' | 'warning' | 'error' | 'success') => void;
    markAllRead: () => void;
    clearNotifications: () => void;
}

const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

export const useAlertStore = create<AlertState>()(
    persist(
        (set, get) => ({
            isListening: false,
            channel: null,
            lastLog: '',
            permissionStatus: 'default',
            pushSubscription: null,
            notifications: [],

            addLog: (msg: string) => {
                const time = new Date().toLocaleTimeString('fa-IR');
                const log = `[${time}] ${msg}`;
                console.log(log);
                set({ lastLog: log });
            },

            addNotification: (title, message, type: 'info' | 'warning' | 'error' | 'success' = 'info') => {
                const newNotification: NotificationItem = {
                    id: uuidv4(),
                    title,
                    message,
                    timestamp: Date.now(),
                    read: false,
                    type
                };
                set(state => ({
                    notifications: [newNotification, ...state.notifications].slice(0, 100) // Keep last 100
                }));
            },

            markAllRead: () => {
                set(state => ({
                    notifications: state.notifications.map(n => ({ ...n, read: true }))
                }));
            },

            clearNotifications: () => {
                set({ notifications: [] });
            },

            checkAndRequestPermission: async () => {
                if (!("Notification" in window)) {
                    set({ permissionStatus: 'denied' });
                    usePermissionStore.getState().setPermissionStatus('notifications', 'denied');
                    return false;
                }
                const status = Notification.permission;
                set({ permissionStatus: status });

                // Sync with central store
                const centralStatus = status === 'default' ? 'prompt' : status;
                usePermissionStore.getState().setPermissionStatus('notifications', centralStatus);

                return status === 'granted';
            },

            requestPermissionManual: async () => {
                if (!("Notification" in window)) {
                    useToastStore.getState().addToast('مرورگر شما از اعلان پشتیبانی نمی‌کند.', 'error');
                    return;
                }

                try {
                    const permission = await Notification.requestPermission();
                    set({ permissionStatus: permission });

                    // Sync with central store
                    const centralStatus = permission === 'default' ? 'prompt' : permission;
                    usePermissionStore.getState().setPermissionStatus('notifications', centralStatus);

                    if (permission === 'granted') {
                        useToastStore.getState().addToast('اعلان‌ها فعال شدند.', 'success');
                        await get().triggerSystemNotification('سامانه مروارید', 'سیستم اعلان‌ها فعال شد. از این پس پیام‌ها را دریافت خواهید کرد.');
                        await get().subscribeToPushNotifications();
                    } else {
                        useToastStore.getState().addToast('مجوز اعلان رد شد.', 'warning');
                    }
                } catch (e: any) {
                    console.error('Permission Request Error:', e);
                    get().addLog(`Permission Error: ${e.message || e}`);
                }
            },

            saveSubscriptionToDb: async (sub: PushSubscription) => {
                const { user } = useAuthStore.getState();
                if (!user) return;

                try {
                    const { error } = await supabase.from('push_subscriptions').upsert({
                        user_id: user.id,
                        subscription: JSON.parse(JSON.stringify(sub)),
                        user_agent: navigator.userAgent
                    }, { onConflict: 'user_id, user_agent' });

                    if (error) {
                        console.error('[Alert] DB Save Error:', error);
                        if (error.code === '42P01') {
                            console.warn('Table push_subscriptions does not exist. Please run the SQL setup script.');
                            get().addLog('هشدار: جدول دیتابیس یافت نشد (42P01)');
                        } else {
                            get().addLog(`DB Error: ${error.message}`);
                        }
                    } else {
                        console.log('[Alert] Subscription saved to DB.');
                        get().addLog('دستگاه در سرور ثبت شد.');
                    }
                } catch (e: any) {
                    console.error('[Alert] DB Save Exception:', e);
                    get().addLog(`Exception: ${e.message || String(e)}`);
                }
            },

            subscribeToPushNotifications: async () => {
                if (!pushNotificationService.isSupported()) {
                    get().addLog('هشدار: نوتیفیکیشن در این مرورگر پشتیبانی نمی‌شود یا کلید VAPID تنظیم نشده است.');
                    return;
                }

                try {
                    const sub = await pushNotificationService.subscribe();
                    set({ pushSubscription: sub });
                    if (sub) {
                        get().addLog('دستگاه با موفقیت برای دریافت اعلان ثبت شد.');
                    }
                } catch (e: any) {
                    console.warn('[Alert] Push Subscription failed:', e);
                    get().addLog(`خطا در اشتراک Push: ${e.message || String(e)}`);
                }
            },

            triggerSystemNotification: async (title: string, body: string, tag = 'general') => {
                // Add to internal history
                get().addNotification(title, body, tag === 'critical-alert' ? 'error' : 'info');

                if (Notification.permission !== 'granted') return false;

                // 2. Try Service Worker Notification
                if ('serviceWorker' in navigator) {
                    try {
                        const reg = await navigator.serviceWorker.ready;
                        if (reg) {
                            await reg.showNotification(title, {
                                body: body,
                                icon: '/icons/icon-192x192.png',
                                badge: '/icons/icon-192x192.png',
                                vibrate: [200, 100, 200],
                                tag: tag,
                                renotify: true,
                                requireInteraction: true,
                                dir: 'rtl',
                                lang: 'fa-IR',
                                data: { url: window.location.href }
                            } as any);
                            return true;
                        }
                    } catch (swError) {
                        console.error('[Alert] SW Notification failed:', swError);
                    }
                }

                // 3. Fallback
                try {
                    new Notification(title, {
                        body,
                        icon: '/icons/icon-192x192.png',
                        requireInteraction: true,
                        dir: 'rtl'
                    });
                    return true;
                } catch (e) {
                    console.error('[Alert] Fallback Notification failed:', e);
                    return false;
                }
            },

            sendLocalNotification: async (title: string, body: string, tag?: string) => {
                return await get().triggerSystemNotification(title, body, tag);
            },

            triggerTestNotification: async () => {
                const hasPerm = await get().checkAndRequestPermission();
                if (hasPerm) {
                    await get().triggerSystemNotification("تست سامانه مروارید", "این یک پیام آزمایشی سیستمی است که باید در نوار وضعیت نمایش داده شود.");
                    get().addLog('تست ارسال شد.');
                } else {
                    useToastStore.getState().addToast('مجوز نوتیفیکیشن وجود ندارد.', 'warning');
                }
            },

            initListener: () => {
                if (get().isListening) return;

                get().checkAndRequestPermission();
                get().subscribeToPushNotifications();

                const channel = supabase.channel('app_alerts', {
                    config: { broadcast: { self: false } }
                });

                channel
                    .on(
                        'broadcast',
                        { event: 'farm_alert' },
                        async (event) => {
                            const payload = event.payload as AlertPayload;
                            const currentUser = useAuthStore.getState().user;

                            if (!currentUser) return;

                            if (payload.senderId === currentUser.id) {
                                return;
                            }

                            const assignedIds = currentUser.assignedFarms?.map(f => f.id) || [];
                            const isRelevant = currentUser.role === UserRole.ADMIN || assignedIds.includes(payload.targetFarmId);

                            if (isRelevant) {
                                useToastStore.getState().addToast(`پیام فوری: ${payload.message}`, 'error');

                                await get().triggerSystemNotification(
                                    `⚠️ هشدار: ${payload.farmName}`,
                                    payload.message,
                                    'critical-alert'
                                );
                            }
                        }
                    )
                    .subscribe((status) => {
                        if (status === 'SUBSCRIBED') {
                            set({ isListening: true });
                            console.log('[Alert] Listening for broadcasts...');
                        }
                    });

                set({ channel });
            },

            sendAlert: async (farmId, farmName, message) => {
                const { user } = useAuthStore.getState();
                if (!user) return { success: false, detail: 'Auth Required' };

                let channel = get().channel;
                if (!channel) { get().initListener(); channel = get().channel; }

                if (channel?.state !== 'joined') {
                    await new Promise(r => setTimeout(r, 1500));
                }

                const payload = {
                    targetFarmId: farmId,
                    farmName,
                    message,
                    senderId: user.id,
                    sentAt: Date.now(),
                    action: 'missing_stats'
                };

                const socketResult = await channel?.send({ type: 'broadcast', event: 'farm_alert', payload });

                try {
                    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
                    const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${supabaseKey}`,
                        },
                        body: JSON.stringify(payload),
                    });

                    if (!res.ok) {
                        const errData = await res.json().catch(() => ({}));
                        console.warn('[Alert] Push Function Error:', errData);
                        get().addLog('خطا در ارسال Push: ' + (errData.error || res.statusText));
                    }
                } catch (e) {
                    console.error('[Alert] Push Invocation Failed:', e);
                }

                return { success: socketResult === 'ok', detail: socketResult as string };
            }
        }),
        {
            name: 'morvarid-alert-store',
            partialize: (state) => ({ notifications: state.notifications }),
        }
    )
);
