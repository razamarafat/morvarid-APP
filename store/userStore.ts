
import { create, StoreApi, UseBoundStore } from 'zustand';
import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { User, UserRole } from '../types';
import { useLogStore } from './logStore';
import { useToastStore } from './toastStore';

interface UserState {
  users: User[];
  isLoading: boolean;
  fetchUsers: () => Promise<void>;
  addUser: (user: Omit<User, 'id'>) => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  users: [],
  isLoading: false,

  fetchUsers: async () => {
      set({ isLoading: true });
      const { data: profiles, error } = await supabase.from('profiles').select('*, farms:user_farms(farm_id)');
      
      if (error) {
           useLogStore.getState().addLog('error', 'database', `Fetch Users Failed: ${error.message}`);
           set({ isLoading: false });
           return;
      }

      if (profiles) {
          const { data: allFarms } = await supabase.from('farms').select('*');
          
          const mappedUsers = profiles.map((p: any) => {
              const assignedFarmIds = p.farms ? p.farms.map((f: any) => f.farm_id) : [];
              const assignedFarms = allFarms ? allFarms.filter((f: any) => assignedFarmIds.includes(f.id)).map((f:any) => ({...f, productIds: f.product_ids})) : [];

              return {
                  id: p.id,
                  username: p.username,
                  fullName: p.full_name,
                  role: p.role as UserRole,
                  isActive: p.is_active,
                  phoneNumber: p.phone_number,
                  assignedFarms: assignedFarms
              };
          });
          set({ users: mappedUsers, isLoading: false });
      } else {
          set({ isLoading: false });
      }
  },

  addUser: async (userData) => {
      const currentAdmin = (await supabase.auth.getUser()).data.user;
      
      const rawUsername = userData.username;
      const sanitizedUsername = rawUsername.toLowerCase().replace(/[^a-z0-9]/g, '');
      // UPDATED: Use morvarid.app to match admin domain
      const email = `${sanitizedUsername}@morvarid.app`; 
      const password = userData.password || 'Morvarid1234';

      useLogStore.getState().addLog('info', 'auth', `Creating user: '${sanitizedUsername}' | Pass Length: ${password.length}`, currentAdmin?.id);

      if (sanitizedUsername.length < 3) {
          useToastStore.getState().addToast('نام کاربری نامعتبر است (حداقل ۳ کاراکتر انگلیسی)', 'error');
          return;
      }

      set({ isLoading: true });

      try {
          // Create Isolated Client with Memory Storage to avoid logging out admin
          const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, {
              auth: {
                  persistSession: false,
                  autoRefreshToken: false,
                  detectSessionInUrl: false,
                  storage: {
                      getItem: () => null,
                      setItem: () => {},
                      removeItem: () => {},
                  }
              }
          });

          const { data, error } = await tempSupabase.auth.signUp({
              email: email,
              password: password,
              options: {
                  data: {
                      username: sanitizedUsername,
                      full_name: userData.fullName,
                      role: userData.role
                  }
              }
          });

          if (error) {
              const errorDetails = JSON.stringify({ message: error.message, status: error.status });
              useLogStore.getState().addLog('error', 'auth', `SIGNUP_FAIL: ${errorDetails}`, currentAdmin?.id);
              useToastStore.getState().addToast(`خطا در ساخت کاربر: ${error.message}`, 'error');
              return;
          }

          if (data.user) {
              // Create Profile
              const { error: profileError } = await supabase.from('profiles').insert({
                  id: data.user.id,
                  username: sanitizedUsername,
                  full_name: userData.fullName,
                  role: userData.role,
                  is_active: userData.isActive,
                  phone_number: userData.phoneNumber
              });

              if (profileError) {
                  useLogStore.getState().addLog('error', 'database', `PROFILE_FAIL: ${profileError.message}`, currentAdmin?.id);
                  useToastStore.getState().addToast('کاربر ساخته شد اما پروفایل ثبت نشد', 'warning');
              } else {
                  // Only assign farms if profile created successfully
                  if (userData.assignedFarms && userData.assignedFarms.length > 0) {
                      const inserts = userData.assignedFarms.map(f => ({
                          user_id: data.user!.id,
                          farm_id: f.id
                      }));
                      const { error: assignError } = await supabase.from('user_farms').insert(inserts);
                      if (assignError) {
                          useLogStore.getState().addLog('warn', 'database', `ASSIGN_FAIL: ${assignError.message}`, currentAdmin?.id);
                          useToastStore.getState().addToast('کاربر ایجاد شد اما تخصیص فارم با خطا مواجه شد', 'warning');
                      }
                  }
                  
                  useLogStore.getState().addLog('info', 'database', `User created successfully: ${sanitizedUsername}`, currentAdmin?.id);
                  useToastStore.getState().addToast(`کاربر ${userData.fullName} با موفقیت ایجاد شد`, 'success');
                  await get().fetchUsers();
              }
          }

      } catch (err: any) {
          useLogStore.getState().addLog('error', 'auth', `EXCEPTION: ${err.message}`, currentAdmin?.id);
          useToastStore.getState().addToast(`خطای غیرمنتظره: ${err.message}`, 'error');
      } finally {
          set({ isLoading: false });
      }
  },

  updateUser: async (user) => {
      const currentAdmin = (await supabase.auth.getUser()).data.user;
      useLogStore.getState().addLog('info', 'database', `Updating user profile: ${user.username}`, currentAdmin?.id);
      set({ isLoading: true });

      try {
          // 1. Update Profile Fields
          const { error: profileError } = await supabase.from('profiles').update({
              username: user.username, // Allow updating display username
              full_name: user.fullName,
              role: user.role,
              is_active: user.isActive,
              phone_number: user.phoneNumber
          }).eq('id', user.id);

          if (profileError) {
               throw new Error(`Profile update failed: ${profileError.message}`);
          }

          // 2. Update Farm Assignments (Handle RLS Gracefully)
          // We wrap this in a separate block so if it fails, the profile update still stands.
          let farmUpdateStatus = 'success';
          try {
              // Delete existing
              const { error: deleteError } = await supabase
                  .from('user_farms')
                  .delete()
                  .eq('user_id', user.id);
              
              if (deleteError) throw deleteError;

              // Insert new
              if (user.assignedFarms && user.assignedFarms.length > 0) {
                  const inserts = user.assignedFarms.map(f => ({
                      user_id: user.id,
                      farm_id: f.id
                  }));
                  
                  const { error: insertError } = await supabase
                      .from('user_farms')
                      .insert(inserts);
                  
                  if (insertError) throw insertError;
              }
          } catch (farmError: any) {
              farmUpdateStatus = 'failed';
              useLogStore.getState().addLog('error', 'database', `Farm Update RLS Error: ${farmError.message}`, currentAdmin?.id);
          }

          useLogStore.getState().addLog('info', 'database', `User ${user.username} updated. Farm Status: ${farmUpdateStatus}`, currentAdmin?.id);
          
          if (farmUpdateStatus === 'success') {
              useToastStore.getState().addToast('ویرایش کاربر با موفقیت ثبت شد', 'success');
          } else {
              useToastStore.getState().addToast('پروفایل ویرایش شد، اما تغییر فارم‌ها به دلیل محدودیت دسترسی انجام نشد.', 'warning');
          }

      } catch (error: any) {
          useLogStore.getState().addLog('error', 'database', `Update Error: ${error.message}`, currentAdmin?.id);
          useToastStore.getState().addToast(`خطا در ویرایش کاربر: ${error.message}`, 'error');
      } finally {
          await get().fetchUsers();
          set({ isLoading: false });
      }
  },

  deleteUser: async (userId) => {
      const currentAdmin = (await supabase.auth.getUser()).data.user;
      useLogStore.getState().addLog('warn', 'database', `Starting comprehensive delete for user: ${userId}`, currentAdmin?.id);
      set({ isLoading: true });

      try {
          // 1. Unlink Invoices and Stats (Preserve data, remove user link)
          // We assume 'created_by' can be null or we ignore error if restricted.
          // This allows deleting the user while keeping the business data.
          await supabase.from('invoices').update({ created_by: null }).eq('created_by', userId);
          await supabase.from('daily_statistics').update({ created_by: null }).eq('created_by', userId);

          // 2. Delete System Logs (New)
          // Removing logs prevents foreign key constraints in 'system_logs' from blocking user deletion.
          await useLogStore.getState().deleteLogsByUserId(userId);

          // 3. Delete Farm Associations
          const { error: farmError } = await supabase.from('user_farms').delete().eq('user_id', userId);
          if (farmError) {
               console.warn("Farm delete error (ignorable if RLS):", farmError);
          }

          // 4. Delete Profile
          const { error: profileError } = await supabase.from('profiles').delete().eq('id', userId);
          
          if (profileError) {
              throw new Error(`User deletion failed: ${profileError.message}`);
          }
          
          useLogStore.getState().addLog('info', 'database', `User profile and dependencies cleaned up.`, currentAdmin?.id);
          useToastStore.getState().addToast('کاربر از سیستم حذف شد. (داده‌های آماری حفظ شدند)', 'success');

      } catch (error: any) {
          useLogStore.getState().addLog('error', 'database', `Delete Error: ${error.message}`, currentAdmin?.id);
          useToastStore.getState().addToast(`خطا در حذف کاربر: ${error.message}`, 'error');
      } finally {
          await get().fetchUsers();
          set({ isLoading: false });
      }
  }
}));
