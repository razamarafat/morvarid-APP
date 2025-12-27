
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Invoice } from '../types';
import { useStatisticsStore } from './statisticsStore';
import { normalizeDate } from '../utils/dateUtils';
import { useSyncStore } from './syncStore';

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
    if (status === '400' || code === 'PGRST204' || code === '42703') return 'خطای ساختار دیتابیس (ستون یافت نشد). پیلود اصلاح و تلاش مجدد شد.';
    if (code === '23505') return 'شماره حواله تکراری است (این محصول قبلاً برای این حواله ثبت شده است).';
    return `خطای سیستم: ${error.message || code}`;
};

const isNetworkError = (error: any) => {
    if (!error) return false;
    const msg = error.message?.toLowerCase() || '';
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
      const { data, error } = await supabase.from('invoices').select('*').order('date', { ascending: false });
      
      if (!error && data) {
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
  },

  addInvoice: async (inv, isSyncing = false) => {
      return await get().bulkAddInvoices([inv], isSyncing);
  },

  bulkAddInvoices: async (invoicesList, isSyncing = false) => {
      if (!isSyncing) {
          const existingInvoices = get().invoices;
          const offlineQueue = useSyncStore.getState().queue.filter(q => q.type === 'INVOICE').map(q => q.payload);
          const allToCheck = [...existingInvoices, ...offlineQueue];

          for (const inv of invoicesList) {
              const duplicates = allToCheck.filter(ex => ex.invoiceNumber === inv.invoiceNumber);
              if (duplicates.length > 0) {
                  return { 
                      success: false, 
                      error: `شماره حواله ${inv.invoiceNumber} قبلاً ثبت شده است. برای افزودن محصول به این حواله، لطفاً به بخش سوابق مراجعه و حواله مورد نظر را ویرایش کنید.` 
                  };
              }
          }
      }

      if (!isSyncing && !navigator.onLine) {
          let hasError = false;
          invoicesList.forEach(inv => {
              const added = useSyncStore.getState().addToQueue('INVOICE', inv);
              if (!added) hasError = true;
          });
          
          if (hasError) return { success: false, error: 'این محصول قبلاً در صف ارسال وجود دارد.' };
          return { success: true, error: 'ذخیره در صف آفلاین' };
      }

      try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return { success: false, error: "کاربر لاگین نیست." };

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
              created_by: user.id
          }));

          const { error } = await supabase.from('invoices').insert(dbInvoices);

          if (error) {
              const code = error.code || '';
              const status = String((error as any).status || '');
              
              if (status === '400' || code === 'PGRST204' || code === '42703') {
                  const coreInvoices = dbInvoices.map(inv => ({
                      farm_id: inv.farm_id,
                      date: inv.date,
                      invoice_number: inv.invoice_number,
                      total_cartons: inv.total_cartons,
                      total_weight: inv.total_weight,
                      product_id: inv.product_id,
                      created_by: inv.created_by
                  }));
                  
                  const { error: retryError } = await supabase.from('invoices').insert(coreInvoices);
                  if (retryError) throw retryError;
              } else {
                  throw error;
              }
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
          if (!isSyncing && isNetworkError(error)) {
              invoicesList.forEach(inv => useSyncStore.getState().addToQueue('INVOICE', inv));
              return { success: true, error: 'ذخیره در صف آفلاین (عدم دسترسی به سرور)' };
          }
          return { success: false, error: translateError(error) };
      }
  },

  updateInvoice: async (id, updates, isSyncing = false) => {
      if (!isSyncing && !navigator.onLine) {
          useSyncStore.getState().addToQueue('UPDATE_INVOICE', { id, updates });
          return { success: true, error: 'ذخیره در صف آفلاین' };
      }

      try {
          const original = get().invoices.find(i => i.id === id);
          
          const fullPayload: any = {};
          if (updates.totalCartons !== undefined) fullPayload.total_cartons = Math.floor(Number(updates.totalCartons)); 
          if (updates.totalWeight !== undefined) fullPayload.total_weight = Number(updates.totalWeight);
          if (updates.driverName !== undefined) fullPayload.driver_name = updates.driverName;
          if (updates.driverPhone !== undefined) fullPayload.driver_phone = updates.driverPhone;
          if (updates.plateNumber !== undefined) fullPayload.plate_number = updates.plateNumber;
          if (updates.invoiceNumber !== undefined) fullPayload.invoice_number = updates.invoiceNumber;
          if (updates.description !== undefined) fullPayload.description = updates.description;
          if (updates.date !== undefined) fullPayload.date = normalizeDate(updates.date);
          
          fullPayload.updated_at = new Date().toISOString();

          let { error } = await supabase.from('invoices').update(fullPayload).eq('id', id);

          if (error) {
              if (String((error as any).status) === '400' || error.code === 'PGRST204' || error.code === '42703') {
                  const corePayload: any = {
                      total_cartons: fullPayload.total_cartons,
                      total_weight: fullPayload.total_weight,
                      invoice_number: fullPayload.invoice_number,
                      driver_name: fullPayload.driver_name, 
                      plate_number: fullPayload.plate_number,
                      driver_phone: fullPayload.driver_phone
                  };
                  Object.keys(corePayload).forEach(key => corePayload[key] === undefined && delete corePayload[key]);
                  
                  let retry = await supabase.from('invoices').update(corePayload).eq('id', id);
                  
                  if (retry.error) {
                       const absoluteCore = {
                           total_cartons: fullPayload.total_cartons,
                           total_weight: fullPayload.total_weight,
                           invoice_number: fullPayload.invoice_number
                       };
                       Object.keys(absoluteCore).forEach(key => (absoluteCore as any)[key] === undefined && delete (absoluteCore as any)[key]);
                       retry = await supabase.from('invoices').update(absoluteCore).eq('id', id);
                  }
                  
                  if (retry.error) throw retry.error;
              } else {
                  throw error;
              }
          }
          
          await get().fetchInvoices();
          
          if (original?.productId) {
              useStatisticsStore.getState().syncSalesFromInvoices(original.farmId, original.date, original.productId);
              
              if (updates.date && updates.date !== original.date) {
                  useStatisticsStore.getState().syncSalesFromInvoices(original.farmId, updates.date, original.productId);
              }
          }
          
          return { success: true };

      } catch (error: any) {
          if (!isSyncing && isNetworkError(error)) {
              useSyncStore.getState().addToQueue('UPDATE_INVOICE', { id, updates });
              return { success: true, error: 'ذخیره در صف آفلاین (عدم دسترسی به سرور)' };
          }
          return { success: false, error: translateError(error) };
      }
  },

  deleteInvoice: async (id, isSyncing = false) => {
      if (!isSyncing && !navigator.onLine) {
          useSyncStore.getState().addToQueue('DELETE_INVOICE', { id });
          return { success: true, error: 'ذخیره در صف آفلاین' };
      }

      try {
          const original = get().invoices.find(i => i.id === id);
          const { error } = await supabase.from('invoices').delete().eq('id', id);
          if (error) throw error;

          await get().fetchInvoices();
          if (original?.productId) useStatisticsStore.getState().syncSalesFromInvoices(original.farmId, original.date, original.productId);
          return { success: true };
      } catch (error: any) {
          if (!isSyncing && isNetworkError(error)) {
              useSyncStore.getState().addToQueue('DELETE_INVOICE', { id });
              return { success: true, error: 'ذخیره در صف آفلاین (عدم دسترسی به سرور)' };
          }
          return { success: false, error: translateError(error) };
      }
  }
}));
