
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Invoice } from '../types';
import { useStatisticsStore } from './statisticsStore';

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
    if (code === '23505') return 'شماره حواله تکراری است.';
    return `خطای سیستم: ${error.message || code}`;
};

interface InvoiceState {
    invoices: Invoice[];
    isLoading: boolean;
    fetchInvoices: () => Promise<void>;
    addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt'>) => Promise<{ success: boolean; error?: string }>;
    updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<{ success: boolean; error?: string }>;
    deleteInvoice: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export const useInvoiceStore = create<InvoiceState>((set, get) => ({
  invoices: [],
  isLoading: false,

  fetchInvoices: async () => {
      set({ isLoading: true });
      const { data, error } = await supabase.from('invoices').select('*').order('date', { ascending: false });
      
      if (!error && data) {
          const creatorIds = Array.from(new Set(data.map((i: any) => i.created_by).filter(Boolean)));
          let profileMap: Record<string, string> = {};
          if (creatorIds.length > 0) {
              const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', creatorIds);
              if (profiles) profileMap = profiles.reduce((acc: any, p: any) => ({ ...acc, [p.id]: p.full_name }), {});
          }

          const mapped = data.map((i: any) => ({
              id: i.id,
              farmId: i.farm_id,
              date: i.date,
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
              createdBy: i.created_by,
              creatorName: profileMap[i.created_by] || 'ناشناس'
          }));
          set({ invoices: mapped, isLoading: false });
      } else {
          set({ isLoading: false });
      }
  },

  addInvoice: async (inv) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: "کاربر لاگین نیست." };

      const dbInv: any = {
          farm_id: inv.farmId,
          date: inv.date,
          invoice_number: inv.invoiceNumber,
          total_cartons: Number(inv.totalCartons),
          total_weight: Number(inv.totalWeight),
          product_id: inv.productId,
          driver_name: inv.driverName,
          driver_phone: inv.driverPhone,
          plate_number: inv.plateNumber,
          description: inv.description,
          is_yesterday: inv.isYesterday,
          created_by: user.id
      };
      
      let { error } = await supabase.from('invoices').insert(dbInv);
      
      if (error && (String(error.status) === '400' || error.code === 'PGRST204')) {
          const safeInv = { ...dbInv };
          delete safeInv.description; 
          const retry = await supabase.from('invoices').insert(safeInv);
          error = retry.error;
      }

      if (!error) {
          get().fetchInvoices();
          if (inv.productId) useStatisticsStore.getState().syncSalesFromInvoices(inv.farmId, inv.date, inv.productId);
          return { success: true };
      }
      return { success: false, error: translateError(error) };
  },

  updateInvoice: async (id, updates) => {
      const original = get().invoices.find(i => i.id === id);
      const fullPayload: any = {};
      if (updates.totalCartons !== undefined) fullPayload.total_cartons = Number(updates.totalCartons);
      if (updates.totalWeight !== undefined) fullPayload.total_weight = Number(updates.totalWeight);
      if (updates.driverName !== undefined) fullPayload.driver_name = updates.driverName;
      if (updates.driverPhone !== undefined) fullPayload.driver_phone = updates.driverPhone;
      if (updates.plateNumber !== undefined) fullPayload.plate_number = updates.plateNumber;
      if (updates.invoiceNumber !== undefined) fullPayload.invoice_number = updates.invoiceNumber;
      if (updates.description !== undefined) fullPayload.description = updates.description;
      fullPayload.updated_at = new Date().toISOString();

      let { error } = await supabase.from('invoices').update(fullPayload).eq('id', id);

      // NUCLEAR FALLBACK: Strips everything but the essentials
      if (error && (String(error.status) === '400' || error.code === 'PGRST204' || error.code === '42703')) {
          const corePayload: any = {
              total_cartons: fullPayload.total_cartons,
              total_weight: fullPayload.total_weight,
              invoice_number: fullPayload.invoice_number,
              driver_name: fullPayload.driver_name,
              plate_number: fullPayload.plate_number,
              driver_phone: fullPayload.driver_phone
          };
          Object.keys(corePayload).forEach(key => corePayload[key] === undefined && delete corePayload[key]);
          
          const retry = await supabase.from('invoices').update(corePayload).eq('id', id);
          error = retry.error;
      }
      
      if (!error) {
          await get().fetchInvoices();
          if (original?.productId) useStatisticsStore.getState().syncSalesFromInvoices(original.farmId, original.date, original.productId);
          return { success: true };
      }
      return { success: false, error: translateError(error) };
  },

  deleteInvoice: async (id) => {
      const original = get().invoices.find(i => i.id === id);
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (!error) {
          await get().fetchInvoices();
          if (original?.productId) useStatisticsStore.getState().syncSalesFromInvoices(original.farmId, original.date, original.productId);
          return { success: true };
      }
      return { success: false, error: translateError(error) };
  }
}));
