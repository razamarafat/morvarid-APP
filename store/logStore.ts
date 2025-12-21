
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { SystemLog } from '../types';
import { getTodayJalali, getCurrentTime } from '../utils/dateUtils';

interface LogState {
  logs: SystemLog[];
  addLog: (level: SystemLog['level'], category: SystemLog['category'], message: string, userId?: string) => void;
  clearLogs: () => void;
  fetchLogs: () => Promise<void>;
  subscribeToLogs: () => () => void; // Fixed: Now returns a cleanup function
  deleteLogsByUserId: (userId: string) => Promise<void>;
}

const isUUID = (str?: string) => {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

export const useLogStore = create<LogState>((set, get) => ({
  logs: [],
  
  fetchLogs: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .gte('timestamp', twentyFourHoursAgo)
        .order('timestamp', { ascending: false })
        .limit(500);

      if (error) {
          console.warn("Fetch logs warning:", error.message);
          return;
      }

      if (data) {
          const mappedLogs = data.map((l: any) => ({
              id: l.id,
              level: l.level,
              category: l.category,
              message: l.message,
              userId: l.user_id,
              timestamp: new Date(l.timestamp).toLocaleTimeString('fa-IR', { 
                  year: 'numeric', month: '2-digit', day: '2-digit', 
                  hour: '2-digit', minute: '2-digit', second: '2-digit' 
              })
          }));
          set({ logs: mappedLogs });
      }
  },

  subscribeToLogs: () => {
      const channel = supabase
      .channel('system_logs_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_logs' }, payload => {
          const newLog = payload.new;
          
          const formattedLog: SystemLog = {
              id: newLog.id,
              level: newLog.level,
              category: newLog.category,
              message: newLog.message,
              userId: newLog.user_id,
              timestamp: new Date(newLog.timestamp).toLocaleTimeString('fa-IR', { 
                  year: 'numeric', month: '2-digit', day: '2-digit', 
                  hour: '2-digit', minute: '2-digit', second: '2-digit' 
              })
          };
          
          set(state => ({ logs: [formattedLog, ...state.logs].slice(0, 500) }));
      })
      .subscribe();
      
      // Return a standard void function for cleanup
      return () => {
          supabase.removeChannel(channel);
      };
  },

  addLog: async (level, category, message, userId) => {
    // 1. Technical Meta Data Generation
    const userAgent = navigator.userAgent;
    const lang = navigator.language;
    const cores = (navigator as any).hardwareConcurrency || 'N/A';
    const techInfo = `[Route: ${window.location.hash}] [UA: ${userAgent}] [Lang: ${lang}] [CPU: ${cores} cores]`;
    
    const cleanMessage = message && typeof message === 'string' ? (message.length > 500 ? message.substring(0, 500) + '...' : message) : JSON.stringify(message);
    const fullMessage = `${cleanMessage} | METRICS: ${techInfo}`;

    const newLogLocal: SystemLog = {
        id: Math.random().toString(),
        level,
        category,
        message: fullMessage,
        userId: userId || 'ANON',
        timestamp: `${getTodayJalali()} ${getCurrentTime()}`
    };
    
    set((state) => ({ logs: [newLogLocal, ...state.logs].slice(0, 500) }));

    // 2. Database Insert (Best Effort)
    const validUserId = isUUID(userId) ? userId : null;
    
    supabase.from('system_logs').insert({
        level,
        category,
        message: fullMessage,
        user_id: validUserId,
    }).then(({ error }) => {
        if (error) {
            // Silently caught - technical details already in local logs for admin view if reachable
        }
    });
  },
  
  clearLogs: () => set({ logs: [] }),

  deleteLogsByUserId: async (userId: string) => {
      set((state) => ({ logs: state.logs.filter(l => l.userId !== userId) }));
      await supabase.from('system_logs').delete().eq('user_id', userId);
  }
}));
