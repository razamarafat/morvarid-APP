
import { create } from 'zustand';
import { supabase, supabaseUrl } from '../lib/supabase';
import { User, UserRole } from '../types';
import { useToastStore } from './toastStore';
import { CONFIG } from '../constants/config';

import { mapLegacyProductId } from '../utils/productUtils';

// Security: Generate a random string for initial passwords if not provided
const generateSecurePassword = (length = 12): string => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let retVal = "";
    if (window.crypto && window.crypto.getRandomValues) {
        const values = new Uint32Array(length);
        window.crypto.getRandomValues(values);
        for (let i = 0; i < length; i++) {
            retVal += charset[values[i] % charset.length];
        }
    } else {
        // Fallback for older browsers (less secure but functional)
        for (let i = 0, n = charset.length; i < length; ++i) {
            retVal += charset.charAt(Math.floor(Math.random() * n));
        }
    }
    return retVal;
};

interface UserState {
    users: User[];
    isLoading: boolean;
    fetchUsers: () => Promise<void>;
    addUser: (user: Omit<User, 'id'> & { password?: string }) => Promise<{ success: boolean; error?: string; password?: string }>;
    updateUser: (user: User) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;
    /**
     * 20260620 — Admin reads the plain-text `visible_password` for every
     * user from the SEC-DEF RPC `admin_list_visible_passwords`. Used by the
     * Admin User Management panel to render the toggleable password
     * column. Returns `{ [userId]: plaintextPassword }` keyed by user id.
     * Empty password string `''` is preserved when an account has no
     * password vault entry yet (e.g. a user whose record predates the
     * 20260620 migration but who hasn't changed password since).
     */
    adminListVisiblePasswords: () => Promise<Record<string, string>>;
    /**
     * 20260620 — Admin overwrites any user's password via Edge Function
     * `reset-user-password` (which calls auth.admin.updateUserById + the
     * SEC-DEF RPC `admin_set_visible_password` so the vault stays in
     * sync). Surfaces the Persian error verbatim on failure.
     */
    adminResetUserPassword: (targetUserId: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

export const useUserStore = create<UserState>((set, get) => ({
    users: [],
    isLoading: false,

    fetchUsers: async () => {
        set({ isLoading: true });
        try {
            const { data: profiles, error: profilesError } = await supabase.from('profiles').select('*');
            if (profilesError) throw profilesError;

            const { data: userFarmsData, error: userFarmsError } = await supabase.from('user_farms').select('user_id, farm_id');
            if (userFarmsError) console.warn("Error fetching user_farms:", userFarmsError);

            if (profiles) {
                const { data: allFarms } = await supabase.from('farms').select('*');
                const mappedUsers = profiles.map((p: any) => {
                    const assignedFarmIds = userFarmsData
                        ? userFarmsData.filter((uf: any) => uf.user_id === p.id).map((uf: any) => uf.farm_id)
                        : [];

                    const assignedFarms = allFarms
                        ? allFarms.filter((f: any) => assignedFarmIds.includes(f.id)).map((f: any) => ({
                            ...f,
                            productIds: (f.product_ids || []).map(mapLegacyProductId)
                        }))
                        : [];

                    return {
                        id: p.id,
                        username: p.username,
                        fullName: p.full_name,
                        role: p.role as UserRole,
                        isActive: p.is_active,
                        phoneNumber: p.phone_number,
                        createdAt: p.created_at,
                        assignedFarms: assignedFarms
                    };
                });
                set({ users: mappedUsers, isLoading: false });
            } else {
                set({ isLoading: false });
            }
        } catch (error: any) {
            console.error('Fetch Users Failed:', error);
            set({ isLoading: false });
        }
    },

    addUser: async (userData) => {
        const rawUsername = userData.username || '';
        const sanitizedUsername = rawUsername.trim();

        if (!sanitizedUsername || sanitizedUsername.length < 3) {
            useToastStore.getState().addToast('نام کاربری باید شامل حداقل ۳ کاراکتر باشد', 'error');
            return { success: false, error: 'نام کاربری کوتاه است' };
        }

        // 🚨 SECURITY: PASSWORD HANDLING
        // Security: enforce Supabase min_password_length (8 chars) BEFORE the
        // Edge Function round-trip so a short user-typed password is caught
        // here with a clear Persian error instead of bubbling up as a generic
        // backend error. Defence-in-depth: the Edge Function ALSO validates.
        const passwordMinLength = CONFIG.BUSINESS.MIN_PASSWORD_LENGTH;
        if (userData.password && userData.password.length < passwordMinLength) {
            useToastStore.getState().addToast(`رمز عبور باید حداقل ${passwordMinLength} کاراکتر باشد`, 'error');
            return { success: false, error: 'PASSWORD_TOO_SHORT' };
        }
        const isAutoGenerated = !userData.password;
        const password = userData.password || generateSecurePassword(16);

        set({ isLoading: true });
        try {
            // Get the current session token for authenticating the edge function call
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                useToastStore.getState().addToast('نشست شما منقضی شده است. لطفاً دوباره وارد شوید.', 'error');
                return { success: false, error: 'No valid session' };
            }

            // Build email from username (matching the RPC convention)
            const email = `${sanitizedUsername}@morvarid.com`;

            // Call the Edge Function (uses service_role to create auth users)
            const response = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    password,
                    username: sanitizedUsername,
                    full_name: userData.fullName,
                    role: userData.role,
                    phone_number: userData.phoneNumber || null,
                }),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                console.error('Edge Function Create User Error:', result);
                if (result.error?.includes('Access Denied')) {
                    useToastStore.getState().addToast('شما دسترسی لازم برای ساخت کاربر را ندارید.', 'error');
                } else if (result.error === 'PASSWORD_TOO_SHORT' || result.error?.includes('رمز عبور باید حداقل')) {
                    // Forward the server-supplied Persian error verbatim — the
                    // generic prefix would be redundant since the message is
                    // already self-descriptive.
                    useToastStore.getState().addToast(result.error, 'error');
                } else if (result.error?.includes('قبلاً')) {
                    useToastStore.getState().addToast(result.error, 'error');
                } else {
                    useToastStore.getState().addToast(`خطا در ساخت کاربر: ${result.error || 'خطای ناشناخته'}`, 'error');
                }
                return { success: false, error: result.error || 'Unknown error' };
            }

            const newUserId = result.user_id;
            if (newUserId) {
                // Handle farm assignments
                if (userData.assignedFarms && userData.assignedFarms.length > 0) {
                    const inserts = userData.assignedFarms.map(f => ({ user_id: newUserId, farm_id: f.id }));
                    await supabase.from('user_farms').insert(inserts);
                }

                useToastStore.getState().addToast(`کاربر ${userData.fullName} با موفقیت ایجاد شد`, 'success');

                // Refresh user list
                await get().fetchUsers();

                // Return password to UI for display
                return { success: true, password: isAutoGenerated ? password : undefined };
            }
            return { success: false, error: 'User ID missing from response' };

        } catch (err: any) {
            console.error('User Add Exception:', err);
            useToastStore.getState().addToast(`خطای غیرمنتظره: ${err.message}`, 'error');
            return { success: false, error: err.message };
        } finally {
            set({ isLoading: false });
        }
    },

    updateUser: async (user) => {
        set({ isLoading: true });
        try {
            const { error: profileError } = await supabase.from('profiles').update({
                username: user.username,
                full_name: user.fullName,
                role: user.role,
                is_active: user.isActive,
                phone_number: user.phoneNumber
            }).eq('id', user.id);

            if (profileError) throw profileError;

            const { error: deleteError } = await supabase.from('user_farms').delete().eq('user_id', user.id);
            if (!deleteError && user.assignedFarms && user.assignedFarms.length > 0) {
                const inserts = user.assignedFarms.map(f => ({ user_id: user.id, farm_id: f.id }));
                await supabase.from('user_farms').insert(inserts);
            }
            useToastStore.getState().addToast('ویرایش کاربر با موفقیت ثبت شد', 'success');
        } catch (error: any) {
            console.error('User Update Failed:', error);
            if (error.code === '23505') {
                useToastStore.getState().addToast('این نام کاربری قبلاً استفاده شده است.', 'error');
            } else {
                useToastStore.getState().addToast(`خطا در ویرایش کاربر: ${error.message}`, 'error');
            }
        } finally {
            await get().fetchUsers();
            set({ isLoading: false });
        }
    },

    deleteUser: async (userId) => {
        set({ isLoading: true });
        try {
            // SECURITY: Use Secure RPC instead of direct table update
            const { error } = await supabase.rpc('soft_delete_user', {
                target_user_id: userId
            });

            if (error) {
                if (error.message.includes('Access Denied')) {
                    throw new Error('شما دسترسی لازم برای حذف کاربر را ندارید.');
                }
                if (error.message.includes('own account')) {
                    throw new Error('شما نمی‌توانید حساب کاربری خودتان را غیرفعال کنید.');
                }
                throw error;
            }

            useToastStore.getState().addToast('کاربر با موفقیت غیرفعال شد.', 'success');
        } catch (error: any) {
            console.error('User Delete Failed:', error);
            useToastStore.getState().addToast(`خطا در حذف کاربر: ${error.message || error.details || 'خطای ناشناخته'}`, 'error');
        } finally {
            await get().fetchUsers();
            set({ isLoading: false });
        }
    },

    // 20260620 — Admin reads all visible_passwords via SEC-DEF RPC. Returns
    // a `[userId → plaintext]` map. UI consumer is the Admin User Management
    // password column (toggleable reveal).
    adminListVisiblePasswords: async () => {
        try {
            const { data, error } = await supabase.rpc('admin_list_visible_passwords');
            if (error) {
                if (error.message?.includes('FORBIDDEN') || error.message?.includes('admin only')) {
                    useToastStore.getState().addToast('شما دسترسی لازم برای مشاهده رمز عبور کاربران را ندارید.', 'error');
                }
                console.error('[UserStore] admin_list_visible_passwords failed:', error);
                return {};
            }
            const map: Record<string, string> = {};
            if (Array.isArray(data)) {
                for (const row of data) {
                    if (row?.id) {
                        map[row.id as string] = (row?.visible_password ?? '') as string;
                    }
                }
            }
            return map;
        } catch (err: any) {
            console.error('[UserStore] adminListVisiblePasswords exception:', err);
            return {};
        }
    },

    // 20260620 — Admin password reset via Edge Function orchestrator. The
    // Edge Function calls auth.admin.updateUserById + RPC admin_set_visible_password
    // in sequence so the auth password and the vault entry stay in lock-step.
    adminResetUserPassword: async (targetUserId, newPassword) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                return { success: false, error: 'نشست شما منقضی شده است. لطفاً دوباره وارد شوید.' };
            }

            const response = await fetch(`${supabaseUrl}/functions/v1/reset-user-password`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ target_user_id: targetUserId, new_password: newPassword }),
            });

            const result = await response.json().catch(() => ({ success: false, error: 'پاسخ نامعتبر از سرور.' }));

            if (!response.ok || !result.success) {
                console.error('[UserStore] reset-user-password EF failed:', result);
                return { success: false, error: result.error || 'تغییر رمز عبور ناموفق بود.' };
            }
            return { success: true };
        } catch (err: any) {
            console.error('[UserStore] adminResetUserPassword exception:', err);
            const isNet = err?.isNetworkError || err?.message?.includes('fetch') || err?.message?.includes('Failed to fetch');
            if (isNet) {
                useToastStore.getState().addToast('اینترنت متصل نیست. لطفاً دوباره تلاش کنید.', 'error');
            }
            return { success: false, error: err.message || 'خطای غیرمنتظره.' };
        }
    }
}));
