
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
    lastLog: string;
    permissionStatus: NotificationPermission;
    initListener: () => void;
    checkAndRequestPermission: () => Promise<boolean>;
    requestPermissionManual: () => Promise<void>;
    sendAlert: (farmId: string, farmName: string, message: string) => Promise<{ success: boolean; detail: string; bytes: number }>;
    triggerTestNotification: () => Promise<void>;
    sendLocalNotification: (title: string, body: string, tag?: string) => Promise<boolean>;
    addLog: (msg: string) => void;
}

const playNotificationSound = () => {
    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;

        const audioContext = new AudioContextClass();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
        oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.1); // Drop
        
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.6);

        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
    } catch (e) {
        console.error('[Audio] Play failed', e);
    }
};

export const useAlertStore = create<AlertState>((set, get) => ({
    isListening: false,
    channel: null,
    lastLog: '',
    permissionStatus: 'default',

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

        if (Notification.permission === 'granted') return true;
        return false;
    },

    requestPermissionManual: async () => {
        if (!("Notification" in window)) {
            useToastStore.getState().addToast('مرورگر شما از اعلان پشتیبانی نمی‌کند.', 'error');
            return;
        }

        const permission = await Notification.requestPermission();
        set({ permissionStatus: permission });
        
        if (permission === 'granted') {
            useToastStore.getState().addToast('اعلان‌ها فعال شدند.', 'success');
            get().sendLocalNotification('مروارید', 'اعلان‌ها با موفقیت فعال شدند.');
        } else {
            useToastStore.getState().addToast('مجوز اعلان رد شد. لطفاً در تنظیمات مرورگر فعال کنید.', 'warning');
        }
    },

    sendLocalNotification: async (title: string, body: string, tag = 'general') => {
        // 1. Permission Check
        if (Notification.permission !== 'granted') return false;

        // 2. Play Sound
        playNotificationSound();

        // 3. Badging API (New Improvement)
        if ('setAppBadge' in navigator) {
            // @ts-ignore
            navigator.setAppBadge(1).catch(() => {});
        }

        // 4. Service Worker Strategy (Priority)
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.ready;
                if (registration) {
                    await registration.showNotification(title, {
                        body: body,
                        icon: '/icons/icon-192x192.png',
                        badge: '/icons/icon-192x192.png',
                        vibrate: [200, 100, 200],
                        tag: tag,
                        renotify: true,
                        requireInteraction: true,
                        data: { url: window.location.href }
                    } as any);
                    return true;
                }
            } catch (e) {
                console.error('[Alert] SW Notification failed, falling back to classic', e);
            }
        }

        // 5. Fallback Strategy
        try {
            new Notification(title, {
                body: body,
                icon: '/icons/icon-192x192.png',
                tag: tag
            });
            return true;
        } catch (e) {
            console.error('[Alert] Classic Notification failed', e);
            return false;
        }
    },

    triggerTestNotification: async () => {
        const hasPermission = await get().checkAndRequestPermission();
        if (hasPermission) {
             const result = await get().sendLocalNotification("تست سامانه مروارید", "سیستم اعلان‌ها فعال است و به درستی کار می‌کند.");
             if (result) get().addLog('اعلان تست ارسال شد.');
             else get().addLog('خطا در ارسال اعلان.');
        } else {
             useToastStore.getState().addToast('مجوز نوتیفیکیشن وجود ندارد.', 'warning');
        }
    },

    initListener: () => {
        if (get().isListening) return;

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
                    
                    if (!currentUser) return;
                    if (payload.senderId === currentUser.id) return;

                    const assignedIds = currentUser.assignedFarms?.map(f => f.id) || [];
                    const isRelevant = currentUser.role === UserRole.ADMIN || assignedIds.includes(payload.targetFarmId);

                    if (isRelevant) {
                        useToastStore.getState().addToast(`پیام مدیریت: ${payload.message}`, 'error');
                        await get().sendLocalNotification("⚠️ هشدار مدیریتی", payload.message, 'critical-alert');
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
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
        
        if (channel?.state !== 'joined') {
             await new Promise(r => setTimeout(r, 1000));
        }

        const payload = { targetFarmId: farmId, farmName, message, senderId: user.id, sentAt: Date.now(), action: 'missing_stats' };
        
        const result = await channel?.send({ type: 'broadcast', event: 'farm_alert', payload });
        
        return { success: result === 'ok', detail: result as string, bytes: JSON.stringify(payload).length };
    }
}));
