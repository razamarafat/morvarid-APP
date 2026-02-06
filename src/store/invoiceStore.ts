
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Invoice } from '../types';
import { useStatisticsStore } from './statisticsStore';
import { normalizeDate } from '../utils/dateUtils';
import { useSyncStore } from './syncStore';
import { useAuthStore } from './authStore';
import { v4 as uuidv4 } from 'uuid';

import { getErrorMessage } from '../utils/errorUtils';
import { mapLegacyProductId } from '../utils/productUtils';

const translateError = (error: any): string => {
    if (!error) return 'خطای ناشناخته';
    const code = error.code || '';
    const status = String(error.status || '');
    if (status === '400' || code === 'PGRST204' || code === '42703') return 'خطای ساختار دیتابیس (ستون یافت نشد).';
    if (code === '23505') return 'شماره حواله تکراری است.';

    // Use the robust extractor for other errors
    return `خطای سیستم: ${getErrorMessage(error)}`;
};

const isNetworkError = (error: any) => {
    if (!error) return false;
    const msg = getErrorMessage(error).toLowerCase();
    return msg.includes('fetch') || msg.includes('network') || msg.includes('connection') || msg.includes('offline');
};

interface InvoiceState {
    invoices: Invoice[];
    isLoading: boolean;
    fetchInvoices: () => Promise<void>;
    addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt'>, isSyncing?: boolean) => Promise<{ success: boolean; error?: string }>;
    bulkAddInvoices: (invoices: Omit<Invoice, 'id' | 'createdAt'>[], isSyncing?: boolean) => Promise<{ success: boolean; error?: string }>;
    updateInvoice: (id: string, updates: Partial<Invoice>, isSyncing?: boolean) => Promise<{ success: boolean; error?: string }>;
    deleteInvoice: (id: string, isSyncing?: boolean) => Promise<{ success: boolean; error?: string }>;
    /**
     * Validate if invoice number is unique for new invoices.
     * @param invoiceNumber - The invoice number to check
     * @param excludeInvoiceId - Optional: when adding items to existing invoice, exclude this invoice's family
     * @returns Promise<{ isValid: boolean; error?: string }>
     */
    validateUnique: (invoiceNumber: string, excludeInvoiceId?: string) => Promise<{ isValid: boolean; error?: string }>;
}

export const useInvoiceStore = create<InvoiceState>((set, get) => ({
    invoices: [],
    isLoading: false,

    fetchInvoices: async () => {
        set({ isLoading: true });
        try {
            const currentUser = useAuthStore.getState().user;

            let query = supabase
                .from('invoices')
                .select('*, profiles!created_by(full_name, role)')
                .order('created_at', { ascending: false })
                .limit(2000);

            // Role-based filtering for fetching
            if (currentUser && currentUser.role !== 'ADMIN') {
                // Fetch records for all assigned farms
                const farmIds = (currentUser.assignedFarms || []).map(f => f.id);
                if (farmIds.length > 0) {
                    query = query.in('farm_id', farmIds);
                } else if (currentUser.role === 'SALES' || currentUser.role === 'REGISTRATION') {
                    set({ invoices: [], isLoading: false });
                    return;
                }
            }

            const { data, error } = await query;

            if (error) {
                console.warn('[InvoiceStore] Relational select failed, retrying simple select', error);
                let simpleQuery = supabase
                    .from('invoices')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(2000);

                if (currentUser && currentUser.role !== 'ADMIN') {
                    simpleQuery = simpleQuery.eq('created_by', currentUser.id);
                }
                const simple = await simpleQuery;
                if (simple.error) throw simple.error;

                const mapped = simple.data.map((i: any) => ({
                    id: i.id,
                    farmId: i.farm_id,
                    date: normalizeDate(i.date),
                    invoiceNumber: i.invoice_number,
                    totalCartons: i.total_cartons,
                    totalWeight: i.total_weight,
                    productId: i.product_id ? mapLegacyProductId(i.product_id) : i.product_id,
                    driverName: i.driver_name,
                    driverPhone: i.driver_phone,
                    plateNumber: i.plate_number,
                    description: i.description,
                    isYesterday: i.is_yesterday,
                    isSorted: i.is_sorted || false,
                    isConverted: i.is_converted || false,
                    sourceProductId: i.source_product_id || undefined,
                    convertedAmount: i.converted_amount || 0,
                    createdAt: i.created_at ? new Date(i.created_at).getTime() : Date.now(),
                    updatedAt: i.updated_at ? new Date(i.updated_at).getTime() : undefined,
                    createdBy: i.created_by,
                    creatorName: 'شما',
                    creatorRole: currentUser?.role,
                }));
                set({ invoices: mapped, isLoading: false });
                return;
            }

            if (data) {
                const mapped = data.map((i: any) => ({
                    id: i.id,
                    farmId: i.farm_id,
                    date: normalizeDate(i.date),
                    invoiceNumber: i.invoice_number,
                    totalCartons: i.total_cartons,
                    totalWeight: i.total_weight,
                    productId: i.product_id ? mapLegacyProductId(i.product_id) : i.product_id,
                    driverName: i.driver_name,
                    driverPhone: i.driver_phone,
                    plateNumber: i.plate_number,
                    description: i.description,
                    isYesterday: i.is_yesterday,
                    isSorted: i.is_sorted || false,
                    isConverted: i.is_converted || false,
                    sourceProductId: i.source_product_id || undefined,
                    convertedAmount: i.converted_amount || 0,
                    createdAt: i.created_at ? new Date(i.created_at).getTime() : Date.now(),
                    updatedAt: i.updated_at ? new Date(i.updated_at).getTime() : undefined,
                    createdBy: i.created_by,
                    creatorName: i.profiles?.full_name || (i.created_by === currentUser?.id ? 'شما' : 'کاربر حذف شده'),
                    creatorRole: i.profiles?.role || i.creator_role
                }));
                set({ invoices: mapped, isLoading: false });
            } else {
                set({ invoices: [], isLoading: false });
            }
        } catch (e) {
            console.error("Fetch Invoices Failed:", e);
            set({ invoices: [], isLoading: false });
        }
    },

    addInvoice: async (inv, isSyncing = false) => {
        return await get().bulkAddInvoices([inv], isSyncing);
    },

    bulkAddInvoices: async (invoicesList, isSyncing = false) => {
        // 1. Get User from Store
        const currentUser = useAuthStore.getState().user;
        if (!currentUser) return { success: false, error: "کاربر لاگین نیست." };

        // 2. Pre-insertion Duplicate Check (Skip if syncing from queue as it was checked then)
        if (!isSyncing) {
            try {
                // Check for duplicates based on (invoice_number, product_id) combination
                const duplicates: string[] = [];
                for (const inv of invoicesList) {
                    const { data: existing, error: checkError } = await supabase
                        .from('invoices')
                        .select('id, invoice_number, product_id')
                        .eq('invoice_number', inv.invoiceNumber)
                        .eq('product_id', inv.productId || null)
                        .limit(1);

                    if (!checkError && existing && existing.length > 0) {
                        duplicates.push(`${inv.invoiceNumber} (محصول تکراری)`);
                    }
                }

                if (duplicates.length > 0) {
                    return {
                        success: false,
                        error: `حواله‌های زیر قبلاً برای این محصول ثبت شده‌اند: ${duplicates.join(', ')}`
                    };
                }
            } catch (e) {
                console.warn("[InvoiceStore] Duplicate Check Bypass:", e);
            }
        }

        // 3. OPTIMISTIC UI UPDATE (Immediate)
        const tempIds: string[] = [];
        const optimisticInvoices: Invoice[] = invoicesList.map(inv => {
            const tempId = uuidv4();
            tempIds.push(tempId);
            return {
                ...inv,
                id: tempId,
                createdAt: Date.now(),
                createdBy: currentUser.id,
                creatorName: currentUser.fullName,
                creatorRole: currentUser.role,
                isPending: !isSyncing,
                isOffline: !navigator.onLine && !isSyncing
            } as Invoice;
        });

        if (!isSyncing) {
            set(state => ({ invoices: [...optimisticInvoices, ...state.invoices] }));
        }

        // 4. Offline Check
        if (!isSyncing && !navigator.onLine) {
            invoicesList.forEach(inv => useSyncStore.getState().addToQueue('INVOICE', inv));
            return { success: true, error: 'ذخیره در صف آفلاین' };
        }

        try {
            const dbInvoices = invoicesList.map(inv => ({
                farm_id: inv.farmId,
                date: normalizeDate(inv.date),
                invoice_number: inv.invoiceNumber,
                total_cartons: Math.floor(Number(inv.totalCartons)) || 0,
                total_weight: Number(inv.totalWeight) || 0,
                product_id: inv.productId,
                driver_name: inv.driverName || null,
                driver_phone: inv.driverPhone || null,
                plate_number: inv.plateNumber || null,
                description: inv.description || null,
                is_yesterday: inv.isYesterday || false,
                is_sorted: inv.isSorted || false,
                is_converted: inv.isConverted || false,
                source_product_id: inv.sourceProductId || null,
                converted_amount: inv.convertedAmount || 0,
                created_by: currentUser.id
            }));

            const { error } = await supabase.from('invoices').insert(dbInvoices);
            if (error) throw error;

            await get().fetchInvoices();

            // Sync stats
            const uniqueKeys = new Set<string>();
            invoicesList.forEach(inv => {
                if (inv.productId) uniqueKeys.add(`${inv.farmId}|${inv.date}|${inv.productId}`);
                // Also update SOURCE product stats if conversion happened
                if (inv.sourceProductId && inv.isConverted) {
                    uniqueKeys.add(`${inv.farmId}|${inv.date}|${inv.sourceProductId}`);
                }
            });
            uniqueKeys.forEach(key => {
                const [fId, dt, pId] = key.split('|');
                useStatisticsStore.getState().syncSalesFromInvoices(fId, dt, pId);
            });

            return { success: true };

        } catch (error: any) {
            // If network error during request, add to queue
            if (!isSyncing && (isNetworkError(error) || !navigator.onLine)) {
                // Update local status to offline instead of rolling back
                set(state => ({
                    invoices: state.invoices.map(inv =>
                        tempIds.includes(inv.id) ? { ...inv, isPending: false, isOffline: true } : inv
                    )
                }));
                invoicesList.forEach(inv => useSyncStore.getState().addToQueue('INVOICE', inv));
                return { success: true, error: 'ذخیره در صف آفلاین (خطای شبکه)' };
            }

            // Real error (duplicate, etc.) -> Rollback
            if (!isSyncing) {
                set(state => ({
                    invoices: state.invoices.filter(inv => !tempIds.includes(inv.id))
                }));
            }
            return { success: false, error: translateError(error) };
        }
    },

    updateInvoice: async (id, updates, isSyncing = false) => {
        try {
            // 1. Fetch current invoice data to compare
            const currentInvoices = get().invoices;
            const currentInvoice = currentInvoices.find(i => i.id === id);
            if (!currentInvoice) {
                return { success: false, error: 'Invoice not found' };
            }

            // 2. Check if there are actual changes
            const oldDataStr = JSON.stringify({
                invoiceNumber: String(currentInvoice.invoiceNumber || ''),
                totalCartons: String(currentInvoice.totalCartons || ''),
                totalWeight: String(currentInvoice.totalWeight || ''),
                driverName: String(currentInvoice.driverName || ''),
                plateNumber: String(currentInvoice.plateNumber || ''),
                driverPhone: String(currentInvoice.driverPhone || ''),
                description: String(currentInvoice.description || ''),
                productId: String(currentInvoice.productId || '')
            });
            const newDataStr = JSON.stringify({
                invoiceNumber: String(updates.invoiceNumber ?? currentInvoice.invoiceNumber),
                totalCartons: String(updates.totalCartons ?? currentInvoice.totalCartons),
                totalWeight: String(updates.totalWeight ?? currentInvoice.totalWeight),
                driverName: String(updates.driverName ?? currentInvoice.driverName),
                plateNumber: String(updates.plateNumber ?? currentInvoice.plateNumber),
                driverPhone: String(updates.driverPhone ?? currentInvoice.driverPhone),
                description: String(updates.description ?? currentInvoice.description),
                productId: String(updates.productId ?? currentInvoice.productId)
            });

            if (oldDataStr === newDataStr) {
                return { success: true };
            }

            // 3. Construct DB payload
            const dbUpdates: any = {
                updated_at: new Date().toISOString()
            };

            if (updates.invoiceNumber !== undefined) dbUpdates.invoice_number = updates.invoiceNumber;
            if (updates.totalCartons !== undefined) dbUpdates.total_cartons = updates.totalCartons;
            if (updates.totalWeight !== undefined) dbUpdates.total_weight = updates.totalWeight;
            if (updates.driverName !== undefined) dbUpdates.driver_name = updates.driverName;
            if (updates.driverPhone !== undefined) dbUpdates.driver_phone = updates.driverPhone;
            if (updates.plateNumber !== undefined) dbUpdates.plate_number = updates.plateNumber;
            if (updates.description !== undefined) dbUpdates.description = updates.description;
            if (updates.productId !== undefined) dbUpdates.product_id = updates.productId;
            if (updates.farmId !== undefined) dbUpdates.farm_id = updates.farmId;
            if (updates.date !== undefined) dbUpdates.date = normalizeDate(updates.date);

            const { error } = await supabase.from('invoices').update(dbUpdates).eq('id', id);
            if (error) throw error;

            await get().fetchInvoices();

            // 4. SYNC STATISTICS
            // A. Revert/Update OLD Statistic (using old values)
            useStatisticsStore.getState().syncSalesFromInvoices(
                currentInvoice.farmId,
                currentInvoice.date,
                currentInvoice.productId || ''
            );

            // B. Update NEW Statistic (if Product, Farm, or Date changed)
            // If they didn't change, the call above covers it (since update is already in DB).
            // But if Product Changed, we must sync the NEW product too.
            const newProductId = updates.productId || currentInvoice.productId;
            const newFarmId = updates.farmId || currentInvoice.farmId;
            const newDate = updates.date || currentInvoice.date;

            if (newProductId !== currentInvoice.productId ||
                newFarmId !== currentInvoice.farmId ||
                normalizeDate(newDate) !== normalizeDate(currentInvoice.date)) {
                useStatisticsStore.getState().syncSalesFromInvoices(
                    newFarmId,
                    newDate,
                    newProductId || ''
                );
            }

            return { success: true };
        } catch (error: any) {
            if (!isSyncing && (isNetworkError(error) || !navigator.onLine)) {
                useSyncStore.getState().addToQueue('UPDATE_INVOICE', { id, updates });
                return { success: true, error: 'ویرایش در صف آفلاین ذخیره شد' };
            }
            return { success: false, error: getErrorMessage(error) };
        }
    },

    deleteInvoice: async (id, isSyncing = false) => {
        try {
            const currentInvoice = get().invoices.find(i => i.id === id);
            const { error } = await supabase.from('invoices').delete().eq('id', id);
            if (error) throw error;
            await get().fetchInvoices();

            if (currentInvoice) {
                useStatisticsStore.getState().syncSalesFromInvoices(
                    currentInvoice.farmId,
                    currentInvoice.date,
                    currentInvoice.productId || ''
                );
                if (currentInvoice.sourceProductId && currentInvoice.isConverted) {
                    useStatisticsStore.getState().syncSalesFromInvoices(
                        currentInvoice.farmId,
                        currentInvoice.date,
                        currentInvoice.sourceProductId
                    );
                }
            }

            return { success: true };
        } catch (e: any) {
            if (!isSyncing && (isNetworkError(e) || !navigator.onLine)) {
                useSyncStore.getState().addToQueue('DELETE_INVOICE', { id });
                return { success: true, error: 'حذف در صف آفلاین ذخیره شد' };
            }
            return { success: false, error: getErrorMessage(e) };
        }
    },

    validateUnique: async (invoiceNumber: string, excludeInvoiceId?: string) => {
        try {
            // Check if this invoice number exists for ANY product on this farm/date?
            // Actually, strict uniqueness is usually per (Farm, Date, Number) or just (Number) globally depending on business rule.
            // Based on previous code: unique constraint is likely (invoice_number, product_id) or just (invoice_number).
            // Let's assume Invoice Number should be unique across the system or at least not duplicated for the *same* product lightly.
            // BUT user requirement says: "Changing invoice_number must trigger validation".

            let query = supabase
                .from('invoices')
                .select('id')
                .eq('invoice_number', invoiceNumber);

            if (excludeInvoiceId) {
                query = query.neq('id', excludeInvoiceId);
            }

            const { data, error } = await query;

            if (error) throw error;

            if (data && data.length > 0) {
                return { isValid: false, error: 'این شماره حواله قبلاً ثبت شده است.' };
            }

            return { isValid: true };
        } catch (e: any) {
            console.warn('[InvoiceStore] validateUnique error:', e);
            // Fail safe: allow if check fails (e.g. offline), preventing block
            return { isValid: true };
        }
    }
}));
