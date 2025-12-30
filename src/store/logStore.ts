
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import { APP_VERSION } from '../constants';

interface LogPayload {
  message: string;
  stack?: string;
  component_stack?: string;
  user_id?: string | null;
  username?: string;
  user_agent: string;
  url: string;
  app_version: string;
  timestamp: string;
}

interface LogState {
  isLogging: boolean;
  logError: (error: Error, componentStack?: string) => Promise<void>;
}

export const useLogStore = create<LogState>((set, get) => ({
  isLogging: false,
  
  logError: async (error: Error, componentStack?: string) => {
    // Fail-safe mechanism: Ensure logging process doesn't crash the app itself
    try {
      set({ isLogging: true });
      
      // Attempt to get user info safely
      let userId: string | null = null;
      let username: string = 'guest';
      
      try {
          const authState = useAuthStore.getState();
          if (authState.user) {
              userId = authState.user.id;
              username = authState.user.username;
          }
      } catch (authErr) {
          console.warn('[Logger] Could not retrieve auth info:', authErr);
      }

      const payload: LogPayload = {
        message: error.message || 'Unknown Error',
        stack: error.stack || 'No stack trace available',
        component_stack: componentStack || 'No component stack',
        user_id: userId,
        username: username,
        user_agent: navigator.userAgent,
        url: window.location.href,
        app_version: APP_VERSION,
        timestamp: new Date().toISOString()
      };

      // Send to Supabase 'error_logs' table
      const { error: dbError } = await supabase
        .from('error_logs')
        .insert([payload]);

      if (dbError) {
        // Fallback: Log to console if DB insert fails
        console.warn('[Logger] Failed to save error to DB:', dbError.message);
      } else {
        console.log('[Logger] Error securely logged to cloud.');
      }

    } catch (internalError) {
      // Ultimate fail-safe: Just log locally
      console.error('[Logger] Critical failure in error logger service:', internalError);
    } finally {
      set({ isLogging: false });
    }
  }
}));
