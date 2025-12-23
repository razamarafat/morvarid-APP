
import { create } from 'zustand';
export const useLogStore = create(() => ({
    logs: [],
    addLogEntry: () => {}
}));
