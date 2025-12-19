
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Only register SW if origin matches standard expectations to prevent "origin mismatch" errors in web containers
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isSecure = window.location.protocol === 'https:';
    
    // Simple check to avoid registering in preview environments that might have origin issues
    if (isLocalhost || isSecure) {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('SW registered scope:', registration.scope);
            })
            .catch(err => {
                // Silently fail or log warning without crashing
                console.debug('SW registration skipped/failed:', err);
            });
    }
  });
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
