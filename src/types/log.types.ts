
// ═════════════════════════════════════════════════════
// FILE: src/types/log.types.ts
// DESCRIPTION: Core type definitions for the logging system
// ═════════════════════════════════════════════════════

export type LogLevel = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export type LogCategory = 
  | 'AUTH' 
  | 'DATABASE' 
  | 'NETWORK' 
  | 'SYSTEM' 
  | 'SECURITY' 
  | 'UI' 
  | 'USER_ACTION' 
  | 'FEATURE_TEST'
  | 'REPORT'
  | 'UNKNOWN';

export interface LogEntry {
  id: string;
  timestamp: string; // ISO String
  level: LogLevel;
  category: LogCategory;
  messageFa: string; // Brief Persian message for UI
  messageEn: string; // Technical English message
  component?: string; // Where it happened
  userId?: string | null;
  userFullName?: string; // Enriched data
  metadata?: Record<string, any>;
  error?: Record<string, any>; // Serialized error object
  synced: boolean; // Storage status
}

export interface LogFilterState {
  levels: LogLevel[];
  categories: LogCategory[];
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  searchTerm?: string;
}

export interface LogStats {
  total: number;
  errors: number;
  warnings: number;
  lastSync: string | null;
}
