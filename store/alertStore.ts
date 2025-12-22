
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
    requestPermission: () => Promise<boolean>;
    sendAlert: (farmId: string, farmName: string, message: string) => Promise<{ success: boolean; detail: string; bytes: number }>;
}

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
        playNote(523.25, now, 0.5);          
        playNote(659.25, now + 0.12, 0.5);    
        playNote(783.99, now + 0.24, 0.5);    
        playNote(987.77, now + 0.36, 0.5);    
        playNote(1046.50, now + 0.48, 0.8, 0.2); 
    } catch (e) {
        console.warn("Audio Context blocked", e);
    }
};

export const useAlertStore = create<AlertState>((set, get) => ({
    isListening: false,
    channel: null,

    requestPermission: async () => {
        if (!("Notification" in window)) return false;
        
        try {
            const permission = await Notification.requestPermission();
            const toastStore = useToastStore.getState();

            if (permission === "granted") {
                return true;
            } else if (permission === "denied") {
                toastStore.addToast('اعلان‌ها مسدود هستند. لطفا برای دریافت هشدارها از تنظیمات مرورگر (آیکون قفل) دسترسی را باز کنید.', 'warning');
                return false;
            }
        } catch (error) {
            console.error("Permission request error", error);
        }
        return false;
    },

    initListener: () => {
        if (get().isListening) return;

        get().requestPermission();

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
                        playProfessionalSmsSound();
                        if ("vibrate" in navigator) {
                            navigator.vibrate([100, 50, 100, 50, 300]); 
                        }
                        useToastStore.getState().addToast(`هشدار: ${payload.message}`, 'error');

                        if ("serviceWorker" in navigator && Notification.permission === "granted") {
                            try {
                                const registration = await navigator.serviceWorker.ready;
                                registration.showNotification("سامانه مروارید: وضعیت بحرانی", {
                                    body: payload.message,
                                    icon: "/vite.svg",
                                    badge: "/vite.svg",
                                    tag: "farm-alert-" + payload.targetFarmId,
                                    renotify: true,
                                    vibrate: [100, 50, 100, 50, 300],
                                    dir: "rtl",
                                    silent: false 
                                } as any);
                            } catch(e) {
                                console.warn("SW notification failed", e);
                            }
                        }
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
        if (!channel) return { success: false, detail: 'Channel Error', bytes: 0 };

        const payload = { targetFarmId: farmId, farmName, message, senderId: user.id, sentAt: Date.now(), action: 'missing_stats' };
        const result = await channel.send({ type: 'broadcast', event: 'farm_alert', payload });
        
        return { success: result === 'ok', detail: result as string, bytes: JSON.stringify(payload).length };
    }
}));
