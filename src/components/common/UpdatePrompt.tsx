// src/components/common/UpdatePrompt.tsx
import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToastStore } from '@/store/toastStore';
import { TOAST_IDS, APP_VERSION } from '@/constants';

/**
 * Zero-Touch PWA Auto-Update Strategy:
 * 1. useRegisterSW with periodic SW update checks (every 60s)
 * 2. On needRefresh → auto-reload immediately
 * 3. Listen for SW_UPDATED postMessage → force reload
 * 4. Poll version.json as a fallback (every 5 min) → force reload on mismatch
 */

const SW_CHECK_INTERVAL = 60 * 1000;       // 60 seconds
const VERSION_POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

function UpdatePrompt() {
  const addToast = useToastStore((state) => state.addToast);
  const isReloading = useRef(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      if (r) {
        console.log('[PWA] SW registered. Starting periodic update checks...');
        // Periodic SW update check: asks the browser to re-fetch sw.js
        setInterval(() => {
          if (!isReloading.current) {
            console.log('[PWA] Checking for SW update...');
            r.update().catch(err => console.warn('[PWA] SW update check failed:', err));
          }
        }, SW_CHECK_INTERVAL);
      }
    },
    onRegisterError(error: Error) {
      console.error('[PWA] SW registration error:', error);
    },
    onNeedRefresh() {
      console.log('[PWA] New SW available, triggering auto-update...');
    },
    onOfflineReady() {
      console.log('[PWA] App ready for offline use.');
    },
  });

  // Auto-reload when needRefresh is triggered by useRegisterSW
  useEffect(() => {
    if (needRefresh && !isReloading.current) {
      isReloading.current = true;
      addToast('در حال بروزرسانی به نسخه جدید...', 'info', TOAST_IDS.UPDATE_AVAILABLE);
      // Small delay for toast to render, then force update
      setTimeout(() => {
        updateServiceWorker(true);
      }, 300);
    }
  }, [needRefresh, updateServiceWorker, addToast]);

  // Listen for SW_UPDATED postMessage from sw.js activate event
  useEffect(() => {
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED' && !isReloading.current) {
        isReloading.current = true;
        console.log('[PWA] SW_UPDATED message received, reloading...');
        addToast('نسخه جدید فعال شد، بارگذاری مجدد...', 'info', TOAST_IDS.UPDATE_AVAILABLE);
        setTimeout(() => window.location.reload(), 1000);
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleSWMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    };
  }, [addToast]);

  // Fallback: Poll version.json to catch edge-cases where SW update detection fails
  useEffect(() => {
    const checkVersion = async () => {
      if (isReloading.current) return;
      try {
        const res = await fetch('/version.json', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const serverVersion = data.version;
        if (serverVersion && serverVersion !== APP_VERSION && !serverVersion.endsWith('-dev')) {
          console.log(`[PWA] Version mismatch: local=${APP_VERSION}, server=${serverVersion}. Forcing reload.`);
          isReloading.current = true;
          addToast('نسخه جدید شناسایی شد، بروزرسانی خودکار...', 'info', TOAST_IDS.UPDATE_AVAILABLE);
          setTimeout(() => window.location.reload(), 1500);
        }
      } catch (err) {
        // Offline or fetch error — ignore silently
      }
    };

    // Initial check after 10s (give app time to fully load)
    const initialTimer = setTimeout(checkVersion, 10_000);
    const intervalId = setInterval(checkVersion, VERSION_POLL_INTERVAL);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalId);
    };
  }, [addToast]);

  return null;
}

export default UpdatePrompt;
