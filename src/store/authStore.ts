
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { User, UserRole } from '../types';
import { useToastStore } from './toastStore';

import { mapLegacyProductId } from '../utils/productUtils';

const DEFAULT_PROD_1 = '11111111-1111-1111-1111-111111111111';
const DEFAULT_PROD_2 = '22222222-2222-2222-2222-222222222222';

// 1 Hour in milliseconds
const SESSION_TIMEOUT = 60 * 60 * 1000;

const STORAGE_KEYS = {
    ACTIVITY: 'morvarid_last_activity',
    REMEMBERED_FLAG: 'morvarid_remember_flag', // Only stores boolean flag
    ENCRYPTED_UID: 'morvarid_encrypted_uid',   // Encrypted username (AES-GCM)
    CRYPTO_IV: 'morvarid_crypto_iv',            // Initialization vector
    LOGIN_ATTEMPTS: 'morvarid_login_attempts',
    BLOCK_UNTIL: 'morvarid_block_until'
};

// --- Secure Crypto Utilities ---
const CRYPTO_KEY_MATERIAL = 'MorvaridSecureKey2024!'; // Salt for key derivation

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
            iterations: 100000,
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
    loadSavedUsername: () => Promise<void>;
    updateActivity: () => void;
    checkInactivity: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    isLoading: true,
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
                // If session exists but no activity record (e.g. cleared storage manually), treat as fresh login or set activity
                // For security, we can reset activity here to keep session alive if token is valid
                localStorage.setItem(STORAGE_KEYS.ACTIVITY, Date.now().toString());
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
                    await get().logout();
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

                // Refresh activity timestamp on successful session check
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

        const cleanUsername = username.trim();
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
            const { data: profile } = await supabase.from('profiles').select('is_active, username').eq('id', loginData.user.id).single();

            if (profile && !profile.is_active) {
                await supabase.auth.signOut();
                return { success: false, error: 'حساب کاربری شما غیرفعال شده است.' };
            }

            get().resetAttempts();

            if (rememberMe) {
                // Encrypt username with AES-GCM before saving
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
        // Preserve Remember Me data (encrypted username) unless explicitly logged out
        const keysToPreserve = [
            STORAGE_KEYS.ENCRYPTED_UID,
            STORAGE_KEYS.CRYPTO_IV,
            STORAGE_KEYS.REMEMBERED_FLAG
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

        set({ user: null, isLoading: false });

        if (isTimeout) {
            useToastStore.getState().addToast('مدت زمان نشست شما به پایان رسیده است. لطفا مجددا وارد شوید.', 'warning');
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
