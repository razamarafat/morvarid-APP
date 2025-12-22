
import { create } from 'zustand';
// DEPRECATED
export const useLogStore = create(() => ({
    logs: [],
    addLogEntry: () => {}
}));
