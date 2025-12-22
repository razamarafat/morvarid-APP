
import { create } from 'zustand';

// DEPRECATED STORE - REPLACED BY CONSOLE LOGGING
export const useLogStore = create((set) => ({
  logs: [],
  maxLogs: 0,
  filter: {},
  isLoading: false,
  
  addEntry: () => {},
  clearLogs: () => {},
  setFilter: () => {},
  fetchLogs: async () => {},
  subscribeToLogs: () => () => {},
  logTest: () => {},
  logClick: () => {},
  logError: () => {},
  
  log: () => {},
  info: () => {},
  success: () => {},
  warn: () => {},
  error: () => {},
  
  logAction: async () => {},
  addLog: async () => {},
  logUserAction: async () => {},
  
  flushPendingLogs: async () => {}, 
  syncQueue: async () => {}, 
  deleteLogsByUserId: async () => {},
}));
