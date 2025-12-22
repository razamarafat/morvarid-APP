
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { useLogStore } from './store/logStore';
import { usePwaStore } from './store/pwaStore';

// --- GLOBAL ERROR TRAPPING ---
window.onerror = (message, source, lineno, colno, error) => {
    useLogStore.getState().error(
        'SYSTEM', 
        `Uncaught Global Error: ${message}`,
        { source, lineno, colno, stack: error?.stack }
    );
    return false;
};

window.addEventListener('unhandledrejection', (event) => {
    let details: any = { reason: event.reason };
    let message = 'Unhandled Promise Rejection';

    if (event.reason instanceof Error) {
        message = event.reason.message;
        details = { stack: event.reason.stack };
    }

    useLogStore.getState().error('SYSTEM', message, details);
});

// --- PWA EARLY CAPTURE ---
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    usePwaStore.getState().setDeferredPrompt(e);
    useLogStore.getState().info('SYSTEM', 'PWA install prompt captured');
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element to mount to");

// --- ENVIRONMENT CHECKS ---
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isHttps = window.location.protocol === 'https:';

if (!isHttps && !isLocal) {
    useLogStore.getState().warn('NETWORK', 'Insecure Connection (HTTP)', { protocol: window.location.protocol });
}

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
                useLogStore.getState().info('NETWORK', 'New version available', { type: 'update_found' });
                console.log('PWA: New content is available; please refresh.');
              }
            };
          }
        };
    } catch (error: any) {
        useLogStore.getState().error('NETWORK', 'Service Worker Registration Failed', error);
    }
  });
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
