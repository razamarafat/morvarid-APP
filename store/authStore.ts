
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { User, UserRole } from '../types';
import { useLogStore } from './logStore';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  loginAttempts: number;
  blockUntil: number | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  registerBiometric: () => void;
  recordFailedAttempt: () => void;
  resetAttempts: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  loginAttempts: 0,
  blockUntil: null,

  checkSession: async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
          useLogStore.getState().addLog('error', 'auth', `Session check error: ${sessionError.message}`);
      }

      if (session?.user) {
        // Fetch profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*, farms:user_farms(farm_id)')
          .eq('id', session.user.id)
          .single();

        if (profileError) {
             useLogStore.getState().addLog('error', 'database', `Profile fetch failed for ${session.user.id}: ${profileError.message}`);
        }

        if (profile) {
            // Fetch assigned farms details if any
            let assignedFarms = [];
            if (profile.farms && profile.farms.length > 0) {
                const farmIds = profile.farms.map((f: any) => f.farm_id);
                const { data: farmsData } = await supabase.from('farms').select('*').in('id', farmIds);
                // Parse product_ids from jsonb
                assignedFarms = (farmsData || []).map((f: any) => ({
                    ...f,
                    productIds: f.product_ids
                }));
            }

            set({
                user: {
                    id: profile.id,
                    username: profile.username,
                    fullName: profile.full_name,
                    role: profile.role as UserRole,
                    isActive: profile.is_active,
                    assignedFarms: assignedFarms,
                    // Extra fields mapped
                    phoneNumber: profile.phone_number
                },
                isLoading: false
            });
            return;
        }
      }
      set({ user: null, isLoading: false });
    } catch (error: any) {
      console.error('Session check failed', error);
      useLogStore.getState().addLog('error', 'auth', `Session check exception: ${error.message}`);
      set({ user: null, isLoading: false });
    }
  },

  login: async (username, password) => {
    const { loginAttempts, blockUntil } = get();
    useLogStore.getState().addLog('info', 'auth', `Login attempt for user: ${username}`);
    
    if (blockUntil && Date.now() < blockUntil) {
      useLogStore.getState().addLog('warn', 'security', `Blocked login attempt for ${username}`);
      return { success: false, error: 'حساب موقتا مسدود است. لطفا صبر کنید.' };
    }

    // Convert username to email for Supabase logic
    const email = `${username}@morvarid.app`;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
        get().recordFailedAttempt();
        useLogStore.getState().addLog('warn', 'auth', `Login failed for ${username}: ${error.message}`);
        return { success: false, error: 'نام کاربری یا رمز عبور اشتباه است' };
    }

    if (data.user) {
        get().resetAttempts();
        await get().checkSession();
        useLogStore.getState().addLog('info', 'auth', `User ${username} logged in successfully`, data.user.id);
        return { success: true };
    }
    
    return { success: false, error: 'خطای ناشناخته' };
  },

  logout: async () => {
    const user = get().user;
    useLogStore.getState().addLog('info', 'auth', `User logged out`, user?.id);
    await supabase.auth.signOut();
    set({ user: null });
  },

  registerBiometric: () => set((state) => ({ 
    user: state.user ? { ...state.user, hasBiometric: true } : null 
  })),

  recordFailedAttempt: () => set((state) => {
    const newAttempts = state.loginAttempts + 1;
    if (newAttempts >= 5) {
       return { loginAttempts: newAttempts, blockUntil: Date.now() + 15 * 60 * 1000 }; // 15 mins block
    }
    return { loginAttempts: newAttempts };
  }),

  resetAttempts: () => set({ loginAttempts: 0, blockUntil: null }),
}));
