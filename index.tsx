
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
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
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
    // Exclude blob URLs
    const isBlob = window.location.protocol === 'blob:' || window.location.href.startsWith('blob:');
    
    // Robust check for AI Studio / Google User Content / Cloud Shell preview environments
    // We check both hostname and origin to catch iframe discrepancies
    const isGooglePreview = 
        window.location.hostname.includes('googleusercontent') || 
        window.location.hostname.includes('ai.studio') || 
        window.location.hostname.includes('usercontent.goog') ||
        (window.origin && window.origin.includes('usercontent.goog'));

    if (isBlob || isGooglePreview) {
        console.warn('[PWA Warning] Service Worker registration skipped in preview environment to prevent origin mismatch errors.');
        return;
    }

    try {
        const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
        
        if (registration.installing) {
            usePwaStore.getState().logEvent('Service Worker installing...');
        } else if (registration.waiting) {
            usePwaStore.getState().logEvent('Service Worker waiting...');
        } else if (registration.active) {
            usePwaStore.getState().logEvent('Service Worker active');
        }

        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  usePwaStore.getState().logEvent('New content is available; please refresh.');
                } else {
                  usePwaStore.getState().logEvent('Content is cached for offline use.');
                }
              }
            };
          }
        };
    } catch (error: any) {
        // Suppress the specific "origin mismatch" error from cluttering logs if it slips through
        if (error?.message?.includes('does not match the current origin')) {
            console.warn('[PWA] Origin mismatch detected during registration (likely preview env).');
        } else {
            console.error('[PWA Error] Service Worker Registration Failed:', error);
            usePwaStore.getState().logEvent('Service Worker Registration Failed', error);
        }
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
