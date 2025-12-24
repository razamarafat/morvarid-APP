
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { User, UserRole } from '../types';

const mapLegacyProductId = (id: string): string => {
    if (id === '1') return '11111111-1111-1111-1111-111111111111';
    if (id === '2') return '22222222-2222-2222-2222-222222222222';
    return id;
};

const DEFAULT_PROD_1 = '11111111-1111-1111-1111-111111111111';
const DEFAULT_PROD_2 = '22222222-2222-2222-2222-222222222222';

// 2 Hours in milliseconds
const SESSION_DURATION = 2 * 60 * 60 * 1000; 

interface AuthState {
  user: User | null;
  isLoading: boolean;
  loginAttempts: number;
  blockUntil: number | null;
  savedUsername: string; 
  login: (username: string, password: string, rememberMe: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  recordFailedAttempt: () => void;
  resetAttempts: () => void;
  loadSavedUsername: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  loginAttempts: 0,
  blockUntil: null,
  savedUsername: '',

  loadSavedUsername: () => {
      const saved = localStorage.getItem('morvarid_saved_username');
      if (saved) set({ savedUsername: saved });
  },

  checkSession: async () => {
    try {
      // 1. Check Custom 2-Hour Expiration Logic
      const lastLoginStr = localStorage.getItem('morvarid_last_login_time');
      if (lastLoginStr) {
          const lastLoginTime = parseInt(lastLoginStr);
          const now = Date.now();
          
          if (now - lastLoginTime > SESSION_DURATION) {
              // Session Expired
              console.log('Session expired (2 hours limit). Logging out...');
              await get().logout(); 
              return; // Stop execution
          }
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
          console.error('Session Check Error:', sessionError);
          if (sessionError.message.includes('Refresh Token Not Found')) {
              await supabase.auth.signOut().catch(() => {});
              localStorage.removeItem('sb-bcdyieczslyynvvsfmmm-auth-token');
          }
          set({ user: null, isLoading: false });
          return;
      }

      if (!session?.user) {
          set({ user: null, isLoading: false });
          return;
      }

      const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*, farms:user_farms(farm_id)')
          .eq('id', session.user.id)
          .single();

      if (profileError) {
           console.error('Profile Fetch Error:', profileError);
           set({ user: null, isLoading: false });
           return;
      }

      if (profile) {
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
                  if (f.type === 'MOTEFEREGHE' && pIds.length === 0) {
                      pIds = [DEFAULT_PROD_1, DEFAULT_PROD_2];
                  }
                  return { ...f, productIds: pIds };
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
      }
    } catch (error: any) {
      console.error('Unexpected Auth Error:', error);
      set({ user: null, isLoading: false });
    }
  },

  login: async (username, password, rememberMe) => {
    const { loginAttempts, blockUntil } = get();
    
    if (blockUntil && Date.now() < blockUntil) {
      return { success: false, error: 'حساب موقتا مسدود است. لطفا صبر کنید.' };
    }

    const cleanUsername = username.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!cleanUsername) return { success: false, error: 'نام کاربری نامعتبر است' };

    const domains = ['morvarid.app', 'morvarid.com', 'morvarid-system.com'];
    let loginData = null;
    let loginError = null;

    for (const domain of domains) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: `${cleanUsername}@${domain}`,
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
        return { success: false, error: 'نام کاربری یا رمز عبور اشتباه است' };
    }

    if (loginData.user) {
        const { data: profile } = await supabase.from('profiles').select('is_active').eq('id', loginData.user.id).single();
        
        if (profile && !profile.is_active) {
            await supabase.auth.signOut();
            return { success: false, error: 'حساب کاربری شما غیرفعال شده است.' };
        }

        get().resetAttempts();
        
        // --- Remember Me Logic ---
        if (rememberMe) {
            localStorage.setItem('morvarid_saved_username', username);
            set({ savedUsername: username });
        } else {
            localStorage.removeItem('morvarid_saved_username');
            set({ savedUsername: '' });
        }

        // --- 2 Hour Session Timer Start ---
        localStorage.setItem('morvarid_last_login_time', Date.now().toString());

        await get().checkSession();
        const currentUser = get().user;
        if (currentUser) {
            return { success: true };
        } else {
             return { success: false, error: 'خطا در دریافت پروفایل' };
        }
    }
    return { success: false, error: 'خطای ناشناخته' };
  },

  logout: async () => {
    await supabase.auth.signOut();
    // Do NOT remove 'morvarid_saved_username' here so it persists for the login page
    localStorage.removeItem('morvarid_last_login_time');
    set({ user: null });
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
