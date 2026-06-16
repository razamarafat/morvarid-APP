import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { SalesVoucher, SalesVoucherLine, SalesVoucherFilter, CreateSalesVoucherInput, UpdateSalesVoucherInput, SalesVoucherWithLines } from '../types';
import { useAuthStore } from './authStore';
import { normalizeDate } from '../utils/dateUtils';
import { getErrorMessage } from '../utils/errorUtils';
import { normalizeVoucherNumber } from '../utils/formatUtils';

const translateError = (error: any): string => {
  if (!error) return 'خطای ناشناخته';
  const code = error.code || '';
  const status = String(error.status || '');
  if (status === '400' || code === 'PGRST204' || code === '42703') return 'خطای ساختار دیتابیس. لطفاً مایگریشن را اجرا کنید.';
  if (code === '23505') return 'شماره حواله تکراری است.';
  if (code === '23514') return 'مقادیر وارد شده نامعتبر است.';
  return `خطای سیستم: ${getErrorMessage(error)}`;
};

interface SalesVoucherState {
  vouchers: SalesVoucher[];
  currentVoucher: SalesVoucherWithLines | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;

  // Fetch operations
  fetchSalesVouchers: (filters?: SalesVoucherFilter) => Promise<void>;
  fetchSalesVoucherById: (id: string) => Promise<void>;

  // CRUD operations
  createSalesVoucher: (input: CreateSalesVoucherInput) => Promise<{ success: boolean; error?: string; voucherId?: string }>;
  updateSalesVoucher: (id: string, input: UpdateSalesVoucherInput) => Promise<{ success: boolean; error?: string }>;
  deleteSalesVoucher: (id: string) => Promise<{ success: boolean; error?: string }>;

  // Utility
  clearCurrentVoucher: () => void;
  clearError: () => void;
}

export const useSalesVoucherStore = create<SalesVoucherState>((set, get) => ({
  vouchers: [],
  currentVoucher: null,
  isLoading: false,
  isSubmitting: false,
  error: null,

  // ============================
  // FETCH ALL VOUCHERS (with filters)
  // ============================
  fetchSalesVouchers: async (filters?: SalesVoucherFilter) => {
    set({ isLoading: true, error: null });
    try {
      const currentUser = useAuthStore.getState().user;

      let query = supabase
        .from('sales_vouchers')
        .select('*, profiles!created_by(full_name, role), editor:profiles!updated_by(full_name), farms!inner(name)')
        .order('created_at', { ascending: false })
        .limit(500);

      // Role-based filtering
      if (currentUser && currentUser.role !== 'ADMIN') {
        if (currentUser.role === 'SALES') {
          // Sales users can see all vouchers across all farms
        } else {
          // REGISTRATION (Operator) sees only their assigned farms
          const farmIds = (currentUser.assignedFarms || []).map(f => f.id);
          if (farmIds.length > 0) {
            query = query.in('farm_id', farmIds);
          } else {
            set({ vouchers: [], isLoading: false });
            return;
          }
        }
      }

      // Apply optional filters
      if (filters?.farmId) {
        query = query.eq('farm_id', filters.farmId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.createdBy) {
        query = query.eq('created_by', filters.createdBy);
      }
      if (filters?.dateFrom) {
        query = query.gte('voucher_date', normalizeDate(filters.dateFrom));
      }
      if (filters?.dateTo) {
        query = query.lte('voucher_date', normalizeDate(filters.dateTo));
      }
      if (filters?.search) {
        query = query.or(`voucher_number.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        const mapped: SalesVoucher[] = data.map((v: any) => ({
          id: v.id,
          voucherNumber: v.voucher_number,
          farmId: v.farm_id,
          voucherDate: normalizeDate(v.voucher_date),
          status: v.status,
          createdBy: v.created_by,
          submittedAt: v.submitted_at,
          notes: v.notes,
          totalAmount: v.total_amount,
          customerName: v.customer_name,
          customerPhone: v.customer_phone,
          vehiclePlate: v.vehicle_plate,
          deliveryAddress: v.delivery_address,
          driverName: v.driver_name,
          driverPhone: v.driver_phone,
          inventoryApplied: v.inventory_applied || false,
          createdAt: v.created_at,
          updatedAt: v.updated_at,
          updatedBy: v.updated_by,
          farmName: v.farms?.name || 'نامشخص',
          creatorName: v.profiles?.full_name || 'نامشخص',
          editorName: v.editor?.full_name || undefined,
        }));
        set({ vouchers: mapped, isLoading: false });
      } else {
        set({ vouchers: [], isLoading: false });
      }
    } catch (e) {
      console.error('Fetch Sales Vouchers Failed:', e);
      set({ vouchers: [], isLoading: false, error: translateError(e) });
    }
  },

  // ============================
  // FETCH SINGLE VOUCHER (with lines)
  // ============================
  fetchSalesVoucherById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data: voucher, error: voucherError } = await supabase
        .from('sales_vouchers')
        .select('*, profiles!created_by(full_name, role), editor:profiles!updated_by(full_name), farms!inner(name)')
        .eq('id', id)
        .single();

      if (voucherError) throw voucherError;
      if (!voucher) {
        set({ currentVoucher: null, isLoading: false, error: 'حواله یافت نشد.' });
        return;
      }

      const { data: lines, error: linesError } = await supabase
        .from('sales_voucher_lines')
        .select('*, products!inner(name, unit)')
        .eq('voucher_id', id)
        .order('created_at', { ascending: true });

      if (linesError) throw linesError;

      let totalItems = 0;
      let totalQuantity = 0;
      const mappedLines: SalesVoucherLine[] = (lines || []).map((l: any) => {
        totalItems++;
        totalQuantity += Number(l.quantity) || 0;
        return {
          id: l.id,
          voucherId: l.voucher_id,
          productId: l.product_id,
          quantity: l.quantity,
          unitPrice: l.unit_price,
          totalPrice: l.total_price,
          notes: l.notes,
          createdAt: l.created_at,
          productName: l.products?.name || 'نامشخص',
          productUnit: l.products?.unit || 'CARTON',
        };
      });

      set({ currentVoucher: {
        id: voucher.id, voucherNumber: voucher.voucher_number,
        farmId: voucher.farm_id, voucherDate: normalizeDate(voucher.voucher_date),
        status: voucher.status, createdBy: voucher.created_by,
        submittedAt: voucher.submitted_at, notes: voucher.notes,
        totalAmount: voucher.total_amount, customerName: voucher.customer_name,
        customerPhone: voucher.customer_phone, vehiclePlate: voucher.vehicle_plate,
        deliveryAddress: voucher.delivery_address, driverName: voucher.driver_name,
        driverPhone: voucher.driver_phone,        inventoryApplied: voucher.inventory_applied || false,
        createdAt: voucher.created_at, updatedAt: voucher.updated_at,
        updatedBy: voucher.updated_by,
        farmName: voucher.farms?.name || 'نامشخص',
        creatorName: voucher.profiles?.full_name || 'نامشخص',
        editorName: voucher.editor?.full_name || undefined,
        totalItems, totalQuantity, lines: mappedLines,
      }, isLoading: false });
    } catch (e) {
      console.error('Fetch Sales Voucher By ID Failed:', e);
      set({ currentVoucher: null, isLoading: false, error: translateError(e) });
    }
  },

  // ============================
  // CREATE VOUCHER (immediately registered — no draft)
  // ============================
  createSalesVoucher: async (input: CreateSalesVoucherInput) => {
    set({ isSubmitting: true, error: null });
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) {
      set({ isSubmitting: false });
      return { success: false, error: 'کاربر لاگین نیست.' };
    }

    try {
      const normalizedVoucherNumber = normalizeVoucherNumber(input.voucherNumber);
      
      // 1. Insert voucher as immediately registered
      const { data: voucher, error: voucherError } = await supabase
        .from('sales_vouchers')
        .insert({
          farm_id: input.farmId,
          voucher_date: normalizeDate(input.voucherDate),
          voucher_number: normalizedVoucherNumber,
          status: 'submitted',
          created_by: currentUser.id,
          notes: input.notes || null,
          total_amount: input.totalAmount || null,
          customer_name: input.customerName || null,
          vehicle_plate: input.vehiclePlate || null,
          driver_name: input.driverName || null,
          driver_phone: input.driverPhone || null,
        })
        .select('id, voucher_number')
        .single();

      if (voucherError) throw voucherError;
      if (!voucher) throw new Error('خطا در ایجاد حواله.');

      const voucherId = voucher.id;

      // 2. Insert voucher lines (line-level trigger handles inventory)
      if (input.lines.length > 0) {
        const dbLines = input.lines.map(line => ({
          voucher_id: voucherId,
          product_id: line.productId,
          quantity: line.quantity,
          unit_price: line.unitPrice || null,
          total_price: line.totalPrice || null,
          notes: line.notes || null,
        }));

        const { error: linesError } = await supabase
          .from('sales_voucher_lines')
          .insert(dbLines);

        if (linesError) {
          // Rollback: delete the voucher if lines fail (triggers reverse inventory)
          await supabase.from('sales_vouchers').delete().eq('id', voucherId);
          throw linesError;
        }
      }

      set({ isSubmitting: false });
      return { success: true, voucherId };
    } catch (e: any) {
      console.error('Create Sales Voucher Failed:', e);
      set({ isSubmitting: false });
      return { success: false, error: translateError(e) };
    }
  },

  // ============================
  // UPDATE VOUCHER (edit any voucher)
  // ============================
  updateSalesVoucher: async (id: string, input: UpdateSalesVoucherInput) => {
    set({ isSubmitting: true, error: null });
    try {
      // 1. Update voucher header
      const dbUpdates: any = {};
      if (input.voucherNumber !== undefined) dbUpdates.voucher_number = normalizeVoucherNumber(input.voucherNumber);
      if (input.voucherDate !== undefined) dbUpdates.voucher_date = normalizeDate(input.voucherDate);
      if (input.notes !== undefined) dbUpdates.notes = input.notes;
      if (input.totalAmount !== undefined) dbUpdates.total_amount = input.totalAmount;
      if (input.customerName !== undefined) dbUpdates.customer_name = input.customerName;
      if (input.vehiclePlate !== undefined) dbUpdates.vehicle_plate = input.vehiclePlate;
      if (input.driverName !== undefined) dbUpdates.driver_name = input.driverName;
      if (input.driverPhone !== undefined) dbUpdates.driver_phone = input.driverPhone;

      if (Object.keys(dbUpdates).length > 0) {
        const { error: updateError } = await supabase
          .from('sales_vouchers')
          .update(dbUpdates)
          .eq('id', id);

        if (updateError) throw updateError;
      }

      // 2. Update lines if provided (delete old + insert new → triggers handle inventory)
      if (input.lines && input.lines.length > 0) {
        await supabase.from('sales_voucher_lines').delete().eq('voucher_id', id);

        const dbLines = input.lines.map(line => ({
          voucher_id: id,
          product_id: line.productId,
          quantity: line.quantity,
          unit_price: line.unitPrice || null,
          total_price: line.totalPrice || null,
          notes: line.notes || null,
        }));

        const { error: linesError } = await supabase
          .from('sales_voucher_lines')
          .insert(dbLines);

        if (linesError) throw linesError;
      }

      set({ isSubmitting: false });
      return { success: true };
    } catch (e: any) {
      console.error('Update Sales Voucher Failed:', e);
      set({ isSubmitting: false });
      return { success: false, error: translateError(e) };
    }
  },

  // ============================
  // DELETE VOUCHER (any voucher — cascade deletes lines → triggers reverse inventory)
  // ============================
  deleteSalesVoucher: async (id: string) => {
    set({ isSubmitting: true, error: null });
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) {
      set({ isSubmitting: false });
      return { success: false, error: 'کاربر لاگین نیست.' };
    }

    try {
      const { error } = await supabase
        .from('sales_vouchers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set({ isSubmitting: false, currentVoucher: null });
      return { success: true };
    } catch (e: any) {
      console.error('Delete Sales Voucher Failed:', e);
      set({ isSubmitting: false });
      return { success: false, error: translateError(e) };
    }
  },

  // ============================
  // UTILITY
  // ============================
  clearCurrentVoucher: () => {
    set({ currentVoucher: null, error: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));
