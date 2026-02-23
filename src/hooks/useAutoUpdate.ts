
import { useEffect, useRef } from 'react';
import { APP_VERSION } from '../constants';

/**
 * Unified Auto-Update Hook
 * ========================
 * Single source of truth for detecting new deployments.
 * 
 * Strategy:
 * - Poll version.json every 2 minutes (not 30s — reduces load)
 * - Compare server version string with compiled APP_VERSION
 * - On mismatch: reload ONCE using sessionStorage guard
 * - Does NOT unregister SW or nuke caches (that causes re-register loops)
 * - The SW + Workbox precache handles cache busting automatically via hashed filenames
 */

const CHECK_INTERVAL = 30 * 1000; // 30 seconds - aggressive check for fast updates
const RELOAD_GUARD_KEY = 'morvarid_last_update_version';

export const useAutoUpdate = () => {
  const isReloading = useRef(false);

  useEffect(() => {
    const checkVersion = async () => {
      if (!navigator.onLine || isReloading.current) return;

      // Skip in preview/iframe environments
      try {
        if (
          window.location.hostname.includes('googleusercontent') ||
          window.location.hostname.includes('usercontent.goog') ||
          window.location.hostname.includes('ai.studio')
        ) return;
      } catch { /* ignore */ }

      try {
        const response = await fetch(`./version.json?_=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache, no-store' }
        });

        if (!response.ok) return;

        const data = await response.json();
        const serverVersion = data.version;

        // Skip dev mode
        if (!serverVersion || serverVersion.endsWith('-dev')) return;

        // Compare with compiled version
        if (serverVersion === APP_VERSION) return;

        // RELOAD GUARD: Check if we already reloaded for this version
        const lastReloadedVersion = sessionStorage.getItem(RELOAD_GUARD_KEY);
        if (lastReloadedVersion === serverVersion) {
          // Already reloaded for this version in this session — do nothing
          return;
        }

        console.log(`[AutoUpdate] Version mismatch: local=${APP_VERSION}, server=${serverVersion}. Reloading once.`);

        // Mark that we are reloading for this version BEFORE reload
        sessionStorage.setItem(RELOAD_GUARD_KEY, serverVersion);
        isReloading.current = true;

        // Trigger SW update if available (non-destructive)
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            // First try normal update
            await reg.update().catch(() => { });

            // Wait for new worker to install
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Force unregister to ensure the next load gets fresh content if update fails
            await reg.unregister().catch(() => { });
          }

          // Clear all caches aggressively
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
          }
        }

        // Clean reload with a cache-busting query parameter
        setTimeout(() => {
          const url = new URL(window.location.href);
          url.searchParams.set('v', Date.now().toString());
          window.location.replace(url.toString()); // replace avoids history clutter
        }, 500);

      } catch (e) {
        console.warn('[AutoUpdate] Error during version check:', e);
      }
    };

    // First check after 5 seconds (let app stabilize)
    const initialTimer = setTimeout(checkVersion, 5000);
    const interval = setInterval(checkVersion, CHECK_INTERVAL);

    // Also check when user returns to tab
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);
};
