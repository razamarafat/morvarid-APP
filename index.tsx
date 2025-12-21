
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { useLogStore } from './store/logStore';
import { usePwaStore } from './store/pwaStore';

// --- GLOBAL ERROR TRAPPING ---
window.onerror = (message, source, lineno, colno, error) => {
    const errorMessage = error?.message || String(message) || 'Unknown Error';
    setTimeout(() => {
        useLogStore.getState().addLog('error', 'frontend', `Global Error: ${errorMessage}`, 'SYSTEM_TRAP');
    }, 0);
    return false;
};

// --- PWA EARLY CAPTURE ---
// Important: This listener must be attached immediately to capture the event 
// if it fires before the React app is fully mounted.
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    usePwaStore.getState().setDeferredPrompt(e);
    useLogStore.getState().addLog('info', 'frontend', 'PWA: "beforeinstallprompt" event captured successfully in Global Scope.', 'SYSTEM');
    console.log('PWA: Event captured in index.tsx');
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element to mount to");

// --- ENVIRONMENT CHECKS ---
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isHttps = window.location.protocol === 'https:';

if (!isHttps && !isLocal) {
    useLogStore.getState().addLog('warn', 'network', 'PWA: App is NOT serving over HTTPS. Installation may be blocked by browser.', 'SYSTEM');
}

// --- ROBUST SERVICE WORKER REGISTRATION ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // FIX: Use absolute URL derived from window.location to prevent origin mismatch errors
    const swUrl = new URL('sw.js', window.location.href).href;
    
    useLogStore.getState().addLog('debug', 'network', 'PWA: Starting Service Worker registration...', 'SYSTEM');

    navigator.serviceWorker.register(swUrl)
      .then(registration => {
        useLogStore.getState().addLog('info', 'network', `PWA: ServiceWorker registered successfully. Scope: ${registration.scope}`, 'SYSTEM');
        
        // Check for updates
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                useLogStore.getState().addLog('info', 'network', 'PWA: New content available (Update Found).', 'SYSTEM');
                console.log('PWA: New content is available; please refresh.');
              }
            };
          }
        };
      })
      .catch(err => {
        useLogStore.getState().addLog('error', 'network', `PWA: ServiceWorker registration failed: ${err.message}`, 'SYSTEM');
        console.error('PWA: ServiceWorker registration failed:', err);
      });
  });
} else {
    useLogStore.getState().addLog('warn', 'network', 'PWA: Service Worker is not supported in this browser.', 'SYSTEM');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
