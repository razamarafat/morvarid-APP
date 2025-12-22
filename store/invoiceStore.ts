
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

// Helper to translate DB errors
const translateError = (error: any): string => {
    if (!error) return 'خطای ناشناخته';
    const msg = error.message || '';
    const code = error.code || '';

    if (code === '23505') return 'شماره حواله تکراری است.';
    if (msg.includes('network') || msg.includes('fetch')) return 'خطا در اتصال به سرور.';
    if (code === 'PGRST204') return 'خطای ساختار دیتابیس (ستون یافت نشد).';
    
    return `خطای ثبت حواله: ${msg} (${code})`;
};

// Extend Invoice interface internally for the store to include creatorName
interface InvoiceWithCreator extends Invoice {
    creatorName?: string;
}

interface InvoiceState {
    invoices: InvoiceWithCreator[];
    isLoading: boolean;
    fetchInvoices: () => Promise<void>;
    addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt'>) => Promise<{ success: boolean; error?: string; debug?: any }>;
    updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<{ success: boolean; error?: string; debug?: any }>;
    deleteInvoice: (id: string) => Promise<void>;
}

export const useInvoiceStore = create<InvoiceState>((set, get) => ({
  invoices: [],
  isLoading: false,

  fetchInvoices: async () => {
      set({ isLoading: true });
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
          set({ invoices: [], isLoading: false });
          return;
      }

      const { data, error } = await supabase
          .from('invoices')
          .select('*')
          .order('date', { ascending: false });
      
      if (!error && data) {
          // Fetch Creator Profiles
          const creatorIds = Array.from(new Set(data.map((i: any) => i.created_by).filter(Boolean)));
          let profileMap: Record<string, string> = {};

          if (creatorIds.length > 0) {
              const { data: profilesData } = await supabase.from('profiles').select('id, full_name').in('id', creatorIds);
              if (profilesData) {
                  profileMap = profilesData.reduce((acc: any, p: any) => ({ ...acc, [p.id]: p.full_name }), {});
              }
          }

          const mappedInvoices = data.map((i: any) => ({
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
              creatorName: profileMap[i.created_by] || 'ناشناس', // Map name
              updatedAt: i.updated_at ? new Date(i.updated_at).getTime() : undefined
          }));
          set({ invoices: mappedInvoices, isLoading: false });
      } else {
          set({ isLoading: false });
          console.error('Error fetching invoices:', error?.message || error);
      }
  },

  addInvoice: async (inv) => {
      try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return { success: false, error: "کاربر لاگین نیست." };

          const dbInv: any = {
              farm_id: inv.farmId,
              date: inv.date,
              invoice_number: inv.invoiceNumber,
              total_cartons: inv.totalCartons,
              total_weight: inv.totalWeight,
              product_id: inv.productId,
              driver_name: inv.driverName,
              driver_phone: inv.driverPhone,
              plate_number: inv.plateNumber,
              description: inv.description,
              is_yesterday: inv.isYesterday,
              created_by: user.id
          };
          
          let { error } = await supabase.from('invoices').insert(dbInv);
          
          // Fallback Strategy
          if (error && error.code === 'PGRST204' && error.message.includes('description')) {
              delete dbInv.description;
              const retry = await supabase.from('invoices').insert(dbInv);
              error = retry.error;
          }
          
          if (!error) {
              get().fetchInvoices();
              if (inv.productId) {
                  useStatisticsStore.getState().syncSalesFromInvoices(inv.farmId, inv.date, inv.productId);
              }
              return { success: true };
          }
          
          console.error('Invoice Add Error:', error);
          return { success: false, error: translateError(error), debug: error };
      } catch (e: any) {
          return { success: false, error: `خطای غیرمنتظره: ${e.message}`, debug: e };
      }
  },

  updateInvoice: async (id, updates) => {
      const original = get().invoices.find(i => i.id === id);

      const dbUpdates: any = {
          updated_at: new Date().toISOString()
      };
      if (updates.totalCartons !== undefined) dbUpdates.total_cartons = updates.totalCartons;
      if (updates.totalWeight !== undefined) dbUpdates.total_weight = updates.totalWeight;
      if (updates.driverName !== undefined) dbUpdates.driver_name = updates.driverName;
      if (updates.driverPhone !== undefined) dbUpdates.driver_phone = updates.driverPhone;
      if (updates.plateNumber !== undefined) dbUpdates.plate_number = updates.plateNumber;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.invoiceNumber !== undefined) dbUpdates.invoice_number = updates.invoiceNumber;
      
      let { error } = await supabase.from('invoices').update(dbUpdates).eq('id', id);

      if (error && error.code === 'PGRST204' && error.message.includes('description')) {
          delete dbUpdates.description;
          const retry = await supabase.from('invoices').update(dbUpdates).eq('id', id);
          error = retry.error;
      }
      
      if (!error) {
          await get().fetchInvoices();
          if (original && original.productId) {
              useStatisticsStore.getState().syncSalesFromInvoices(original.farmId, original.date, original.productId);
          }
          return { success: true };
      }
      return { success: false, error: translateError(error), debug: error };
  },

  deleteInvoice: async (id) => {
      const original = get().invoices.find(i => i.id === id);
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      
      if (!error) {
          await get().fetchInvoices();
          if (original && original.productId) {
              useStatisticsStore.getState().syncSalesFromInvoices(original.farmId, original.date, original.productId);
          }
      }
      else {
          console.error('Error deleting invoice:', error?.message || error);
      }
  }
}));
