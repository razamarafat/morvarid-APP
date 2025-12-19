
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, UserRole } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface UserState {
  users: User[];
  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (user: User) => void;
  deleteUser: (userId: string) => void;
}

// Initial Admin Seeding
const initialAdmin: User = { 
    id: 'admin-main', 
    username: 'rezamarefat', 
    fullName: 'مدیر سیستم', 
    role: UserRole.ADMIN, 
    isActive: true, 
    lastVisit: new Date().toLocaleString('fa-IR'),
    password: 'raza1385' // In real backend this would be hashed
};

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      users: [initialAdmin],
      addUser: (user) => set((state) => ({ users: [...state.users, { ...user, id: uuidv4() }] })),
      updateUser: (updatedUser) =>
        set((state) => ({
          users: state.users.map((user) => (user.id === updatedUser.id ? updatedUser : user)),
        })),
      deleteUser: (userId) => set((state) => ({ users: state.users.filter((user) => user.id !== userId) })),
    }),
    {
      name: 'user-storage',
    }
  )
);
