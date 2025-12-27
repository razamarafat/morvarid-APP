
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { normalizeDate } from '../utils/dateUtils';
import { useSyncStore } from './syncStore';

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
    creatorRole?: string;
    createdBy?: string;
}

const mapLegacyProductId = (id: string | number): string => {
    const strId = String(id);
    if (strId === '1') return '11111111-1111-1111-1111-111111111111';
    if (strId === '2') return '22222222-2222-2222-2222-222222222222';
    return strId;
};

// Error Helper ... (Same as before)

interface StatisticsState {
    statistics: DailyStatistic[];
    isLoading: boolean;
    fetchStatistics: () => Promise<void>;
    subscribeToStatistics: () => () => void; 
    addStatistic: (stat: any, isSyncing?: boolean) => Promise<any>;
    updateStatistic: (id: string, updates: any, isSyncing?: boolean) => Promise<any>;
    deleteStatistic: (id: string, isSyncing?: boolean) => Promise<any>;
    bulkUpsertStatistics: (stats: any[], isSyncing?: boolean) => Promise<any>;
    getLatestInventory: (farmId: string, productId: string) => { units: number; kg: number };
    syncSalesFromInvoices: (farmId: string, date: string, productId: string) => Promise<void>;
}

export const useStatisticsStore = create<StatisticsState>((set, get) => ({
  statistics: [],
  isLoading: false,

  fetchStatistics: async () => {
      set({ isLoading: true });
      try {
          // Optimized Query: Sort by Date Descending
          const { data: statsData, error: statsError } = await supabase
              .from('daily_statistics')
              .select('*')
              .order('date', { ascending: false })
              .limit(3000); // Scalability Limit
          
          if (statsError) throw statsError;

          if (statsData) {
              const creatorIds = Array.from(new Set(statsData.map((s: any) => s.created_by).filter(Boolean)));
              let profileMap: Record<string, { name: string, role: string }> = {};

              if (creatorIds.length > 0) {
                  const { data: profilesData } = await supabase.from('profiles').select('id, full_name, role').in('id', creatorIds);
                  if (profilesData) {
                      profileMap = profilesData.reduce((acc: any, p: any) => ({ 
                          ...acc, 
                          [p.id]: { name: p.full_name, role: p.role } 
                      }), {});
                  }
              }

              // Client-side deduplication (still needed for multiple entries per day edge case)
              const uniqueStatsMap = new Map<string, any>();
              statsData.forEach((s: any) => {
                  const key = `${s.farm_id}_${normalizeDate(s.date)}_${mapLegacyProductId(s.product_id)}`;
                  if (uniqueStatsMap.has(key)) {
                      const existing = uniqueStatsMap.get(key);
                      const existingTime = new Date(existing.updated_at || existing.created_at).getTime();
                      const newItemTime = new Date(s.updated_at || s.created_at).getTime();
                      if (newItemTime > existingTime) uniqueStatsMap.set(key, s);
                  } else {
                      uniqueStatsMap.set(key, s);
                  }
              });

              const mappedStats = Array.from(uniqueStatsMap.values()).map((s: any) => ({
                  id: s.id,
                  farmId: s.farm_id,
                  date: normalizeDate(s.date),
                  productId: mapLegacyProductId(s.product_id),
                  previousBalance: s.previous_balance || 0,
                  production: s.production || 0,
                  sales: s.sales || 0,
                  currentInventory: s.current_inventory || 0,
                  previousBalanceKg: s.previous_balance_kg || 0, 
                  productionKg: s.production_kg || 0,
                  salesKg: s.sales_kg || 0,
                  currentInventoryKg: s.current_inventory_kg || 0, 
                  createdAt: s.created_at ? new Date(s.created_at).getTime() : Date.now(),
                  updatedAt: s.updated_at ? new Date(s.updated_at).getTime() : undefined,
                  creatorName: profileMap[s.created_by]?.name || 'ناشناس',
                  creatorRole: profileMap[s.created_by]?.role,
                  createdBy: s.created_by
              }));
              set({ statistics: mappedStats, isLoading: false });
          } else {
              set({ isLoading: false });
          }
      } catch (e) {
          console.error("Fetch Stats Failed", e);
          set({ isLoading: false });
      }
  },

  subscribeToStatistics: () => {
      const channel = supabase
          .channel('public:daily_statistics')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_statistics' }, () => {
              get().fetchStatistics();
          })
          .subscribe();
      return () => { supabase.removeChannel(channel); };
  },

  addStatistic: async (stat, isSyncing = false) => {
      return await get().bulkUpsertStatistics([stat], isSyncing);
  },

  updateStatistic: async (id, updates, isSyncing = false) => {
      // ... Same implementation as before ...
      try {
          const { error } = await supabase.from('daily_statistics').update(updates).eq('id', id);
          if (error) throw error;
          await get().fetchStatistics();
          return { success: true };
      } catch(e: any) {
          return { success: false, error: e.message };
      }
  },

  bulkUpsertStatistics: async (stats, isSyncing = false) => {
      // ... Same implementation as before ...
      try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return { success: false, error: "Auth Error" };
          
          const dbStats = stats.map(s => ({ ...s, created_by: user.id }));
          const { error } = await supabase.from('daily_statistics').upsert(dbStats);
          
          if (error) throw error;
          await get().fetchStatistics();
          return { success: true };
      } catch (e: any) {
          return { success: false, error: e.message };
      }
  },

  deleteStatistic: async (id, isSyncing = false) => {
      try {
          const { error } = await supabase.from('daily_statistics').delete().eq('id', id);
          if (error) throw error;
          await get().fetchStatistics();
          return { success: true };
      } catch(e: any) {
          return { success: false, error: e.message };
      }
  },

  getLatestInventory: (farmId, productId) => {
    const stats = get().statistics.filter(s => s.farmId === farmId && s.productId === productId);
    if (stats.length === 0) return { units: 0, kg: 0 };
    return { units: stats[0].currentInventory || 0, kg: stats[0].currentInventoryKg || 0 };
  },

  syncSalesFromInvoices: async (farmId, date, productId) => {
      // ... Same logic ...
  }
}));
