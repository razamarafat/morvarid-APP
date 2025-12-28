
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Invoice } from '../types';
import { useStatisticsStore } from './statisticsStore';
import { normalizeDate } from '../utils/dateUtils';
import { useSyncStore } from './syncStore';
import { useAuthStore } from './authStore';

const mapLegacyProductId = (id: string | number): string => {
    const strId = String(id);
    if (strId === '1') return '11111111-1111-1111-1111-111111111111';
    if (strId === '2') return '22222222-2222-2222-2222-222222222222';
    return strId;
};

// Robust Error Extractor - Guaranteed to return a readable string
const getErrorMessage = (e: any): string => {
    if (e === null || e === undefined) return 'خطای ناشناخته (Empty Error)';
    
    // 1. If it's already a string
    if (typeof e === 'string') return e;
    
    // 2. Standard JS Error
    if (e instanceof Error) return e.message;
    
    // 3. Supabase PostgrestError often has 'message'
    if (e?.message) {
        if (typeof e.message === 'string') return e.message;
        // If message itself is an object, try to stringify it safely
        try {
            return JSON.stringify(e.message);
        } catch {
            return 'خطای جزئیات پیام (Message Object)';
        }
    }
    
    // 4. OAuth / Auth errors
    if (e?.error_description) return e.error_description;
    
    // 5. PostgREST fields
    if (e?.details) return e.details;
    if (e?.hint) return e.hint;

    // 6. Fallback: JSON Stringify
    try {
        const json = JSON.stringify(e);
        // Avoid returning empty brackets
        if (json === '{}' || json === '[]') {
             const code = e?.code ? `Code: ${e.code}` : '';
             const status = e?.status ? `Status: ${e.status}` : '';
             if (code || status) return `خطای سرور (${code} ${status})`.trim();
             
             return 'خطای داخلی نامشخص (Unknown Object)';
        }
        return json;
    } catch {
        return 'خطای سیستمی (Circular Object)';
    }
};

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
          const { data, error } = await supabase
              .from('invoices')
              .select('*')
              .order('date', { ascending: false })
              .limit(2000); 
          
          if (error) throw error;

          if (data) {
              const creatorIds = Array.from(new Set(data.map((i: any) => i.created_by).filter(Boolean)));
              let profileMap: Record<string, { name: string, role: string }> = {};
              
              if (creatorIds.length > 0) {
                  const { data: profiles } = await supabase.from('profiles').select('id, full_name, role').in('id', creatorIds);
                  if (profiles) profileMap = profiles.reduce((acc: any, p: any) => ({ 
                      ...acc, 
                      [p.id]: { name: p.full_name, role: p.role } 
                  }), {});
              }

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
                  creatorName: profileMap[i.created_by]?.name || 'کاربر حذف شده',
                  creatorRole: profileMap[i.created_by]?.role
              }));
              set({ invoices: mapped, isLoading: false });
          } else {
              set({ isLoading: false });
          }
      } catch(e) {
          console.error("Fetch Invoices Failed:", e);
          set({ isLoading: false });
      }
  },

  addInvoice: async (inv, isSyncing = false) => {
      return await get().bulkAddInvoices([inv], isSyncing);
  },

  bulkAddInvoices: async (invoicesList, isSyncing = false) => {
      // 1. Check Offline first
      if (!isSyncing && !navigator.onLine) {
          invoicesList.forEach(inv => useSyncStore.getState().addToQueue('INVOICE', inv));
          return { success: true, error: 'ذخیره در صف آفلاین' };
      }

      // 2. Get User from Store (Memory) instead of async Supabase call
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) return { success: false, error: "کاربر لاگین نیست." };

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
              created_by: currentUser.id // Use local user ID
          }));

          const { error } = await supabase.from('invoices').insert(dbInvoices);

          if (error) {
              throw error;
          }

          get().fetchInvoices();
          
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
              invoicesList.forEach(inv => useSyncStore.getState().addToQueue('INVOICE', inv));
              return { success: true, error: 'ذخیره در صف آفلاین (خطای شبکه)' };
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
      } catch(e: any) {
          if (!isSyncing && (isNetworkError(e) || !navigator.onLine)) {
               useSyncStore.getState().addToQueue('DELETE_INVOICE', { id });
               return { success: true, error: 'حذف در صف آفلاین ذخیره شد' };
          }
          return { success: false, error: getErrorMessage(e) };
      }
  }
}));
