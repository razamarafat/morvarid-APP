
import { create } from 'zustand';

// Minimal interface to satisfy existing imports if any, but functionality is stripped.
export interface LogEntry {
  id: string;
  message: string;
}

interface LogState {
  logs: LogEntry[];
  addLog: (message: string, level?: any, category?: any, details?: any) => void;
  clearLogs: () => void;
}

// No-op store to disable logging system overhead
export const useLogStore = create<LogState>((set) => ({
  logs: [],
  addLog: (message) => {
    // Logging disabled per user command
    // console.log('[System Log Skipped]:', message); 
  },
  clearLogs: () => set({ logs: [] }),
}));
