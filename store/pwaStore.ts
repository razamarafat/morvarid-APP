import { create } from 'zustand';

interface PwaState {
  deferredPrompt: any | null;
  setDeferredPrompt: (prompt: any) => void;
  isInstalled: boolean;
  setIsInstalled: (value: boolean) => void;
  logEvent: (message: string, data?: any) => void;
}

export const usePwaStore = create<PwaState>((set) => ({
  deferredPrompt: null,
  isInstalled: false,
  
  setDeferredPrompt: (prompt) => {
    console.log('✅ [PWA] Event Captured: beforeinstallprompt stored in state.');
    set({ deferredPrompt: prompt });
  },

  setIsInstalled: (value) => {
    console.log(`ℹ️ [PWA] Install Mode: ${value ? 'Standalone (PWA)' : 'Browser Tab'}`);
    set({ isInstalled: value });
  },

  logEvent: (message, data) => {
    console.log(`🔵 [PWA] LOG: ${message}`);
    if (data) console.dir(data);
  }
}));