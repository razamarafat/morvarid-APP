
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
    creatorName?: string; // Added for Sales Dashboard
}

// Legacy ID mapping helper - ROBUST
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

      // Step 1: Fetch statistics without join to avoid schema cache errors
      const { data: statsData, error: statsError } = await supabase
          .from('daily_statistics')
          .select('*')
          .order('date', { ascending: false });
      
      if (statsError) {
          console.error('Error fetching statistics:', statsError.message);
          set({ isLoading: false });
          return;
      }

      let mappedStats: DailyStatistic[] = [];

      if (statsData) {
          // Step 2: Extract unique user IDs for manual fetching
          const userIds = Array.from(new Set(statsData.map((s: any) => s.created_by).filter(Boolean)));
          
          // Step 3: Fetch Profiles manually
          let profilesMap: Record<string, string> = {};
          if (userIds.length > 0) {
             const { data: profilesData } = await supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', userIds);
             
             if (profilesData) {
                 profilesData.forEach((p: any) => {
                     profilesMap[p.id] = p.full_name;
                 });
             }
          }

          mappedStats = statsData.map((s: any) => ({
              id: s.id,
              farmId: s.farm_id,
              // CRITICAL FIX: Normalize date coming FROM DB to ensure UI matches
              date: normalizeDate(s.date),
              productId: mapLegacyProductId(s.product_id),
              previousBalance: s.previous_balance,
              production: s.production,
              sales: s.sales,
              currentInventory: s.current_inventory,
              createdAt: s.created_at ? new Date(s.created_at).getTime() : Date.now(),
              updatedAt: s.updated_at ? new Date(s.updated_at).getTime() : undefined,
              creatorName: profilesMap[s.created_by] || 'ناشناس'
          }));
      }
      
      set({ statistics: mappedStats, isLoading: false });
  },

  addStatistic: async (stat) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: "Not authenticated" };

      // CRITICAL FIX: Normalize date before sending TO DB.
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
          // Immediately re-fetch to update local state with server truth
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
      // Also allow date updates if necessary
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
    // Relies on the fact that fetchStatistics sorts by date DESC
    const stats = get().statistics.filter(s => s.farmId === farmId && s.productId === productId);
    if (stats.length === 0) return 0;
    return stats[0].currentInventory || 0;
  }
}));
