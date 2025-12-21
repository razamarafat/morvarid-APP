
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

// PWA Service Worker Registration Logic
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const hostname = window.location.hostname;
    const href = window.location.href;
    
    // Expanded list of preview/sandbox environments that restrict SW or cause Origin Mismatches
    const isSandbox = 
        hostname.includes('usercontent.goog') || 
        hostname.includes('ai.studio') ||
        hostname.includes('googleusercontent.com') ||
        hostname.includes('webcontainer.io') ||
        hostname.includes('stackblitz.io') ||
        href.includes('scf.usercontent.goog');

    if (isSandbox) {
      console.info('Morvarid PWA: Service Worker registration intentionally skipped on preview domain to prevent security/origin errors.');
      return;
    }

    // Using a simple relative path is the most robust way to register a SW 
    // without triggering origin mismatch errors in proxied environments.
    navigator.serviceWorker.register('sw.js', { scope: './' })
      .then(registration => {
        console.log('Morvarid PWA: ServiceWorker registered successfully on scope:', registration.scope);
      })
      .catch(err => {
        const msg = err?.message || String(err);
        // Silently handle common sandbox/security restrictions to keep the console clean
        if (
            msg.includes('origin') || 
            msg.includes('scriptURL') || 
            msg.includes('SecurityError') || 
            msg.includes('disallowed') ||
            msg.includes('Operation is not supported')
        ) {
            console.warn('Morvarid PWA: SW registration skipped (Environment restriction):', msg);
            return;
        }
        console.error('Morvarid PWA: ServiceWorker registration failed:', err);
      });
  });
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
