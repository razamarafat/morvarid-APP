
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { LogEntry, LogLevel, LogCategory } from '../types';

interface LogFilterState {
  levels: LogLevel[];
  categories: LogCategory[];
  searchTerm: string;
}

interface LogState {
  logs: LogEntry[];
  maxLogs: number;
  filter: LogFilterState;
  isLoading: boolean;
  
  addEntry: (level: LogLevel, category: LogCategory, message: string, details?: any) => void;
  clearLogs: () => void;
  setFilter: (filter: Partial<LogFilterState>) => void;
  fetchLogs: () => Promise<void>;
  subscribeToLogs: () => () => void;
  logTest: (feature: string, success: boolean, data: any) => void;
  logClick: (element: string, context?: any) => void;
  logError: (message: string, error?: any) => void;
  
  // Compatibility Layer
  log: (level: LogLevel, category: LogCategory, message: string, details?: any) => void;
  info: (category: LogCategory, message: string, details?: any) => void;
  success: (category: LogCategory, message: string, details?: any) => void;
  warn: (category: LogCategory, message: string, details?: any) => void;
  error: (category: LogCategory, message: string, error?: any) => void;
  logAction: (level: any, category: any, message: string, details?: any) => Promise<void>;
  addLog: (level: any, category: any, message: string, ...args: any[]) => Promise<void>;
  logUserAction: (action: string, explanation: string, context?: any) => Promise<void>;
  flushPendingLogs: () => Promise<void>;
  syncQueue: () => Promise<void>;
  deleteLogsByUserId: (userId: string) => Promise<void>;
}

const STORAGE_KEY = 'morvarid_nexus_logs';

export const useLogStore = create<LogState>((set, get) => ({
  logs: (() => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  })(),
  maxLogs: 300,
  isLoading: false,
  filter: {
    levels: [],
    categories: [],
    searchTerm: '',
  },

  fetchLogs: async () => {
    set({ isLoading: true });
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) set({ logs: JSON.parse(data) });
    } finally {
      set({ isLoading: false });
    }
  },

  subscribeToLogs: () => () => {},

  setFilter: (newFilter) => set(state => ({ filter: { ...state.filter, ...newFilter } })),

  addEntry: (level, category, message, details = {}) => {
    const entry: LogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      level: level.toUpperCase() as LogLevel,
      category: category.toUpperCase() as LogCategory,
      message,
      details: { ...details, path: window.location.hash },
      synced: true 
    };

    set(state => {
      const newLogs = [entry, ...state.logs].slice(0, state.maxLogs);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newLogs));
      return { logs: newLogs };
    });
  },

  logTest: (feature, success, data) => get().addEntry(success ? 'SUCCESS' : 'ERROR', 'SYSTEM', `تست فنی [${feature}]`, data),
  logClick: (element, context) => get().addEntry('INFO', 'UI', `کلیک: ${element}`, context),
  logError: (message, error) => get().addEntry('ERROR', 'SYSTEM', message, { error }),

  log: (lvl, cat, msg, det) => get().addEntry(lvl, cat, msg, det),
  info: (cat, msg, det) => get().addEntry('INFO', cat, msg, det),
  success: (cat, msg, det) => get().addEntry('SUCCESS', cat, msg, det),
  warn: (cat, msg, det) => get().addEntry('WARNING', cat, msg, det),
  error: (cat, msg, err) => get().logError(msg, err),
  
  logAction: async (level, category, message, details) => get().addEntry(level, category, message, details),
  addLog: async (level, category, message, ...args) => get().addEntry(level, category, message, args[0]),
  logUserAction: async (action, explanation) => get().addEntry('INFO', 'USER_ACTION', explanation, { action }),
  
  flushPendingLogs: async () => {}, 
  syncQueue: async () => {}, 
  deleteLogsByUserId: async () => {},

  clearLogs: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ logs: [] });
  }
}));
