
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { LogEntry, LogLevel, LogCategory } from '../types.ts';

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
  
  // Core Actions
  addEntry: (level: LogLevel, category: LogCategory, message: string, details?: any) => void;
  clearLogs: () => void;
  setFilter: (filter: Partial<LogFilterState>) => void;
  
  // Interface Compatibility for UI
  fetchLogs: () => Promise<void>;
  subscribeToLogs: () => () => void;
  
  // Specialized Admin/Tech Helpers
  logTest: (feature: string, success: boolean, data: any) => void;
  logClick: (element: string, context?: any) => void;
  logError: (message: string, error?: any) => void;
  
  // Legacy Compatibility Layer
  log: (level: LogLevel, category: LogCategory, message: string, details?: any) => void;
  info: (category: LogCategory, message: string, details?: any) => void;
  success: (category: LogCategory, message: string, details?: any) => void;
  warn: (category: LogCategory, message: string, details?: any) => void;
  error: (category: LogCategory, message: string, error?: any) => void;
  logAction: (level: any, category: any, message: string, details?: any) => void;
  addLog: (level: any, category: any, message: string, ...args: any[]) => void;
  flushPendingLogs: () => Promise<void>;
  syncQueue: () => Promise<void>;
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
    // In local-first, fetching means ensuring the state matches localStorage
    set({ isLoading: true });
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        set({ logs: JSON.parse(data) });
      }
    } catch (e) {
      console.error("Local log fetch error", e);
    } finally {
      set({ isLoading: false });
    }
  },

  subscribeToLogs: () => {
    // Local logs don't need a real-time DB subscription, 
    // but we provide a dummy unsubscribe function for UI compatibility.
    return () => { /* No-op cleanup */ };
  },

  setFilter: (newFilter) => {
    set(state => ({ filter: { ...state.filter, ...newFilter } }));
  },

  addEntry: (level, category, message, details = {}) => {
    const entry: LogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      details: {
        ...details,
        path: window.location.hash,
        userAgent: navigator.userAgent
      },
      synced: true 
    };

    // Console mirror
    const colors = { INFO: '#2D89EF', SUCCESS: '#00A300', WARNING: '#F09609', ERROR: '#EE1111' };
    console.log(`%c[${level}] %c${category}: ${message}`, `color: ${colors[level]}; font-weight: bold;`, 'color: gray;', details);

    set(state => {
      const newLogs = [entry, ...state.logs].slice(0, state.maxLogs);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newLogs));
      return { logs: newLogs };
    });
  },

  logTest: (feature, success, data) => {
    get().addEntry(
      success ? 'SUCCESS' : 'ERROR',
      'SYSTEM',
      `تست فنی [${feature}]: ${success ? 'موفق' : 'ناموفق'}`,
      { technical_data: data }
    );
  },

  logClick: (element, context) => {
    get().addEntry('INFO', 'UI', `تعامل: کلیک بر روی [${element}]`, context);
  },

  logError: (message, error) => {
    get().addEntry('ERROR', 'SYSTEM', message, { 
      errorMessage: error?.message || error,
      stack: error?.stack 
    });
  },

  // Compatibility Wrappers
  log: (lvl, cat, msg, det) => get().addEntry(lvl, cat, msg, det),
  info: (cat, msg, det) => get().addEntry('INFO', cat, msg, det),
  success: (cat, msg, det) => get().addEntry('SUCCESS', cat, msg, det),
  warn: (cat, msg, det) => get().addEntry('WARNING', cat, msg, det),
  error: (cat, msg, err) => get().logError(msg, err),
  
  logAction: async (level, category, message, details) => {
      get().addEntry(level.toUpperCase(), category.toUpperCase(), message, details);
  },
  
  addLog: async (level, category, message, ...args) => {
    const details = args.length > 0 ? (typeof args[0] === 'object' ? args[0] : { data: args }) : {};
    get().addEntry(level.toUpperCase() as LogLevel, category.toUpperCase() as LogCategory, message, details);
  },
  
  flushPendingLogs: async () => {}, 
  syncQueue: async () => {}, 

  clearLogs: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ logs: [] });
  }
}));
