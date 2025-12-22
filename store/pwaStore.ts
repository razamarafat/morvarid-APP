
import { create } from 'zustand';

interface PwaState {
  deferredPrompt: any | null;
  setDeferredPrompt: (prompt: any) => void;
  isInstalled: boolean;
  setIsInstalled: (value: boolean) => void;
}

export const usePwaStore = create<PwaState>((set) => ({
  deferredPrompt: null,
  isInstalled: false,
  setDeferredPrompt: (prompt) => set({ deferredPrompt: prompt }),
  setIsInstalled: (value) => set({ isInstalled: value }),
}));
