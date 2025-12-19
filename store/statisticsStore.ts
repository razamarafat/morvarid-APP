
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export interface DailyStatistic {
    id: string;
    farmId: string;
    date: string; // Jalali
    productId: string;
    previousBalance?: number; 
    production: number;
    sales?: number; 
    currentInventory?: number;
    createdAt: number;
}

interface StatisticsState {
    statistics: DailyStatistic[];
    addStatistic: (stat: Omit<DailyStatistic, 'id' | 'createdAt'>) => void;
    updateStatistic: (id: string, updates: Partial<DailyStatistic>) => void;
    deleteStatistic: (id: string) => void;
    getLatestInventory: (farmId: string, productId: string) => number;
}

export const useStatisticsStore = create<StatisticsState>()(
  persist(
    (set, get) => ({
      statistics: [],
      addStatistic: (stat) => set((state) => ({ 
          statistics: [...state.statistics, { ...stat, id: uuidv4(), createdAt: Date.now() }] 
      })),
      updateStatistic: (id, updates) => set((state) => ({
          statistics: state.statistics.map(s => s.id === id ? { ...s, ...updates } : s)
      })),
      deleteStatistic: (id) => set((state) => ({
          statistics: state.statistics.filter(s => s.id !== id)
      })),
      getLatestInventory: (farmId, productId) => {
        const stats = get().statistics.filter(s => s.farmId === farmId && s.productId === productId);
        if (stats.length === 0) return 0;
        // Sort by date/created to ensure we get the absolute latest
        const sorted = stats.sort((a,b) => b.createdAt - a.createdAt);
        return sorted[0].currentInventory || 0;
      }
    }),
    {
      name: 'statistics-storage',
    }
  )
);
