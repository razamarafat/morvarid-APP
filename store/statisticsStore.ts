
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { normalizeDate } from '../utils/dateUtils';

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
    updatedAt?: number;
    creatorName?: string; 
    createdBy?: string;
}

const mapLegacyProductId = (id: string | number): string => {
    const strId = String(id);
    if (strId === '1') return '11111111-1111-1111-1111-111111111111';
    if (strId === '2') return '22222222-2222-2222-2222-222222222222';
    return strId;
};

interface StatisticsState {
    statistics: DailyStatistic[];
    isLoading: boolean;
    fetchStatistics: () => Promise<void>;
    addStatistic: (stat: Omit<DailyStatistic, 'id' | 'createdAt'>) => Promise<{ success: boolean; error?: any }>;
    updateStatistic: (id: string, updates: Partial<DailyStatistic>) => Promise<{ success: boolean; error?: any }>;
    deleteStatistic: (id: string) => Promise<void>;
    getLatestInventory: (farmId: string, productId: string) => number;
}

export const useStatisticsStore = create<StatisticsState>((set, get) => ({
  statistics: [],
  isLoading: false,

  fetchStatistics: async () => {
      set({ isLoading: true });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
          set({ statistics: [], isLoading: false });
          return;
      }

      // Fetch statistics without automatic join to avoid relationship/schema cache errors
      const { data: statsData, error: statsError } = await supabase
          .from('daily_statistics')
          .select('*')
          .order('date', { ascending: false });
      
      if (statsError) {
          console.warn('Error fetching statistics:', statsError.message);
          set({ isLoading: false });
          return;
      }

      if (statsData) {
          // Manually fetch profiles for all creators to resolve names to bypass schema relationship issues
          const creatorIds = Array.from(new Set(statsData.map((s: any) => s.created_by).filter(Boolean)));
          let profileMap: Record<string, string> = {};

          if (creatorIds.length > 0) {
              const { data: profilesData } = await supabase
                  .from('profiles')
                  .select('id, full_name')
                  .in('id', creatorIds);
              
              if (profilesData) {
                  profileMap = profilesData.reduce((acc: any, p: any) => {
                      acc[p.id] = p.full_name;
                      return acc;
                  }, {});
              }
          }

          const mappedStats = statsData.map((s: any) => ({
              id: s.id,
              farmId: s.farm_id,
              date: normalizeDate(s.date),
              productId: mapLegacyProductId(s.product_id),
              previousBalance: s.previous_balance,
              production: s.production,
              sales: s.sales,
              currentInventory: s.current_inventory,
              createdAt: s.created_at ? new Date(s.created_at).getTime() : Date.now(),
              updatedAt: s.updated_at ? new Date(s.updated_at).getTime() : undefined,
              creatorName: profileMap[s.created_by] || 'ناشناس',
              createdBy: s.created_by
          }));
          set({ statistics: mappedStats, isLoading: false });
      } else {
          set({ isLoading: false });
      }
  },

  addStatistic: async (stat) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: "Not authenticated" };

      const normalizedDateStr = normalizeDate(stat.date);

      const dbStat = {
          farm_id: stat.farmId,
          date: normalizedDateStr,
          product_id: stat.productId,
          previous_balance: stat.previousBalance,
          production: stat.production,
          sales: stat.sales,
          current_inventory: stat.currentInventory,
          created_by: user.id
      };
      
      const { error } = await supabase.from('daily_statistics').insert(dbStat);
      
      if (!error) {
          await get().fetchStatistics();
          return { success: true };
      }
      return { success: false, error: error?.message };
  },

  updateStatistic: async (id, updates) => {
      const dbUpdates: any = {
          updated_at: new Date().toISOString()
      };
      if (updates.production !== undefined) dbUpdates.production = updates.production;
      if (updates.sales !== undefined) dbUpdates.sales = updates.sales;
      if (updates.previousBalance !== undefined) dbUpdates.previous_balance = updates.previousBalance;
      if (updates.currentInventory !== undefined) dbUpdates.current_inventory = updates.currentInventory;
      if (updates.date) dbUpdates.date = normalizeDate(updates.date);

      const { error } = await supabase.from('daily_statistics').update(dbUpdates).eq('id', id);
      
      if (!error) {
          get().fetchStatistics();
          return { success: true };
      }
      return { success: false, error: error?.message };
  },

  deleteStatistic: async (id) => {
      const { error } = await supabase.from('daily_statistics').delete().eq('id', id);
      if (!error) get().fetchStatistics();
  },

  getLatestInventory: (farmId, productId) => {
    const stats = get().statistics.filter(s => s.farmId === farmId && s.productId === productId);
    if (stats.length === 0) return 0;
    return stats[0].currentInventory || 0;
  }
}));
