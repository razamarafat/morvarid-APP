
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type PermissionType = 'notifications' | 'clipboard-read';
export type PermissionStatusCustom = 'granted' | 'denied' | 'prompt' | 'unknown';

interface PermissionState {
  permissions: Record<PermissionType, PermissionStatusCustom>;
  hasCheckedInitial: boolean;
  setPermissionStatus: (type: PermissionType, status: PermissionStatusCustom) => void;
  setHasCheckedInitial: (value: boolean) => void;
  checkPermission: (type: PermissionType) => Promise<PermissionStatusCustom>;
  requestPermission: (type: PermissionType) => Promise<boolean>;
  resetInitialCheck: () => void;
}

export const usePermissionStore = create<PermissionState>()(
  persist(
    (set, get) => ({
      permissions: {
        'notifications': 'unknown',
        'clipboard-read': 'unknown'
      },
      hasCheckedInitial: false,

      setPermissionStatus: (type, status) => 
        set(state => ({ permissions: { ...state.permissions, [type]: status } })),

      setHasCheckedInitial: (value) => set({ hasCheckedInitial: value }),

      resetInitialCheck: () => set({ hasCheckedInitial: false }),

      checkPermission: async (type) => {
        try {
          if (type === 'notifications') {
            if (!("Notification" in window)) return 'denied';
            // Notification.permission is synchronous
            const status = Notification.permission === 'default' ? 'prompt' : Notification.permission;
            get().setPermissionStatus(type, status as PermissionStatusCustom);
            return status as PermissionStatusCustom;
          }
          
          if (type === 'clipboard-read') {
            if (!navigator.permissions || !navigator.permissions.query) return 'unknown';
            const result = await navigator.permissions.query({ name: 'clipboard-read' as any });
            get().setPermissionStatus(type, result.state as PermissionStatusCustom);
            
            // Listen for changes
            result.onchange = () => {
                get().setPermissionStatus(type, result.state as PermissionStatusCustom);
            };
            
            return result.state as PermissionStatusCustom;
          }

          return 'unknown';
        } catch (e) {
          console.warn(`[Permission] Check failed for ${type}`, e);
          return 'unknown';
        }
      },

      requestPermission: async (type) => {
        try {
          if (type === 'notifications') {
            if (!("Notification" in window)) return false;
            const result = await Notification.requestPermission();
            get().setPermissionStatus(type, result === 'default' ? 'prompt' : result);
            return result === 'granted';
          }

          if (type === 'clipboard-read') {
            // Clipboard read cannot be requested directly via an API call returning a promise in the same way.
            // It usually triggers on first read access.
            // However, we can try a dummy read if we are inside a user gesture context (which this function should be called from).
            try {
                await navigator.clipboard.readText();
                get().setPermissionStatus(type, 'granted');
                return true;
            } catch (err) {
                // If denied, it throws NotAllowedError
                // If dismissed, it might throw or just return empty
                get().checkPermission(type); // Re-check status
                return false;
            }
          }

          return false;
        } catch (e) {
          console.error(`[Permission] Request failed for ${type}`, e);
          return false;
        }
      }
    }),
    {
      name: 'morvarid-permissions',
      storage: createJSONStorage(() => sessionStorage), // Use SessionStorage so we re-check on new tab/session
      partialize: (state) => ({ hasCheckedInitial: state.hasCheckedInitial }), // Only persist if we checked initial
    }
  )
);
