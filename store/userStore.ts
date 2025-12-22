
import { create } from 'zustand';
import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { User, UserRole } from '../types';
import { useToastStore } from './toastStore';

// Helper duplicated here to avoid circular dependencies if we imported from farmStore
const mapLegacyProductId = (id: string): string => {
    if (id === '1') return '11111111-1111-1111-1111-111111111111';
    if (id === '2') return '22222222-2222-2222-2222-222222222222';
    return id;
};

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
      
      try {
          // SPLIT QUERY STRATEGY:
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
                    ? allFarms.filter((f: any) => assignedFarmIds.includes(f.id)).map((f:any) => ({
                        ...f, 
                        // FIX: Ensure legacy IDs are mapped here too
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
                      createdAt: p.created_at, // Map creation date
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
      const sanitizedUsername = rawUsername.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      
      if (!sanitizedUsername || sanitizedUsername.length < 3) {
          useToastStore.getState().addToast('نام کاربری باید شامل حداقل ۳ حرف لاتین یا عدد باشد', 'error');
          return;
      }

      const email = `${sanitizedUsername}@morvarid.com`; 
      const password = userData.password || 'Morvarid1234';

      set({ isLoading: true });

      try {
          // Create Isolated Client with Memory Storage
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
              useToastStore.getState().addToast(`خطا در ساخت کاربر: ${error.message}`, 'error');
              return;
          }

          if (data.user) {
              if (!data.session) {
                  useToastStore.getState().addToast('کاربر ساخته شد اما "تایید ایمیل" در پنل Supabase فعال است.', 'warning');
              }

              const { error: profileError } = await supabase.from('profiles').insert({
                  id: data.user.id,
                  username: sanitizedUsername,
                  full_name: userData.fullName,
                  role: userData.role,
                  is_active: userData.isActive,
                  phone_number: userData.phoneNumber
              });

              if (profileError) {
                  console.error('Profile Creation Failed:', profileError);
                  useToastStore.getState().addToast('کاربر ساخته شد اما پروفایل ثبت نشد', 'warning');
              } else {
                  if (userData.assignedFarms && userData.assignedFarms.length > 0) {
                      const inserts = userData.assignedFarms.map(f => ({
                          user_id: data.user!.id,
                          farm_id: f.id
                      }));
                      await supabase.from('user_farms').insert(inserts);
                  }
                  
                  if (data.session) {
                      useToastStore.getState().addToast(`کاربر ${userData.fullName} با موفقیت ایجاد شد`, 'success');
                  }
                  await get().fetchUsers();
              }
          }

      } catch (err: any) {
          console.error('User Add Exception:', err);
          useToastStore.getState().addToast(`خطای غیرمنتظره: ${err.message}`, 'error');
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

          if (profileError) {
               throw new Error(`Profile update failed: ${profileError.message}`);
          }

          let farmUpdateStatus = 'success';
          try {
              const { error: deleteError } = await supabase
                  .from('user_farms')
                  .delete()
                  .eq('user_id', user.id);
              
              if (deleteError) throw deleteError;

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
              console.error('Farm Update Failed:', farmError);
          }

          if (farmUpdateStatus === 'success') {
              useToastStore.getState().addToast('ویرایش کاربر با موفقیت ثبت شد', 'success');
          } else {
              useToastStore.getState().addToast('پروفایل ویرایش شد، اما تغییر فارم‌ها به دلیل محدودیت دسترسی انجام نشد.', 'warning');
          }

      } catch (error: any) {
          console.error('User Update Failed:', error);
          useToastStore.getState().addToast(`خطا در ویرایش کاربر: ${error.message}`, 'error');
      } finally {
          await get().fetchUsers();
          set({ isLoading: false });
      }
  },

  deleteUser: async (userId) => {
      set({ isLoading: true });

      try {
          await supabase.from('invoices').update({ created_by: null }).eq('created_by', userId);
          await supabase.from('daily_statistics').update({ created_by: null }).eq('created_by', userId);

          const { error: farmError } = await supabase.from('user_farms').delete().eq('user_id', userId);
          if (farmError) console.warn("Farm delete error:", farmError);

          const { error: profileError } = await supabase.from('profiles').delete().eq('id', userId);
          
          if (profileError) {
              throw new Error(`User deletion failed: ${profileError.message}`);
          }
          
          useToastStore.getState().addToast('کاربر از سیستم حذف شد.', 'success');

      } catch (error: any) {
          console.error('User Delete Failed:', error);
          useToastStore.getState().addToast(`خطا در حذف کاربر: ${error.message}`, 'error');
      } finally {
          await get().fetchUsers();
          set({ isLoading: false });
      }
  }
}));
