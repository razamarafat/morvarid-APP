
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Invoice {
    id: string;
    farmId: string;
    date: string;
    invoiceNumber: string;
    totalCartons: number;
    totalWeight: number;
    productId?: string;
    driverName?: string;
    driverPhone?: string;
    plateNumber?: string;
    isYesterday: boolean;
    createdAt: number;
}

interface InvoiceState {
    invoices: Invoice[];
    isLoading: boolean;
    fetchInvoices: () => Promise<void>;
    addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt'>) => Promise<void>;
    updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<void>;
    deleteInvoice: (id: string) => Promise<void>;
}

export const useInvoiceStore = create<InvoiceState>((set, get) => ({
  invoices: [],
  isLoading: false,

  fetchInvoices: async () => {
      set({ isLoading: true });
      const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
      
      if (!error && data) {
          const mappedInvoices = data.map((i: any) => ({
              id: i.id,
              farmId: i.farm_id,
              date: i.date,
              invoiceNumber: i.invoice_number,
              totalCartons: i.total_cartons,
              totalWeight: i.total_weight,
              productId: i.product_id,
              driverName: i.driver_name,
              driverPhone: i.driver_phone,
              plateNumber: i.plate_number,
              isYesterday: i.is_yesterday,
              createdAt: new Date(i.created_at).getTime()
          }));
          set({ invoices: mappedInvoices, isLoading: false });
      } else {
          set({ isLoading: false });
      }
  },

  addInvoice: async (inv) => {
      const { data: { user } } = await supabase.auth.getUser();
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
          is_yesterday: inv.isYesterday,
          created_by: user?.id
      };
      
      const { error } = await supabase.from('invoices').insert(dbInv);
      if (!error) get().fetchInvoices();
  },

  updateInvoice: async (id, updates) => {
      const dbUpdates: any = {};
      if (updates.totalCartons !== undefined) dbUpdates.total_cartons = updates.totalCartons;
      if (updates.totalWeight !== undefined) dbUpdates.total_weight = updates.totalWeight;
      
      const { error } = await supabase.from('invoices').update(dbUpdates).eq('id', id);
      if (!error) get().fetchInvoices();
  },

  deleteInvoice: async (id) => {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (!error) get().fetchInvoices();
  }
}));
