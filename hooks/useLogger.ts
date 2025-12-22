
// Simplified Logger - Console Only
export const useLogger = () => {
  return {
    info: (msg: string, cat?: string, det?: any) => console.log(`[INFO] ${cat || ''}: ${msg}`, det),
    success: (msg: string, cat?: string, det?: any) => console.log(`[SUCCESS] ${cat || ''}: ${msg}`, det),
    warn: (msg: string, cat?: string, det?: any) => console.warn(`[WARN] ${cat || ''}: ${msg}`, det),
    error: (msg: string, cat?: string, det?: any) => console.error(`[ERROR] ${cat || ''}: ${msg}`, det),
    log: (msg: string) => console.log(msg)
  };
};
