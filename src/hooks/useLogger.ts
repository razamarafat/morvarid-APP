
export function useLogger() {
  return {
    info: (category?: any, message?: any, metadata?: any) => {},
    success: (category?: any, message?: any, metadata?: any) => {},
    warning: (category?: any, message?: any, metadata?: any) => {},
    error: (category?: any, message?: any, error?: any, metadata?: any) => { console.error(category, message, error); },
    log: (entry?: any) => {}
  };
}
