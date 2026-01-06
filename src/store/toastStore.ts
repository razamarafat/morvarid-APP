
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  fixedId?: string; // Optional fixed ID for deduplication
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type: ToastType, fixedId?: string) => void;
  removeToast: (id: string) => void;
  dismissByFixedId: (fixedId: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  addToast: (message, type, fixedId) => {
    const state = get();

    // If a fixedId is provided, check for existing toast with same fixedId
    if (fixedId) {
      const existingToast = state.toasts.find(t => t.fixedId === fixedId);
      if (existingToast) {
        // Update existing toast instead of creating new one
        set((state) => ({
          toasts: state.toasts.map(t =>
            t.fixedId === fixedId
              ? { ...t, message, type } // Update message and type, keep same id and timeout
              : t
          )
        }));
        return;
      }
    }

    // Create new toast (with or without fixedId)
    const id = uuidv4();
    const newToast: Toast = { id, message, type, ...(fixedId && { fixedId }) };

    set((state) => ({ toasts: [...state.toasts, newToast] }));

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  dismissByFixedId: (fixedId) => set((state) => ({
    toasts: state.toasts.filter((t) => t.fixedId !== fixedId)
  })),
}));
