
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useToastStore } from './toastStore';
import { useAuthStore } from './authStore';
import { useLogStore } from './logStore';
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
    sendAlert: (farmId: string, farmName: string, message: string) => Promise<{ success: boolean; detail: string; bytes: number }>;
}

/**
 * ملودی پیامک حرفه‌ای (Arpeggio)
 * ۵ نت متوالی برای ایجاد یک صدای اعلان دلنشین و واضح
 */
const playProfessionalSmsSound = () => {
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        const playNote = (freq: number, start: number, duration: number, volume: number = 0.15) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);
            
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(volume, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.start(start);
            osc.stop(start + duration);
        };

        const now = audioCtx.currentTime;
        // ملودی: C5 - E5 - G5 - B5 - C6
        playNote(523.25, now, 0.5);          // C5
        playNote(659.25, now + 0.12, 0.5);    // E5
        playNote(783.99, now + 0.24, 0.5);    // G5
        playNote(987.77, now + 0.36, 0.5);    // B5
        playNote(1046.50, now + 0.48, 0.8, 0.2); // C6 (نت نهایی بلندتر)
        
    } catch (e) {
        console.warn("Audio Context blocked. User must interact with page first.", e);
    }
};

export const useAlertStore = create<AlertState>((set, get) => ({
    isListening: false,
    channel: null,

    initListener: () => {
        if (get().isListening) return;

        const logStore = useLogStore.getState();
        
        // درخواست مجوز اعلان
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

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
                    if (!currentUser || payload.senderId === currentUser.id) return;

                    const assignedIds = currentUser.assignedFarms?.map(f => f.id) || [];
                    const isRelevant = currentUser.role === UserRole.ADMIN || assignedIds.includes(payload.targetFarmId);

                    if (isRelevant) {
                        // ۱. پخش صدا و ویبره در محیط برنامه (اگر باز باشد)
                        playProfessionalSmsSound();
                        if ("vibrate" in navigator) {
                            navigator.vibrate([100, 50, 100, 50, 300]); 
                        }
                        useToastStore.getState().addToast(`پیام جدید: ${payload.message}`, 'error');

                        // ۲. نمایش اعلان سیستمی از طریق Service Worker (بسیار پایدارتر در پس‌زمینه)
                        if ("serviceWorker" in navigator && Notification.permission === "granted") {
                            const registration = await navigator.serviceWorker.ready;
                            // Fix: Cast the notification options to any to resolve property 'renotify' not existing error.
                            registration.showNotification("سامانه مروارید: گزارش نهایی", {
                                body: payload.message,
                                icon: "/vite.svg",
                                badge: "/vite.svg",
                                tag: "farm-alert-" + payload.targetFarmId,
                                renotify: true,
                                vibrate: [100, 50, 100, 50, 300],
                                data: { url: window.location.href },
                                dir: "rtl",
                                // ارجاع به تنظیمات سیستم برای صدا (در اکثر گوشی‌ها)
                                silent: false 
                            } as any);
                        }
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    set({ isListening: true });
                    logStore.addLog('info', 'alert', 'اتصال آنی برای دریافت هشدارها برقرار شد.');
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
        const result = await channel.send({ type: 'broadcast', event: 'farm_alert', payload });
        return { success: result === 'ok', detail: result as string, bytes: JSON.stringify(payload).length };
    }
}));
