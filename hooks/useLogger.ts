
// DEPRECATED HOOK
export function useLogger() {
  const noop = () => {};
  return {
    info: noop,
    success: noop,
    warning: noop,
    error: (cat: any, msg: any, err: any) => console.error(cat, msg, err),
    log: noop
  };
}
