
import { useEffect, useRef } from 'react';
import { useToastStore } from '../store/toastStore';

export const useAutoUpdate = () => {
  const { addToast } = useToastStore();
  const initialBuildDate = useRef<number | null>(null);
  
  // Check frequently (every 30 seconds)
  const CHECK_INTERVAL = 30 * 1000; 

  useEffect(() => {
    const checkVersion = async () => {
      try {
        // Robust check for AI Studio / Google User Content preview environments
        const isGooglePreview = 
            window.location.hostname.includes('googleusercontent') || 
            window.location.hostname.includes('ai.studio') || 
            window.location.hostname.includes('usercontent.goog') ||
            (window.origin && window.origin.includes('usercontent.goog'));

        // Skip version check in preview environments to avoid "Failed to fetch" errors
        if (isGooglePreview) return;

        // Force bypass cache with timestamp and random number
        const response = await fetch(`./version.json?t=${Date.now()}&r=${Math.random()}`, {
          cache: 'no-store',
          headers: {
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Expires': '0'
          }
        });

        if (!response.ok) return;

        const data = await response.json();
        const serverBuildDate = data.buildDate;

        if (initialBuildDate.current === null) {
          initialBuildDate.current = serverBuildDate;
        } else if (serverBuildDate !== initialBuildDate.current) {
          console.log('[AutoUpdate] New version detected! Forcing update...');
          
          addToast('نسخه جدید شناسایی شد. در حال بروزرسانی...', 'info');
          
          // 1. Unregister Service Workers (Skip in preview to avoid origin mismatch errors)
          if ('serviceWorker' in navigator && !isGooglePreview) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                  await registration.unregister();
                }
            } catch (swError) {
                console.warn('[AutoUpdate] Failed to unregister SW:', swError);
            }
          }

          // 2. Clear All Caches
          if ('caches' in window) {
             const keys = await caches.keys();
             await Promise.all(keys.map(key => caches.delete(key)));
          }

          // 3. Clear Local Storage flags related to updates (optional, keeping auth)
          // We intentionally don't clear auth tokens here to keep user logged in.

          // 4. Force Reload from Server (ignoring cache)
          setTimeout(() => {
              window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now();
              window.location.reload();
          }, 1000);
        }
      } catch (error) {
        console.error('[AutoUpdate] Failed to check version:', error);
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, CHECK_INTERVAL);

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            checkVersion();
        }
    };
    
    // Also check on focus/click to ensure active users get it
    window.addEventListener('focus', checkVersion);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        clearInterval(interval);
        window.removeEventListener('focus', checkVersion);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
};
