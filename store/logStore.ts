
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { SystemLog } from '../types';

interface LogState {
  logs: SystemLog[];
  isLoading: boolean;
  
  // Core Action: Sends log to DB
  logAction: (
      level: SystemLog['level'], 
      category: SystemLog['category'], 
      summary: string, 
      technicalDetails?: any, 
      forceUserId?: string | null
  ) => Promise<void>;

  // Wrapper for backward compatibility
  addLog: (
      level: SystemLog['level'], 
      category: SystemLog['category'], 
      message: string, 
      userId?: string
  ) => Promise<void>;

  fetchLogs: (filters?: { userId?: string; date?: string }) => Promise<void>;
  subscribeToLogs: () => () => void;
  deleteLogsByUserId: (userId: string) => Promise<void>;
  clearLocalLogs: () => void;
}

const getTechnicalContext = () => {
    try {
        const nav = navigator as any;
        return {
            url: window.location.href,
            userAgent: nav.userAgent,
            platform: nav.platform,
            screen: `${window.screen.width}x${window.screen.height}`,
            timestamp: new Date().toISOString()
        };
    } catch (e) {
        return { error: 'Context extraction failed' };
    }
};

export const useLogStore = create<LogState>((set, get) => ({
  logs: [],
  isLoading: false,

  logAction: async (level, category, summary, technicalDetails = {}, forceUserId) => {
      // 1. Resolve User ID securely
      let finalUserId: string | null = null;

      // Validate UUID format if forced
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (forceUserId && uuidRegex.test(forceUserId)) {
          finalUserId = forceUserId;
      } else {
          // If not forced, try to get from current session
          const { data } = await supabase.auth.getSession();
          if (data.session?.user?.id) {
              finalUserId = data.session.user.id;
          }
      }

      const techContext = getTechnicalContext();
      const fullDetails = { ...technicalDetails, ...techContext };

      // 2. Primary Attempt: Use 'details' JSON column
      const logPayload = {
          level,
          category,
          message: summary,
          details: fullDetails,
          user_id: finalUserId,
          timestamp: new Date().toISOString()
      };

      // 3. Console Log for Dev
      if (process.env.NODE_ENV === 'development') {
          console.log(`[LOGGER] ${category.toUpperCase()}: ${summary}`, logPayload);
      }

      try {
          const { error } = await supabase.from('system_logs').insert(logPayload);

          if (error) {
              // 4. Fallback Strategy: If 'details' column is missing (PGRST204) or any undefined column error (42703)
              if (error.code === '42703' || error.code === 'PGRST204') { 
                   console.warn("LogStore: 'details' column missing. Falling back to legacy format.");
                   
                   // Serialize details into the message string
                   const legacyMessage = `${summary} | [TECH_DETAILS]: ${JSON.stringify(fullDetails)}`;
                   const legacyPayload = {
                      level,
                      category,
                      message: legacyMessage.slice(0, 5000), // Ensure it fits in text column
                      user_id: finalUserId,
                      timestamp: logPayload.timestamp
                   };
                   
                   // Try inserting without 'details' field
                   const { error: legacyError } = await supabase.from('system_logs').insert(legacyPayload);
                   if (legacyError) {
                       if (legacyError.code === '42501') {
                           console.warn('Log Legacy Insert Blocked by RLS.', legacyError.message);
                       } else {
                           console.error('CRITICAL: Log Legacy Insert Failed. Msg:', legacyError.message, 'Code:', legacyError.code, 'Details:', legacyError.details);
                       }
                   }
              } else if (error.code === '42501') {
                  // RLS Violation (Permission Denied) - common for anonymous
                  console.warn('Log Insert Blocked by RLS (Policy Violation). Expected for anonymous users.', error.message);
              } else {
                  console.error('CRITICAL: Log Insert Failed. Message:', error.message, 'Code:', error.code, 'Details:', error.details);
              }
          }
      } catch (err: any) {
          console.error('CRITICAL: Logger Exception', err?.message || err);
      }
  },

  addLog: async (level, category, message, userId) => {
      await get().logAction(level, category, message, {}, userId);
  },

  fetchLogs: async (filters) => {
      set({ isLoading: true });
      try {
          let query = supabase
            .from('system_logs')
            .select(`
                *,
                profiles:user_id ( full_name, username )
            `)
            .order('timestamp', { ascending: false })
            .limit(200);

          if (filters?.userId && filters.userId !== 'all') {
              query = query.eq('user_id', filters.userId);
          }

          const { data, error } = await query;

          if (error) throw error;

          if (data) {
              const mappedLogs: SystemLog[] = data.map((l: any) => {
                  // If details is null (legacy fallback), try to parse from message if it has the tag
                  let finalDetails = l.details || {};
                  let finalMessage = l.message;

                  if (!l.details && l.message && l.message.includes('[TECH_DETAILS]:')) {
                      try {
                          const parts = l.message.split('[TECH_DETAILS]:');
                          finalMessage = parts[0].trim().replace(/ \| $/, '');
                          finalDetails = JSON.parse(parts[1]);
                      } catch (e) {
                          // Keep as is if parsing fails
                      }
                  }

                  return {
                      id: l.id,
                      level: l.level,
                      category: l.category,
                      message: finalMessage,
                      details: finalDetails,
                      userId: l.user_id,
                      user_full_name: l.profiles?.full_name || (l.user_id ? 'کاربر حذف شده' : 'سیستم / ناشناس'),
                      timestamp: l.timestamp
                  };
              });
              set({ logs: mappedLogs, isLoading: false });
          }
      } catch (error: any) {
          if (error?.code !== '42501') { 
              console.error("Fetch Logs Error:", error?.message || error);
          }
          set({ isLoading: false });
      }
  },

  subscribeToLogs: () => {
      const channel = supabase
          .channel('realtime_logs_global')
          .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'system_logs' },
              async (payload) => {
                  const newLog = payload.new;
                  
                  let userName = 'سیستم / ناشناس';
                  if (newLog.user_id) {
                      const { data } = await supabase.from('profiles').select('full_name').eq('id', newLog.user_id).single();
                      if (data) userName = data.full_name;
                  }

                  // Handle legacy fallback parsing in realtime too
                  let finalDetails = newLog.details || {};
                  let finalMessage = newLog.message;
                  if (!newLog.details && newLog.message && newLog.message.includes('[TECH_DETAILS]:')) {
                      try {
                          const parts = newLog.message.split('[TECH_DETAILS]:');
                          finalMessage = parts[0].trim().replace(/ \| $/, '');
                          finalDetails = JSON.parse(parts[1]);
                      } catch (e) {}
                  }

                  const formattedLog: SystemLog = {
                      id: newLog.id,
                      level: newLog.level,
                      category: newLog.category,
                      message: finalMessage,
                      details: finalDetails,
                      userId: newLog.user_id,
                      user_full_name: userName,
                      timestamp: newLog.timestamp
                  };

                  set(state => ({
                      logs: [formattedLog, ...state.logs].slice(0, 200)
                  }));
              }
          )
          .subscribe();

      return () => {
          supabase.removeChannel(channel);
      };
  },

  deleteLogsByUserId: async (userId) => {
      await supabase.from('system_logs').delete().eq('user_id', userId);
  },

  clearLocalLogs: () => set({ logs: [] })
}));
