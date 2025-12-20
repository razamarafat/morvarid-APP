
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { SystemLog } from '../types';
import { getTodayJalali, getCurrentTime } from '../utils/dateUtils';

interface LogState {
  logs: SystemLog[];
  addLog: (level: SystemLog['level'], category: SystemLog['category'], message: string, userId?: string) => void;
  clearLogs: () => void;
  fetchLogs: () => Promise<void>;
  deleteLogsByUserId: (userId: string) => Promise<void>;
}

export const useLogStore = create<LogState>((set, get) => ({
  logs: [],
  
  fetchLogs: async () => {
      const { data } = await supabase.from('system_logs').select('*').order('timestamp', { ascending: false }).limit(100);
      if (data) {
          const mappedLogs = data.map((l: any) => ({
              id: l.id,
              level: l.level,
              category: l.category,
              message: l.message,
              userId: l.user_id,
              timestamp: new Date(l.timestamp).toLocaleString('fa-IR')
          }));
          set({ logs: mappedLogs });
      }
  },

  addLog: async (level, category, message, userId) => {
    // Optimistic Update
    const newLogLocal: SystemLog = {
        id: Math.random().toString(),
        level,
        category,
        message,
        userId,
        timestamp: `${getTodayJalali()} ${getCurrentTime()}`
    };
    set((state) => ({ logs: [newLogLocal, ...state.logs].slice(0, 100) }));

    // Async DB Insert
    await supabase.from('system_logs').insert({
        level,
        category,
        message,
        user_id: userId
    });
  },
  
  clearLogs: () => set({ logs: [] }),

  deleteLogsByUserId: async (userId: string) => {
      // Remove from local state
      set((state) => ({ logs: state.logs.filter(l => l.userId !== userId) }));
      // Remove from DB
      await supabase.from('system_logs').delete().eq('user_id', userId);
  }
}));
