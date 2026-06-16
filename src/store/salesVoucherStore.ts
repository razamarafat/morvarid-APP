import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { SalesVoucher, SalesVoucherLine, SalesVoucherFilter, CreateSalesVoucherInput, UpdateSalesVoucherInput, SalesVoucherWithLines } from '../types';
import { useAuthStore } from './authStore';
import { useFarmStore } from './farmStore';
import { useStatisticsStore } from './statisticsStore';
import { normalizeDate } from '../utils/dateUtils';
import { getErrorMessage } from '../utils/errorUtils';

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
  submitSalesVoucher: (id: string) => Promise<{ success: boolean; error?: string }>;
  cancelSalesVoucher: (id: string) => Promise<{ success: boolean; error?: string }>;
  deleteSalesVoucher: (id: string) => Promise<{ success: boolean; error?: string }>;

  // Utility
  getNextVoucherNumber: () => Promise<string>;
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
          // No additional farm filter needed here, filters applied below
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
          cancelledBy: v.cancelled_by,
          cancelledAt: v.cancelled_at,
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
      // Fetch voucher with farm, creator, and editor info
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

      // Fetch voucher lines with product info
      const { data: lines, error: linesError } = await supabase
        .from('sales_voucher_lines')
        .select('*, products!inner(name, unit)')
        .eq('voucher_id', id)
        .order('created_at', { ascending: true });

      if (linesError) throw linesError;

      // Count total items and quantity
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

      const mapped: SalesVoucherWithLines = {
        id: voucher.id,
        voucherNumber: voucher.voucher_number,
        farmId: voucher.farm_id,
        voucherDate: normalizeDate(voucher.voucher_date),
        status: voucher.status,
        createdBy: voucher.created_by,
        submittedAt: voucher.submitted_at,
        notes: voucher.notes,
        totalAmount: voucher.total_amount,
        customerName: voucher.customer_name,
        customerPhone: voucher.customer_phone,
        vehiclePlate: voucher.vehicle_plate,
        deliveryAddress: voucher.delivery_address,
        driverName: voucher.driver_name,
        driverPhone: voucher.driver_phone,
        inventoryApplied: voucher.inventory_applied || false,
        cancelledBy: voucher.cancelled_by,
        cancelledAt: voucher.cancelled_at,
        createdAt: voucher.created_at,
        updatedAt: voucher.updated_at,
        updatedBy: voucher.updated_by,
        farmName: voucher.farms?.name || 'نامشخص',
        creatorName: voucher.profiles?.full_name || 'نامشخص',
        editorName: voucher.editor?.full_name || undefined,
        totalItems,
        totalQuantity,
        lines: mappedLines,
      };

      set({ currentVoucher: mapped, isLoading: false });
    } catch (e) {
      console.error('Fetch Sales Voucher By ID Failed:', e);
      set({ currentVoucher: null, isLoading: false, error: translateError(e) });
    }
  },

  // ============================
  // CREATE VOUCHER (with lines in transaction)
  // ============================
  createSalesVoucher: async (input: CreateSalesVoucherInput) => {
    set({ isSubmitting: true, error: null });
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) {
      set({ isSubmitting: false });
      return { success: false, error: 'کاربر لاگین نیست.' };
    }

    try {
      // 1. Insert the voucher (voucher_number is manual now)
      const normalizedVoucherNumber = (input.voucherNumber || '').trim();
      const { data: voucher, error: voucherError } = await supabase
        .from('sales_vouchers')
        .insert({
          farm_id: input.farmId,
          voucher_date: normalizeDate(input.voucherDate),
          voucher_number: normalizedVoucherNumber,
          status: 'draft',
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

      // 2. Insert voucher lines
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
          // Rollback: delete the voucher if lines fail
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
  // UPDATE DRAFT VOUCHER
  // ============================
  updateSalesVoucher: async (id: string, input: UpdateSalesVoucherInput) => {
    set({ isSubmitting: true, error: null });
    try {
      // 1. Verify voucher exists and is draft (server-side check via RLS handles security)
      const { data: voucher, error: fetchError } = await supabase
        .from('sales_vouchers')
        .select('status, created_by')
        .eq('id', id)
        .single();

      if (fetchError) {
        set({ isSubmitting: false });
        return { success: false, error: 'حواله یافت نشد.' };
      }
      if (voucher && voucher.status !== 'draft') {
        set({ isSubmitting: false });
        return { success: false, error: 'فقط حواله‌های پیش‌نویس قابل ویرایش هستند.' };
      }

      // 2. Update voucher header
      const dbUpdates: any = {};
      if (input.voucherNumber !== undefined) dbUpdates.voucher_number = (input.voucherNumber || '').trim();
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

      // 3. Update lines if provided (delete old, insert new)
      if (input.lines && input.lines.length > 0) {
        // Delete existing lines
        await supabase.from('sales_voucher_lines').delete().eq('voucher_id', id);

        // Insert new lines
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
  // SUBMIT VOUCHER (draft -> submitted + inventory deduction)
  // ============================
  submitSalesVoucher: async (id: string) => {
    set({ isSubmitting: true, error: null });
    try {
      // 1. Fetch current voucher to verify status and inventory
      const { data: voucher, error: fetchError } = await supabase
        .from('sales_vouchers')
        .select('*, sales_voucher_lines(*)')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      if (!voucher) {
        set({ isSubmitting: false });
        return { success: false, error: 'حواله یافت نشد.' };
      }
      if (voucher.status !== 'draft') {
        set({ isSubmitting: false });
        return { success: false, error: 'فقط حواله‌های پیش‌نویس قابل ثبت نهایی هستند.' };
      }

      // 2. SAFEGUARD: Check if inventory already applied
      if (voucher.inventory_applied) {
        set({ isSubmitting: false });
        return { success: false, error: 'موجودی انبار قبلاً برای این حواله کسر شده است.' };
      }

      // 3. SAFEGUARD: Check if inventory transactions already exist
      const { data: existingTxns, error: txnCheckError } = await supabase
        .from('inventory_transactions')
        .select('id')
        .eq('source_type', 'sales_voucher')
        .eq('source_id', id)
        .limit(1);

      if (!txnCheckError && existingTxns && existingTxns.length > 0) {
        set({ isSubmitting: false });
        return { success: false, error: 'تراکنش‌های انبار قبلاً برای این حواله ثبت شده است.' };
      }

      // 4. Verify lines exist
      const lines = voucher.sales_voucher_lines || [];
      if (lines.length === 0) {
        set({ isSubmitting: false });
        return { success: false, error: 'حواله بدون اقلام قابل ثبت نیست. حداقل یک قلم اضافه کنید.' };
      }

      // 5. Check inventory sufficiency for each line
      const { getLatestInventory } = useStatisticsStore.getState();
      const { getProductById } = useFarmStore.getState();
      const insufficientItems: string[] = [];

      for (const line of lines) {
        const { units } = getLatestInventory(voucher.farm_id, line.product_id);
        const product = getProductById(line.product_id);
        if (units < Number(line.quantity)) {
          insufficientItems.push(
            `${product?.name || 'محصول'} (موجودی: ${units}، نیاز: ${line.quantity})`
          );
        }
      }

      if (insufficientItems.length > 0) {
        set({ isSubmitting: false });
        return {
          success: false,
          error: `موجودی انبار برای اقلام زیر کافی نیست:\n${insufficientItems.join('\n')}`
        };
      }

      // 6. Submit the voucher (status change triggers inventory deduction via DB triggers)
      const { error: submitError } = await supabase
        .from('sales_vouchers')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          // inventory_applied is set by DB trigger
        })
        .eq('id', id);

      if (submitError) throw submitError;

      // 7. Refresh data
      await get().fetchSalesVoucherById(id);
      set({ isSubmitting: false });
      return { success: true };
    } catch (e: any) {
      console.error('Submit Sales Voucher Failed:', e);
      set({ isSubmitting: false });
      return { success: false, error: translateError(e) };
    }
  },

  // ============================
  // CANCEL VOUCHER (admin or sales owner, reverses inventory)
  // ============================
  cancelSalesVoucher: async (id: string) => {
    set({ isSubmitting: true, error: null });
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) {
      set({ isSubmitting: false });
      return { success: false, error: 'کاربر لاگین نیست.' };
    }

    try {
      const { error } = await supabase
        .from('sales_vouchers')
        .update({
          status: 'cancelled',
          cancelled_by: currentUser.id,
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      await get().fetchSalesVoucherById(id);
      set({ isSubmitting: false });
      return { success: true };
    } catch (e: any) {
      console.error('Cancel Sales Voucher Failed:', e);
      set({ isSubmitting: false });
      return { success: false, error: translateError(e) };
    }
  },

  // ============================
  // DELETE VOUCHER (admin or sales owner, draft only)
  // ============================
  deleteSalesVoucher: async (id: string) => {
    set({ isSubmitting: true, error: null });
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) {
      set({ isSubmitting: false });
      return { success: false, error: 'کاربر لاگین نیست.' };
    }

    try {
      // Verify status is draft
      const { data: voucher, error: fetchError } = await supabase
        .from('sales_vouchers')
        .select('status')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      if (voucher && voucher.status !== 'draft') {
        set({ isSubmitting: false });
        return { success: false, error: 'فقط حواله‌های پیش‌نویس قابل حذف هستند.' };
      }

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
  // GET NEXT VOUCHER NUMBER (deprecated - voucher number is now manual)
  // ============================
  getNextVoucherNumber: async (): Promise<string> => {
    // Voucher number is now fully manual. This function remains for API compatibility.
    return '';
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
