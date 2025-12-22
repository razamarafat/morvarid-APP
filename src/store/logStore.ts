
// ═════════════════════════════════════════════════════
// FILE: src/store/logStore.ts
// DESCRIPTION: Main state management for logs (Zustand)
// ═════════════════════════════════════════════════════

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { LogEntry, LogLevel, LogCategory, LogFilterState } from '../types/log.types';
import { LogService } from '../services/LogService';
import { formatErrorObject } from '../utils/logHelpers';
import { supabase } from '../lib/supabase';

interface LogStoreState {
  logs: LogEntry[];
  filter: LogFilterState;
  isLoading: boolean;
  
  // Core Actions
  addLogEntry: (
    level: LogLevel, 
    category: LogCategory, 
    messageFa: string, 
    messageEn: string, 
    meta?: any, 
    error?: any
  ) => Promise<void>;
  
  fetchLogs: () => Promise<void>;
  setFilter: (filter: Partial<LogFilterState>) => void;
  clearLogs: () => void;
  syncOfflineLogs: () => Promise<void>;
  syncQueue: () => Promise<void>; // Alias for build compatibility

  // Legacy Compatibility Actions
  logAction: (level: any, category: any, message: string, details?: any, userId?: any) => Promise<void>;
  addLog: (level: any, category: any, message: string, arg1?: any, arg2?: any, arg3?: any) => Promise<void>;
  logError: (message: string, error?: unknown) => void; // Fixed signature
  logUserAction: (action: string, explanation: string, context?: any) => Promise<void>;
  
  // Short Helpers
  log: (level: LogLevel, category: LogCategory, message: string, details?: any) => void;
  info: (category: LogCategory, message: string, details?: any) => void;
  success: (category: LogCategory, message: string, details?: any) => void;
  warn: (category: LogCategory, message: string, details?: any) => void;
  error: (category: LogCategory, message: string, error?: unknown) => void;

  // Helpers
  deleteLogsByUserId: (userId: string) => Promise<void>;
  subscribeToLogs: () => () => void;
  flushPendingLogs: () => Promise<void>;
  logTest: (feature: string, success: boolean, data: any) => void;
  logClick: (element: string, context?: any) => void;
}

export const useLogStore = create<LogStoreState>((set, get) => ({
  logs: [],
  isLoading: false,
  filter: {
    levels: [],
    categories: [],
  },

  addLogEntry: async (level, category, messageFa, messageEn, meta, error) => {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id || null;

    const entry: LogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      level: level as LogLevel,
      category: category as LogCategory,
      messageFa,
      messageEn,
      userId,
      metadata: meta || {},
      error: error ? formatErrorObject(error) : undefined,
      synced: false
    };

    set(state => ({
      logs: [entry, ...state.logs].slice(0, 500)
    }));

    const saved = await LogService.saveLog(entry);
    
    if (saved) {
      set(state => ({
        logs: state.logs.map(l => l.id === entry.id ? { ...l, synced: true } : l)
      }));
    }
  },

  fetchLogs: async () => {
    set({ isLoading: true });
    try {
      const logs = await LogService.fetchLogs(100);
      set({ logs, isLoading: false });
    } catch (e: any) {
      console.error('Fetch Logs Error:', e.message || e);
      set({ isLoading: false });
    }
  },

  setFilter: (newFilter) => {
    set(state => ({ filter: { ...state.filter, ...newFilter } }));
  },

  clearLogs: () => set({ logs: [] }),

  syncOfflineLogs: async () => {
    await LogService.syncQueue();
    get().fetchLogs();
  },

  syncQueue: async () => get().syncOfflineLogs(),

  // ═════════════════════════════════════════════════════
  // COMPATIBILITY LAYER
  // ═════════════════════════════════════════════════════
  
  logAction: async (level, category, message, details) => {
    await get().addLogEntry(level as LogLevel, category as LogCategory, message, message, details);
  },

  addLog: async (level, category, message, arg1, arg2) => {
    let msgFa = message;
    let meta = {};
    if (typeof arg1 === 'string' && /[\u0600-\u06FF]/.test(arg1)) {
        msgFa = arg1; 
        if (arg2) meta = arg2;
    } else if (typeof arg1 === 'object') {
        meta = arg1;
    }
    await get().addLogEntry(level as LogLevel, category as LogCategory, msgFa, message, meta);
  },

  logError: (msg, err) => get().error('SYSTEM' as LogCategory, msg, err),

  logUserAction: async (action, explanation, context) => {
    await get().addLogEntry('INFO', 'USER_ACTION', explanation, action, context);
  },

  logTest: (feature, success, data) => 
    get().addLogEntry(success ? 'SUCCESS' : 'ERROR', 'FEATURE_TEST', `تست فنی: ${feature}`, feature, data),

  logClick: (element, context) => 
    get().addLogEntry('INFO', 'UI', `کلیک: ${element}`, `UI Click: ${element}`, context),

  // ═════════════════════════════════════════════════════
  // SHORT HELPERS
  // ═════════════════════════════════════════════════════
  log: (lvl, cat, msg, det) => get().addLogEntry(lvl, cat, msg, msg, det),
  info: (cat, msg, det) => get().addLogEntry('INFO', cat, msg, msg, det),
  success: (cat, msg, det) => get().addLogEntry('SUCCESS', cat, msg, msg, det),
  warn: (cat, msg, det) => get().addLogEntry('WARNING' as LogLevel, cat, msg, msg, det),
  error: (cat, msg, err) => get().addLogEntry('ERROR', cat, msg, msg, {}, err),

  deleteLogsByUserId: async (userId) => {
    await supabase.from('system_logs').delete().eq('user_id', userId);
    set(state => ({ logs: state.logs.filter(l => l.userId !== userId) }));
  },

  subscribeToLogs: () => {
    const channel = supabase
      .channel('realtime_system_logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_logs' }, () => {
          get().fetchLogs();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  },

  flushPendingLogs: async () => {
    await get().syncOfflineLogs();
  }
}));
