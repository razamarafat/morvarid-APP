
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { User, UserRole } from '../types';

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
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Fetch profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*, farms:user_farms(farm_id)')
          .eq('id', session.user.id)
          .single();

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
    } catch (error) {
      console.error('Session check failed', error);
      set({ user: null, isLoading: false });
    }
  },

  login: async (username, password) => {
    const { loginAttempts, blockUntil } = get();
    
    if (blockUntil && Date.now() < blockUntil) {
      return { success: false, error: 'حساب موقتا مسدود است. لطفا صبر کنید.' };
    }

    // Convert username to email for Supabase
    const email = `${username}@morvarid.app`;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
        get().recordFailedAttempt();
        return { success: false, error: 'نام کاربری یا رمز عبور اشتباه است' };
    }

    if (data.user) {
        get().resetAttempts();
        await get().checkSession();
        return { success: true };
    }
    
    return { success: false, error: 'خطای ناشناخته' };
  },

  logout: async () => {
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
