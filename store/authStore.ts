
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { User, UserRole } from '../types';
import { useLogStore } from './logStore';
import { LOG_CATEGORIES, LOG_LEVELS } from '../constants';

const mapLegacyProductId = (id: string): string => {
    if (id === '1') return '11111111-1111-1111-1111-111111111111';
    if (id === '2') return '22222222-2222-2222-2222-222222222222';
    return id;
};

const DEFAULT_PROD_1 = '11111111-1111-1111-1111-111111111111';
const DEFAULT_PROD_2 = '22222222-2222-2222-2222-222222222222';

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
      if (saved) set({ savedUsername: saved });
  },

  checkSession: async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
          useLogStore.getState().logError('خطا در بررسی نشست کاربری', sessionError);
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
           useLogStore.getState().logError('خطا در دریافت پروفایل کاربر', profileError);
           set({ user: null, isLoading: false });
           return;
      }

      if (profile) {
          if (!profile.is_active) {
              useLogStore.getState().addLog('warn', 'auth', `Inactive user attempted session resume: ${profile.username}`, 'تلاش کاربر غیرفعال برای ادامه نشست');
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

          // FLUSH PENDING LOGS ON SUCCESSFUL RESTORE
          useLogStore.getState().flushPendingLogs();
      }
    } catch (error: any) {
      useLogStore.getState().logError('خطای غیرمنتظره در بررسی نشست', error);
      set({ user: null, isLoading: false });
    }
  },

  login: async (username, password, rememberMe) => {
    const { loginAttempts, blockUntil } = get();
    
    if (blockUntil && Date.now() < blockUntil) {
      useLogStore.getState().addLog('warn', 'security', `Blocked login attempt: ${username}`, 'تلاش ورود به حساب مسدود شده', { attempt: loginAttempts });
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
        useLogStore.getState().addLog('warn', 'auth', `Failed login attempt for ${cleanUsername}`, 'نام کاربری یا رمز عبور اشتباه', { error: loginError?.message });
        return { success: false, error: 'نام کاربری یا رمز عبور اشتباه است' };
    }

    if (loginData.user) {
        const { data: profile } = await supabase.from('profiles').select('is_active').eq('id', loginData.user.id).single();
        
        if (profile && !profile.is_active) {
            await supabase.auth.signOut();
            useLogStore.getState().addLog('warn', 'auth', `Inactive user login blocked: ${username}`, 'ورود حساب غیرفعال مسدود شد', {}, loginData.user.id);
            return { success: false, error: 'حساب کاربری شما غیرفعال شده است.' };
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
            // Log successful login first
            await useLogStore.getState().addLog('info', 'auth', `User logged in: ${currentUser.username}`, 'ورود موفق کاربر به سیستم', { role: currentUser.role }, currentUser.id);
            
            // FLUSH PENDING LOGS
            useLogStore.getState().flushPendingLogs();
            
            return { success: true };
        } else {
             return { success: false, error: 'خطا در دریافت پروفایل' };
        }
    }
    return { success: false, error: 'خطای ناشناخته' };
  },

  logout: async () => {
    const user = get().user;
    if (user) {
        await useLogStore.getState().addLog('info', 'auth', `User logged out: ${user.username}`, 'خروج کاربر از سیستم', {}, user.id);
    }
    await supabase.auth.signOut();
    set({ user: null });
  },

  registerBiometric: () => {
      useLogStore.getState().logUserAction('Biometric Register Request', 'درخواست ثبت بیومتریک');
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
