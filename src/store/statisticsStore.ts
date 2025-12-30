
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { normalizeDate } from '../utils/dateUtils';
import { useSyncStore } from './syncStore';
import { useAuthStore } from './authStore';

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

import { getErrorMessage } from '../utils/errorUtils';
import { mapLegacyProductId } from '../utils/productUtils';

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
            const { data: statsData, error: statsError } = await supabase
                .from('daily_statistics')
                .select('*')
                .order('date', { ascending: false })
                .limit(3000);

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
        try {
            const dbUpdates: any = {};
            // Map camelCase to snake_case
            if (updates.farmId !== undefined) dbUpdates.farm_id = updates.farmId;
            if (updates.date !== undefined) dbUpdates.date = updates.date;
            if (updates.productId !== undefined) dbUpdates.product_id = updates.productId;
            if (updates.previousBalance !== undefined) dbUpdates.previous_balance = updates.previousBalance;
            if (updates.previousBalanceKg !== undefined) dbUpdates.previous_balance_kg = updates.previousBalanceKg;
            if (updates.production !== undefined) dbUpdates.production = updates.production;
            if (updates.productionKg !== undefined) dbUpdates.production_kg = updates.productionKg;
            if (updates.sales !== undefined) dbUpdates.sales = updates.sales;
            if (updates.salesKg !== undefined) dbUpdates.sales_kg = updates.salesKg;
            if (updates.currentInventory !== undefined) dbUpdates.current_inventory = updates.currentInventory;
            if (updates.currentInventoryKg !== undefined) dbUpdates.current_inventory_kg = updates.currentInventoryKg;

            dbUpdates.updated_at = new Date().toISOString();

            const { error } = await supabase.from('daily_statistics').update(dbUpdates).eq('id', id);
            if (error) throw error;
            await get().fetchStatistics();
            return { success: true };
        } catch (e: any) {
            if (!isSyncing && (!navigator.onLine || getErrorMessage(e).toLowerCase().includes('fetch'))) {
                useSyncStore.getState().addToQueue('UPDATE_STAT', { id, updates });
                return { success: true, error: 'ویرایش در صف آفلاین ذخیره شد' };
            }
            return { success: false, error: getErrorMessage(e) };
        }
    },

    bulkUpsertStatistics: async (stats, isSyncing = false) => {
        // 1. Offline Check First
        if (!isSyncing && !navigator.onLine) {
            stats.forEach(s => useSyncStore.getState().addToQueue('STAT', s));
            return { success: true, error: 'ذخیره در صف آفلاین' };
        }

        // 2. Get User from Local Store
        const currentUser = useAuthStore.getState().user;
        if (!currentUser) return { success: false, error: "Auth Error: User not logged in" };

        try {
            // MAP camelCase (Frontend) TO snake_case (Database)
            const dbStats = stats.map(s => ({
                farm_id: s.farmId,
                date: normalizeDate(s.date),
                product_id: s.productId,
                previous_balance: s.previousBalance,
                previous_balance_kg: s.previousBalanceKg,
                production: s.production,
                production_kg: s.productionKg,
                sales: s.sales,
                sales_kg: s.salesKg,
                current_inventory: s.currentInventory,
                current_inventory_kg: s.currentInventoryKg,
                created_by: currentUser.id // Use cached ID
            }));

            // DEBUG LOG: Ensure payload is correct before sending
            console.log('[StatisticsStore] Upsert Payload:', dbStats);

            // FIX: Add onConflict to handle unique constraint violation on 'farm_id, date, product_id'
            // We ignore duplicate key error and UPDATE instead.
            const { error } = await supabase.from('daily_statistics').upsert(dbStats, {
                onConflict: 'farm_id,date,product_id',
                ignoreDuplicates: false // We want to UPDATE if it exists
            });

            if (error) {
                // DETECT SCHEMA ERROR: If column missing, warn user
                if (error.message?.includes('Could not find') || error.code === 'PGRST204' || error.code === '42703') {
                    console.error("CRITICAL: Database schema mismatch. Please run supabase_setup.sql");
                    return { success: false, error: "ساختار دیتابیس قدیمی است. لطفا فایل supabase_setup.sql را در Supabase اجرا کنید." };
                }
                throw error;
            }

            await get().fetchStatistics();
            return { success: true };
        } catch (e: any) {
            // Check for Network Error specifically
            const errMsg = getErrorMessage(e);
            if (!isSyncing && (errMsg.toLowerCase().includes('fetch') || !navigator.onLine)) {
                stats.forEach(s => useSyncStore.getState().addToQueue('STAT', s));
                return { success: true, error: 'ذخیره در صف آفلاین (خطای شبکه)' };
            }

            console.error("Upsert Stats Error:", errMsg);
            return { success: false, error: errMsg };
        }
    },

    deleteStatistic: async (id, isSyncing = false) => {
        try {
            const { error } = await supabase.from('daily_statistics').delete().eq('id', id);
            if (error) throw error;
            await get().fetchStatistics();
            return { success: true };
        } catch (e: any) {
            if (!isSyncing && (!navigator.onLine || getErrorMessage(e).toLowerCase().includes('fetch'))) {
                useSyncStore.getState().addToQueue('DELETE_STAT', { id });
                return { success: true, error: 'حذف در صف آفلاین ذخیره شد' };
            }
            return { success: false, error: getErrorMessage(e) };
        }
    },

    getLatestInventory: (farmId, productId) => {
        const stats = get().statistics.filter(s => s.farmId === farmId && s.productId === productId);
        if (stats.length === 0) return { units: 0, kg: 0 };
        // Sort by date descending to get true latest
        const sorted = [...stats].sort((a, b) => b.date.localeCompare(a.date));
        return { units: sorted[0].currentInventory || 0, kg: sorted[0].currentInventoryKg || 0 };
    },

    syncSalesFromInvoices: async (farmId, date, productId) => {
        try {
            const normalizedDate = normalizeDate(date);

            // 1. Fetch all invoices for this day/farm/product
            const { data: invoices } = await supabase.from('invoices')
                .select('total_cartons, total_weight')
                .match({ farm_id: farmId, date: normalizedDate, product_id: productId });

            // 2. Sum totals
            const totalSales = invoices?.reduce((sum, inv) => sum + (inv.total_cartons || 0), 0) || 0;
            const totalSalesKg = invoices?.reduce((sum, inv) => sum + (inv.total_weight || 0), 0) || 0;

            // 3. Find the daily statistic record
            const { data: stats } = await supabase.from('daily_statistics')
                .select('*')
                .match({ farm_id: farmId, date: normalizedDate, product_id: productId })
                .single();

            if (stats) {
                // 4. Recalculate inventory
                // Logic: Current = Previous + Production - Sales
                const newCurrent = (stats.previous_balance || 0) + (stats.production || 0) - totalSales;
                const newCurrentKg = (stats.previous_balance_kg || 0) + (stats.production_kg || 0) - totalSalesKg;

                // 5. Update the record
                await supabase.from('daily_statistics').update({
                    sales: totalSales,
                    sales_kg: totalSalesKg,
                    current_inventory: newCurrent,
                    current_inventory_kg: newCurrentKg,
                    updated_at: new Date().toISOString()
                }).eq('id', stats.id);

                get().fetchStatistics();
            }
        } catch (e) {
            console.error('Sync Sales Error', e);
        }
    }
}));
