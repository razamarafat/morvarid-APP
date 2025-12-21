
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { useLogStore } from './store/logStore';

// --- GLOBAL ERROR TRAPPING START ---
window.onerror = (message, source, lineno, colno, error) => {
    const errorDetails = `Global Error: ${message} at ${source}:${lineno}:${colno}`;
    setTimeout(() => {
        useLogStore.getState().addLog('error', 'frontend', errorDetails, 'SYSTEM_TRAP');
    }, 0);
    return false;
};

window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || event.reason || 'Unknown Async Error';
    const errorDetails = `Unhandled Promise: ${reason}`;
    if (typeof reason === 'string' && reason.includes('ResizeObserver')) return;
    setTimeout(() => {
        useLogStore.getState().addLog('error', 'network', errorDetails, 'SYSTEM_TRAP');
    }, 0);
});
// --- GLOBAL ERROR TRAPPING END ---

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

/**
 * مدیریت ثبت Service Worker
 * جلوگیری از ثبت در محیط‌های توسعه ابری که باعث خطای Origin Mismatch می‌شوند.
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const hostname = window.location.hostname;
    
    // لیست دامنه‌هایی که نباید در آن‌ها SW ثبت شود (محیط‌های پیش‌نمایش)
    const isSandbox = hostname.includes('usercontent') || 
                     hostname.includes('ai.studio') ||
                     hostname.includes('google') ||
                     hostname.includes('stackblitz') || 
                     hostname.includes('webcontainer');

    // اگر محیط سندباکس است، کلاً بیخیال ثبت شو
    if (isSandbox) {
      console.debug('Morvarid PWA: SW registration skipped (Sandbox environment detected).');
      return;
    }

    navigator.serviceWorker.register('sw.js')
      .then(registration => {
        console.log('Morvarid PWA: ServiceWorker registered successfully');
      })
      .catch(err => {
        // نادیده گرفتن خطاهای Origin برای جلوگیری از شلوغی کنسول در محیط‌های خاص
        if (err.message && (err.message.includes('origin') || err.message.includes('scope'))) {
            return; 
        }
        console.warn('Morvarid PWA: ServiceWorker registration failed:', err.message);
      });
  });
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
