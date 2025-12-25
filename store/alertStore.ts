
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useToastStore } from './toastStore';
import { useAuthStore } from './authStore';
import { UserRole } from '../types';

// IMPORTANT: Replace this with your generated VAPID PUBLIC KEY from "npx web-push generate-vapid-keys"
// Must match the one set in Supabase Edge Function secrets.
const VAPID_PUBLIC_KEY = 'BJ_Xy...PLACEHOLDER_KEY...Replace_With_Your_Own_VAPID_Public_Key';

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
    
    initListener: () => void;
    checkAndRequestPermission: () => Promise<boolean>;
    requestPermissionManual: () => Promise<void>;
    sendAlert: (farmId: string, farmName: string, message: string) => Promise<{ success: boolean; detail: string }>;
    triggerTestNotification: () => Promise<void>;
    
    triggerSystemNotification: (title: string, body: string, tag?: string) => Promise<boolean>;
    // Added alias method to fix build error in useAutoUpdate
    sendLocalNotification: (title: string, body: string, tag?: string) => Promise<boolean>;
    
    subscribeToPushNotifications: () => Promise<void>;
    saveSubscriptionToDb: (sub: PushSubscription) => Promise<void>;
    addLog: (msg: string) => void;
}

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const useAlertStore = create<AlertState>((set, get) => ({
    isListening: false,
    channel: null,
    lastLog: '',
    permissionStatus: 'default',
    pushSubscription: null,

    addLog: (msg: string) => {
        const time = new Date().toLocaleTimeString('fa-IR');
        const log = `[${time}] ${msg}`;
        console.log(log);
        set({ lastLog: log });
    },

    checkAndRequestPermission: async () => {
        if (!("Notification" in window)) {
            set({ permissionStatus: 'denied' });
            return false;
        }
        set({ permissionStatus: Notification.permission });
        return Notification.permission === 'granted';
    },

    requestPermissionManual: async () => {
        if (!("Notification" in window)) {
            useToastStore.getState().addToast('مرورگر شما از اعلان پشتیبانی نمی‌کند.', 'error');
            return;
        }

        try {
            const permission = await Notification.requestPermission();
            set({ permissionStatus: permission });
            
            if (permission === 'granted') {
                useToastStore.getState().addToast('اعلان‌ها فعال شدند.', 'success');
                await get().triggerSystemNotification('سامانه مروارید', 'سیستم اعلان‌ها فعال شد. از این پس پیام‌ها را دریافت خواهید کرد.');
                await get().subscribeToPushNotifications(); 
            } else {
                useToastStore.getState().addToast('مجوز اعلان رد شد.', 'warning');
            }
        } catch (e) {
            console.error('Permission Request Error:', e);
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
            }, { onConflict: 'subscription' });

            if (error) {
                console.error('[Alert] DB Save Error:', error);
            } else {
                console.log('[Alert] Subscription saved to DB.');
                get().addLog('دستگاه در سرور ثبت شد.');
            }
        } catch (e) {
            console.error('[Alert] DB Save Exception:', e);
        }
    },

    subscribeToPushNotifications: async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        
        try {
            const registration = await navigator.serviceWorker.ready;
            
            let sub = await registration.pushManager.getSubscription();
            
            if (!sub) {
                const options: any = {
                    userVisibleOnly: true,
                };
                
                if (!VAPID_PUBLIC_KEY.includes('PLACEHOLDER')) {
                    options.applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
                }

                sub = await registration.pushManager.subscribe(options);
            }
            
            set({ pushSubscription: sub });
            if (sub) {
                await get().saveSubscriptionToDb(sub);
            }
            
        } catch (e) {
            console.warn('[Alert] Push Subscription failed:', e);
            get().addLog(`خطا در اشتراک Push: ${e}`);
        }
    },

    triggerSystemNotification: async (title: string, body: string, tag = 'general') => {
        if (Notification.permission !== 'granted') return false;

        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                const ctx = new AudioContextClass();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(500, ctx.currentTime);
                osc.frequency.linearRampToValueAtTime(1000, ctx.currentTime + 0.1);
                osc.frequency.linearRampToValueAtTime(500, ctx.currentTime + 0.2);
                osc.frequency.linearRampToValueAtTime(1000, ctx.currentTime + 0.3);
                
                gain.gain.setValueAtTime(0.5, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
                
                osc.start();
                osc.stop(ctx.currentTime + 0.8);
            }
        } catch (e) { console.error('Audio play error', e); }

        if ('serviceWorker' in navigator) {
            try {
                const reg = await navigator.serviceWorker.ready;
                if (reg) {
                    await reg.showNotification(title, {
                        body: body,
                        icon: '/icons/icon-192x192.png',
                        badge: '/icons/icon-192x192.png',
                        vibrate: [200, 100, 200, 100, 400],
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

        try {
            new Notification(title, { 
                body, 
                icon: '/icons/icon-192x192.png',
                requireInteraction: true 
            });
            return true;
        } catch (e) {
            console.error('[Alert] Fallback Notification failed:', e);
            return false;
        }
    },

    // Alias for compatibility
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
            config: { broadcast: { self: true } }
        });

        channel
            .on(
                'broadcast',
                { event: 'farm_alert' },
                async (event) => {
                    const payload = event.payload as AlertPayload;
                    const currentUser = useAuthStore.getState().user;
                    
                    if (!currentUser) return;
                    if (payload.senderId === currentUser.id) return; 

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
            const { error } = await supabase.functions.invoke('send-push', {
                body: payload
            });
            
            if (error) {
                console.warn('[Alert] Push Function Error:', error);
            } else {
                console.log('[Alert] Push Function invoked successfully.');
            }
        } catch (e) {
            console.error('[Alert] Push Invocation Failed:', e);
        }

        return { success: socketResult === 'ok', detail: socketResult as string };
    }
}));
