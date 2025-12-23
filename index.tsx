import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { usePwaStore } from './store/pwaStore';

// --- PWA INSTALLATION CAPTURE ---
console.log('🔵 [PWA] Initializing root event listeners');

window.addEventListener('beforeinstallprompt', (e) => {
    console.log('✅ [PWA] SUCCESS: Browser fired beforeinstallprompt event!');
    e.preventDefault();
    usePwaStore.getState().setDeferredPrompt(e);
});

window.addEventListener('appinstalled', () => {
    console.log('✅ [PWA] Application successfully installed on this device!');
    usePwaStore.getState().setIsInstalled(true);
    usePwaStore.getState().setDeferredPrompt(null);
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element to mount to");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);