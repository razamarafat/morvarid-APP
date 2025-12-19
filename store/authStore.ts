
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, UserRole } from '../types';
import { THEMES } from '../constants';

interface AuthState {
  user: User | null;
  token: string | null;
  loginAttempts: number;
  blockUntil: number | null;
  login: (user: User, token: string) => void;
  logout: () => void;
  registerBiometric: () => void;
  recordFailedAttempt: () => void;
  resetAttempts: () => void;
  getThemeColors: (theme: 'light' | 'dark') => any;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      loginAttempts: 0,
      blockUntil: null,
      login: (user, token) => set({ user, token, loginAttempts: 0, blockUntil: null }),
      logout: () => set({ user: null, token: null }),
      registerBiometric: () => set((state) => ({ 
        user: state.user ? { ...state.user, hasBiometric: true } : null 
      })),
      recordFailedAttempt: () => set((state) => {
        const newAttempts = state.loginAttempts + 1;
        if (newAttempts >= 10) {
           return { loginAttempts: newAttempts, blockUntil: Date.now() + 30 * 60 * 1000 }; // 30 mins
        }
        return { loginAttempts: newAttempts };
      }),
      resetAttempts: () => set({ loginAttempts: 0, blockUntil: null }),
      getThemeColors: (theme) => {
        const userRole = get().user?.role || UserRole.ADMIN;
        return THEMES[theme][userRole];
      }
    }),
    {
      name: 'auth-storage',
    }
  )
);
