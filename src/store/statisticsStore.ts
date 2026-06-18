
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { normalizeDate } from '../utils/dateUtils';
import { useSyncStore } from './syncStore';
import { useAuthStore } from './authStore';
import { useFarmStore } from './farmStore';
import { useInvoiceStore } from './invoiceStore';
import { calculateProductUsage, InvoiceItem } from '../utils/inventoryUtils';
import { UserRole } from '../types';

// ============================================================================
// Sales Voucher Impact (Feature 1: Dynamic Immediate Visibility, 20260618)
// ============================================================================
// Flattened list of every submitted sales_voucher_lines row across the user's
// accessible farms. Used by Farm Monitoring Cards to surface "what the Sales
// user already sold" BEFORE the Operator has had a chance to copy it to their
// daily voucher. Distinct from the invoice store on purpose so the two roll
// up cleanly in displaySales = totalCartons(invoices) + uncopiedQty(here).
export interface SalesVoucherLineImpact {
    lineId: string;
    voucherId: string;
    voucherNumber: string;
    farmId: string;
    voucherDate: string;
    productId: string;
    quantity: number;
}

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
    updatedBy?: string; // 20260619 — Audit trail: editor's profile.id (FK public.profiles.id)
    editorName?: string; // 20260619 — Audit trail: human-readable editor name from profiles!updated_by
    creatorName?: string;
    creatorRole?: string;
    createdBy?: string;
    isPending?: boolean; // Optimistic UI Flag
    isOffline?: boolean; // Offline Queue Flag
}

import { getErrorMessage } from '../utils/errorUtils';
import { mapLegacyProductId } from '../utils/productUtils';
import { isShrinkPack } from '../utils/sortUtils';
import { getCorrectedInventory } from '../utils/inventoryUtils';

export const calculateFarmStats = (input: {
    previousStock: number;
    production: number;
    sales: number;
    previousStockKg?: number;
    productionKg?: number;
    salesKg?: number;
    separationAmount?: number;
}) => {
    const previousStock = input.previousStock || 0;
    const production = input.production || 0;
    const separation = input.separationAmount || 0;
    const totalDeduction = input.sales || 0; // Renamed for clarity: this is Total Deducted Usage
    const totalDeductionKg = input.salesKg || 0;

    const previousStockKg = input.previousStockKg || 0;
    const productionKg = input.productionKg || 0;

    return {
        remaining: (previousStock + production + separation) - totalDeduction,
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
    /** All submitted sales_voucher_lines rows on the user's accessible farms
     * (Feature 1: Dynamic Immediate Visibility, migration 20260618). */
    salesVoucherImpacts: SalesVoucherLineImpact[];
    fetchSalesVoucherImpacts: () => Promise<void>;
    /** Returns the SUM of uncopied sales_voucher_lines.quantity for this
     * (farm,date,product). "Uncopied" = NO invoice has set
     * source_sales_voucher_line_id to that line's id (yet), so the user has
     * NOT seen this quantity reflected in any daily voucher entry. */
    getUncopiedSalesVouchersQty: (farmId: string, date: string, productId: string) => number;
}

export const useStatisticsStore = create<StatisticsState>((set, get) => ({
    statistics: [],
    salesVoucherImpacts: [],
    isLoading: false,

    fetchStatistics: async (inputFilters?: { farmId?: string }) => {
        set({ isLoading: true });
        try {
            const currentUser = useAuthStore.getState().user;

            // SECURITY (20260619): REGISTRATION operators — IGNORE any caller-
            // supplied filters.farmId. The operator's allowed scope is exactly
            // their `assignedFarms` (enforced by RLS via `can_access_farm()` in
            // `daily_statistics` FOR ALL). Frontend hard lock prevents any caller-
            // supplied filter from widening scope (defense-in-depth alongside
            // `in('farm_id', assignedFarmIds)` below + RLS).
            const sanitizedFilters = currentUser?.role === UserRole.REGISTRATION && inputFilters
                ? { ...inputFilters, farmId: undefined }
                : inputFilters;

            let query = supabase
                .from('daily_statistics')
                // 20260619 — Audit trail: also pull the editor's name via
                // profiles!updated_by so we can show "آخرین ویرایش توسط".
                .select('*, profiles!created_by(full_name, role), editor:profiles!updated_by(full_name)')
                .order('date', { ascending: false })
                .limit(3000);

            // Role-based filtering for fetching
            if (currentUser && currentUser.role !== 'ADMIN') {
                if (currentUser.role === 'SALES') {
                    // Sales can see all statistics, no farm filter needed
                    if (sanitizedFilters?.farmId) query = query.eq('farm_id', sanitizedFilters.farmId);
                } else {
                    // REGISTRATION sees only assigned farms
                    const farmIds = (currentUser.assignedFarms || []).map(f => f.id);
                    if (farmIds.length > 0) {
                        query = query.in('farm_id', farmIds);
                    } else {
                        // If no farms assigned, they can't see anything anyway
                        set({ statistics: [], isLoading: false });
                        return;
                    }
                }
            } else if (sanitizedFilters?.farmId) {
                // Admin can also narrow to a single farm via caller-supplied filter
                query = query.eq('farm_id', sanitizedFilters.farmId);
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
                    if (currentUser.role === 'SALES') {
                        // No filter
                    } else {
                        simpleQuery = simpleQuery.eq('created_by', currentUser.id);
                    }
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
                    updatedBy: s.updated_by,
                    editorName: undefined, // Simple-select fallback path doesn't join profiles.
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
                    updatedBy: s.updated_by,
                    editorName: s.editor?.full_name ?? undefined,
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
        // Feature 1: Sales Voucher submitted → Farm Monitoring Cards must
        // re-render immediately. We listen on BOTH sales_vouchers (status
        // flip / delete) AND sales_voucher_lines (line insert / update /
        // delete) so React refreshes the dashboard cards as soon as the
        // sales user commits a voucher, even before the Operator has copied.
        const channel = supabase
            .channel('public:sales_monitoring')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_statistics' }, () => {
                get().fetchStatistics();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_vouchers' }, () => {
                get().fetchSalesVoucherImpacts();
                get().fetchStatistics();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_voucher_lines' }, () => {
                get().fetchSalesVoucherImpacts();
                get().fetchStatistics();
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    },

    // ========================================================================
    // 20260618 — Feature 1: Dynamic Immediate Visibility
    // Fetches every line from submitted sales_vouchers the current user can
    // see (admin: all; sales: all; operator: assigned farms). Stored flat on
    // the store so the dashboard compute line is a cheap O(N) scan and
    // deltas (per-line live updates) work via the channel above.
    // ========================================================================
    fetchSalesVoucherImpacts: async () => {
        try {
            const currentUser = useAuthStore.getState().user;

            // Build the role-aware set of farm IDs the user can access; null
            // means "all farms" (admin/sales).
            let accessibleFarmIds: string[] | null = null;
            if (currentUser && currentUser.role !== 'ADMIN' && currentUser.role !== 'SALES') {
                accessibleFarmIds = (currentUser.assignedFarms || []).map(f => f.id);
                if (accessibleFarmIds.length === 0) {
                    set({ salesVoucherImpacts: [] });
                    return;
                }
            }

            // Pull every sales voucher line; filter to "submitted" via the
            // join. We avoid `select('*, sales_vouchers(*)')` because the
            // orphan-FK fallback we've used elsewhere produces silent empty
            // arrays; a plain inner join with explicit column list is safer.
            const { data, error } = await supabase
                .from('sales_voucher_lines')
                .select('id, product_id, quantity, voucher_id, sales_vouchers!inner(id, voucher_number, farm_id, voucher_date, status)');

            if (error) {
                console.warn('[StatisticsStore] fetchSalesVoucherImpacts relational select failed, falling back', error);
                const fallback = await supabase
                    .from('sales_voucher_lines')
                    .select('id, product_id, quantity, voucher_id');
                if (fallback.error) throw fallback.error;
                // Without the join we can't enforce submitted-only / farm
                // filtering; do a second hop for the parent voucher set.
                const voucherIds = Array.from(new Set((fallback.data || []).map((r: any) => r.voucher_id).filter(Boolean)));
                if (voucherIds.length === 0) {
                    set({ salesVoucherImpacts: [] });
                    return;
                }
                const { data: vouchers } = await supabase
                    .from('sales_vouchers')
                    .select('id, voucher_number, farm_id, voucher_date, status')
                    .in('id', voucherIds);
                const voucherMap = new Map<string, any>((vouchers || []).map((v: any) => [v.id, v]));
                const impacts: SalesVoucherLineImpact[] = (fallback.data || [])
                    .map((row: any) => {
                        const v = voucherMap.get(row.voucher_id);
                        if (!v || v.status !== 'submitted') return null;
                        if (accessibleFarmIds && !accessibleFarmIds.includes(v.farm_id)) return null;
                        return {
                            lineId: row.id,
                            voucherId: row.voucher_id,
                            voucherNumber: v.voucher_number,
                            farmId: v.farm_id,
                            voucherDate: normalizeDate(v.voucher_date),
                            productId: row.product_id,
                            quantity: Number(row.quantity) || 0,
                        };
                    })
                    .filter(Boolean) as SalesVoucherLineImpact[];
                set({ salesVoucherImpacts: impacts });
                return;
            }

            const impacts: SalesVoucherLineImpact[] = (data || [])
                .filter((row: any) => {
                    const v = row.sales_vouchers;
                    if (!v || v.status !== 'submitted') return false;
                    if (accessibleFarmIds && !accessibleFarmIds.includes(v.farm_id)) return false;
                    return true;
                })
                .map((row: any) => ({
                    lineId: row.id,
                    voucherId: row.voucher_id,
                    voucherNumber: row.sales_vouchers.voucher_number,
                    farmId: row.sales_vouchers.farm_id,
                    voucherDate: normalizeDate(row.sales_vouchers.voucher_date),
                    productId: row.product_id,
                    quantity: Number(row.quantity) || 0,
                }));

            set({ salesVoucherImpacts: impacts });
        } catch (e) {
            console.warn('[StatisticsStore] fetchSalesVoucherImpacts failed', e);
            // Don't crash the dashboard on a transient failure; keep prior cache.
        }
    },

    // Returns the SUM of quantity on uncopied sales_voucher_lines for the
    // given (farm,date,product). Cheap because salesVoucherImpacts is a flat
    // array bounded by the user's accessible farms.
    getUncopiedSalesVouchersQty: (farmId: string, date: string, productId: string) => {
        const normalizedDate = normalizeDate(date);
        const allInvoices = useInvoiceStore.getState().invoices || [];
        // Build the set of line IDs that have ALREADY been copied to an
        // invoice. Those lines are accounted for via the invoice's totalCartons
        // so we MUST subtract them to avoid double-counting in displaySales.
        const copiedLineIds = new Set<string>();
        for (const inv of allInvoices) {
            if (inv.isFromSalesVoucher && inv.sourceSalesVoucherLineId) {
                copiedLineIds.add(inv.sourceSalesVoucherLineId);
            }
        }
        let total = 0;
        for (const impact of get().salesVoucherImpacts) {
            if (impact.farmId !== farmId) continue;
            if (impact.voucherDate !== normalizedDate) continue;
            if (impact.productId !== productId) continue;
            if (copiedLineIds.has(impact.lineId)) continue;
            total += impact.quantity;
        }
        return total;
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
            // SECURITY (20260619): REGISTRATION operators — defense-in-depth pre-
            // mutation farm_id check. RLS is the final guard, but this ensures
            // any stale or forged id passed in is rejected at the function entry.
            // (Editing user reuses the same `editingUser` resolved further below
            // before the DB write to avoid duplicating useAuthStore.getState().)
            const editingUserForGuard = useAuthStore.getState().user;
            if (editingUserForGuard?.role === UserRole.REGISTRATION) {
                const allowedFarmIds = (editingUserForGuard.assignedFarms || []).map(f => f.id);
                if (!allowedFarmIds.includes(currentStat.farmId)) {
                    return { success: false, error: 'شما مجاز به ویرایش این رکورد نیستید.' };
                }
            }

            if (!isSyncing && navigator.onLine) {
                const newProduction = updates.production !== undefined ? Number(updates.production) : currentStat.production;
                const newPreviousBalance = updates.previousBalance !== undefined ? Number(updates.previousBalance) : currentStat.previousBalance;
                const totalAvailable = newProduction + newPreviousBalance;

                // Query DB for strict sales check
                const { data: relatedInvoices, error: invError } = await supabase
                    .from('invoices')
                    .select('product_id, total_cartons, total_weight, source_product_id, converted_amount, is_converted, is_from_sales_voucher')
                    .match({
                        farm_id: currentStat.farmId,
                        date: normalizeDate(currentStat.date)
                    });

                if (!invError && relatedInvoices) {
                    // Filter out invoices copied from sales vouchers (inventory already deducted)
                    const nonSalesVoucherInvoices = relatedInvoices.filter((inv: any) => !inv.is_from_sales_voucher);
                    const usage = calculateProductUsage(nonSalesVoucherInvoices as InvoiceItem[], currentStat.productId);

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

            // 20260619 — Audit trail: explicitly set updated_by (FK profiles.id)
            // alongside updated_at so the BEFORE UPDATE trigger records WHO did
            // the edit. The DB trigger also sets it defensively (backstops any
            // missing app-side field), but explicit is better for forensic tracing.
            const editingUser = useAuthStore.getState().user;
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
            dbUpdates.updated_by = editingUser?.id || null;

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
            // SECURITY (20260619): REGISTRATION operators — defense-in-depth pre-
            // mutation farm_id check. RLS is the final guard, but this rejects
            // any stale or forged id passed in before any DB round-trip.
            // Resolve the cached stat ONCE here so the security check is
            // unconditional (avoids the race where `cachedStat` was null at
            // the security check but became available after re-reading).
            const deletingUser = useAuthStore.getState().user;
            const cachedStat = get().statistics.find(s => s.id === id);
            if (deletingUser?.role === UserRole.REGISTRATION) {
                if (!cachedStat) {
                    return { success: false, error: 'رکورد یافت نشد.' };
                }
                const allowedFarmIds = (deletingUser.assignedFarms || []).map(f => f.id);
                if (!allowedFarmIds.includes(cachedStat.farmId)) {
                    return { success: false, error: 'شما مجاز به حذف این رکورد نیستید.' };
                }
            }

            // --- STRICT VALIDATION GUARD ---
            if (!isSyncing && navigator.onLine) {
                const statToDelete = cachedStat;
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
        // Compute on-the-fly for correct value (handles old records missing separation)
        const latest = sorted[0];
        const productName = useFarmStore.getState().getProductById?.(productId)?.name || '';
        const corrected = getCorrectedInventory(latest, productName);
        return { units: corrected.units, kg: corrected.kg };
    },

    syncSalesFromInvoices: async (farmId, date, productId) => {
        try {
            const normalizedDate = normalizeDate(date);

            // 1. Fetch ALL invoices for this farm/date (filtering loosely first)
            const { data: allInvoices } = await supabase.from('invoices')
                .select('*')
                .match({ farm_id: farmId, date: normalizedDate });

            // 2. Fetch uncopied sales voucher impact for this (farm,date,product)
            //    using the central store helper. This is what Feature 1 leans
            //    on: a Sales submission's qty must show in the dashboard even
            //    if NO operator has copied it to a daily voucher yet.
            const uncopiedSalesVouchersCartons = get().getUncopiedSalesVouchersQty(farmId, normalizedDate, productId);

            if (!allInvoices) {
                // Edge case: still bump the stat we don't have here to keep
                // the math in step (only happens for synthetic rows).
                return;
            }

            // 3. SEPARATE: Invoices from sales vouchers should NOT affect physical inventory
            //    (inventory was already deducted when the sales voucher was submitted,
            //     and the 20260618 trigger `tr_invoice_reconciliation` will post a
            //     sale_reconciliation row whenever the Operator's qty differs —
            //     so net effect equals exactly the Operator's totalCartons).
            const nonSalesVoucherInvoices = allInvoices.filter((inv: any) => !inv.is_from_sales_voucher);

            // 4. Calculate USAGE via Centralized Utility (only non-sales-voucher
            //    invoices contribute). `uncopiedSalesVouchersCartons` is added
            //    directly to physicalUsage because the sales_voucher_lines
            //    trigger has already deducted it from inventory and we MUST
            //    surface that deduction on the Farm Monitoring "Remaining" card.
            const usage = calculateProductUsage(nonSalesVoucherInvoices as InvoiceItem[], productId);
            const totalDeducted = usage.usageCartons + uncopiedSalesVouchersCartons;
            const totalDeductedKg = usage.usageWeight; // sales_voucher_lines trigger stores qty_out_kg=0

            // 5. Calculate SALES DISPLAY (for the "فروش" column on the card).
            //    Display = sum of all invoices for this product (STANDALONE + COPIED)
            //            + sum of UNCOPIED sales_voucher_lines.
            //    This is the UNIQUE zero-double-counting decomposition:
            //      • Copied sales voucher → contributes EXACTLY ONCE via the
            //        invoice's totalCartons; the reconciliation trigger handles
            //        the inventory drift, NOT a second displaySales entry.
            //      • Standalone Operator invoice → contributes via totalCartons.
            //      • Uncopied sales voucher → contributes via the line's qty.
            const directInvoices = allInvoices.filter(i => i.product_id === productId);
            const totalSalesDisplay = directInvoices.reduce((sum, inv) => sum + (inv.total_cartons || 0), 0) + uncopiedSalesVouchersCartons;
            const totalSalesKgDisplay = directInvoices.reduce((sum, inv) => sum + (inv.total_weight || 0), 0);


            // 6. Find the daily statistic record
            const { data: stats } = await supabase.from('daily_statistics')
                .select('*')
                .match({ farm_id: farmId, date: normalizedDate, product_id: productId })
                .single();

            if (stats) {
                // 7. Recalculate inventory
                // Remaining = Previous + Production + Separation - DEDUCTED
                const productName = useFarmStore.getState().getProductById?.(productId)?.name || '';
                const effectiveSeparation = !isShrinkPack(productName) ? (stats.separation_amount || 0) : 0;
                const remaining = (stats.previous_balance || 0) + (stats.production || 0) + effectiveSeparation - totalDeducted;
                const remainingKg = (stats.previous_balance_kg || 0) + (stats.production_kg || 0) - totalDeductedKg;

                // 8. Update the record
                // 20260619 — Audit trail: include updated_by so sales-drives-stats
                // recompute runs are also attributed (e.g. when an Operator copies
                // a sales voucher into a daily invoice, the stat recomputation will
                // show who triggered the inventory roll).
                await supabase.from('daily_statistics').update({
                    sales: totalSalesDisplay,
                    sales_kg: totalSalesKgDisplay,
                    current_inventory: remaining,
                    current_inventory_kg: remainingKg,
                    updated_at: new Date().toISOString(),
                    updated_by: useAuthStore.getState().user?.id || null,
                }).eq('id', stats.id);

                get().fetchStatistics();
            }
        } catch (e) {
            console.error('Sync Sales Error', e);
        }
    }
}));
