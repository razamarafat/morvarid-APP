
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { User, UserRole } from '../types';
import { useToastStore } from './toastStore';
import { TOAST_IDS } from '../constants';

import { mapLegacyProductId } from '../utils/productUtils';
import { notifyEvent } from '../services/pushNotificationService';

const DEFAULT_PROD_1 = '11111111-1111-1111-1111-111111111111';
const DEFAULT_PROD_2 = '22222222-2222-2222-2222-222222222222';

import { CONFIG } from '../constants/config';

// Use configurable session timeout from config
const SESSION_TIMEOUT = CONFIG.SECURITY.SESSION_TIMEOUT;

export const STORAGE_KEYS = {
    ACTIVITY: 'morvarid_last_activity',
    // Sentinel: PRESENCE == user ticked "Remember Me" on last login. ABSENCE
    // == one-off session. Read by App.tsx on `pagehide` to decide whether to
    // scrub the Supabase auth tokens (so the user is logged out on tab close).
    // This boolean is the ONLY non-Supabase thing we keep; no credentials.
    REMEMBER_ME_SESSION: 'morvarid_remember_me_session',
    LOGIN_ATTEMPTS: 'morvarid_login_attempts',
    BLOCK_UNTIL: 'morvarid_block_until',
};

// --- Migration scrub for legacy credential-equivalent keys (SECURITY) ---
//
// Older builds of this app stored PBKDF2 password hashes + AES-GCM encrypted
// usernames in localStorage to support offline login. That is a credential-
// equivalent vector (PBKDF2 output is reversible via brute force). We now
// delegate ALL credential storage to Supabase's built-in JWT cache, which
// uses HttpOnly-style opaque tokens, server-rotatable refresh tokens, and
// can be revoked from the Supabase dashboard.
//
// When the module is imported, we IMMEDIATELY scrub any keys that match the
// legacy schema so a returning user with a stale localStorage is healed
// before any code path can read them.
if (typeof localStorage !== 'undefined') {
    const LEGACY_KEYS = [
        // Pb-credential equivalents (DANGEROUS)
        'morvarid_offline_pw_hash',
        'morvarid_offline_pw_salt',
        'morvarid_offline_profile',
        'morvarid_offline_profile_iv',
        // Legacy encrypted-username keys (no longer needed; browser autofill
        // handles username pre-fill via `autoComplete="username"` + password
        // manager).
        'morvarid_encrypted_uid',
        'morvarid_crypto_iv',
        'morvarid_remember_flag',
        'morvarid_saved_uid', // older legacy
    ];
    for (const k of LEGACY_KEYS) {
        if (localStorage.getItem(k) !== null) {
            localStorage.removeItem(k);
        }
    }
}

interface AuthState {
    user: User | null;
    isLoading: boolean;
    /**
     * @deprecated SECURITY (2026-06): Offline-cache path removed. The
     * legacy PBKDF2 + AES-GCM profile cache has been deleted. This field
     * is kept only to avoid breaking any subscribers; ALWAYS false.
     * Do NOT reintroduce offline-session logic — session must be held
     * in Supabase's JWT only.
     */
    isOfflineSession: boolean;
    loginAttempts: number;
    blockUntil: number | null;
    savedUsername: string;
    login: (username: string, password: string, rememberMe: boolean) => Promise<{ success: boolean; error?: string }>;
    logout: (isTimeout?: boolean) => Promise<void>;
    checkSession: () => Promise<void>;
    recordFailedAttempt: () => void;
    resetAttempts: () => void;
    loadSavedUsername: () => Promise<void>;
    updateActivity: () => void;
    checkInactivity: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    isLoading: true,
    // @deprecated see AuthState.isOfflineSession — keep false.
    isOfflineSession: false,
    loginAttempts: parseInt(localStorage.getItem('morvarid_login_attempts') || '0'),
    blockUntil: localStorage.getItem('morvarid_block_until') ? parseInt(localStorage.getItem('morvarid_block_until')!) : null,
    savedUsername: '',

    loadSavedUsername: async () => {
        // Username pre-fill is now fully delegated to the browser/OS password
        // manager via the `autoComplete="username"` HTML attribute on the login
        // form input. Browsers (Chrome/Safari/Edge/Samsung Keychain/Apple
        // iCloud Keychain) will surface the previously saved username on next
        // page load without us touching localStorage at all.
        //
        // The legacy decrypted-username storage has been scrubbed by the
        // migration block at top-of-file. We no longer read anything from
        // localStorage for this purpose — the browser owns it.
        set({ savedUsername: '' });
    },

    updateActivity: () => {
        const { user, logout } = get();
        if (user) {
            // SECURITY (2026-06): ADMIN USERS ARE EXEMPT FROM THE 1-HOUR
            // INACTIVITY TIMEOUT. Admins are trusted operators on shared
            // devices and stay signed-in across idle periods per the
            // product business rule. Their activity stamp is still
            // refreshed (so audit/dashboards that read this stamp stay
            // accurate), but we skip the timeout-comparison branch.
            const isAdmin = user.role === UserRole.ADMIN;
            const lastActivityStr = localStorage.getItem(STORAGE_KEYS.ACTIVITY);
            if (lastActivityStr && !isAdmin) {
                const lastActivity = parseInt(lastActivityStr);
                const now = Date.now();
                if (now - lastActivity > SESSION_TIMEOUT) {
                    console.warn('[Auth] Session expired during interaction attempt. Logging out.');
                    logout(true);
                    return;
                }
            }
            localStorage.setItem(STORAGE_KEYS.ACTIVITY, Date.now().toString());
        }
    },

    checkInactivity: () => {
        const { user } = get();
        // SECURITY (2026-06): ADMIN USERS ARE EXEMPT FROM THE 1-HOUR
        // INACTIVITY TIMEOUT. If there is no user OR the user is an
        // admin, App.tsx's setInterval short-circuits here.
        if (!user || user.role === UserRole.ADMIN) {
            return false;
        }
        const lastActivityStr = localStorage.getItem(STORAGE_KEYS.ACTIVITY);
        if (lastActivityStr) {
            const lastActivity = parseInt(lastActivityStr);
            const now = Date.now();
            if (now - lastActivity > SESSION_TIMEOUT) {
                console.warn('[Auth] Session expired due to inactivity (> 1 hour).');
                get().logout(true);
                return true;
            }
        }
        return false;
    },

    checkSession: async () => {
        try {
            if (get().checkInactivity()) {
                set({ isLoading: false });
                return;
            }

            // SECURITY: No offline credential/path. We only trust Supabase's
            // built-in JWT session. If the network is down, the user must
            // reconnect before any dashboard access is granted.
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError) {
                const errMsg = sessionError.message || '';

                if (
                    errMsg.includes('Refresh Token Not Found') ||
                    errMsg.includes('Invalid Refresh Token') ||
                    errMsg.includes('not found')
                ) {
                    console.warn('[Auth] Refresh token invalid or not found. Forcing cleanup.');
                    await get().logout(false);
                    return;
                }

                console.error('Session Check Error:', sessionError);
                set({ user: null, isLoading: false });
                return;
            }

            const lastActivityStr = localStorage.getItem(STORAGE_KEYS.ACTIVITY);
            if (session?.user && !lastActivityStr) {
                localStorage.setItem(STORAGE_KEYS.ACTIVITY, Date.now().toString());
            }

            if (!session?.user) {
                set({ user: null, isLoading: false });
                return;
            }

            let { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*, farms:user_farms(farm_id)')
                .eq('id', session.user.id)
                .single();

            if (profileError) {
                console.error('Profile Fetch Error:', profileError);

                // Handle specific network errors
                if (profileError.message?.includes('locked') ||
                    profileError.message?.includes('net::ERR_FAILED') ||
                    profileError.code === '401') {
                    console.warn('[Auth] Network or auth error, attempting to refresh session');
                    const { error: refreshError } = await supabase.auth.refreshSession();
                    if (!refreshError) {
                        const retryResult = await supabase
                            .from('profiles')
                            .select('*, farms:user_farms(farm_id)')
                            .eq('id', session.user.id)
                            .single();

                        if (!retryResult.error && retryResult.data) {
                            profile = retryResult.data;
                            profileError = retryResult.error;
                        }
                    }
                }

                if (profileError) {
                    // SECURITY (2026-06): No offline-cache fallback exists
                    // anymore (was removed along with the PBKDF2 password
                    // hash + AES-GCM encrypted profile). The user must have
                    // connectivity for dashboard access to be granted.
                    console.error('[Auth] Profile fetch failed and no offline cache available.');
                    await get().logout(false);
                    return;
                }
            }

            if (profile) {
                if (!profile.is_active) {
                    await get().logout();
                    return;
                }

                let assignedFarms: any[] = [];
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

                    if (profile.role !== UserRole.ADMIN && assignedFarms.length > 0) {
                        const allInactive = assignedFarms.every((f: any) => !f.is_active);
                        if (allInactive) {
                            console.warn('[Auth] User blocked: All assigned farms are inactive.');
                            await get().logout();
                            return;
                        }
                    }
                }

                const userObj: User = {
                    id: profile.id,
                    username: profile.username,
                    fullName: profile.full_name,
                    role: profile.role as UserRole,
                    isActive: profile.is_active,
                    assignedFarms: assignedFarms,
                    phoneNumber: profile.phone_number
                };

                set({
                    user: userObj,
                    isLoading: false,
                    isOfflineSession: false
                });

                // Refresh activity timestamp on successful session check
                localStorage.setItem(STORAGE_KEYS.ACTIVITY, Date.now().toString());

                // SECURITY (2026-06): No offline-profile cache write.
                // Removed. Session is held ENTIRELY in Supabase's JWT.
            }
        } catch (error: any) {
            console.error('Unexpected Auth Error:', error);
            // SECURITY (2026-06): No offline-cache fallback exists.
            // Removed.
            set({ user: null, isLoading: false, isOfflineSession: false });
        }
    },

    login: async (username, password, rememberMe) => {
        const { loginAttempts, blockUntil } = get();

        if (blockUntil && Date.now() < blockUntil) {
            return { success: false, error: 'حساب موقتا مسدود است. لطفا صبر کنید.' };
        }

        const cleanUsername = username.trim();
        if (!cleanUsername) return { success: false, error: 'نام کاربری نامعتبر است' };

        // SECURITY (2026-06): No offline-credential path. The password is sent
        // directly to Supabase over HTTPS and is never stored, cached, or
        // hashed on this device. Session persistence is handled ENTIRELY by
        // Supabase's built-in localStorage-managed JWT (rotate-able, server-
        // revocable, NOT a credential that's brute-forceable).

        const domains = ['morvarid.app', 'morvarid.com', 'morvarid-system.com'];
        let loginData = null;
        let loginError: any = null;

        for (const domain of domains) {
            try {
                const signInPromise = supabase.auth.signInWithPassword({
                    email: `${cleanUsername}@${domain}`,
                    password,
                });

                const timeoutPromise = new Promise<{ data: any, error: any }>((resolve) =>
                    setTimeout(() => resolve({ data: { user: null }, error: { message: 'Network Timeout', isNetworkError: true } }), 10000)
                );

                const { data, error } = await Promise.race([signInPromise, timeoutPromise]);

                if (!error && data?.user) {
                    loginData = data;
                    loginError = null;
                    break;
                } else {
                    loginError = error;
                    const isNetworkErr = error?.isNetworkError || error?.message?.includes('fetch') || error?.message?.includes('Failed to fetch') || error?.status === 0;
                    if (isNetworkErr) break;
                }
            } catch (err: any) {
                loginError = err;
                const isNetworkErr = err?.isNetworkError || err?.message?.includes('fetch') || err?.message?.includes('Failed to fetch') || err?.status === 0;
                if (isNetworkErr) break;
            }
        }

        if (loginError || !loginData) {
            // Any error: simply refuse. No offline path. The user must retry
            // when connectivity is restored.
            get().recordFailedAttempt();
            const isNetworkErr =
                loginError?.isNetworkError ||
                loginError?.message?.includes('fetch') ||
                loginError?.message?.includes('network') ||
                loginError?.message?.includes('Failed to fetch') ||
                loginError?.message?.includes('Timeout') ||
                loginError?.status === 0;
            if (isNetworkErr) {
                return { success: false, error: 'اینترنت متصل نیست. لطفاً اتصال خود را بررسی و دوباره تلاش کنید.' };
            }
            return { success: false, error: 'نام کاربری یا رمز عبور اشتباه است' };
        }

        // --- SUCCESSFUL ONLINE LOGIN PROCESSING ---
        if (loginData?.user) {
            try {
                const { data: profile, error: profileError } = await supabase.from('profiles').select('is_active, username, role').eq('id', loginData.user.id).single();

                if (profileError) {
                    console.warn('[Auth] Profile fetch failed:', profileError);
                    if (profileError.message?.includes('fetch') || profileError.message?.includes('network')) {
                        await supabase.auth.signOut();
                        return { success: false, error: 'اینترنت قطع شد. لطفاً دوباره تلاش کنید.' };
                    }
                }

                if (profile && !profile.is_active) {
                    await supabase.auth.signOut();
                    return { success: false, error: 'حساب کاربری شما غیرفعال شده است.' };
                }

                // Check if user's farms are active
                if (profile && profile.role !== UserRole.ADMIN) {
                    const { data: userFarms, error: farmsError } = await supabase
                        .from('user_farms')
                        .select('farm_id, farms:farms(is_active)')
                        .eq('user_id', loginData.user.id);

                    if (farmsError) {
                        if (farmsError.message?.includes('fetch') || farmsError.message?.includes('network')) {
                            await supabase.auth.signOut();
                            return { success: false, error: 'اینترنت قطع شد. لطفاً دوباره تلاش کنید.' };
                        }
                    }

                    if (userFarms && userFarms.length > 0) {
                        const allInactive = userFarms.every((uf: any) => !uf.farms?.is_active);
                        if (allInactive) {
                            await supabase.auth.signOut();
                            return { success: false, error: 'فارم شما غیرفعال شده است و امکان ورود وجود ندارد.' };
                        }
                    }
                }

                get().resetAttempts();

                // SECURITY (2026-06):
                //   - supabase.auth (configured with persistSession:true in
                //     src/lib/supabase.ts) ALREADY persists the JWT in
                //     localStorage. So "Remember Me" is ON by default with
                //     Supabase's secure storage.
                //   - When "Remember Me" is UNCHECKED, we mark an explicit
                //     sentinel below. App.tsx reads this on the `pagehide`
                //     event to scrub Supabase's auth tokens so the user is
                //     logged out on tab close.
                //   - We deliberately store NO credentials and NO username in
                //     localStorage. Browser-native password manager (Chrome,
                //     Safari, iCloud Keychain, Samsung Pass) handles username
                //     + password pre-fill via the HTML `autoComplete`
                //     attributes on the login form.
                if (rememberMe) {
                    localStorage.setItem(STORAGE_KEYS.REMEMBER_ME_SESSION, '1');
                } else {
                    localStorage.removeItem(STORAGE_KEYS.REMEMBER_ME_SESSION);
                }

                localStorage.setItem(STORAGE_KEYS.ACTIVITY, Date.now().toString());

                await get().checkSession();
                const currentUser = get().user;
                if (currentUser) {
                    notifyEvent('login', { user: currentUser.fullName });
                    set({ isOfflineSession: false });
                    return { success: true };
                } else {
                    return { success: false, error: 'خطا در دریافت پروفایل' };
                }
            } catch (err) {
                console.warn('[Auth] Unexpected error during online profile fetch', err);
                await supabase.auth.signOut();
                return { success: false, error: 'خطای غیرمنتظره. لطفاً دوباره تلاش کنید.' };
            }
        }
        return { success: false, error: 'خطای ناشناخته' };
    },

    logout: async (isTimeout = false) => {
        try {
            const { user } = get();
            if (user && navigator.onLine) {
                await supabase.from('push_subscriptions')
                    .delete()
                    .match({ user_id: user.id, user_agent: navigator.userAgent });
            }
        } catch (e) {
            console.warn("[Auth] Failed to remove push subscription on logout", e);
        }

        try {
            await supabase.auth.signOut();
        } catch (err) {
            console.warn("SignOut warning (token likely invalid):", err);
        }

        // Aggressively clear ALL Supabase tokens and App data from localStorage.
        // SECURITY (2026-06): Nothing credentials-related is preserved.
        const keysToPreserve = [
            STORAGE_KEYS.REMEMBER_ME_SESSION, // just a UI boolean preference
        ];

        Object.keys(localStorage).forEach(key => {
            if (
                (key.startsWith('sb-') && key.endsWith('-auth-token')) ||
                key === STORAGE_KEYS.ACTIVITY ||
                (key.startsWith('morvarid_') && !keysToPreserve.includes(key))
            ) {
                localStorage.removeItem(key);
            }
        });

        set({ user: null, isLoading: false, isOfflineSession: false, savedUsername: '' });

        // Notify logout event
        notifyEvent('logout', { isTimeout });

        if (isTimeout) {
            // SECURITY (2026-06): The 1-Hour Inactivity Timer flow uses
            // an activity-specific Persian message instead of the generic
            // session-expired string. The user lands on /login with empty
            // inputs; the browser's native password manager then pre-fills
            // the credentials (autoComplete="username" + "current-password")
            // for a one-click re-entry. No password is ever stored.
            useToastStore.getState().addToast('به دلیل عدم فعالیت، از سیستم خارج شدید', 'warning', TOAST_IDS.INACTIVITY_LOGOUT);
        }
    },

    recordFailedAttempt: () => set((state) => {
        const newAttempts = state.loginAttempts + 1;
        localStorage.setItem(STORAGE_KEYS.LOGIN_ATTEMPTS, String(newAttempts));

        if (newAttempts >= 5) {
            const blockTime = Date.now() + 15 * 60 * 1000;
            localStorage.setItem(STORAGE_KEYS.BLOCK_UNTIL, String(blockTime));
            return { loginAttempts: newAttempts, blockUntil: blockTime };
        }
        return { loginAttempts: newAttempts };
    }),

    resetAttempts: () => {
        localStorage.removeItem(STORAGE_KEYS.LOGIN_ATTEMPTS);
        localStorage.removeItem(STORAGE_KEYS.BLOCK_UNTIL);
        set({ loginAttempts: 0, blockUntil: null });
    },
}));
