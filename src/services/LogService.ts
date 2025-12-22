
// ═════════════════════════════════════════════════════
// FILE: src/services/LogService.ts
// DESCRIPTION: Core service for logging operations
// ═════════════════════════════════════════════════════

import { supabase } from '../lib/supabase';
import { LogEntry } from '../types/log.types';

const STORAGE_KEY = 'nexus_log_queue_v2';

export class LogService {
  /**
   * Saves a log entry to Supabase, falling back to LocalStorage
   */
  static async saveLog(entry: LogEntry): Promise<boolean> {
    try {
      // 1. Try Supabase Insert
      const { error } = await supabase.from('system_logs').insert({
        id: entry.id,
        timestamp: entry.timestamp,
        level: entry.level,
        category: entry.category,
        message_fa: entry.messageFa,
        message_en: entry.messageEn,
        component: entry.component,
        user_id: entry.userId,
        metadata: entry.metadata,
        error: entry.error,
        created_at: entry.timestamp // redundant but safe
      });

      if (error) throw error;
      return true;

    } catch (err) {
      console.warn('[LogService] Sync failed, queuing offline:', err);
      this.queueLog(entry);
      return false;
    }
  }

  /**
   * Queues a log in LocalStorage for later sync
   */
  private static queueLog(entry: LogEntry) {
    try {
      const queue = this.getQueue();
      queue.push({ ...entry, synced: false });
      // Keep queue size manageable (max 500)
      if (queue.length > 500) queue.shift();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error('[LogService] LocalStorage full or error', e);
    }
  }

  /**
   * Retrieves the offline queue
   */
  static getQueue(): LogEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Attempts to flush the offline queue to Supabase
   */
  static async syncQueue(): Promise<number> {
    const queue = this.getQueue();
    if (queue.length === 0) return 0;

    const syncedIds: string[] = [];
    
    // Batch insert could be more efficient, but let's do safe iterative for reliability
    // or small batches. Let's try batch of 50.
    const batchSize = 50;
    const batch = queue.slice(0, batchSize);

    try {
      const dbRows = batch.map(log => ({
        id: log.id,
        timestamp: log.timestamp,
        level: log.level,
        category: log.category,
        message_fa: log.messageFa,
        message_en: log.messageEn,
        component: log.component,
        user_id: log.userId,
        metadata: log.metadata,
        error: log.error
      }));

      const { error } = await supabase.from('system_logs').insert(dbRows);
      
      if (!error) {
        // Remove synced items from queue
        const remaining = queue.slice(batchSize);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
        return batch.length;
      }
    } catch (e) {
      console.error('[LogService] Sync Retry Failed', e);
    }

    return 0;
  }

  /**
   * Fetches logs from Supabase with optional filters
   */
  static async fetchLogs(limit: number = 100): Promise<LogEntry[]> {
    const { data, error } = await supabase
      .from('system_logs')
      .select('*, user:profiles(full_name, username)')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      timestamp: row.timestamp,
      level: row.level,
      category: row.category,
      messageFa: row.message_fa,
      messageEn: row.message_en,
      component: row.component,
      userId: row.user_id,
      userFullName: row.user?.full_name || row.user?.username || 'Unknown',
      metadata: row.metadata,
      error: row.error,
      synced: true
    }));
  }
}
