
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

const STORAGE_KEYS = {
    ACTIVITY: 'morvarid_last_activity',
    REMEMBERED_FLAG: 'morvarid_remember_flag', // Only stores boolean flag
    ENCRYPTED_UID: 'morvarid_encrypted_uid',   // Encrypted username (AES-GCM)
    CRYPTO_IV: 'morvarid_crypto_iv',            // Initialization vector
    LOGIN_ATTEMPTS: 'morvarid_login_attempts',
    BLOCK_UNTIL: 'morvarid_block_until',
    // --- Offline Auth Keys ---
    OFFLINE_PROFILE: 'morvarid_offline_profile',   // AES-GCM encrypted user profile JSON
    OFFLINE_PROFILE_IV: 'morvarid_offline_profile_iv',
    OFFLINE_PW_HASH: 'morvarid_offline_pw_hash',   // PBKDF2 password hash (base64)
    OFFLINE_PW_SALT: 'morvarid_offline_pw_salt',   // Random salt for password hash (base64)
};

// --- Secure Crypto Utilities ---
const CRYPTO_KEY_MATERIAL = import.meta.env.VITE_CRYPTO_SALT || (() => {
    console.error('🔥 CRITICAL: VITE_CRYPTO_SALT not configured!');
    throw new Error('Crypto salt missing - check .env configuration');
})(); // Secure salt from environment

const getCryptoKey = async (): Promise<CryptoKey> => {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(CRYPTO_KEY_MATERIAL),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode('morvarid_salt_v1'),
            iterations: 100000, // CONFIG.SECURITY.PBKDF2_ITERATIONS
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
};

const encryptUsername = async (username: string): Promise<{ encrypted: string; iv: string } | null> => {
    try {
        const encoder = new TextEncoder();
        const key = await getCryptoKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            encoder.encode(username)
        );
        return {
            encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
            iv: btoa(String.fromCharCode(...iv))
        };
    } catch (e) {
        console.error('[Auth] Encryption failed:', e);
        return null;
    }
};

const decryptUsername = async (encryptedData: string, ivData: string): Promise<string | null> => {
    try {
        const key = await getCryptoKey();
        const encrypted = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
        const iv = Uint8Array.from(atob(ivData), c => c.charCodeAt(0));
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            encrypted
        );
        return new TextDecoder().decode(decrypted);
    } catch (e) {
        console.error('[Auth] Decryption failed:', e);
        return null;
    }
};

// --- Offline Auth: Encrypt/Decrypt Profile ---
const encryptData = async (data: string): Promise<{ encrypted: string; iv: string } | null> => {
    try {
        const encoder = new TextEncoder();
        const key = await getCryptoKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            encoder.encode(data)
        );
        return {
            encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
            iv: btoa(String.fromCharCode(...iv))
        };
    } catch (e) {
        console.error('[OfflineAuth] Encrypt data failed:', e);
        return null;
    }
};

const decryptData = async (encryptedData: string, ivData: string): Promise<string | null> => {
    try {
        const key = await getCryptoKey();
        const encrypted = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
        const iv = Uint8Array.from(atob(ivData), c => c.charCodeAt(0));
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            encrypted
        );
        return new TextDecoder().decode(decrypted);
    } catch (e) {
        console.error('[OfflineAuth] Decrypt data failed:', e);
        return null;
    }
};

// --- Offline Auth: Password Hashing with PBKDF2 ---
const hashPasswordForOffline = async (password: string, salt?: Uint8Array): Promise<{ hash: string; salt: string } | null> => {
    try {
        const encoder = new TextEncoder();
        const passwordSalt = salt || crypto.getRandomValues(new Uint8Array(16));
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveBits']
        );
        const hashBits = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: passwordSalt.buffer as ArrayBuffer,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            256
        );
        return {
            hash: btoa(String.fromCharCode(...new Uint8Array(hashBits))),
            salt: btoa(String.fromCharCode(...passwordSalt))
        };
    } catch (e) {
        console.error('[OfflineAuth] Password hash failed:', e);
        return null;
    }
};

const verifyPasswordOffline = async (password: string, storedHash: string, storedSalt: string): Promise<boolean> => {
    try {
        const salt = Uint8Array.from(atob(storedSalt), c => c.charCodeAt(0));
        const result = await hashPasswordForOffline(password, salt);
        if (!result) return false;
        return result.hash === storedHash;
    } catch (e) {
        console.error('[OfflineAuth] Password verify failed:', e);
        return false;
    }
};

// --- Offline Auth: Cache/Restore User Profile ---
const cacheUserProfileForOffline = async (user: User, password: string): Promise<void> => {
    try {
        // 1. Encrypt and store user profile
        const profileJson = JSON.stringify(user);
        const encryptedProfile = await encryptData(profileJson);
        if (encryptedProfile) {
            localStorage.setItem(STORAGE_KEYS.OFFLINE_PROFILE, encryptedProfile.encrypted);
            localStorage.setItem(STORAGE_KEYS.OFFLINE_PROFILE_IV, encryptedProfile.iv);
        }

        // 2. Hash and store password
        const pwHash = await hashPasswordForOffline(password);
        if (pwHash) {
            localStorage.setItem(STORAGE_KEYS.OFFLINE_PW_HASH, pwHash.hash);
            localStorage.setItem(STORAGE_KEYS.OFFLINE_PW_SALT, pwHash.salt);
        }

        console.log('[OfflineAuth] User profile cached for offline access.');
    } catch (e) {
        console.error('[OfflineAuth] Failed to cache profile:', e);
    }
};

const restoreCachedProfile = async (): Promise<User | null> => {
    try {
        const encryptedProfile = localStorage.getItem(STORAGE_KEYS.OFFLINE_PROFILE);
        const profileIv = localStorage.getItem(STORAGE_KEYS.OFFLINE_PROFILE_IV);
        if (!encryptedProfile || !profileIv) return null;

        const profileJson = await decryptData(encryptedProfile, profileIv);
        if (!profileJson) return null;

        const user = JSON.parse(profileJson) as User;
        console.log('[OfflineAuth] Restored cached profile for:', user.username);
        return user;
    } catch (e) {
        console.error('[OfflineAuth] Failed to restore cached profile:', e);
        return null;
    }
};

const clearOfflineCache = () => {
    localStorage.removeItem(STORAGE_KEYS.OFFLINE_PROFILE);
    localStorage.removeItem(STORAGE_KEYS.OFFLINE_PROFILE_IV);
    localStorage.removeItem(STORAGE_KEYS.OFFLINE_PW_HASH);
    localStorage.removeItem(STORAGE_KEYS.OFFLINE_PW_SALT);
};

// --- Helper: Check if offline auth data is available ---
const hasOfflineCredentials = (): boolean => {
    return !!(
        localStorage.getItem(STORAGE_KEYS.OFFLINE_PROFILE) &&
        localStorage.getItem(STORAGE_KEYS.OFFLINE_PW_HASH) &&
        localStorage.getItem(STORAGE_KEYS.OFFLINE_PW_SALT)
    );
};

interface AuthState {
    user: User | null;
    isLoading: boolean;
    isOfflineSession: boolean; // NEW: indicates offline-restored session
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
    isOfflineSession: false,
    loginAttempts: parseInt(localStorage.getItem('morvarid_login_attempts') || '0'),
    blockUntil: localStorage.getItem('morvarid_block_until') ? parseInt(localStorage.getItem('morvarid_block_until')!) : null,
    savedUsername: '',

    loadSavedUsername: async () => {
        const isRemembered = localStorage.getItem(STORAGE_KEYS.REMEMBERED_FLAG) === 'true';
        if (!isRemembered) {
            set({ savedUsername: '' });
            return;
        }

        const encryptedData = localStorage.getItem(STORAGE_KEYS.ENCRYPTED_UID);
        const ivData = localStorage.getItem(STORAGE_KEYS.CRYPTO_IV);

        if (encryptedData && ivData) {
            const decrypted = await decryptUsername(encryptedData, ivData);
            if (decrypted) {
                set({ savedUsername: decrypted });
                return;
            }
        }

        // Migration: Try old btoa format and migrate
        const legacySaved = localStorage.getItem('morvarid_saved_uid');
        if (legacySaved) {
            try {
                const decoded = atob(legacySaved);
                set({ savedUsername: decoded });
                // Migrate to new secure format
                const encrypted = await encryptUsername(decoded);
                if (encrypted) {
                    localStorage.setItem(STORAGE_KEYS.ENCRYPTED_UID, encrypted.encrypted);
                    localStorage.setItem(STORAGE_KEYS.CRYPTO_IV, encrypted.iv);
                    localStorage.setItem(STORAGE_KEYS.REMEMBERED_FLAG, 'true');
                }
                localStorage.removeItem('morvarid_saved_uid'); // Remove old format
            } catch {
                set({ savedUsername: '' });
            }
        }
    },

    updateActivity: () => {
        const { user, logout } = get();
        if (user) {
            const lastActivityStr = localStorage.getItem(STORAGE_KEYS.ACTIVITY);
            if (lastActivityStr) {
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

            // --- OFFLINE FALLBACK ---
            // If we're offline, try to restore the cached profile immediately
            if (!navigator.onLine) {
                const cachedUser = await restoreCachedProfile();
                if (cachedUser) {
                    console.log('[Auth] Offline mode: Restored cached profile.');
                    set({
                        user: cachedUser,
                        isLoading: false,
                        isOfflineSession: true
                    });
                    localStorage.setItem(STORAGE_KEYS.ACTIVITY, Date.now().toString());
                    return;
                }
                // No cached profile — user must login online first
                set({ user: null, isLoading: false });
                return;
            }

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

                // Network error during session check — try offline fallback
                if (errMsg.includes('fetch') || errMsg.includes('network') || errMsg.includes('Failed to fetch')) {
                    const cachedUser = await restoreCachedProfile();
                    if (cachedUser) {
                        console.log('[Auth] Network error during session check, using cached profile.');
                        set({ user: cachedUser, isLoading: false, isOfflineSession: true });
                        localStorage.setItem(STORAGE_KEYS.ACTIVITY, Date.now().toString());
                        return;
                    }
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
                    // Last resort offline fallback
                    const cachedUser = await restoreCachedProfile();
                    if (cachedUser) {
                        console.log('[Auth] Profile fetch failed, using cached profile.');
                        set({ user: cachedUser, isLoading: false, isOfflineSession: true });
                        return;
                    }
                    set({ user: null, isLoading: false });
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

                // Update the offline cache with latest profile data silently
                // (password stays unchanged — only refreshed on login)
                if (hasOfflineCredentials()) {
                    const profileJson = JSON.stringify(userObj);
                    encryptData(profileJson).then(enc => {
                        if (enc) {
                            localStorage.setItem(STORAGE_KEYS.OFFLINE_PROFILE, enc.encrypted);
                            localStorage.setItem(STORAGE_KEYS.OFFLINE_PROFILE_IV, enc.iv);
                        }
                    }).catch(() => { });
                }
            }
        } catch (error: any) {
            console.error('Unexpected Auth Error:', error);
            // Offline fallback on unexpected errors
            const cachedUser = await restoreCachedProfile();
            if (cachedUser && !navigator.onLine) {
                set({ user: cachedUser, isLoading: false, isOfflineSession: true });
                return;
            }
            set({ user: null, isLoading: false });
        }
    },

    login: async (username, password, rememberMe) => {
        const { loginAttempts, blockUntil } = get();

        if (blockUntil && Date.now() < blockUntil) {
            return { success: false, error: 'حساب موقتا مسدود است. لطفا صبر کنید.' };
        }

        const cleanUsername = username.trim();
        if (!cleanUsername) return { success: false, error: 'نام کاربری نامعتبر است' };

        // --- OFFLINE LOGIN PATH ---
        if (!navigator.onLine) {
            // Check if we have cached credentials
            const storedHash = localStorage.getItem(STORAGE_KEYS.OFFLINE_PW_HASH);
            const storedSalt = localStorage.getItem(STORAGE_KEYS.OFFLINE_PW_SALT);

            if (!storedHash || !storedSalt) {
                return { success: false, error: 'اینترنت متصل نیست و اطلاعات ورود آفلاین موجود نیست. لطفاً ابتدا یکبار با اینترنت وارد شوید.' };
            }

            // Verify password against stored hash
            const isValid = await verifyPasswordOffline(password, storedHash, storedSalt);
            if (!isValid) {
                get().recordFailedAttempt();
                return { success: false, error: 'رمز عبور اشتباه است' };
            }

            // Restore cached profile
            const cachedUser = await restoreCachedProfile();
            if (!cachedUser) {
                return { success: false, error: 'اطلاعات پروفایل آفلاین معتبر نیست. لطفاً با اینترنت وارد شوید.' };
            }

            // Verify username matches cached profile
            if (cachedUser.username !== cleanUsername) {
                get().recordFailedAttempt();
                return { success: false, error: 'نام کاربری یا رمز عبور اشتباه است' };
            }

            get().resetAttempts();

            // Handle remember me
            if (rememberMe) {
                const encrypted = await encryptUsername(cleanUsername);
                if (encrypted) {
                    localStorage.setItem(STORAGE_KEYS.ENCRYPTED_UID, encrypted.encrypted);
                    localStorage.setItem(STORAGE_KEYS.CRYPTO_IV, encrypted.iv);
                    localStorage.setItem(STORAGE_KEYS.REMEMBERED_FLAG, 'true');
                }
                set({ savedUsername: cleanUsername });
            }

            localStorage.setItem(STORAGE_KEYS.ACTIVITY, Date.now().toString());

            set({
                user: cachedUser,
                isLoading: false,
                isOfflineSession: true
            });

            console.log('[OfflineAuth] Offline login successful for:', cleanUsername);
            return { success: true };
        }

        // --- ONLINE LOGIN PATH (existing logic) ---
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
            const { data: profile } = await supabase.from('profiles').select('is_active, username, role').eq('id', loginData.user.id).single();

            if (profile && !profile.is_active) {
                await supabase.auth.signOut();
                return { success: false, error: 'حساب کاربری شما غیرفعال شده است.' };
            }

            // Check if user's farms are active
            if (profile && profile.role !== UserRole.ADMIN) {
                const { data: userFarms } = await supabase
                    .from('user_farms')
                    .select('farm_id, farms:farms(is_active)')
                    .eq('user_id', loginData.user.id);

                if (userFarms && userFarms.length > 0) {
                    const allInactive = userFarms.every((uf: any) => !uf.farms?.is_active);
                    if (allInactive) {
                        await supabase.auth.signOut();
                        return { success: false, error: 'فارم شما غیرفعال شده است و امکان ورود وجود ندارد.' };
                    }
                }
            }

            get().resetAttempts();

            if (rememberMe) {
                const encrypted = await encryptUsername(cleanUsername);
                if (encrypted) {
                    localStorage.setItem(STORAGE_KEYS.ENCRYPTED_UID, encrypted.encrypted);
                    localStorage.setItem(STORAGE_KEYS.CRYPTO_IV, encrypted.iv);
                    localStorage.setItem(STORAGE_KEYS.REMEMBERED_FLAG, 'true');
                }
                set({ savedUsername: cleanUsername });
            } else {
                localStorage.removeItem(STORAGE_KEYS.ENCRYPTED_UID);
                localStorage.removeItem(STORAGE_KEYS.CRYPTO_IV);
                localStorage.removeItem(STORAGE_KEYS.REMEMBERED_FLAG);
                localStorage.removeItem('morvarid_saved_uid'); // Clean legacy
                set({ savedUsername: '' });
            }

            localStorage.setItem(STORAGE_KEYS.ACTIVITY, Date.now().toString());

            await get().checkSession();
            const currentUser = get().user;
            if (currentUser) {
                // --- Cache for offline use (always, regardless of rememberMe) ---
                await cacheUserProfileForOffline(currentUser, password);

                // Notify successful login
                notifyEvent('login', { user: currentUser.fullName });
                set({ isOfflineSession: false });
                return { success: true };
            } else {
                return { success: false, error: 'خطا در دریافت پروفایل' };
            }
        }
        return { success: false, error: 'خطای ناشناخته' };
    },

    logout: async (isTimeout = false) => {
        try {
            await supabase.auth.signOut();
        } catch (err) {
            console.warn("SignOut warning (token likely invalid):", err);
        }

        // Aggressively clear ALL Supabase tokens and App data from localStorage
        // Preserve Remember Me data AND Offline Auth data
        const keysToPreserve = [
            STORAGE_KEYS.ENCRYPTED_UID,
            STORAGE_KEYS.CRYPTO_IV,
            STORAGE_KEYS.REMEMBERED_FLAG,
            // Keep offline credentials so user can log back in offline
            STORAGE_KEYS.OFFLINE_PROFILE,
            STORAGE_KEYS.OFFLINE_PROFILE_IV,
            STORAGE_KEYS.OFFLINE_PW_HASH,
            STORAGE_KEYS.OFFLINE_PW_SALT,
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

        set({ user: null, isLoading: false, isOfflineSession: false });

        // Notify logout event
        notifyEvent('logout', { isTimeout });

        if (isTimeout) {
            useToastStore.getState().addToast('مدت زمان نشست شما به پایان رسیده است. لطفا مجددا وارد شوید.', 'warning', TOAST_IDS.SESSION_EXPIRED);
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
