
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { usePwaStore } from './store/pwaStore';

// --- PWA INSTALLATION DIAGNOSTICS ---
// 1. Check if Manifest exists
const manifestLink = document.querySelector('link[rel="manifest"]');
if (!manifestLink) {
    console.error('[PWA Error] Manifest file (manifest.json) NOT found in HTML head.');
} else {
    console.log('[PWA Info] Manifest linked:', manifestLink.getAttribute('href'));
}

// 2. Capture Install Prompt
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile (we provide custom UI)
    e.preventDefault();
    // Stash the event so it can be triggered later.
    console.log('[PWA] beforeinstallprompt captured!');
    usePwaStore.getState().setDeferredPrompt(e);
});

// 3. Detect Installation Success
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
        // Only exclude Blob URLs which strictly cannot support SW
        const isBlob = window.location.protocol === 'blob:' || window.location.href.startsWith('blob:');
        
        if (isBlob) {
            console.warn('[PWA Warning] Service Worker registration skipped (Blob URL).');
            return;
        }

        // Use ABSOLUTE path for SW to ensure it works from nested routes (e.g. /admin)
        // Scope '/' ensures it controls the entire origin
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        
        if (registration.installing) {
            console.log('[PWA] Service Worker installing...');
            usePwaStore.getState().logEvent('Service Worker installing...');
        } else if (registration.waiting) {
            console.log('[PWA] Service Worker waiting...');
            usePwaStore.getState().logEvent('Service Worker waiting...');
        } else if (registration.active) {
            console.log('[PWA] Service Worker active!');
            usePwaStore.getState().logEvent('Service Worker active');
        }

        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.log('[PWA] New content available');
                  usePwaStore.getState().logEvent('New content is available; please refresh.');
                } else {
                  console.log('[PWA] Content cached for offline use');
                  usePwaStore.getState().logEvent('Content is cached for offline use.');
                }
              }
            };
          }
        };
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
