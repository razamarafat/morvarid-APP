
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { User, UserRole } from '../types';

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
      
      if (!error && profiles) {
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
      // NOTE: Creating a user in Supabase Auth usually requires Admin API or calling a helper endpoint.
      // Since we are using client side, we can use `signUp` but that logs the current user out by default unless configured.
      // FOR V1: We will Create a User via a "Secondary Client" strategy or just simple signUp. 
      // Ideally, this should be an Edge Function. Here we simulate by calling signUp directly which might warn.
      // Better approach for Client-Side Admin: User `supabase.auth.signUp` with the new user credentials.
      
      // 1. Create Auth User
      const email = `${userData.username}@morvarid.app`;
      const { data, error } = await supabase.auth.signUp({
          email,
          password: userData.password || '123456', // Default
          options: {
              data: {
                  username: userData.username,
                  full_name: userData.fullName,
                  role: userData.role
              }
          }
      });

      if (error) {
          alert('خطا در ساخت کاربر: ' + error.message);
          return;
      }

      if (data.user) {
          // 2. Assign Farms (Junction Table)
          if (userData.assignedFarms && userData.assignedFarms.length > 0) {
              const inserts = userData.assignedFarms.map(f => ({
                  user_id: data.user!.id,
                  farm_id: f.id
              }));
              await supabase.from('user_farms').insert(inserts);
          }
          get().fetchUsers();
      }
  },

  updateUser: async (user) => {
      // 1. Update Profile
      await supabase.from('profiles').update({
          full_name: user.fullName,
          role: user.role,
          is_active: user.isActive,
          phone_number: user.phoneNumber
      }).eq('id', user.id);

      // 2. Update Farm Assignments (Clear then Insert)
      await supabase.from('user_farms').delete().eq('user_id', user.id);
      
      if (user.assignedFarms && user.assignedFarms.length > 0) {
          const inserts = user.assignedFarms.map(f => ({
              user_id: user.id,
              farm_id: f.id
          }));
          await supabase.from('user_farms').insert(inserts);
      }
      
      get().fetchUsers();
  },

  deleteUser: async (userId) => {
      // Deleting from profiles cascades to user_farms
      // Note: Deleting from Auth users requires Service Role (Edge Function). 
      // For Client Side V1, we just disable the user in profiles or delete the profile row.
      // Deleting profile row doesn't delete Auth User (security limitation of client SDK).
      // Best practice: Set is_active = false.
      
      await supabase.from('profiles').update({ is_active: false }).eq('id', userId);
      get().fetchUsers();
  }
}));
