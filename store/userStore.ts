
import { create, StoreApi, UseBoundStore } from 'zustand';
import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { User, UserRole } from '../types';
import { useLogStore } from './logStore';

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
          // We need farms to map names
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
      
      // 1. Aggressive Sanitization & Logging
      const rawUsername = userData.username;
      const sanitizedUsername = rawUsername.toLowerCase().replace(/[^a-z0-9]/g, '');
      const email = `${sanitizedUsername}@morvarid.app`; // Using a consistent domain
      const password = userData.password || 'Morvarid1234';

      // Log the exact payload attempting to be sent
      useLogStore.getState().addLog('info', 'auth', `INIT_SIGNUP: Raw='${rawUsername}' -> Email='${email}'`, currentAdmin?.id);

      if (sanitizedUsername.length < 3) {
          alert('نام کاربری نامعتبر است (حداقل ۳ کاراکتر انگلیسی).');
          return;
      }

      try {
          // 2. Create Isolated Client with Memory Storage
          // This ensures NO cookies/localstorage from the admin session are touched/read.
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

          useLogStore.getState().addLog('debug', 'auth', `Temp Client Created. Endpoint: ${supabaseUrl}`, currentAdmin?.id);

          // 3. Attempt SignUp
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

          // 4. Detailed Error Handling
          if (error) {
              const errorDetails = JSON.stringify({
                  message: error.message,
                  status: error.status,
                  name: error.name
              });
              
              useLogStore.getState().addLog('error', 'auth', `SIGNUP_FAIL: ${errorDetails}`, currentAdmin?.id);
              console.error('Signup Error Full Object:', error);
              
              alert(`خطا در ساخت کاربر (Auth):\n${error.message}\n(Status: ${error.status || 'N/A'})`);
              return;
          }

          if (data.user) {
              useLogStore.getState().addLog('info', 'auth', `SUCCESS: User created with ID ${data.user.id}. Creating Profile...`, currentAdmin?.id);
              
              // 5. Create Profile (Using Admin Client)
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
                  alert('کاربر ساخته شد اما پروفایل ثبت نشد. لطفا با پشتیبانی تماس بگیرید: ' + profileError.message);
                  return;
              }

              // 6. Assign Farms
              if (userData.assignedFarms && userData.assignedFarms.length > 0) {
                  const inserts = userData.assignedFarms.map(f => ({
                      user_id: data.user!.id,
                      farm_id: f.id
                  }));
                  const { error: assignError } = await supabase.from('user_farms').insert(inserts);
                  if (assignError) {
                      useLogStore.getState().addLog('error', 'database', `ASSIGN_FAIL: ${assignError.message}`, currentAdmin?.id);
                  }
              }
              
              useLogStore.getState().addLog('info', 'database', `User creation flow completed for ${sanitizedUsername}`, currentAdmin?.id);
              get().fetchUsers();
          } else {
             // Edge case: No error but no user (e.g. email confirmation required but not enabled?)
             useLogStore.getState().addLog('warn', 'auth', `SIGNUP_WEIRD: No error, but no user object returned. Data: ${JSON.stringify(data)}`, currentAdmin?.id);
             alert('پاسخ نامشخص از سرور (User is null). لطفا لاگ‌ها را بررسی کنید.');
          }

      } catch (err: any) {
          useLogStore.getState().addLog('error', 'auth', `EXCEPTION: ${err.message}`, currentAdmin?.id);
          console.error('Unexpected error in addUser:', err);
          alert(`خطای غیرمنتظره: ${err.message}`);
      }
  },

  updateUser: async (user) => {
      const currentAdmin = (await supabase.auth.getUser()).data.user;
      useLogStore.getState().addLog('info', 'database', `Updating user profile: ${user.username}`, currentAdmin?.id);

      // 1. Update Profile
      const { error: profileError } = await supabase.from('profiles').update({
          full_name: user.fullName,
          role: user.role,
          is_active: user.isActive,
          phone_number: user.phoneNumber
      }).eq('id', user.id);

      if (profileError) {
           useLogStore.getState().addLog('error', 'database', `Profile update failed: ${profileError.message}`, currentAdmin?.id);
           return;
      }

      // 2. Update Farm Assignments (Clear then Insert)
      await supabase.from('user_farms').delete().eq('user_id', user.id);
      
      if (user.assignedFarms && user.assignedFarms.length > 0) {
          const inserts = user.assignedFarms.map(f => ({
              user_id: user.id,
              farm_id: f.id
          }));
          const { error: assignError } = await supabase.from('user_farms').insert(inserts);
          if (assignError) {
              useLogStore.getState().addLog('error', 'database', `Farm re-assignment failed: ${assignError.message}`, currentAdmin?.id);
          }
      }
      
      get().fetchUsers();
  },

  deleteUser: async (userId) => {
      const currentAdmin = (await supabase.auth.getUser()).data.user;
      useLogStore.getState().addLog('warn', 'database', `Deactivating user: ${userId}`, currentAdmin?.id);

      const { error } = await supabase.from('profiles').update({ is_active: false }).eq('id', userId);
      
      if (error) {
          useLogStore.getState().addLog('error', 'database', `User deactivation failed: ${error.message}`, currentAdmin?.id);
      } else {
          get().fetchUsers();
      }
  }
}));
