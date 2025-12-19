
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
      
      // Aggressive sanitization to remove any invisible chars or spaces
      const sanitizedUsername = userData.username.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      if (sanitizedUsername.length < 3) {
          alert('نام کاربری نامعتبر است. لطفا فقط از حروف انگلیسی و اعداد استفاده کنید.');
          return;
      }

      useLogStore.getState().addLog('info', 'database', `Creating new user: ${sanitizedUsername}`, currentAdmin?.id);

      // Create a temporary client to perform the sign-up WITHOUT affecting the current admin session
      const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false
          }
      });

      // 1. Create Auth User
      // Using .com to avoid potential TLD strictness, though .app is valid.
      // Ensuring no spaces or invalid chars are passed.
      const email = `${sanitizedUsername}@morvarid-system.com`;
      const password = userData.password || 'Morvarid1234'; // Stronger default password
      
      const { data, error } = await tempSupabase.auth.signUp({
          email,
          password,
          options: {
              data: {
                  username: sanitizedUsername,
                  full_name: userData.fullName,
                  role: userData.role
              }
          }
      });

      if (error) {
          useLogStore.getState().addLog('error', 'auth', `Failed to sign up user ${sanitizedUsername} (${email}): ${error.message}`, currentAdmin?.id);
          alert(`خطا در ساخت کاربر (Auth): ${error.message}`);
          return;
      }

      if (data.user) {
          useLogStore.getState().addLog('info', 'auth', `Auth user created: ${data.user.id}`, currentAdmin?.id);
          
          // 2. MANUALLY Create Profile (Using the main client which has the Admin session - if RLS requires it)
          const { error: profileError } = await supabase.from('profiles').insert({
              id: data.user.id,
              username: sanitizedUsername,
              full_name: userData.fullName,
              role: userData.role,
              is_active: userData.isActive,
              phone_number: userData.phoneNumber
          });

          if (profileError) {
              useLogStore.getState().addLog('error', 'database', `Failed to create profile for ${sanitizedUsername}: ${profileError.message}`, currentAdmin?.id);
              alert('کاربر ساخته شد اما پروفایل ثبت نشد. لطفا با پشتیبانی تماس بگیرید: ' + profileError.message);
              return;
          }

          // 3. Assign Farms (Junction Table)
          if (userData.assignedFarms && userData.assignedFarms.length > 0) {
              const inserts = userData.assignedFarms.map(f => ({
                  user_id: data.user!.id,
                  farm_id: f.id
              }));
              const { error: assignError } = await supabase.from('user_farms').insert(inserts);
              if (assignError) {
                  useLogStore.getState().addLog('error', 'database', `Failed to assign farms to ${sanitizedUsername}: ${assignError.message}`, currentAdmin?.id);
              }
          }
          
          // Refresh list
          get().fetchUsers();
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
