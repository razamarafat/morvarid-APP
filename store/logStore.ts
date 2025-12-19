
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SystemLog } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { getTodayJalali, getCurrentTime } from '../utils/dateUtils';

interface LogState {
  logs: SystemLog[];
  addLog: (level: SystemLog['level'], category: SystemLog['category'], message: string, userId?: string) => void;
  clearLogs: () => void;
}

export const useLogStore = create<LogState>()(
  persist(
    (set) => ({
      logs: [],
      addLog: (level, category, message, userId) => {
        const newLog: SystemLog = {
          id: uuidv4(),
          level,
          category,
          message,
          userId,
          timestamp: `${getTodayJalali()} ${getCurrentTime()}`
        };
        set((state) => ({ logs: [newLog, ...state.logs].slice(0, 1000) })); // Keep last 1000 logs
      },
      clearLogs: () => set({ logs: [] }),
    }),
    {
      name: 'system-logs',
    }
  )
);
