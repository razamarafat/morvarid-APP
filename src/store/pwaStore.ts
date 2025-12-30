
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
    const style = 'background: #0050EF; color: white; padding: 2px 5px; border-radius: 3px; font-weight: bold;';
    console.log(`%c[PWA Installer] Event: beforeinstallprompt captured!`, style);
    console.log(`%c[PWA Installer] App is ready to be installed. Prompt saved.`, 'color: #0050EF;');
    set({ deferredPrompt: prompt });
  },

  setIsInstalled: (value) => {
    const style = value 
        ? 'background: #00A300; color: white; padding: 2px 5px; border-radius: 3px;' 
        : 'background: #F09609; color: black; padding: 2px 5px; border-radius: 3px;';
    
    console.log(`%c[PWA Installer] Mode: ${value ? 'STANDALONE (Installed)' : 'BROWSER (Web)'}`, style);
    set({ isInstalled: value });
  },

  logEvent: (message, data) => {
    const style = 'background: #603CBA; color: white; padding: 2px 5px; border-radius: 3px;';
    console.log(`%c[PWA Debug] ${message}`, style);
    if (data) {
        console.dir(data);
    }
  }
}));
