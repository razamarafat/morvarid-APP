
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { User, UserRole } from '../types';
import { useLogStore } from './logStore';

// Legacy ID mapping helper
const mapLegacyProductId = (id: string): string => {
    if (id === '1') return '11111111-1111-1111-1111-111111111111';
    if (id === '2') return '22222222-2222-2222-2222-222222222222';
    return id;
};

// Default UUIDs for Motefereghe
const DEFAULT_PROD_1 = '11111111-1111-1111-1111-111111111111';
const DEFAULT_PROD_2 = '22222222-2222-2222-2222-222222222222';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  loginAttempts: number;
  blockUntil: number | null;
  savedUsername: string; // For Remember Me
  login: (username: string, password: string, rememberMe: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  recordFailedAttempt: () => void;
  resetAttempts: () => void;
  loadSavedUsername: () => void; // Helper to load from localstorage
  registerBiometric: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  loginAttempts: 0,
  blockUntil: null,
  savedUsername: '',

  loadSavedUsername: () => {
      const saved = localStorage.getItem('morvarid_saved_username');
      if (saved) {
          set({ savedUsername: saved });
      }
  },

  checkSession: async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      // Handle Invalid Refresh Token specifically
      if (sessionError) {
          console.warn('Session check warning:', sessionError.message);
          if (sessionError.message.includes('Refresh Token Not Found') || sessionError.message.includes('Invalid Refresh Token')) {
              await supabase.auth.signOut().catch(() => {}); // Force cleanup
              localStorage.removeItem('sb-bcdyieczslyynvvsfmmm-auth-token'); // Manual cleanup fallback
          }
          set({ user: null, isLoading: false });
          return;
      }

      if (!session?.user) {
          set({ user: null, isLoading: false });
          return;
      }

      if (session?.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*, farms:user_farms(farm_id)')
          .eq('id', session.user.id)
          .single();

        if (profileError) {
             console.error('Profile fetch error:', profileError);
             set({ user: null, isLoading: false });
             return;
        }

        if (profile) {
            // INACTIVE CHECK
            if (!profile.is_active) {
                await supabase.auth.signOut();
                set({ user: null, isLoading: false });
                return;
            }

            let assignedFarms = [];
            if (profile.farms && profile.farms.length > 0) {
                const farmIds = profile.farms.map((f: any) => f.farm_id);
                const { data: farmsData } = await supabase.from('farms').select('*').in('id', farmIds);
                
                assignedFarms = (farmsData || []).map((f: any) => {
                    let pIds = (f.product_ids || []).map(mapLegacyProductId);
                    
                    // FIX: Force default products for MOTEFEREGHE if list is empty
                    if (f.type === 'MOTEFEREGHE' && pIds.length === 0) {
                        pIds = [DEFAULT_PROD_1, DEFAULT_PROD_2];
                    }

                    return {
                        ...f,
                        productIds: pIds
                    };
                });
            }

            set({
                user: {
                    id: profile.id,
                    username: profile.username,
                    fullName: profile.full_name,
                    role: profile.role as UserRole,
                    isActive: profile.is_active,
                    assignedFarms: assignedFarms,
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
      // Fallback cleanup
      set({ user: null, isLoading: false });
    }
  },

  login: async (username, password, rememberMe) => {
    const { loginAttempts, blockUntil } = get();
    
    if (blockUntil && Date.now() < blockUntil) {
      // Use await to ensure log is saved before returning
      await useLogStore.getState().logAction('warn', 'security', `تلاش ورود به حساب مسدود شده: ${username}`, { attempt: loginAttempts }, null);
      return { success: false, error: 'حساب موقتا مسدود است. لطفا صبر کنید.' };
    }

    // VALIDATION: Ensure username has Latin characters
    const cleanUsername = username.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!cleanUsername) {
        return { success: false, error: 'نام کاربری نامعتبر است (لطفا از حروف انگلیسی استفاده کنید)' };
    }

    const domains = ['morvarid.app', 'morvarid.com', 'morvarid-system.com'];
    let loginData = null;
    let loginError = null;

    for (const domain of domains) {
        const email = `${cleanUsername}@${domain}`;
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (!error && data.user) {
            loginData = data;
            loginError = null;
            break; 
        } else {
            loginError = error;
        }
    }

    if (loginError || !loginData) {
        get().recordFailedAttempt();
        // IMPORTANT: Pass 'null' for userId, NOT 'ANONYMOUS' or empty string
        await useLogStore.getState().logAction(
            'warn', 
            'auth', 
            `تلاش ناموفق ورود برای ${cleanUsername}`, 
            { error: loginError?.message }, 
            null
        );
        return { success: false, error: 'نام کاربری یا رمز عبور اشتباه است' };
    }

    if (loginData.user) {
        // Fetch profile to check active status immediately
        const { data: profile } = await supabase.from('profiles').select('is_active').eq('id', loginData.user.id).single();
        
        if (profile && !profile.is_active) {
            await supabase.auth.signOut();
            await useLogStore.getState().logAction('warn', 'auth', `کاربر غیرفعال تلاش برای ورود کرد: ${username}`, {}, loginData.user.id);
            return { success: false, error: 'حساب کاربری شما غیرفعال شده است. با مدیر تماس بگیرید.' };
        }

        get().resetAttempts();
        
        if (rememberMe) {
            localStorage.setItem('morvarid_saved_username', username);
            set({ savedUsername: username });
        } else {
            localStorage.removeItem('morvarid_saved_username');
            set({ savedUsername: '' });
        }

        await get().checkSession();
        const currentUser = get().user;
        if (currentUser) {
            // Log successful login with explicit user ID and await it
            await useLogStore.getState().logAction(
                'info', 
                'auth', 
                `کاربر ${currentUser.fullName} با موفقیت وارد شد.`, 
                { role: currentUser.role }, 
                currentUser.id
            );
            return { success: true };
        } else {
             return { success: false, error: 'حساب کاربری یافت نشد (پروفایل ناقص)' };
        }
    }
    
    return { success: false, error: 'خطای ناشناخته' };
  },

  logout: async () => {
    const user = get().user;
    if (user) {
        // Await the log before signing out
        await useLogStore.getState().logAction('info', 'auth', `کاربر ${user.fullName} خارج شد.`, {}, user.id);
    }
    await supabase.auth.signOut();
    set({ user: null });
  },

  registerBiometric: () => {
      console.log('Biometric registration requested');
  },

  recordFailedAttempt: () => set((state) => {
    const newAttempts = state.loginAttempts + 1;
    if (newAttempts >= 5) {
       return { loginAttempts: newAttempts, blockUntil: Date.now() + 15 * 60 * 1000 };
    }
    return { loginAttempts: newAttempts };
  }),

  resetAttempts: () => set({ loginAttempts: 0, blockUntil: null }),
}));
