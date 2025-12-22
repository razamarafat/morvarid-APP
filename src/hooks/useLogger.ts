
// DEPRECATED
export function useLogger() {
  const noop = (...args: any[]) => {};
  return {
    info: noop,
    success: noop,
    warning: noop,
    error: noop,
    log: noop
  };
}
