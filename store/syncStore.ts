
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export type SyncItemType = 'INVOICE' | 'STAT' | 'UPDATE_INVOICE' | 'UPDATE_STAT' | 'DELETE_INVOICE' | 'DELETE_STAT';

export interface SyncItem {
    id: string;
    type: SyncItemType;
    payload: any;
    timestamp: number;
    retryCount: number;
    lastAttempt?: number; // Added for exponential backoff
}

export interface SyncLog {
    id: string;
    itemId: string;
    itemType: string;
    message: string;
    timestamp: number;
}

interface SyncState {
    queue: SyncItem[];
    syncLogs: SyncLog[]; 
    isProcessing: boolean; // New: Global processing flag
    addToQueue: (type: SyncItemType, payload: any) => void;
    removeFromQueue: (id: string) => void;
    clearQueue: () => void;
    incrementRetry: (id: string) => void;
    updateItemAttempt: (id: string, timestamp: number) => void;
    addSyncLog: (log: Omit<SyncLog, 'id'>) => void;
    clearSyncLogs: () => void;
    setIsProcessing: (status: boolean) => void; // New action
}

export const useSyncStore = create<SyncState>()(
    persist(
        (set, get) => ({
            queue: [],
            syncLogs: [],
            isProcessing: false,
            addToQueue: (type, payload) => {
                const newItem: SyncItem = {
                    id: uuidv4(),
                    type,
                    payload,
                    timestamp: Date.now(),
                    retryCount: 0
                };
                set({ queue: [...get().queue, newItem] });
                console.log(`[Sync] Item added to queue: ${type}`, payload);
            },
            removeFromQueue: (id) => {
                set({ queue: get().queue.filter(item => item.id !== id) });
            },
            clearQueue: () => set({ queue: [] }),
            incrementRetry: (id) => {
                set({
                    queue: get().queue.map(item => 
                        item.id === id ? { ...item, retryCount: item.retryCount + 1 } : item
                    )
                });
            },
            updateItemAttempt: (id, timestamp) => {
                set({
                    queue: get().queue.map(item => 
                        item.id === id ? { ...item, lastAttempt: timestamp } : item
                    )
                });
            },
            addSyncLog: (log) => {
                const newLog = { ...log, id: uuidv4() };
                // Keep only last 50 logs to prevent storage bloat
                set(state => ({ syncLogs: [newLog, ...state.syncLogs].slice(0, 50) }));
            },
            clearSyncLogs: () => set({ syncLogs: [] }),
            setIsProcessing: (status) => set({ isProcessing: status })
        }),
        {
            name: 'morvarid-sync-queue',
            // Do NOT persist isProcessing, it should always be false on load
            partialize: (state) => ({ queue: state.queue, syncLogs: state.syncLogs }),
        }
    )
);
