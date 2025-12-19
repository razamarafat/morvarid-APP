
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface DailyStatistic {
    id: string;
    farmId: string;
    date: string;
    productId: string;
    previousBalance?: number; 
    production: number;
    sales?: number; 
    currentInventory?: number;
    createdAt: number;
}

interface StatisticsState {
    statistics: DailyStatistic[];
    isLoading: boolean;
    fetchStatistics: () => Promise<void>;
    addStatistic: (stat: Omit<DailyStatistic, 'id' | 'createdAt'>) => Promise<void>;
    updateStatistic: (id: string, updates: Partial<DailyStatistic>) => Promise<void>;
    deleteStatistic: (id: string) => Promise<void>;
    getLatestInventory: (farmId: string, productId: string) => number;
}

export const useStatisticsStore = create<StatisticsState>((set, get) => ({
  statistics: [],
  isLoading: false,

  fetchStatistics: async () => {
      set({ isLoading: true });
      const { data, error } = await supabase.from('daily_statistics').select('*').order('created_at', { ascending: false });
      
      if (!error && data) {
          const mappedStats = data.map((s: any) => ({
              id: s.id,
              farmId: s.farm_id,
              date: s.date,
              productId: s.product_id,
              previousBalance: s.previous_balance,
              production: s.production,
              sales: s.sales,
              currentInventory: s.current_inventory,
              createdAt: new Date(s.created_at).getTime()
          }));
          set({ statistics: mappedStats, isLoading: false });
      } else {
          set({ isLoading: false });
      }
  },

  addStatistic: async (stat) => {
      const { data: { user } } = await supabase.auth.getUser();
      const dbStat = {
          farm_id: stat.farmId,
          date: stat.date,
          product_id: stat.productId,
          previous_balance: stat.previousBalance,
          production: stat.production,
          sales: stat.sales,
          current_inventory: stat.currentInventory,
          created_by: user?.id
      };
      
      const { error } = await supabase.from('daily_statistics').insert(dbStat);
      if (!error) get().fetchStatistics();
  },

  updateStatistic: async (id, updates) => {
      const dbUpdates: any = {};
      if (updates.production !== undefined) dbUpdates.production = updates.production;
      if (updates.sales !== undefined) dbUpdates.sales = updates.sales;
      if (updates.previousBalance !== undefined) dbUpdates.previous_balance = updates.previousBalance;
      if (updates.currentInventory !== undefined) dbUpdates.current_inventory = updates.currentInventory;

      const { error } = await supabase.from('daily_statistics').update(dbUpdates).eq('id', id);
      if (!error) get().fetchStatistics();
  },

  deleteStatistic: async (id) => {
      const { error } = await supabase.from('daily_statistics').delete().eq('id', id);
      if (!error) get().fetchStatistics();
  },

  getLatestInventory: (farmId, productId) => {
    const stats = get().statistics.filter(s => s.farmId === farmId && s.productId === productId);
    if (stats.length === 0) return 0;
    // statistics array is already sorted by date descending from fetch
    return stats[0].currentInventory || 0;
  }
}));
