
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

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
    createdAt: number; // For 24h edit rule
}

interface InvoiceState {
    invoices: Invoice[];
    addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt'>) => void;
    updateInvoice: (id: string, updates: Partial<Invoice>) => void;
    deleteInvoice: (id: string) => void;
}

export const useInvoiceStore = create<InvoiceState>()(
  persist(
    (set) => ({
      invoices: [],
      addInvoice: (inv) => set((state) => ({ 
          invoices: [...state.invoices, { ...inv, id: uuidv4(), createdAt: Date.now() }] 
      })),
      updateInvoice: (id, updates) => set((state) => ({
          invoices: state.invoices.map(i => i.id === id ? { ...i, ...updates } : i)
      })),
      deleteInvoice: (id) => set((state) => ({
          invoices: state.invoices.filter(i => i.id !== id)
      }))
    }),
    {
      name: 'invoice-storage',
    }
  )
);
