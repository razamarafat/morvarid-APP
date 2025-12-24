
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

// Play a generic notification sound for open app state
const playNotificationSound = () => {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
        oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.5);
        
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
        console.error('Audio play failed', e);
    }
};

const showSystemNotification = async (title: string, body: string) => {
    console.log('[Notif System] Requesting System Notification:', { title, body });
    
    // Robust check for preview environments
    const isGooglePreview = 
        window.location.hostname.includes('googleusercontent') || 
        window.location.hostname.includes('ai.studio') || 
        window.location.hostname.includes('usercontent.goog') ||
        (window.origin && window.origin.includes('usercontent.goog'));

    if (isGooglePreview) {
        console.warn('[Notif System] System notifications skipped in preview environment.');
        return false;
    }

    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
        return false;
    }

    if (Notification.permission === "granted") {
        try {
            const registration = await navigator.serviceWorker.ready;
            
            if (!registration) {
                 // Fallback if SW not ready
                 new Notification(title, { body, icon: "/icons/icon-192x192.png" });
                 return true;
            }

            // Using 'requireInteraction: true' to keep it visible until user clicks
            await registration.showNotification(title, {
                body: body,
                icon: "/icons/icon-192x192.png",
                badge: "/icons/icon-192x192.png",
                tag: "morvarid-alert-" + Date.now(), 
                renotify: true,
                vibrate: [200, 100, 200, 100, 200], 
                dir: "rtl",
                lang: "fa-IR",
                requireInteraction: true,
                data: {
                    url: window.location.href
                }
            } as any);
            return true;
        } catch (e) {
            console.error("[Notif System] SW Notification Failed:", e);
            return false;
        }
    }
    return false;
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
        if (!("Notification" in window)) {
            get().addLog('مرورگر از نوتیفیکیشن پشتیبانی نمی‌کند.');
            return false;
        }

        if (Notification.permission === 'granted') return true;

        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                get().addLog('مجوز نوتیفیکیشن دریافت شد.');
                return true;
            }
        }
        
        get().addLog('مجوز نوتیفیکیشن رد شد یا وجود ندارد.');
        return false;
    },

    triggerTestNotification: async () => {
        const hasPermission = await get().checkAndRequestPermission();
        if (hasPermission) {
             const result = await showSystemNotification("تست سامانه مروارید", "این یک پیام آزمایشی است. صدای اعلان باید پخش شود.");
             if (!result) {
                 get().addLog('نمایش اعلان سیستمی ناموفق بود (احتمالاً محیط Preview).');
             } else {
                 get().addLog('پیام تست ارسال شد.');
             }
        } else {
             useToastStore.getState().addToast('لطفا مجوز نوتیفیکیشن را در تنظیمات مرورگر فعال کنید.', 'warning');
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
                    
                    get().addLog(`سیگنال دریافت شد: ${payload.action}`);

                    // Logic: Even if currentUser is null (logged out?), if the browser is open, show alert?
                    // No, must be logged in to know which farm they are.
                    if (!currentUser) return;

                    // Don't alert the sender (Sales Manager)
                    if (payload.senderId === currentUser.id) return;

                    const assignedIds = currentUser.assignedFarms?.map(f => f.id) || [];
                    const isRelevant = currentUser.role === UserRole.ADMIN || assignedIds.includes(payload.targetFarmId);

                    if (isRelevant) {
                        const title = "هشدار مدیریتی مروارید";
                        
                        // CRITICAL LOGIC:
                        // If document is hidden (minimized/background tab) -> Force System Notification
                        // If document is visible -> Show Toast AND Play Sound
                        
                        if (document.visibilityState === 'hidden') {
                            get().addLog('برنامه در پس‌زمینه است. ارسال اعلان سیستمی...');
                            const sent = await showSystemNotification(title, payload.message);
                            if (!sent) {
                                // Fallback if system notification fails (rare)
                                get().addLog('خطا در ارسال اعلان سیستمی. تلاش برای پخش صدا...');
                                playNotificationSound(); 
                            }
                        } else {
                            get().addLog('برنامه باز است. نمایش توست و پخش صدا.');
                            useToastStore.getState().addToast(`پیام مدیریت: ${payload.message}`, 'error');
                            playNotificationSound();
                            // Optional: Also show system notification for better attention
                            showSystemNotification(title, payload.message); 
                        }
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
        // Wait a bit for connection if just initialized
        if (!channel) return { success: false, detail: 'Channel Error', bytes: 0 };

        const payload = { targetFarmId: farmId, farmName, message, senderId: user.id, sentAt: Date.now(), action: 'missing_stats' };
        
        const result = await channel.send({ type: 'broadcast', event: 'farm_alert', payload });
        
        return { success: result === 'ok', detail: result as string, bytes: JSON.stringify(payload).length };
    }
}));
