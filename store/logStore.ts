
import { create } from 'zustand';

// LOGGING SYSTEM DELETED
export const useLogStore = create(() => ({
  logs: [],
  addEntry: () => {},
  logAction: async () => {},
  addLog: async () => {},
  syncQueue: async () => {},
  clearLogs: () => {},
  setFilter: () => {},
  fetchLogs: async () => {},
  subscribeToLogs: () => () => {},
}));
