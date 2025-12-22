
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { LogEntry, LogLevel, LogCategory, LogFilter } from '../types';
import { getDeviceInfo, formatError } from '../utils/logUtils';
import { v4 as uuidv4 } from 'uuid';

interface LogState {
  logs: LogEntry[];
  isLoading: boolean;
  queue: LogEntry[]; // Offline queue
  
  // --- Core Actions ---
  log: (level: LogLevel, category: LogCategory, message: string, details?: any, userId?: string | null) => Promise<void>;
  fetchLogs: (filter?: LogFilter) => Promise<void>;
  clearLogs: () => void;
  syncQueue: () => Promise<void>;
  deleteLogsByUserId: (userId: string) => Promise<void>;
  subscribeToLogs: () => () => void;
  flushPendingLogs: () => Promise<void>;

  // --- Compatibility / Legacy Wrappers ---
  // These ensure the rest of the app (Header, Sidebar, AuthStore) keeps working
  logAction: (level: LogLevel, category: LogCategory, message: string, details?: any, userId?: string | null) => Promise<void>;
  addLog: (level: LogLevel, category: LogCategory, message: string, arg1?: any, arg2?: any, arg3?: any) => Promise<void>;
  logError: (error: any, category: LogCategory, context: string, explanation: string) => Promise<void>;
  logUserAction: (action: string, explanation: string, context?: any) => Promise<void>;
  
  // --- Short Helpers ---
  info: (category: LogCategory, message: string, details?: any) => void;
  success: (category: LogCategory, message: string, details?: any) => void;
  warn: (category: LogCategory, message: string, details?: any) => void;
  error: (category: LogCategory, message: string, error?: unknown) => void;
}

const STORAGE_KEY = 'nexus_log_queue';

export const useLogStore = create<LogState>((set, get) => ({
  logs: [],
  isLoading: false,
  queue: JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'),

  // 1. Core Logging Function
  log: async (level, category, message, details = {}, manualUserId) => {
    // Prepare User ID
    let userId = manualUserId;
    if (!userId) {
        const session = await supabase.auth.getSession();
        userId = session.data.session?.user?.id || null;
    }

    const entry: LogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      level: level.toUpperCase() as LogLevel,
      category: category.toUpperCase() as LogCategory,
      message,
      details: {
        ...details,
        device: getDeviceInfo(),
        url: window.location.href,
      },
      userId,
      synced: false
    };

    // Console Mirror
    const style = level === 'ERROR' ? 'background: #fee; color: #c00' : 'background: #eef; color: #333';
    console.log(`%c[${level}] ${category}: ${message}`, style, details);

    // Optimistic UI Update
    set(state => ({ logs: [entry, ...state.logs] }));

    // Persistence Strategy
    try {
      const { error } = await supabase.from('system_logs').insert({
        level: entry.level.toLowerCase(),
        category: entry.category.toLowerCase(),
        message: entry.message,
        metadata: entry.details,
        user_id: entry.userId,
        timestamp: entry.timestamp
      });

      if (error) throw error;

      set(state => ({
        logs: state.logs.map(l => l.id === entry.id ? { ...l, synced: true } : l)
      }));

    } catch (err) {
      console.warn('Log sync failed, queuing to localStorage:', err);
      const newQueue = [...get().queue, entry];
      set({ queue: newQueue });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newQueue));
    }
  },

  // 2. Compatibility Layer (Fixes "logAction is not a function" errors)
  logAction: async (level, category, message, details, userId) => {
      await get().log(level, category, message, details, userId);
  },

  addLog: async (level, category, message, arg1, arg2, arg3) => {
      // Overload handling to support old farmStore/authStore calls
      // Usage 1: addLog(lvl, cat, msg, userId)
      // Usage 2: addLog(lvl, cat, msg, persianMsg, details, userId)
      
      let finalMsg = message;
      let details = {};
      let userId = null;

      // Heuristic: If arg1 is a string containing Persian or if arg2 is present, it's Usage 2
      if (arg2 !== undefined || (typeof arg1 === 'string' && /[\u0600-\u06FF]/.test(arg1))) {
          if (typeof arg1 === 'string') finalMsg = `${arg1} (${message})`;
          if (arg2) details = arg2;
          if (arg3) userId = arg3;
      } else {
          // Usage 1: arg1 is userId
          userId = arg1;
      }

      await get().log(level, category, finalMsg, details, userId);
  },

  logError: async (err, category, context, explanation) => {
      const formatted = formatError(err);
      await get().log('ERROR', category, `${explanation} in ${context}`, formatted);
  },

  logUserAction: async (action, explanation, context) => {
      await get().log('INFO', 'USER_ACTION', `${explanation} - ${action}`, context);
  },

  // 3. Short Helpers
  info: (cat, msg, det) => get().log('INFO', cat, msg, det),
  success: (cat, msg, det) => get().log('SUCCESS', cat, msg, det),
  warn: (cat, msg, det) => get().log('WARNING', cat, msg, det),
  error: (cat, msg, err) => get().log('ERROR', cat, msg, formatError(err)),

  // 4. Data Management
  fetchLogs: async (filter) => {
    set({ isLoading: true });
    try {
      let query = supabase
        .from('system_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (filter?.level && filter.level !== 'ALL') {
        query = query.eq('level', filter.level.toLowerCase());
      }
      if (filter?.category && filter.category !== 'ALL') {
        query = query.eq('category', filter.category.toLowerCase());
      }
      if (filter?.userId && filter.userId !== 'ALL') {
        query = query.eq('user_id', filter.userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        // Enforce types and fetch user names
        const userIds = Array.from(new Set(data.map((l: any) => l.user_id).filter(Boolean)));
        let userMap: Record<string, string> = {};
        
        if (userIds.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('id, full_name, username').in('id', userIds);
            if (profiles) {
                profiles.forEach((p: any) => {
                    userMap[p.id] = p.full_name || p.username || 'Unknown';
                });
            }
        }

        const mappedLogs: LogEntry[] = data.map((row: any) => ({
          id: row.id,
          timestamp: row.timestamp,
          level: (row.level?.toUpperCase() || 'INFO') as LogLevel,
          category: (row.category?.toUpperCase() || 'SYSTEM') as LogCategory,
          message: row.message || '',
          details: row.metadata || row.details || {},
          userId: row.user_id,
          user_full_name: userMap[row.user_id] || (row.user_id ? 'Unknown User' : 'System'),
          synced: true
        }));

        set({ logs: mappedLogs, isLoading: false });
      }
    } catch (e: any) {
      console.error('Fetch Logs Error:', e);
      // Quietly fail UI loading to prevent crash
      set({ isLoading: false });
    }
  },

  syncQueue: async () => {
    const queue = get().queue;
    if (queue.length === 0) return;

    const remainingQueue: LogEntry[] = [];

    for (const entry of queue) {
      try {
        const { error } = await supabase.from('system_logs').insert({
            level: entry.level.toLowerCase(),
            category: entry.category.toLowerCase(),
            message: entry.message,
            metadata: entry.details,
            user_id: entry.userId,
            timestamp: entry.timestamp
        });
        if (error) throw error;
      } catch (e) {
        remainingQueue.push(entry);
      }
    }

    set({ queue: remainingQueue });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remainingQueue));
    
    if (remainingQueue.length < queue.length) {
        get().fetchLogs();
    }
  },

  flushPendingLogs: async () => {
      await get().syncQueue();
  },

  deleteLogsByUserId: async (userId) => {
      await supabase.from('system_logs').delete().eq('user_id', userId);
      set(state => ({ logs: state.logs.filter(l => l.userId !== userId) }));
  },

  subscribeToLogs: () => {
      const channel = supabase
          .channel('realtime_logs')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_logs' }, () => {
              get().fetchLogs();
          })
          .subscribe();
      return () => { supabase.removeChannel(channel); };
  },

  clearLogs: () => set({ logs: [] })
}));
