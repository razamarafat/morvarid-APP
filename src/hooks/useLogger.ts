
// ═════════════════════════════════════════════════════
// FILE: src/hooks/useLogger.ts
// DESCRIPTION: Developer hook for logging
// ═════════════════════════════════════════════════════

import { useLogStore } from '../store/logStore';
import { LogCategory } from '../types/log.types';

export function useLogger() {
  const addLogEntry = useLogStore(state => state.addLogEntry);

  return {
    info: (category: LogCategory, messageFa: string, meta?: any) => 
      addLogEntry('INFO', category, messageFa, 'Info Log', meta),
      
    success: (category: LogCategory, messageFa: string, meta?: any) => 
      addLogEntry('SUCCESS', category, messageFa, 'Success Log', meta),
      
    warning: (category: LogCategory, messageFa: string, meta?: any) => 
      addLogEntry('WARNING', category, messageFa, 'Warning Log', meta),
      
    error: (category: LogCategory, messageFa: string, error: unknown, meta?: any) => 
      addLogEntry('ERROR', category, messageFa, 'Error Log', meta, error),
      
    log: addLogEntry
  };
}
