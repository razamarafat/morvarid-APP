
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { useLogStore } from './store/logStore';
import { usePwaStore } from './store/pwaStore';

// --- GLOBAL ERROR TRAPPING ---
window.onerror = (message, source, lineno, colno, error) => {
    const errorMessage = error?.message || String(message) || 'Unknown Error';
    const stack = error?.stack || 'No Stack Trace';
    
    // Use the new logAction directly
    useLogStore.getState().logAction(
        'error', 
        'frontend', 
        `خطای سیستمی (Global Error): ${errorMessage}`,
        { source, lineno, colno, stack }
    );
    return false;
};

window.addEventListener('unhandledrejection', (event) => {
    useLogStore.getState().logAction(
        'error', 
        'frontend', 
        `خطای Promise مدیریت نشده`,
        { reason: event.reason }
    );
});

// --- PWA EARLY CAPTURE ---
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    usePwaStore.getState().setDeferredPrompt(e);
    console.log('PWA: Event captured in index.tsx');
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element to mount to");

// --- ENVIRONMENT CHECKS ---
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isHttps = window.location.protocol === 'https:';

if (!isHttps && !isLocal) {
    useLogStore.getState().logAction('warn', 'network', 'عدم استفاده از HTTPS', { protocol: window.location.protocol });
}

// --- ROBUST SERVICE WORKER REGISTRATION ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const logStore = useLogStore.getState();
    const isBlob = window.location.protocol === 'blob:' || window.location.href.startsWith('blob:');
    const isData = window.location.protocol === 'data:';
    
    if (isBlob || isData) return;

    const swUrl = './sw.js';

    try {
        const registration = await navigator.serviceWorker.register(swUrl, { scope: './' });
        
        // Log success silently/debug
        console.log(`PWA: ServiceWorker registered. Scope: ${registration.scope}`);
        
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                logStore.logAction('info', 'network', 'نسخه جدید اپلیکیشن موجود است', { type: 'update_found' });
                console.log('PWA: New content is available; please refresh.');
              }
            };
          }
        };
    } catch (error: any) {
        logStore.logAction('error', 'network', 'خطا در ثبت سرویس‌ورکر (PWA)', { error: error.message });
    }
  });
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
