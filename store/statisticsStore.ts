
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { normalizeDate } from '../utils/dateUtils';

export interface DailyStatistic {
    id: string;
    farmId: string;
    date: string;
    productId: string;
    previousBalance: number; 
    previousBalanceKg?: number;
    production: number;
    productionKg?: number;
    sales: number; 
    salesKg?: number;
    currentInventory: number;
    currentInventoryKg?: number;
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
    bulkUpsertStatistics: (stats: Omit<DailyStatistic, 'id' | 'createdAt'>[]) => Promise<{ success: boolean; error?: any }>;
    getLatestInventory: (farmId: string, productId: string) => { units: number; kg: number };
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

      const { data: statsData, error: statsError } = await supabase
          .from('daily_statistics')
          .select('*')
          .order('date', { ascending: false });
      
      if (statsError) {
          set({ isLoading: false });
          return;
      }

      if (statsData) {
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
              previousBalance: s.previous_balance || 0,
              previousBalanceKg: s.previous_balance_kg || 0, 
              production: s.production || 0,
              productionKg: s.production_kg || 0,
              sales: s.sales || 0,
              salesKg: s.sales_kg || 0,
              currentInventory: s.current_inventory || 0,
              currentInventoryKg: s.current_inventory_kg || 0, 
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
      // Wrapper for single add to reuse logic
      return await get().bulkUpsertStatistics([stat]);
  },

  updateStatistic: async (id, updates) => {
      const dbUpdates: any = {
          updated_at: new Date().toISOString()
      };
      if (updates.production !== undefined) dbUpdates.production = Number(updates.production) || 0;
      if (updates.sales !== undefined) dbUpdates.sales = Number(updates.sales) || 0;
      if (updates.previousBalance !== undefined) dbUpdates.previous_balance = Number(updates.previousBalance) || 0;
      if (updates.currentInventory !== undefined) dbUpdates.current_inventory = Number(updates.currentInventory) || 0;
      if (updates.date) dbUpdates.date = normalizeDate(updates.date);

      const { error } = await supabase.from('daily_statistics').update(dbUpdates).eq('id', id);
      
      if (!error) {
          get().fetchStatistics();
          return { success: true };
      }
      return { success: false, error: error?.message };
  },

  bulkUpsertStatistics: async (stats) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: "Not authenticated" };
      
      if (stats.length === 0) return { success: true };

      // FIX: The DB likely misses a unique constraint on (farm_id, date, product_id).
      // Strategy: Fetch existing records for this context first to get IDs, then upsert using ID (PK).
      
      const farmId = stats[0].farmId;
      const date = normalizeDate(stats[0].date);

      // 1. Fetch existing record IDs for this farm/date
      const { data: existingRecords } = await supabase
          .from('daily_statistics')
          .select('id, product_id')
          .eq('farm_id', farmId)
          .eq('date', date);
      
      const idMap = new Map();
      if (existingRecords) {
          existingRecords.forEach((r: any) => idMap.set(String(r.product_id), r.id));
      }

      // 2. Prepare Payloads with IDs if they exist
      const dbPayloads = stats.map(stat => {
          const payload: any = {
              farm_id: stat.farmId,
              date: normalizeDate(stat.date),
              product_id: stat.productId,
              previous_balance: Number(stat.previousBalance) || 0,
              production: Number(stat.production) || 0,
              sales: Number(stat.sales) || 0,
              current_inventory: Number(stat.currentInventory) || 0,
              created_by: user.id,
              // kg columns excluded as per schema
          };

          // If record exists, add ID to force UPDATE on Primary Key
          const existingId = idMap.get(String(stat.productId));
          if (existingId) {
              payload.id = existingId;
          }
          
          return payload;
      });

      // 3. Upsert without 'onConflict' (Supabase uses ID automatically if present)
      const { error } = await supabase
          .from('daily_statistics')
          .upsert(dbPayloads); 

      if (!error) {
          await get().fetchStatistics();
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
    if (stats.length === 0) return { units: 0, kg: 0 };
    return { 
        units: stats[0].currentInventory || 0, 
        kg: stats[0].currentInventoryKg || 0 
    };
  }
}));
