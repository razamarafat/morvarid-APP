
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { normalizeDate } from '../utils/dateUtils';
import { useSyncStore } from './syncStore';
import { useAuthStore } from './authStore';
import { calculateProductUsage, InvoiceItem } from '../utils/inventoryUtils';

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
    separationAmount?: number; // Smart Sorting: Approximate sorting loss/waste
    createdAt: number;
    updatedAt?: number;
    creatorName?: string;
    creatorRole?: string;
    createdBy?: string;
    isPending?: boolean; // Optimistic UI Flag
    isOffline?: boolean; // Offline Queue Flag
}

import { getErrorMessage } from '../utils/errorUtils';
import { mapLegacyProductId } from '../utils/productUtils';

export const calculateFarmStats = (input: {
    previousStock: number;
    production: number;
    sales: number;
    previousStockKg?: number;
    productionKg?: number;
    salesKg?: number;
}) => {
    const previousStock = input.previousStock || 0;
    const production = input.production || 0;
    const totalDeduction = input.sales || 0; // Renamed for clarity: this is Total Deducted Usage
    const totalDeductionKg = input.salesKg || 0;

    const previousStockKg = input.previousStockKg || 0;
    const productionKg = input.productionKg || 0;

    return {
        remaining: (previousStock + production) - totalDeduction,
        remainingKg: (previousStockKg + productionKg) - totalDeductionKg
    };
};

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
            const currentUser = useAuthStore.getState().user;

            let query = supabase
                .from('daily_statistics')
                .select('*, profiles!created_by(full_name, role)')
                .order('date', { ascending: false })
                .limit(3000);

            // Role-based filtering for fetching
            if (currentUser && currentUser.role !== 'ADMIN') {
                // Fetch records for all assigned farms to ensure visibility
                const farmIds = (currentUser.assignedFarms || []).map(f => f.id);
                if (farmIds.length > 0) {
                    query = query.in('farm_id', farmIds);
                } else if (currentUser.role === 'SALES' || currentUser.role === 'REGISTRATION') {
                    // If no farms assigned, they can't see anything anyway
                    set({ statistics: [], isLoading: false });
                    return;
                }
            }

            const { data: statsData, error } = await query;

            if (error) {
                // Fallback for relational query failure
                console.warn('[StatisticsStore] Relational select failed, retrying simple select', error);
                let simpleQuery = supabase
                    .from('daily_statistics')
                    .select('*')
                    .order('date', { ascending: false })
                    .limit(3000);

                if (currentUser && currentUser.role !== 'ADMIN') {
                    simpleQuery = simpleQuery.eq('created_by', currentUser.id);
                }
                const simple = await simpleQuery;
                if (simple.error) throw simple.error;

                const mappedStats = simple.data.map((s: any) => ({
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
                    separationAmount: s.separation_amount || 0,
                    createdAt: s.created_at ? new Date(s.created_at).getTime() : Date.now(),
                    updatedAt: s.updated_at ? new Date(s.updated_at).getTime() : undefined,
                    createdBy: s.created_by,
                    creatorName: 'شما', // Simplified fallback
                    creatorRole: currentUser?.role,
                }));
                set({ statistics: mappedStats, isLoading: false });
                return;
            }

            if (statsData) {
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
                    separationAmount: s.separation_amount || 0,
                    createdAt: s.created_at ? new Date(s.created_at).getTime() : Date.now(),
                    updatedAt: s.updated_at ? new Date(s.updated_at).getTime() : undefined,
                    createdBy: s.created_by,
                    creatorName: s.profiles?.full_name || (s.created_by === currentUser?.id ? 'شما' : 'کاربر حذف شده'),
                    creatorRole: s.profiles?.role || s.creator_role
                }));
                set({ statistics: mappedStats, isLoading: false });
            } else {
                set({ statistics: [], isLoading: false });
            }
        } catch (e) {
            console.error("Fetch Statistics Failed:", e);
            set({ statistics: [], isLoading: false });
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
            // 1. Fetch current stat data
            const currentStats = get().statistics;
            const currentStat = currentStats.find(s => s.id === id);
            if (!currentStat) {
                return { success: false, error: 'Statistic not found' };
            }

            // --- STRICT VALIDATION GUARD ---
            // If reducing quantity, ensure we don't drop below what's already sold.
            // effectively: (NewPrevious + NewProduction) must be >= TotalSold

            // Only run this check if we are online (can query invoices) and not syncing (sync implies force update)
            if (!isSyncing && navigator.onLine) {
                const newProduction = updates.production !== undefined ? Number(updates.production) : currentStat.production;
                const newPreviousBalance = updates.previousBalance !== undefined ? Number(updates.previousBalance) : currentStat.previousBalance;
                const totalAvailable = newProduction + newPreviousBalance;

                // Query DB for strict sales check
                const { data: relatedInvoices, error: invError } = await supabase
                    .from('invoices')
                    .select('product_id, total_cartons, total_weight, source_product_id, converted_amount, is_converted')
                    .match({
                        farm_id: currentStat.farmId,
                        date: normalizeDate(currentStat.date)
                    });

                if (!invError && relatedInvoices) {
                    // Cast to InvoiceItem to satisfy TS if needed, or rely on duck typing
                    const usage = calculateProductUsage(relatedInvoices as InvoiceItem[], currentStat.productId);

                    if (totalAvailable < usage.usageCartons) {
                        return {
                            success: false,
                            error: `خطا: مقدار موجودی (${totalAvailable}) کمتر از مقدار فروخته شده (${usage.usageCartons}) است.`
                        };
                    }
                }
            }
            // -------------------------------

            // 2. Check if there are actual changes
            const oldDataStr = JSON.stringify({
                production: String(currentStat.production || ''),
                previousBalance: String(currentStat.previousBalance || ''),
                currentInventory: String(currentStat.currentInventory || ''),
                productionKg: String(currentStat.productionKg || ''),
                previousBalanceKg: String(currentStat.previousBalanceKg || ''),
                currentInventoryKg: String(currentStat.currentInventoryKg || ''),
                separationAmount: String(currentStat.separationAmount || '')
            });
            const newDataStr = JSON.stringify({
                production: String(updates.production ?? ''),
                previousBalance: String(updates.previousBalance ?? ''),
                currentInventory: String(updates.currentInventory ?? ''),
                productionKg: String(updates.productionKg ?? ''),
                previousBalanceKg: String(updates.previousBalanceKg ?? ''),
                currentInventoryKg: String(updates.currentInventoryKg ?? ''),
                separationAmount: String(updates.separationAmount ?? '')
            });

            if (oldDataStr === newDataStr) {
                return { success: true }; // No changes detected
            }

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
            if (updates.separationAmount !== undefined) dbUpdates.separation_amount = updates.separationAmount;

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
        // 1. Get User from Local Store
        const currentUser = useAuthStore.getState().user;
        if (!currentUser) return { success: false, error: "Auth Error: User not logged in" };

        // 2. OPTIMISTIC UI UPDATE (Immediate)
        const tempIds: string[] = [];
        const optimisticStats: DailyStatistic[] = stats.map(s => {
            const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            tempIds.push(tempId);
            return {
                ...s,
                id: tempId,
                createdAt: Date.now(),
                createdBy: currentUser.id,
                creatorName: currentUser.fullName,
                creatorRole: currentUser.role,
                isPending: !isSyncing,
                isOffline: !navigator.onLine && !isSyncing
            } as DailyStatistic;
        });

        if (!isSyncing) {
            set(state => ({ statistics: [...optimisticStats, ...state.statistics] }));
        }

        // 3. Offline Check
        if (!isSyncing && !navigator.onLine) {
            stats.forEach(s => useSyncStore.getState().addToQueue('STAT', s));
            return { success: true, error: 'ذخیره در صف آفلاین' };
        }

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
                separation_amount: s.separationAmount || 0,
                created_by: currentUser.id
            }));

            const { error } = await supabase.from('daily_statistics').upsert(dbStats, {
                onConflict: 'farm_id,date,product_id',
                ignoreDuplicates: false
            });

            if (error) {
                if (error.message?.includes('Could not find') || error.code === 'PGRST204' || error.code === '42703') {
                    console.error("CRITICAL: Database schema mismatch. Please run supabase_setup.sql");
                    return { success: false, error: "ساختار دیتابیس قدیمی است. لطفا فایل supabase_setup.sql را در Supabase اجرا کنید." };
                }
                throw error;
            }

            await get().fetchStatistics();
            return { success: true };
        } catch (e: any) {
            // If network error during request, add to queue
            if (!isSyncing && (getErrorMessage(e).toLowerCase().includes('fetch') || !navigator.onLine)) {
                // Update local status to offline instead of rolling back
                set(state => ({
                    statistics: state.statistics.map(s =>
                        tempIds.includes(s.id) ? { ...s, isPending: false, isOffline: true } : s
                    )
                }));
                stats.forEach(s => useSyncStore.getState().addToQueue('STAT', s));
                return { success: true, error: 'ذخیره در صف آفلاین (خطای شبکه)' };
            }

            // Real error (duplicate, etc.) -> Rollback
            if (!isSyncing) {
                set(state => ({
                    statistics: state.statistics.filter(s => !tempIds.includes(s.id))
                }));
            }

            console.error("Upsert Stats Error:", getErrorMessage(e));
            return { success: false, error: getErrorMessage(e) };
        }
    },

    deleteStatistic: async (id, isSyncing = false) => {
        try {
            // --- STRICT VALIDATION GUARD ---
            if (!isSyncing && navigator.onLine) {
                const statToDelete = get().statistics.find(s => s.id === id);
                if (statToDelete) {
                    const { data: relatedInvoices, error: invError } = await supabase
                        .from('invoices')
                        .select('product_id, total_cartons, total_weight, source_product_id, converted_amount, is_converted')
                        .match({
                            farm_id: statToDelete.farmId,
                            date: normalizeDate(statToDelete.date)
                        });

                    if (!invError && relatedInvoices) {
                        const usage = calculateProductUsage(relatedInvoices as InvoiceItem[], statToDelete.productId);
                        if (usage.usageCartons > 0) {
                            return {
                                success: false,
                                error: 'خطا: برای این محصول فروش یا تبدیل ثبت شده است. ابتدا حواله‌ها را حذف کنید.'
                            };
                        }
                    }
                }
            }
            // -------------------------------

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

            // 1. Fetch ALL invoices for this farm/date (filtering loosely first)
            const { data: allInvoices } = await supabase.from('invoices')
                .select('*')
                .match({ farm_id: farmId, date: normalizedDate });

            if (!allInvoices) return;

            // 3. Calculate USAGE via Centralized Utility
            // This handles Direct Sales vs Converted Sales automatically
            const usage = calculateProductUsage(allInvoices as InvoiceItem[], productId);

            // Total deduction from inventory (Direct + Source usage)
            const totalDeducted = usage.usageCartons;
            const totalDeductedKg = usage.usageWeight;

            // 4. Calculate SALES DISPLAY (for Reports)
            // Still need to sum up direct invoices for reporting "how much of this product was sold"
            // (Regardless of where stock came from)
            const directInvoices = allInvoices.filter(i => i.product_id === productId);
            const totalSalesDisplay = directInvoices.reduce((sum, inv) => sum + (inv.total_cartons || 0), 0);
            const totalSalesKgDisplay = directInvoices.reduce((sum, inv) => sum + (inv.total_weight || 0), 0);


            // 5. Find the daily statistic record
            const { data: stats } = await supabase.from('daily_statistics')
                .select('*')
                .match({ farm_id: farmId, date: normalizedDate, product_id: productId })
                .single();

            if (stats) {
                // 6. Recalculate inventory
                // Remaining = Previous + Production - DEDUCTED
                const remaining = (stats.previous_balance || 0) + (stats.production || 0) - totalDeducted;
                const remainingKg = (stats.previous_balance_kg || 0) + (stats.production_kg || 0) - totalDeductedKg;

                // 7. Update the record
                await supabase.from('daily_statistics').update({
                    sales: totalSalesDisplay,
                    sales_kg: totalSalesKgDisplay,
                    current_inventory: remaining,
                    current_inventory_kg: remainingKg,
                    updated_at: new Date().toISOString()
                }).eq('id', stats.id);

                get().fetchStatistics();
            }
        } catch (e) {
            console.error('Sync Sales Error', e);
        }
    }
}));
