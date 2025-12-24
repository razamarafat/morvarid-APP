
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
}

interface SyncState {
    queue: SyncItem[];
    addToQueue: (type: SyncItemType, payload: any) => void;
    removeFromQueue: (id: string) => void;
    clearQueue: () => void;
    incrementRetry: (id: string) => void;
}

export const useSyncStore = create<SyncState>()(
    persist(
        (set, get) => ({
            queue: [],
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
            }
        }),
        {
            name: 'morvarid-sync-queue',
        }
    )
);
