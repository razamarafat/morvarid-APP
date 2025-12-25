
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
    initListener: () => void;
    checkAndRequestPermission: () => Promise<boolean>;
    sendAlert: (farmId: string, farmName: string, message: string) => Promise<{ success: boolean; detail: string; bytes: number }>;
    triggerTestNotification: () => Promise<void>;
    addLog: (msg: string) => void;
}

const playNotificationSound = () => {
    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;

        const audioContext = new AudioContextClass();
        
        // Create oscillator for beep
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
        oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.1); // Drop to A4
        
        // Volume Envelope
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.6);

        // Resume context if suspended (browser policy)
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
    } catch (e) {
        console.error('[Audio] Play failed', e);
    }
};

const showSystemNotification = async (title: string, body: string) => {
    console.log('[Notif System] Triggering System Notification:', { title, body });

    // 1. Permission Check
    if (Notification.permission !== 'granted') {
        console.warn('[Notif System] Permission not granted.');
        return false;
    }

    // 2. Service Worker Strategy (Best for Mobile/PWA)
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.ready;
            if (registration) {
                await registration.showNotification(title, {
                    body: body,
                    icon: '/icons/icon-192x192.png',
                    badge: '/icons/icon-192x192.png',
                    vibrate: [200, 100, 200, 100, 200], // Vibration pattern
                    tag: 'morvarid-alert-' + Date.now(),
                    renotify: true,
                    requireInteraction: true,
                    silent: false, // Ensure sound is enabled
                    data: { url: window.location.href }
                } as any);
                return true;
            }
        } catch (e) {
            console.error('[Notif System] SW Notification Failed:', e);
        }
    }

    // 3. Fallback: Classic Web Notification API (Desktop)
    try {
        new Notification(title, {
            body: body,
            icon: '/icons/icon-192x192.png',
            requireInteraction: true,
            silent: false
        });
        return true;
    } catch (e) {
        console.error('[Notif System] Classic Notification Failed:', e);
        return false;
    }
};

export const useAlertStore = create<AlertState>((set, get) => ({
    isListening: false,
    channel: null,
    lastLog: '',

    addLog: (msg: string) => {
        const time = new Date().toLocaleTimeString('fa-IR');
        const log = `[${time}] ${msg}`;
        console.log(log);
        set({ lastLog: log });
    },

    checkAndRequestPermission: async () => {
        if (!("Notification" in window)) return false;
        
        if (Notification.permission === 'granted') return true;
        
        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                get().addLog('مجوز نوتیفیکیشن صادر شد.');
                return true;
            }
        }
        return false;
    },

    triggerTestNotification: async () => {
        const hasPermission = await get().checkAndRequestPermission();
        playNotificationSound(); // Force play sound immediately for test
        
        if (hasPermission) {
             const result = await showSystemNotification("تست سامانه مروارید", "سیستم اعلان‌ها فعال است و به درستی کار می‌کند.");
             if (result) get().addLog('اعلان تست با موفقیت ارسال شد.');
             else get().addLog('ارسال اعلان با خطا مواجه شد.');
        } else {
             useToastStore.getState().addToast('لطفا مجوز نوتیفیکیشن را در تنظیمات مرورگر فعال کنید.', 'warning');
        }
    },

    initListener: () => {
        if (get().isListening) return;

        // Auto request permission on init
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
                    
                    get().addLog(`سیگنال دریافت شد: ${payload.action}`);

                    if (!currentUser) return;
                    if (payload.senderId === currentUser.id) return; // Don't notify sender

                    const assignedIds = currentUser.assignedFarms?.map(f => f.id) || [];
                    const isRelevant = currentUser.role === UserRole.ADMIN || assignedIds.includes(payload.targetFarmId);

                    if (isRelevant) {
                        const title = "⚠️ هشدار مدیریتی";
                        
                        // Always play sound
                        playNotificationSound();
                        
                        // Show internal Toast
                        useToastStore.getState().addToast(`پیام مدیریت: ${payload.message}`, 'error');

                        // Try System Notification (Background/Foreground)
                        await showSystemNotification(title, payload.message);
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    get().addLog('اتصال به کانال هشدار برقرار شد.');
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
        
        // Wait briefly for connection if needed
        if (channel?.state !== 'joined') {
             await new Promise(r => setTimeout(r, 1000));
        }

        const payload = { targetFarmId: farmId, farmName, message, senderId: user.id, sentAt: Date.now(), action: 'missing_stats' };
        
        const result = await channel?.send({ type: 'broadcast', event: 'farm_alert', payload });
        
        return { success: result === 'ok', detail: result as string, bytes: JSON.stringify(payload).length };
    }
}));
