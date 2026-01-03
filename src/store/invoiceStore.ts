
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
                const invoiceNumbers = Array.from(new Set(invoicesList.map(inv => inv.invoiceNumber)));
                const { data: existing, error: checkError } = await supabase
                    .from('invoices')
                    .select('invoice_number')
                    .in('invoice_number', invoiceNumbers)
                    .limit(1);

                if (!checkError && existing && existing.length > 0) {
                    return {
                        success: false,
                        error: `رمز حواله ${existing[0].invoice_number} قبلاً ثبت شده است.`
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
                created_by: currentUser.id
            }));

            const { error } = await supabase.from('invoices').insert(dbInvoices);
            if (error) throw error;

            await get().fetchInvoices();

            // Sync stats
            const uniqueKeys = new Set<string>();
            invoicesList.forEach(inv => {
                if (inv.productId) uniqueKeys.add(`${inv.farmId}|${inv.date}|${inv.productId}`);
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
            // Construct DB payload with snake_case keys manually to prevent missing column errors
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
            return { success: true };
        } catch (error: any) {
            if (!isSyncing && (isNetworkError(error) || !navigator.onLine)) {
                // For updates, we need the ID in the payload
                useSyncStore.getState().addToQueue('UPDATE_INVOICE', { id, updates });
                return { success: true, error: 'ویرایش در صف آفلاین ذخیره شد' };
            }
            return { success: false, error: getErrorMessage(error) };
        }
    },

    deleteInvoice: async (id, isSyncing = false) => {
        try {
            const { error } = await supabase.from('invoices').delete().eq('id', id);
            if (error) throw error;
            await get().fetchInvoices();
            return { success: true };
        } catch (e: any) {
            if (!isSyncing && (isNetworkError(e) || !navigator.onLine)) {
                useSyncStore.getState().addToQueue('DELETE_INVOICE', { id });
                return { success: true, error: 'حذف در صف آفلاین ذخیره شد' };
            }
            return { success: false, error: getErrorMessage(e) };
        }
    }
}));
