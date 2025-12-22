
// LOGGING SYSTEM DELETED
export function useLogger() {
  return {
    info: () => {},
    success: () => {},
    warning: () => {},
    error: (cat: any, msg: any, err: any) => console.error(cat, msg, err),
    log: () => {}
  };
}
