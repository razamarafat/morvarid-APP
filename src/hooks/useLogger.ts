
// Production-Safe Logger Hook
import { log } from '../utils/logger';

export const useLogger = () => {
  return {
    info: (msg: string, cat?: string, det?: any) => log.info(`${cat || ''}: ${msg}`, det),
    success: (msg: string, cat?: string, det?: any) => log.success(`${cat || ''}: ${msg}`, det),
    warn: (msg: string, cat?: string, det?: any) => log.warn(`${cat || ''}: ${msg}`, det),
    error: (msg: string, cat?: string, det?: any) => log.error(`${cat || ''}: ${msg}`, det),
    log: (msg: string) => log.debug(msg)
  };
};
