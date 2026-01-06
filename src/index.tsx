
import './index.css';
import { log } from './utils/logger'; // Vital: Tailwind CSS Import (Moved to top for priority)
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { usePwaStore } from './store/pwaStore';
import { monitor } from './utils/monitor';

// Initialize Global Monitoring
monitor.logInfo('Application started');

// --- PWA INSTALLATION DIAGNOSTICS ---
const manifestLink = document.querySelector('link[rel="manifest"]');
if (!manifestLink) {
    console.error('[PWA Error] Manifest file (manifest.json) NOT found in HTML head.');
} else {
    log.debug('PWA Info - Manifest linked:', manifestLink.getAttribute('href'));
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    log.info('PWA - beforeinstallprompt captured!');
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
