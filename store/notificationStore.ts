
import { create } from 'zustand';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
}

interface NotificationState {
  confirmState: ConfirmOptions & { isOpen: boolean };
  resolvePromise: ((value: boolean) => void) | null;
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
  handleConfirm: () => void;
  handleCancel: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  confirmState: {
    isOpen: false,
    message: '',
  },
  resolvePromise: null,
  showConfirm: (options) => {
    return new Promise<boolean>((resolve) => {
      set({
        confirmState: { ...options, isOpen: true },
        resolvePromise: resolve,
      });
    });
  },
  handleConfirm: () => {
    set((state) => {
      state.resolvePromise?.(true);
      return { confirmState: { isOpen: false, message: '' }, resolvePromise: null };
    });
  },
  handleCancel: () => {
    set((state) => {
      state.resolvePromise?.(false);
      return { confirmState: { isOpen: false, message: '' }, resolvePromise: null };
    });
  },
}));
