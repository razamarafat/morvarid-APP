
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { usePwaStore } from './store/pwaStore';

// --- GLOBAL ERROR TRAPPING (Simplified) ---
window.onerror = (message, source, lineno, colno, error) => {
    console.error('Global Error:', { message, source, lineno, colno, error });
    return false;
};

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled Rejection:', event.reason);
});

// --- PWA EARLY CAPTURE ---
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    usePwaStore.getState().setDeferredPrompt(e);
    console.log('PWA install prompt captured');
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element to mount to");

// --- SERVICE WORKER ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const isBlob = window.location.protocol === 'blob:' || window.location.href.startsWith('blob:');
    if (isBlob) return;

    try {
        const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
        console.log(`PWA: ServiceWorker registered. Scope: ${registration.scope}`);
        
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('PWA: New content is available; please refresh.');
              }
            };
          }
        };
    } catch (error: any) {
        console.error('PWA: Service Worker Registration Failed', error);
    }
  });
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
