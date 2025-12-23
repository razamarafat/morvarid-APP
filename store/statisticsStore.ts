
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

// Helper to check if string is a valid UUID
const isValidUUID = (id: string): boolean => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

// Helper to handle both legacy and UUID formats for internal logic
const getPossibleProductIds = (id: string): string[] => {
    if (id === '11111111-1111-1111-1111-111111111111') return ['1', '11111111-1111-1111-1111-111111111111'];
    if (id === '22222222-2222-2222-2222-222222222222') return ['2', '22222222-2222-2222-2222-222222222222'];
    return [id];
};

// CRITICAL FIX: Returns only valid UUIDs for DB queries to prevent 22P02 errors
const getSafeDbProductIds = (id: string): string[] => {
    return getPossibleProductIds(id).filter(isValidUUID);
};

const translateError = (error: any): string => {
    if (!error) return 'خطای ناشناخته';
    if (typeof error === 'string') return error;
    
    const msg = error.message || error.details || '';
    const code = error.code || '';
    
    if (code === '23505') return 'این رکورد قبلاً ثبت شده است.';
    if (code === '23503') return 'فارم یا محصول نامعتبر است.';
    if (code === '22P02') return 'فرمت داده نامعتبر است (UUID).';
    if (msg.includes('network')) return 'خطا در اتصال به سرور.';
    
    if (!msg && !code) return `خطای نامشخص: ${JSON.stringify(error)}`;
    return `خطای سیستم: ${msg} (${code})`;
};

interface StatisticsState {
    statistics: DailyStatistic[];
    isLoading: boolean;
    fetchStatistics: () => Promise<void>;
    subscribeToStatistics: () => () => void; 
    addStatistic: (stat: Omit<DailyStatistic, 'id' | 'createdAt'>) => Promise<{ success: boolean; error?: string; debug?: any }>;
    updateStatistic: (id: string, updates: Partial<DailyStatistic>) => Promise<{ success: boolean; error?: string; debug?: any }>;
    deleteStatistic: (id: string) => Promise<{ success: boolean; error?: string }>;
    bulkUpsertStatistics: (stats: Omit<DailyStatistic, 'id' | 'createdAt'>[]) => Promise<{ success: boolean; error?: string; debug?: any }>;
    getLatestInventory: (farmId: string, productId: string) => { units: number; kg: number };
    syncSalesFromInvoices: (farmId: string, date: string, productId: string) => Promise<void>;
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
          console.error('Stats Fetch Error:', statsError);
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
      console.group('🛠️ DEBUG: updateStatistic');
      console.log('1. Target ID:', id);
      console.log('2. Raw Updates:', updates);

      const dbUpdates: any = { updated_at: new Date().toISOString() };
      if (updates.production !== undefined) dbUpdates.production = Number(updates.production) || 0;
      if (updates.sales !== undefined) dbUpdates.sales = Number(updates.sales) || 0;
      if (updates.previousBalance !== undefined) dbUpdates.previous_balance = Number(updates.previousBalance) || 0;
      if (updates.currentInventory !== undefined) dbUpdates.current_inventory = Number(updates.currentInventory) || 0;
      
      // Kg Units
      if (updates.productionKg !== undefined) dbUpdates.production_kg = Number(updates.productionKg) || 0;
      if (updates.salesKg !== undefined) dbUpdates.sales_kg = Number(updates.salesKg) || 0;
      if (updates.previousBalanceKg !== undefined) dbUpdates.previous_balance_kg = Number(updates.previousBalanceKg) || 0;
      if (updates.currentInventoryKg !== undefined) dbUpdates.current_inventory_kg = Number(updates.currentInventoryKg) || 0;

      if (updates.date) dbUpdates.date = normalizeDate(updates.date);
      
      console.log('3. Prepared DB Payload:', dbUpdates);

      // 1. Attempt update by ID
      console.log('4. Attempting Update by ID...');
      let { error, count } = await supabase.from('daily_statistics')
          .update(dbUpdates)
          .eq('id', id)
          .select('id', { count: 'exact' });
      
      console.log('5. ID Update Result:', { error, count });

      // Retry if updated_at column is missing (PGRST204)
      if (error && error.code === 'PGRST204' && (error.message.includes('updated_at') || error.message.includes('column'))) {
          console.warn('⚠️ PGRST204: Removing updated_at and retrying...');
          delete dbUpdates.updated_at;
          const retry = await supabase.from('daily_statistics')
              .update(dbUpdates)
              .eq('id', id)
              .select('id', { count: 'exact' });
          error = retry.error;
          count = retry.count;
      }
      
      // 2. Fallback: Attempt update by Composite Key (Farm + Date + Product) if ID update failed
      if ((!count || count === 0) && !error) {
          console.warn('⚠️ ID Update found no records. Falling back to Composite Key.');
          const targetStat = get().statistics.find(s => s.id === id);
          
          if (targetStat) {
              const safeProductIds = getSafeDbProductIds(targetStat.productId);
              console.log('6. Fallback Search Params:', {
                  farmId: targetStat.farmId,
                  date: targetStat.date,
                  safeProductIds: safeProductIds
              });
              
              if (safeProductIds.length > 0) {
                  let retry = await supabase.from('daily_statistics')
                      .update(dbUpdates)
                      .eq('farm_id', targetStat.farmId)
                      .eq('date', targetStat.date)
                      .in('product_id', safeProductIds)
                      .select('id', { count: 'exact' });
                  
                  console.log('7. Fallback Result:', retry);

                  if (retry.error && retry.error.code === 'PGRST204') {
                       if (dbUpdates.updated_at) delete dbUpdates.updated_at;
                       retry = await supabase.from('daily_statistics')
                          .update(dbUpdates)
                          .eq('farm_id', targetStat.farmId)
                          .eq('date', targetStat.date)
                          .in('product_id', safeProductIds)
                          .select('id', { count: 'exact' });
                  }
                  
                  error = retry.error;
                  count = retry.count;
              } else {
                  console.error('❌ No valid UUIDs found for fallback query.');
              }
          } else {
              console.error('❌ Original record not found in local store for fallback.');
          }
      }

      if (!error && count !== null && count > 0) {
          console.log('✅ Update Successful.');
          console.groupEnd();
          await get().fetchStatistics();
          return { success: true };
      }
      
      console.error('❌ UPDATE FAILED. Final Error:', error);
      if (error) {
          console.error('Error Code:', error.code);
          console.error('Error Message:', error.message);
          console.error('Error Details:', error.details);
          console.error('Error Hint:', error.hint);
      } else {
          console.error('Error: No records matched the query criteria (Count is 0).');
      }
      console.groupEnd();

      const errorMessage = error ? translateError(error) : 'رکورد یافت نشد یا مجوز ویرایش ندارید.';
      return { success: false, error: errorMessage, debug: error };
  },

  bulkUpsertStatistics: async (stats) => {
      try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return { success: false, error: "کاربر احراز هویت نشده است." };
          if (stats.length === 0) return { success: true };

          const farmId = stats[0].farmId;
          const date = normalizeDate(stats[0].date);

          const { data: existingRecords, error: fetchError } = await supabase
              .from('daily_statistics')
              .select('id, product_id, sales')
              .eq('farm_id', farmId)
              .eq('date', date);
          
          if (fetchError) {
              console.error('Stats Exists Check Error:', fetchError);
              return { success: false, error: translateError(fetchError), debug: fetchError };
          }
          
          const idMap = new Map();
          const salesMap = new Map(); 
          if (existingRecords) {
              existingRecords.forEach((r: any) => {
                  idMap.set(String(r.product_id), r.id);
                  // Also handle legacy IDs mapping to UUIDs for map lookup
                  idMap.set(mapLegacyProductId(r.product_id), r.id);
                  
                  salesMap.set(String(r.product_id), { unit: r.sales });
                  salesMap.set(mapLegacyProductId(r.product_id), { unit: r.sales });
              });
          }

          const dbPayloads = stats.map(stat => {
              const existingSales = salesMap.get(String(stat.productId));
              const finalSales = existingSales ? existingSales.unit : (Number(stat.sales) || 0);
              
              const payload: any = {
                  farm_id: stat.farmId,
                  date: normalizeDate(stat.date),
                  product_id: stat.productId,
                  previous_balance: Number(stat.previousBalance) || 0,
                  production: Number(stat.production) || 0,
                  sales: finalSales, 
                  current_inventory: Number(stat.currentInventory) || 0,
                  created_by: user.id,
                  // Add KG fields
                  previous_balance_kg: Number(stat.previousBalanceKg) || 0,
                  production_kg: Number(stat.productionKg) || 0,
                  sales_kg: Number(stat.salesKg) || 0,
                  current_inventory_kg: Number(stat.currentInventoryKg) || 0,
              };

              const existingId = idMap.get(String(stat.productId));
              if (existingId) payload.id = existingId;
              
              return payload;
          });

          const inserts = dbPayloads.filter(p => !p.id);
          const updates = dbPayloads.filter(p => p.id);

          if (inserts.length > 0) {
              const { error } = await supabase.from('daily_statistics').insert(inserts);
              if (error) {
                  console.error('Stats Insert Error:', error);
                  return { success: false, error: translateError(error), debug: error };
              }
          }

          if (updates.length > 0) {
              for (const u of updates) {
                  const { id, ...rest } = u;
                  const { error } = await supabase.from('daily_statistics').update(rest).eq('id', id);
                  if (error) {
                      console.error('Stats Update Error:', error);
                      return { success: false, error: translateError(error), debug: error };
                  }
              }
          }

          await get().fetchStatistics();
          return { success: true };

      } catch (err: any) {
          console.error('Unexpected Stats Error:', err);
          return { success: false, error: `خطای غیرمنتظره: ${err.message}`, debug: err };
      }
  },

  deleteStatistic: async (id) => {
      console.group('🛠️ DEBUG: deleteStatistic');
      console.log('1. Target ID:', id);

      // 1. Attempt Delete by ID
      let { error, count } = await supabase.from('daily_statistics')
          .delete({ count: 'exact' })
          .eq('id', id);
      
      console.log('2. ID Delete Result:', { error, count });

      // 2. Fallback: Aggressive attempt by Composite Key if ID delete failed
      if ((!count || count === 0) && !error) {
          console.warn('⚠️ ID Delete found no records. Falling back to Composite Key.');
          const targetStat = get().statistics.find(s => s.id === id);
          if (targetStat) {
              const safeProductIds = getSafeDbProductIds(targetStat.productId);
              
              const dateSlash = toEnglishDigits(targetStat.date); 
              const dateHyphen = dateSlash.replace(/\//g, '-'); 
              const dateVariations = [dateSlash, dateHyphen];

              console.log('3. Fallback Params:', { 
                  farmId: targetStat.farmId, 
                  productIds: safeProductIds, 
                  dateVars: dateVariations 
              });

              // Try every combination until success
              for (const dateVal of dateVariations) {
                  for (const pid of safeProductIds) {
                      if (count && count > 0) break; // Exit if already successful

                      console.log(`4. Trying composite delete: Date=${dateVal}, PID=${pid}`);
                      const retry = await supabase.from('daily_statistics')
                          .delete({ count: 'exact' })
                          .eq('farm_id', targetStat.farmId)
                          .eq('date', dateVal)
                          .eq('product_id', pid);
                      
                      console.log('   Result:', retry);

                      if (retry.error) {
                          error = retry.error;
                      } else {
                          error = null; // Clear previous errors if this query was valid
                      }

                      if (retry.count && retry.count > 0) {
                          count = retry.count;
                      }
                  }
                  if (count && count > 0) break;
              }
          } else {
              console.error('❌ Original record not found locally for fallback.');
          }
      }

      if (error) {
          console.error('❌ DELETE FAILED. Final Error:', error);
          if (error) {
              console.error('Error Code:', error.code);
              console.error('Error Message:', error.message);
          }
          console.groupEnd();
          return { success: false, error: translateError(error) };
      }
      
      if (!count || count === 0) {
          console.warn('❌ Record not found in DB or permission denied.');
          await get().fetchStatistics();
          console.groupEnd();
          return { success: false, error: 'رکورد یافت نشد یا مجوز حذف ندارید.' };
      }

      console.log('✅ Delete Successful.');
      console.groupEnd();
      await get().fetchStatistics();
      return { success: true };
  },

  getLatestInventory: (farmId, productId) => {
    const stats = get().statistics.filter(s => s.farmId === farmId && s.productId === productId);
    if (stats.length === 0) return { units: 0, kg: 0 };
    return { units: stats[0].currentInventory || 0, kg: stats[0].currentInventoryKg || 0 };
  },

  syncSalesFromInvoices: async (farmId, date, productId) => {
      const normalizedDate = normalizeDate(date);
      // FIX: Use fallback for product ID matching here too, BUT only UUIDs
      const safeProductIds = getSafeDbProductIds(productId);

      if (safeProductIds.length === 0) return; // Nothing to sync if no valid UUIDs

      const { data: invoices, error: invError } = await supabase
          .from('invoices')
          .select('total_cartons, total_weight')
          .eq('farm_id', farmId)
          .eq('date', normalizedDate)
          .in('product_id', safeProductIds);

      if (invError) {
          console.error('Sync Sales Error:', invError);
          return;
      }

      const totalSales = invoices?.reduce((sum, inv) => sum + (inv.total_cartons || 0), 0) || 0;
      
      // Update logic needs to handle legacy IDs
      const { data: statRecords } = await supabase
          .from('daily_statistics')
          .select('id, production, previous_balance')
          .eq('farm_id', farmId)
          .eq('date', normalizedDate)
          .in('product_id', safeProductIds);

      if (statRecords && statRecords.length > 0) {
          const statRecord = statRecords[0]; // Take the first match
          const newInventory = (statRecord.previous_balance || 0) + (statRecord.production || 0) - totalSales;
          
          const updatePayload: any = {
              sales: totalSales,
              current_inventory: newInventory,
              updated_at: new Date().toISOString()
          };

          let { error } = await supabase.from('daily_statistics').update(updatePayload).eq('id', statRecord.id);
          
          // Retry if updated_at is missing
          if (error && error.code === 'PGRST204' && (error.message.includes('updated_at') || error.message.includes('column'))) {
              delete updatePayload.updated_at;
              await supabase.from('daily_statistics').update(updatePayload).eq('id', statRecord.id);
          }
      }
  }
}));
