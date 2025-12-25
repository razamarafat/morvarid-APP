
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { User, UserRole } from '../types';
import { useToastStore } from './toastStore';

const mapLegacyProductId = (id: string): string => {
    if (id === '1') return '11111111-1111-1111-1111-111111111111';
    if (id === '2') return '22222222-2222-2222-2222-222222222222';
    return id;
};

const DEFAULT_PROD_1 = '11111111-1111-1111-1111-111111111111';
const DEFAULT_PROD_2 = '22222222-2222-2222-2222-222222222222';

// 1 Hour in milliseconds
const SESSION_TIMEOUT = 60 * 60 * 1000; 

const STORAGE_KEYS = {
    ACTIVITY: 'morvarid_last_activity',
    USERNAME: 'morvarid_saved_username'
};

interface AuthState {
  user: User | null;
  isLoading: boolean;
  loginAttempts: number;
  blockUntil: number | null;
  savedUsername: string; 
  login: (username: string, password: string, rememberMe: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: (isTimeout?: boolean) => Promise<void>;
  checkSession: () => Promise<void>;
  recordFailedAttempt: () => void;
  resetAttempts: () => void;
  loadSavedUsername: () => void;
  updateActivity: () => void;
  checkInactivity: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  loginAttempts: 0,
  blockUntil: null,
  savedUsername: '',

  loadSavedUsername: () => {
      const saved = localStorage.getItem(STORAGE_KEYS.USERNAME);
      if (saved) set({ savedUsername: saved });
  },

  updateActivity: () => {
      const { user, logout } = get();
      // Only update if user is logged in
      if (user) {
          // SECURITY FIX: Check if session is ALREADY expired before updating.
          // This prevents a race condition where a user interaction (click/touch) 
          // on a resumed app (after 7 hours) updates the timestamp BEFORE the 
          // inactivity check interval runs, effectively reviving a dead session.
          const lastActivityStr = localStorage.getItem(STORAGE_KEYS.ACTIVITY);
          if (lastActivityStr) {
              const lastActivity = parseInt(lastActivityStr);
              const now = Date.now();
              if (now - lastActivity > SESSION_TIMEOUT) {
                  console.warn('[Auth] Session expired during interaction attempt. Logging out.');
                  logout(true); // Force logout immediately
                  return; // CRITICAL: Do NOT update the timestamp
              }
          }
          
          localStorage.setItem(STORAGE_KEYS.ACTIVITY, Date.now().toString());
      }
  },

  checkInactivity: () => {
      const lastActivityStr = localStorage.getItem(STORAGE_KEYS.ACTIVITY);
      
      // If there is a timestamp
      if (lastActivityStr) {
          const lastActivity = parseInt(lastActivityStr);
          const now = Date.now();
          
          // Strict Check: If elapsed time > 1 hour
          if (now - lastActivity > SESSION_TIMEOUT) {
              console.warn('[Auth] Session expired due to inactivity (> 1 hour).');
              // Force logout immediately
              get().logout(true); 
              return true;
          }
      }
      return false;
  },

  checkSession: async () => {
    try {
      // 1. STRICT INACTIVITY CHECK FIRST
      // If the app was closed and re-opened after 7 hours, checkInactivity will catch it here
      // BEFORE we even ask Supabase about the session.
      if (get().checkInactivity()) {
          set({ isLoading: false });
          return;
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
          console.error('Session Check Error:', sessionError);
          // Handle Refresh Token Error specifically
          if (sessionError.message.includes('Refresh Token Not Found') || sessionError.message.includes('Invalid Refresh Token')) {
              await get().logout(false);
          }
          set({ user: null, isLoading: false });
          return;
      }

      // 2. STRICT TIMESTAMP CHECK
      // If Supabase has a session, but we have NO local activity timestamp,
      // it means state is inconsistent (maybe storage cleared, or hacked).
      // We must enforce strict timeout policy.
      const lastActivityStr = localStorage.getItem(STORAGE_KEYS.ACTIVITY);
      if (session?.user && !lastActivityStr) {
          console.warn('[Auth] Valid session found but NO activity timestamp. Forcing logout for security.');
          await get().logout(false);
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
              await get().logout(); // Force logout if inactive
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
          
          // Refresh activity timestamp on successful session check to keep session alive while active
          // Note: updateActivity() now has checks, but here we are confirming session validity, so it's safe to touch.
          localStorage.setItem(STORAGE_KEYS.ACTIVITY, Date.now().toString());
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
        
        // --- Remember Me Logic (Only for Username) ---
        if (rememberMe) {
            localStorage.setItem(STORAGE_KEYS.USERNAME, username);
            set({ savedUsername: username });
        } else {
            localStorage.removeItem(STORAGE_KEYS.USERNAME);
            set({ savedUsername: '' });
        }

        // --- Start Session Timer (Crucial) ---
        localStorage.setItem(STORAGE_KEYS.ACTIVITY, Date.now().toString());

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

  logout: async (isTimeout = false) => {
    // 1. Clear Supabase Session (kills the persistence)
    await supabase.auth.signOut().catch(err => console.error("SignOut error:", err));
    
    // 2. Clear Activity Timer
    localStorage.removeItem(STORAGE_KEYS.ACTIVITY);
    
    // 3. Clear Local User State
    set({ user: null, isLoading: false });
    
    // NOTE: We do NOT clear STORAGE_KEYS.USERNAME here. 
    // This allows "Remember Me" to pre-fill the username on the login page
    // even after a timeout logout.

    if (isTimeout) {
        useToastStore.getState().addToast('مدت زمان نشست شما به پایان رسیده است. لطفا مجددا وارد شوید.', 'warning');
    }
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
