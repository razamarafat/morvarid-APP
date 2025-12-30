
import './src/index.css'; // Vital: Tailwind CSS Import (Moved to top for priority)
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { usePwaStore } from './store/pwaStore';

// --- PWA INSTALLATION DIAGNOSTICS ---
const manifestLink = document.querySelector('link[rel="manifest"]');
if (!manifestLink) {
    console.error('[PWA Error] Manifest file (manifest.json) NOT found in HTML head.');
} else {
    console.log('[PWA Info] Manifest linked:', manifestLink.getAttribute('href'));
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    console.log('[PWA] beforeinstallprompt captured!');
    usePwaStore.getState().setDeferredPrompt(e);
});

window.addEventListener('appinstalled', () => {
    usePwaStore.getState().logEvent('✅ APPLICATION INSTALLED SUCCESSFULLY');
    usePwaStore.getState().setDeferredPrompt(null);
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element to mount to");

// --- SERVICE WORKER REGISTRATION ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const isBlob = window.location.protocol === 'blob:' || window.location.href.startsWith('blob:');
            if (isBlob) {
                console.warn('[PWA Warning] Service Worker registration skipped (Blob URL).');
                return;
            }

            const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

            if (registration.installing) {
                console.log('[PWA] Service Worker installing...');
                usePwaStore.getState().logEvent('Service Worker installing...');
            } else if (registration.active) {
                console.log('[PWA] Service Worker active!');
                usePwaStore.getState().logEvent('Service Worker active');
            }
        } catch (error: any) {
            console.error('[PWA Error] Service Worker Registration Failed:', error);
            usePwaStore.getState().logEvent('Service Worker Registration Failed', error);
        }
    });
} else {
    console.warn('[PWA Warning] Service Worker is NOT supported in this browser.');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
