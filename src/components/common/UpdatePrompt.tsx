// src/components/common/UpdatePrompt.tsx
import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToastStore } from '@/store/toastStore';
import { TOAST_IDS } from '@/constants';

/**
 * PWA Service Worker Registration & Auto-Update
 * ===============================================
 * Responsibilities:
 * 1. Register SW via vite-plugin-pwa
 * 2. Periodically check for SW updates (every 60s)
 * 3. On needRefresh → auto-update SW (Workbox handles cache invalidation)
 * 
 * NOTE: version.json polling is handled by useAutoUpdate hook.
 * This component does NOT do its own version polling to avoid duplication.
 * 
 * Anti-loop guard: sessionStorage key prevents multiple reloads for the same SW.
 */

const SW_CHECK_INTERVAL = 60 * 1000; // 60 seconds
const SW_RELOAD_GUARD_KEY = 'morvarid_sw_updated_at';

function UpdatePrompt() {
  const addToast = useToastStore((state) => state.addToast);
  const isReloading = useRef(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      if (r) {
        console.log('[PWA] SW registered.');
        // Periodic SW update check
        setInterval(() => {
          if (!isReloading.current) {
            r.update().catch(() => { });
          }
        }, SW_CHECK_INTERVAL);
      }
    },
    onRegisterError(error: Error) {
      console.error('[PWA] SW registration error:', error);
    },
    onNeedRefresh() {
      console.log('[PWA] New SW available.');
    },
    onOfflineReady() {
      console.log('[PWA] App ready for offline use.');
    },
  });

  // Auto-update when needRefresh fires — with anti-loop guard
  useEffect(() => {
    if (needRefresh && !isReloading.current) {
      // Anti-loop: only reload if we haven't already done so recently (within 30s)
      const lastUpdate = sessionStorage.getItem(SW_RELOAD_GUARD_KEY);
      const now = Date.now();
      if (lastUpdate && now - parseInt(lastUpdate, 10) < 30_000) {
        console.log('[PWA] Skipping reload — already reloaded recently.');
        return;
      }

      isReloading.current = true;
      sessionStorage.setItem(SW_RELOAD_GUARD_KEY, String(now));
      addToast('در حال بروزرسانی...', 'info', TOAST_IDS.UPDATE_AVAILABLE);
      // Let Workbox activate the new SW, which triggers page reload
      setTimeout(() => {
        updateServiceWorker(true);
      }, 500);
    }
  }, [needRefresh, updateServiceWorker, addToast]);

  return null;
}

export default UpdatePrompt;
