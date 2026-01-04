
import { useEffect, useRef } from 'react';
import { useToastStore } from '../store/toastStore';
import { useAlertStore } from '../store/alertStore';

export const useAutoUpdate = () => {
  const { addToast } = useToastStore();
  const { sendLocalNotification } = useAlertStore();
  const initialBuildDate = useRef<number | null>(null);
  
  // Check frequently (every 30 seconds) - TIMING.VERSION_CHECK_INTERVAL
  const CHECK_INTERVAL = 30 * 1000; 

  useEffect(() => {
    const checkVersion = async () => {
      // OPTIMIZATION: Do not fetch if offline
      if (!navigator.onLine) return;

      try {
        const isGooglePreview = 
            window.location.hostname.includes('googleusercontent') || 
            window.location.hostname.includes('ai.studio') || 
            window.location.hostname.includes('usercontent.goog') ||
            (window.origin && window.origin.includes('usercontent.goog'));

        if (isGooglePreview) return;

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
          
          sendLocalNotification(
              'بروزرسانی سیستم', 
              'نسخه جدیدی از سامانه مروارید موجود است. برنامه در حال بارگذاری مجدد است...', 
              'system-update'
          );

          addToast('نسخه جدید شناسایی شد. در حال بروزرسانی...', 'info');
          
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

          if ('caches' in window) {
             const keys = await caches.keys();
             await Promise.all(keys.map(key => caches.delete(key)));
          }

          setTimeout(() => {
              window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now();
              window.location.reload();
          }, 2000);
        }
      } catch (error) {
        // Silent fail is fine here
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, CHECK_INTERVAL);

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            checkVersion();
        }
    };
    
    window.addEventListener('focus', checkVersion);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        clearInterval(interval);
        window.removeEventListener('focus', checkVersion);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
};
