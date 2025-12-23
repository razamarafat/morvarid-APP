
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { normalizeDate, toEnglishDigits } from '../utils/dateUtils';

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

const translateError = (error: any): string => {
    if (!error) return 'خطای ناشناخته';
    const code = error.code || '';
    const status = String(error.status || '');
    if (status === '400' || code === 'PGRST204' || code === '42703') return 'خطای ساختار دیتابیس شناسایی شد. پیلود اصلاح و مجدداً تلاش شد.';
    if (code === '23505') return 'این رکورد قبلاً ثبت شده است.';
    return `خطای سیستم: ${error.message || code}`;
};

interface StatisticsState {
    statistics: DailyStatistic[];
    isLoading: boolean;
    fetchStatistics: () => Promise<void>;
    subscribeToStatistics: () => () => void; 
    addStatistic: (stat: Omit<DailyStatistic, 'id' | 'createdAt'>) => Promise<{ success: boolean; error?: string }>;
    updateStatistic: (id: string, updates: Partial<DailyStatistic>) => Promise<{ success: boolean; error?: string }>;
    deleteStatistic: (id: string) => Promise<{ success: boolean; error?: string }>;
    bulkUpsertStatistics: (stats: Omit<DailyStatistic, 'id' | 'createdAt'>[]) => Promise<{ success: boolean; error?: string }>;
    getLatestInventory: (farmId: string, productId: string) => { units: number; kg: number };
    syncSalesFromInvoices: (farmId: string, date: string, productId: string) => Promise<void>;
}

export const useStatisticsStore = create<StatisticsState>((set, get) => ({
  statistics: [],
  isLoading: false,

  fetchStatistics: async () => {
      set({ isLoading: true });
      const { data: statsData, error: statsError } = await supabase
          .from('daily_statistics')
          .select('*')
          .order('date', { ascending: false });
      
      if (statsError) {
          console.error('Fetch Stats Error:', statsError);
          set({ isLoading: false });
          return;
      }

      if (statsData) {
          const creatorIds = Array.from(new Set(statsData.map((s: any) => s.created_by).filter(Boolean)));
          let profileMap: Record<string, string> = {};

          if (creatorIds.length > 0) {
              const { data: profilesData } = await supabase.from('profiles').select('id, full_name').in('id', creatorIds);
              if (profilesData) {
                  profileMap = profilesData.reduce((acc: any, p: any) => ({ ...acc, [p.id]: p.full_name }), {});
              }
          }

          const mappedStats = statsData.map((s: any) => ({
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
              creatorName: profileMap[s.created_by] || 'ناشناس',
              createdBy: s.created_by
          }));
          set({ statistics: mappedStats, isLoading: false });
      } else {
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

  addStatistic: async (stat) => {
      return await get().bulkUpsertStatistics([stat]);
  },

  updateStatistic: async (id, updates) => {
      const fullPayload: any = {};
      if (updates.production !== undefined) fullPayload.production = Number(updates.production);
      if (updates.sales !== undefined) fullPayload.sales = Number(updates.sales);
      if (updates.previousBalance !== undefined) fullPayload.previous_balance = Number(updates.previousBalance);
      if (updates.currentInventory !== undefined) fullPayload.current_inventory = Number(updates.currentInventory);
      if (updates.date) fullPayload.date = normalizeDate(updates.date);
      
      fullPayload.updated_at = new Date().toISOString();
      if (updates.productionKg !== undefined) fullPayload.production_kg = Number(updates.productionKg);
      if (updates.salesKg !== undefined) fullPayload.sales_kg = Number(updates.salesKg);
      if (updates.previousBalanceKg !== undefined) fullPayload.previous_balance_kg = Number(updates.previousBalanceKg);
      if (updates.currentInventoryKg !== undefined) fullPayload.current_inventory_kg = Number(updates.currentInventoryKg);

      let { error } = await supabase.from('daily_statistics').update(fullPayload).eq('id', id);
      
      if (error && (String((error as any).status) === '400' || error.code === 'PGRST204' || error.code === '42703')) {
          const corePayload = {
              production: fullPayload.production,
              sales: fullPayload.sales,
              previous_balance: fullPayload.previous_balance,
              current_inventory: fullPayload.current_inventory
          };
          Object.keys(corePayload).forEach(key => (corePayload as any)[key] === undefined && delete (corePayload as any)[key]);
          const retry = await supabase.from('daily_statistics').update(corePayload).eq('id', id);
          error = retry.error;
      }
      
      if (!error) {
          await get().fetchStatistics();
          return { success: true };
      }
      return { success: false, error: translateError(error) };
  },

  bulkUpsertStatistics: async (stats) => {
      try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return { success: false, error: "کاربر احراز هویت نشده است." };
          
          const dbPayloads = stats.map(stat => ({
              farm_id: stat.farmId,
              date: normalizeDate(stat.date),
              product_id: mapLegacyProductId(stat.productId),
              previous_balance: Number(stat.previousBalance) || 0,
              production: Number(stat.production) || 0,
              sales: Number(stat.sales) || 0,
              current_inventory: Number(stat.currentInventory) || 0,
              created_by: user.id
          }));

          const { error } = await supabase.from('daily_statistics').upsert(dbPayloads);
          if (error) return { success: false, error: translateError(error) };
          
          await get().fetchStatistics();
          return { success: true };
      } catch (err: any) {
          return { success: false, error: err.message };
      }
  },

  deleteStatistic: async (id) => {
      const { error } = await supabase.from('daily_statistics').delete().eq('id', id);
      if (!error) {
          await get().fetchStatistics();
          return { success: true };
      }
      return { success: false, error: translateError(error) };
  },

  getLatestInventory: (farmId, productId) => {
    const stats = get().statistics.filter(s => s.farmId === farmId && s.productId === productId);
    if (stats.length === 0) return { units: 0, kg: 0 };
    return { units: stats[0].currentInventory || 0, kg: stats[0].currentInventoryKg || 0 };
  },

  syncSalesFromInvoices: async (farmId, date, productId) => {
      const normalizedDate = normalizeDate(date);
      const { data: invoices, error: invError } = await supabase
          .from('invoices')
          .select('total_cartons')
          .eq('farm_id', farmId)
          .eq('date', normalizedDate)
          .eq('product_id', productId);

      if (invError) {
          console.error("Sync: Error fetching invoices:", invError);
          return;
      }

      const totalSales = invoices?.reduce((sum, inv) => sum + (inv.total_cartons || 0), 0) || 0;
      
      const { data: statRecords, error: statError } = await supabase
          .from('daily_statistics')
          .select('id, production, previous_balance')
          .eq('farm_id', farmId)
          .eq('date', normalizedDate)
          .eq('product_id', productId);

      if (statError) {
          console.error("Sync: Error fetching stats:", statError);
          return;
      }

      if (statRecords && statRecords.length > 0) {
          const rec = statRecords[0];
          const newInv = (rec.previous_balance || 0) + (rec.production || 0) - totalSales;
          const { error: updateError } = await supabase
              .from('daily_statistics')
              .update({ sales: totalSales, current_inventory: newInv })
              .eq('id', rec.id);
          
          if (updateError) console.error("Sync: Error updating stats:", updateError);
      }
  }
}));
