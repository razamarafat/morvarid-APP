
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { SystemLog } from '../types';

interface LogState {
  logs: SystemLog[];
  isLoading: boolean;
  
  logAction: (
      level: SystemLog['level'], 
      category: SystemLog['category'], 
      summary: string, 
      techData?: any, 
      forceUserId?: string | null
  ) => Promise<void>;

  addLog: (level: any, cat: any, msg: string, uid?: string) => Promise<void>;

  fetchLogs: (filters?: { userId?: string }) => Promise<void>;
  clearLocalLogs: () => void;
  deleteLogsByUserId: (userId: string) => Promise<void>;
  subscribeToLogs: () => () => void;
}

// Internal helper for full device context
const captureDeviceSpecs = () => {
    try {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return {};
        
        return {
            window: `${window.innerWidth}x${window.innerHeight}`,
            screen: typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : 'unknown',
            userAgent: navigator.userAgent,
            platform: (navigator as any).platform || 'unknown',
            url: window.location.href,
            timestamp: new Date().toISOString(),
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
    } catch (e) {
        return { error: 'Device info capture failed' };
    }
};

export const useLogStore = create<LogState>((set, get) => ({
  logs: [],
  isLoading: false,

  logAction: async (level, category, summary, techData = {}, forceUserId) => {
      try {
          // 1. Resolve User (Non-blocking)
          let userId: string | null = null;
          if (forceUserId) {
              userId = forceUserId;
          } else {
              const { data } = await supabase.auth.getSession();
              userId = data.session?.user?.id || null;
          }

          // 2. Prepare Data
          const techContext = captureDeviceSpecs();
          const finalPayload = {
              level,
              category,
              message: summary,
              details: { ...techData, _technical: techContext },
              user_id: userId,
              timestamp: new Date().toISOString()
          };

          console.log(`%c[LOG:${category}] ${summary}`, "color: #00ff00; background: #000; padding: 2px", finalPayload);

          // 3. Database Save (Robust)
          const { error } = await supabase.from('system_logs').insert(finalPayload);

          if (error) {
              console.warn('Primary log insert failed, attempting fallback:', error.message);
              // Fallback for Schema Mismatches (e.g. if 'details' column is missing or strict)
              const safePayload = {
                  level,
                  category,
                  message: `${summary} | DATA: ${JSON.stringify(techData).substring(0, 500)}`,
                  user_id: userId,
                  timestamp: finalPayload.timestamp
              };
              // Try inserting simplified payload
              await supabase.from('system_logs').insert(safePayload);
          }
      } catch (err) {
          console.error('Critical Logger Failure', err);
      }
  },

  addLog: async (level, category, message, userId) => {
      await get().logAction(level, category, message, {}, userId);
  },

  fetchLogs: async (filters) => {
      set({ isLoading: true });
      try {
          // STRATEGY: Fetch Logs FIRST, then map users manually.
          // This prevents "Foreign Key" errors from breaking the entire list.
          
          // 1. Fetch raw logs
          let query = supabase
            .from('system_logs')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(100);

          if (filters?.userId && filters.userId !== 'all') {
              query = query.eq('user_id', filters.userId);
          }

          const { data: logsData, error: logsError } = await query;

          if (logsError) {
              console.error('Fetch logs error:', logsError);
              throw logsError;
          }
          
          if (logsData && logsData.length > 0) {
              // 2. Extract unique User IDs
              const userIds = Array.from(new Set(logsData.map((l: any) => l.user_id).filter(Boolean)));
              let userMap: Record<string, string> = {};

              // 3. Fetch User Names (If any users exist)
              if (userIds.length > 0) {
                  const { data: profiles } = await supabase
                      .from('profiles')
                      .select('id, full_name, username')
                      .in('id', userIds);
                  
                  if (profiles) {
                      profiles.forEach((p: any) => {
                          userMap[p.id] = p.full_name || p.username || 'کاربر';
                      });
                  }
              }

              // 4. Map Data together
              const mapped: SystemLog[] = logsData.map((l: any) => {
                  let d = l.details || {};
                  let m = l.message;
                  
                  // Handle legacy fallback parsing
                  if (!l.details && l.message?.includes('| DATA:')) {
                      try {
                          const parts = l.message.split('| DATA:');
                          m = parts[0].trim();
                          d = { recovered_data: parts[1] };
                      } catch (e) {}
                  }

                  return {
                      id: l.id,
                      level: l.level,
                      category: l.category,
                      message: m,
                      details: d,
                      userId: l.user_id,
                      user_full_name: userMap[l.user_id] || (l.user_id ? 'کاربر حذف شده/نامشخص' : 'سیستم'),
                      timestamp: l.timestamp
                  };
              });
              set({ logs: mapped, isLoading: false });
          } else {
              set({ logs: [], isLoading: false });
          }
      } catch (e) {
          console.error('Fetch Logs Exception:', e);
          set({ isLoading: false });
      }
  },

  subscribeToLogs: () => {
      const channel = supabase
          .channel('realtime_logs_viewer')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_logs' }, () => {
              get().fetchLogs();
          })
          .subscribe();
      return () => { supabase.removeChannel(channel); };
  },

  deleteLogsByUserId: async (userId) => {
      await supabase.from('system_logs').delete().eq('user_id', userId);
  },

  clearLocalLogs: () => set({ logs: [] })
}));
