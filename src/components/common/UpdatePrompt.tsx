// src/components/common/UpdatePrompt.tsx
import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToastStore } from '@/store/toastStore';
import { TOAST_IDS } from '@/constants';

/**
 * This component handles the PWA update lifecycle.
 * When a new version of the app is available, it will automatically
 * refresh the page to ensure the user is on the latest version.
 */
function UpdatePrompt() {
  const addToast = useToastStore((state) => state.addToast);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      if (r) {
        console.log(`[PWA] Service Worker registered: ${r}`);
      }
    },
    onRegisterError(error: Error) {
      console.error('[PWA] Service Worker registration error:', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      // Show a toast message to inform the user (with fixed ID to prevent duplicates)
      addToast('در حال بروزرسانی به نسخه جدید...', 'info', TOAST_IDS.UPDATE_AVAILABLE);

      // Automatically update and refresh the page after a delay
      const updateTimeout = setTimeout(() => {
        updateServiceWorker(true);
      }, 3000); // 3-second delay

      return () => clearTimeout(updateTimeout);
    }
  }, [needRefresh, updateServiceWorker, addToast]);

  // This component does not render anything to the DOM
  return null;
}

export default UpdatePrompt;
