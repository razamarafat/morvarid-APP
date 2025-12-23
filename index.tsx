import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './src/App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element to mount to");

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const isBlob = window.location.protocol === 'blob:' || window.location.href.startsWith('blob:');
    const isGooglePreview = window.location.hostname.includes('googleusercontent') || window.location.hostname.includes('ai.studio');

    if (isBlob || isGooglePreview) {
      console.warn('[PWA] SW registration skipped in preview environment');
      return;
    }

    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('[PWA] Service Worker registered');
    } catch (error) {
      console.error('[PWA] SW registration failed:', error);
    }
  });
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
