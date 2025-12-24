
import { useEffect, useRef } from 'react';
import { useToastStore } from '../store/toastStore';

export const useAutoUpdate = () => {
  const { addToast } = useToastStore();
  // Store the version timestamp loaded when the app first started
  const initialBuildDate = useRef<number | null>(null);
  
  // Check every 60 seconds
  const CHECK_INTERVAL = 60 * 1000; 

  useEffect(() => {
    const checkVersion = async () => {
      try {
        // Fetch version.json with a query param to bypass browser cache
        const response = await fetch(`./version.json?t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache'
          }
        });

        if (!response.ok) return;

        const data = await response.json();
        const serverBuildDate = data.buildDate;

        if (initialBuildDate.current === null) {
          // First load: set the reference
          initialBuildDate.current = serverBuildDate;
        } else if (serverBuildDate !== initialBuildDate.current) {
          // Version mismatch detected!
          console.log('[AutoUpdate] New version detected. Updating...');
          
          addToast('نسخه جدید یافت شد. در حال بروزرسانی...', 'info');
          
          // 1. Unregister Service Worker to clear control
          if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
              await registration.unregister();
            }
          }

          // 2. Clear Caches (Optional but recommended for hard reset)
          if ('caches' in window) {
             const keys = await caches.keys();
             for (const key of keys) {
                 await caches.delete(key);
             }
          }

          // 3. Force Reload
          setTimeout(() => {
              window.location.reload();
          }, 1500);
        }
      } catch (error) {
        console.error('[AutoUpdate] Failed to check version:', error);
      }
    };

    // Initial check
    checkVersion();

    // Periodic check
    const interval = setInterval(checkVersion, CHECK_INTERVAL);

    // Also check when the tab becomes visible again
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            checkVersion();
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
};
