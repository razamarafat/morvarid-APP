
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { usePwaStore } from './store/pwaStore';

// --- PWA INSTALLATION CAPTURE ---
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    usePwaStore.getState().setDeferredPrompt(e);
});

window.addEventListener('appinstalled', () => {
    usePwaStore.getState().logEvent('✅ APPLICATION INSTALLED SUCCESSFULLY');
    usePwaStore.getState().setDeferredPrompt(null);
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element to mount to");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
