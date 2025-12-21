
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Invoice } from '../types';

// Legacy ID mapping helper - ROBUST
const mapLegacyProductId = (id: string | number): string => {
    const strId = String(id);
    if (strId === '1') return '11111111-1111-1111-1111-111111111111';
    if (strId === '2') return '22222222-2222-2222-2222-222222222222';
    return strId;
};

interface InvoiceState {
    invoices: Invoice[];
    isLoading: boolean;
    fetchInvoices: () => Promise<void>;
    addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt'>) => Promise<{ success: boolean; error?: any }>;
    updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<{ success: boolean; error?: any }>;
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
              updatedAt: i.updated_at ? new Date(i.updated_at).getTime() : undefined
          }));
          set({ invoices: mappedInvoices, isLoading: false });
      } else {
          set({ isLoading: false });
          console.error('Error fetching invoices:', error?.message || error);
      }
  },

  addInvoice: async (inv) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: "Not authenticated" };

      const dbInv = {
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
      
      const { error } = await supabase.from('invoices').insert(dbInv);
      
      if (!error) {
          get().fetchInvoices();
          return { success: true };
      }
      return { success: false, error: error?.message || error };
  },

  updateInvoice: async (id, updates) => {
      const dbUpdates: any = {
          updated_at: new Date().toISOString()
      };
      if (updates.totalCartons !== undefined) dbUpdates.total_cartons = updates.totalCartons;
      if (updates.totalWeight !== undefined) dbUpdates.total_weight = updates.totalWeight;
      if (updates.driverName !== undefined) dbUpdates.driver_name = updates.driverName;
      if (updates.driverPhone !== undefined) dbUpdates.driver_phone = updates.driverPhone;
      if (updates.plateNumber !== undefined) dbUpdates.plate_number = updates.plateNumber;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      
      const { error } = await supabase.from('invoices').update(dbUpdates).eq('id', id);
      
      if (!error) {
          get().fetchInvoices();
          return { success: true };
      }
      return { success: false, error: error?.message || error };
  },

  deleteInvoice: async (id) => {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (!error) get().fetchInvoices();
      else console.error('Error deleting invoice:', error?.message || error);
  }
}));
