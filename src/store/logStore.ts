
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

  // Legacy Compatibility Actions (To prevent breaking other files)
  logAction: (level: any, category: any, message: string, details?: any, userId?: any) => Promise<void>;
  addLog: (level: any, category: any, message: string, arg1?: any, arg2?: any, arg3?: any) => Promise<void>;
  logError: (error: any, category: any, context: string, explanation: string) => Promise<void>;
  logUserAction: (action: string, explanation: string, context?: any) => Promise<void>;
  
  // Short Helpers (Required by App.tsx and SystemLogs.tsx)
  info: (category: LogCategory, message: string, details?: any) => void;
  success: (category: LogCategory, message: string, details?: any) => void;
  warn: (category: LogCategory, message: string, details?: any) => void;
  error: (category: LogCategory, message: string, error?: unknown) => void;

  // Helpers
  deleteLogsByUserId: (userId: string) => Promise<void>;
  subscribeToLogs: () => () => void;
  flushPendingLogs: () => Promise<void>;
}

export const useLogStore = create<LogStoreState>((set, get) => ({
  logs: [],
  isLoading: false,
  filter: {
    levels: [],
    categories: [],
  },

  addLogEntry: async (level, category, messageFa, messageEn, meta, error) => {
    // 1. Get User
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id || null;

    // 2. Construct Entry
    const entry: LogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      level,
      category,
      messageFa,
      messageEn,
      userId,
      metadata: meta || {},
      error: error ? formatErrorObject(error) : undefined,
      synced: false
    };

    // 3. Optimistic Update
    set(state => ({
      logs: [entry, ...state.logs]
    }));

    // 4. Persist
    const saved = await LogService.saveLog(entry);
    
    // 5. Update Sync Status if saved
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
      // Fix: Print the actual error message instead of [object Object]
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

  // ═════════════════════════════════════════════════════
  // COMPATIBILITY LAYER
  // ═════════════════════════════════════════════════════
  
  logAction: async (level, category, message, details) => {
    // Map legacy 'logAction' to new 'addLogEntry'
    const lvl = (String(level).toUpperCase()) as LogLevel;
    // Default FA message is the message passed
    await get().addLogEntry(lvl, category || 'USER_ACTION', message, message, details);
  },

  addLog: async (level, category, message, arg1, arg2) => {
    // Map legacy 'addLog' 
    // Old signature was weird, sometimes (lvl, cat, msg, userId) 
    // sometimes (lvl, cat, msg, persianMsg, details, userId)
    
    let msgFa = message;
    let meta = {};
    
    if (typeof arg1 === 'string' && /[\u0600-\u06FF]/.test(arg1)) {
        msgFa = arg1; // arg1 is Persian message
        if (arg2) meta = arg2;
    } else if (typeof arg1 === 'object') {
        meta = arg1;
    }

    const lvl = (String(level).toUpperCase()) as LogLevel;
    await get().addLogEntry(lvl, category || 'SYSTEM', msgFa, message, meta);
  },

  logError: async (err, category, context, explanation) => {
    await get().addLogEntry('ERROR', category || 'SYSTEM', explanation, `${context}: ${String(err)}`, {}, err);
  },

  logUserAction: async (action, explanation, context) => {
    await get().addLogEntry('INFO', 'USER_ACTION', explanation, action, context);
  },

  // ═════════════════════════════════════════════════════
  // SHORT HELPERS (Fixing Missing Function Errors)
  // ═════════════════════════════════════════════════════
  info: (cat, msg, det) => get().addLogEntry('INFO', cat, msg, msg, det),
  success: (cat, msg, det) => get().addLogEntry('SUCCESS', cat, msg, msg, det),
  warn: (cat, msg, det) => get().addLogEntry('WARNING', cat, msg, msg, det),
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
