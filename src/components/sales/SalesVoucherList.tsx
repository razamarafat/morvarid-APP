import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useSalesVoucherStore } from '../../store/salesVoucherStore';
import { useFarmStore } from '../../store/farmStore';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useConfirm } from '../../hooks/useConfirm';
import { Icons } from '../common/Icons';
import Button from '../common/Button';
import { SkeletonRow } from '../common/Skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { SalesVoucher, SalesVoucherFilter, UserRole } from '../../types';
import { toPersianDigits } from '../../utils/dateUtils';
import { SALES_VOUCHER_STATUS_LABELS, SALES_VOUCHER_STATUS_COLORS } from '../../constants';
import JalaliDatePicker from '../common/JalaliDatePicker';

interface SalesVoucherListProps {
  onNavigate: (view: string) => void;
  onEditVoucher?: (id: string) => void;
  readOnly?: boolean; // برای کاربران اپراتور
}

const SalesVoucherListWrapper: React.FC<SalesVoucherListProps> = ({ onNavigate, onEditVoucher, readOnly = false }) => {
  return (
    <SalesVoucherList onNavigate={onNavigate} onEditVoucher={onEditVoucher} readOnly={readOnly} />
  );
};

const SalesVoucherList: React.FC<SalesVoucherListProps> = ({ onNavigate, onEditVoucher, readOnly = false }) => {
  const { vouchers, isLoading, fetchSalesVouchers, deleteSalesVoucher } = useSalesVoucherStore();
  const { farms, products, getProductById } = useFarmStore();
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const { confirm } = useConfirm();

  const [filterFarmId, setFilterFarmId] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const isAdmin = user?.role === UserRole.ADMIN;
  const isSales = user?.role === UserRole.SALES;

  useEffect(() => {
    const filters: SalesVoucherFilter = {};
    if (filterFarmId !== 'all') filters.farmId = filterFarmId;
    if (filterDateFrom) filters.dateFrom = filterDateFrom;
    if (filterDateTo) filters.dateTo = filterDateTo;
    if (searchTerm) filters.search = searchTerm;

    fetchSalesVouchers(filters);
  }, [filterFarmId, filterDateFrom, filterDateTo, searchTerm]);

  const handleRefresh = () => {
    const filters: SalesVoucherFilter = {};
    if (filterFarmId !== 'all') filters.farmId = filterFarmId;
    if (filterDateFrom) filters.dateFrom = filterDateFrom;
    if (filterDateTo) filters.dateTo = filterDateTo;
    if (searchTerm) filters.search = searchTerm;

    fetchSalesVouchers(filters);
    addToast('لیست حواله‌ها بروزرسانی شد.', 'info');
  };

  const handleCreateNew = () => {
    onNavigate('sales-vouchers-new');
  };

  const handleView = (id: string) => {
    onNavigate(`sales-vouchers-view-${id}`);
  };

  const handleEdit = (id: string) => {
    if (onEditVoucher) {
      onEditVoucher(id);
    } else {
      onNavigate(`sales-vouchers-edit-${id}`);
    }
  };

  const handleDelete = async (voucher: SalesVoucher) => {
    const confirmed = await confirm({
      title: 'حذف حواله',
      message: `آیا از حذف حواله شماره ${toPersianDigits(voucher.voucherNumber)} اطمینان دارید؟ این عمل قابل بازگشت نیست.`,
      confirmText: 'حذف',
      cancelText: 'انصراف',
      type: 'danger',
    });

    if (!confirmed) return;

    const result = await deleteSalesVoucher(voucher.id);
    if (result.success) {
      addToast('حواله با موفقیت حذف شد.', 'success');
    } else {
      addToast(result.error || 'خطا در حذف حواله.', 'error');
    }
  };

  const clearFilters = () => {
    setFilterFarmId('all');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSearchTerm('');
  };

  const hasFilters = filterFarmId !== 'all' || filterDateFrom || filterDateTo || searchTerm;

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header Bar */}
      <div className="bg-white/80 dark:bg-black/40 backdrop-blur-md p-4 lg:p-6 shadow-sm border-l-4 border-l-violet-500 flex flex-col md:flex-row gap-4 lg:gap-6 items-end rounded-xl shrink-0">
        <div className="w-full md:w-1/4">
          <label className="block text-sm font-bold mb-1 lg:mb-2 text-gray-700 dark:text-gray-300">جستجو</label>
          <div className="relative">
            <Icons.Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="شماره حواله، نام مشتری..."
              className="w-full h-10 pr-9 pl-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-bold focus:outline-none focus:border-violet-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-allow-latin="true"
            />
          </div>
        </div>

        <div className="w-full md:w-1/4">
          <label className="block text-sm font-bold mb-1 lg:mb-2 text-gray-700 dark:text-gray-300">فارم</label>
          <select
            className="w-full h-10 p-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 dark:text-white font-bold text-sm outline-none focus:border-violet-500"
            value={filterFarmId}
            onChange={(e) => setFilterFarmId(e.target.value)}
          >
            <option value="all">همه فارم‌ها</option>
            {farms.filter(f => f.isActive).map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>

        <div className="w-full md:w-1/5">
          <label className="block text-sm font-bold mb-1 lg:mb-2 text-gray-700 dark:text-gray-300">از تاریخ</label>
          <div className="h-10 relative z-10">
            <JalaliDatePicker
              value={filterDateFrom}
              onChange={(date) => setFilterDateFrom(date)}
            />
          </div>
        </div>

        <div className="w-full md:w-1/5">
          <label className="block text-sm font-bold mb-1 lg:mb-2 text-gray-700 dark:text-gray-300">تا تاریخ</label>
          <div className="h-10 relative z-10">
            <JalaliDatePicker
              value={filterDateTo}
              onChange={(date) => setFilterDateTo(date)}
            />
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="h-10 px-4 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-xl hover:bg-gray-200 transition-colors font-bold text-sm"
            >
              <Icons.X className="w-4 h-4" />
            </button>
          )}
          <Button onClick={handleRefresh} className="bg-violet-500 hover:bg-violet-600 h-10 px-4 font-bold text-sm">
            <Icons.Refresh className="w-4 h-4 ml-2" />
            بروزرسانی
          </Button>
          {!readOnly && isSales && (
            <Button onClick={handleCreateNew} className="bg-violet-600 hover:bg-violet-700 h-10 px-4 font-bold text-sm">
              <Icons.Plus className="w-4 h-4 ml-2" />
              حواله جدید
            </Button>
          )}
        </div>
      </div>

      {/* Voucher List */}
      <div className="bg-white dark:bg-gray-800 p-0 shadow-md overflow-hidden border border-gray-100 dark:border-gray-700 rounded-[28px]">
        <div className="p-5 bg-violet-50 dark:bg-violet-900/20 border-b border-violet-100 dark:border-violet-800 shrink-0 flex justify-between items-center">
          <h3 className="font-black text-xl text-gray-800 dark:text-white flex items-center gap-2">
            <Icons.FileText className="w-6 h-6 text-violet-600" />
            {readOnly ? 'مشاهده حواله‌های فروش' : 'حواله‌های فروش'}
          </h3>
          <span className="text-xs font-bold text-violet-500">
            {toPersianDigits(vouchers.length)} حواله
          </span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-right border-collapse min-w-[800px]">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 font-black text-xs lg:text-sm uppercase tracking-wider sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-3 text-center">شماره حواله</th>
                <th className="p-3 text-center">فارم</th>
                <th className="p-3 text-center">تاریخ</th>
                <th className="p-3 text-center">مشتری</th>
                <th className="p-3 text-center">وضعیت</th>
                <th className="p-3 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-20">
                    <SkeletonRow height="h-12" />
                    <SkeletonRow height="h-12" />
                    <SkeletonRow height="h-12" />
                  </td>
                </tr>
              ) : vouchers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-24 text-gray-300">
                    <Icons.FileText className="w-20 h-20 mx-auto mb-4 opacity-20" />
                    <span className="text-lg font-bold">
                      {readOnly ? 'هیچ حواله فروشی برای فارم شما یافت نشد' : 'هیچ حواله‌ای یافت نشد'}
                    </span>
                    {!readOnly && isSales && (
                      <div className="mt-4">
                        <Button onClick={handleCreateNew} className="bg-violet-500">
                          <Icons.Plus className="w-4 h-4 ml-2" />
                          ایجاد اولین حواله
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                vouchers.map((voucher) => {
                  const statusColors = SALES_VOUCHER_STATUS_COLORS[voucher.status] || SALES_VOUCHER_STATUS_COLORS.submitted;
                  const statusLabel = SALES_VOUCHER_STATUS_LABELS[voucher.status] || 'ثبت شده';

                  return (
                    <tr key={voucher.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="p-3 text-center font-black text-lg text-violet-600 dark:text-violet-400">
                        {toPersianDigits(voucher.voucherNumber)}
                      </td>
                      <td className="p-3 text-center font-bold text-gray-800 dark:text-white">
                        {voucher.farmName || 'نامشخص'}
                      </td>
                      <td className="p-3 text-center font-bold text-gray-600 dark:text-gray-300">
                        {toPersianDigits(voucher.voucherDate)}
                      </td>
                      <td className="p-3 text-center font-bold text-gray-700 dark:text-gray-300">
                        {voucher.customerName || '---'}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${statusColors.bg} ${statusColors.text} border ${statusColors.border}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* View button - always available */}
                          <button
                            onClick={() => handleView(voucher.id)}
                            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            title="مشاهده"
                          >
                            <Icons.Eye className="w-4 h-4" />
                          </button>

                          {/* Edit button - by creator or admin */}
                          {!readOnly && (isAdmin || (isSales && voucher.createdBy === user?.id)) && (
                            <button
                              onClick={() => handleEdit(voucher.id)}
                              className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 hover:bg-violet-200 transition-colors"
                              title="ویرایش"
                            >
                              <Icons.Edit className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete button - admin or sales owner */}
                          {(isAdmin || (isSales && voucher.createdBy === user?.id)) && (
                            <button
                              onClick={() => handleDelete(voucher)}
                              className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 transition-colors"
                              title="حذف"
                            >
                              <Icons.Trash className="w-4 h-4" />
                            </button>
                          )}

                          {/* Copy to daily voucher - operator only */}
                          {readOnly && (
                            <button
                              onClick={() => {
                                // 20260619 fix: dispatch the typed payload via the
                                // Zustand `copiedSalesVoucher` slot instead of the
                                // previously-buggy `window.dispatchEvent(...)` global
                                // CustomEvent (any iframe could forge it). The
                                // RegistrationDashboard subscribes to the same
                                // slot via a zustand selector and switches to the
                                // InvoiceForm view automatically.
                                useInvoiceStore.getState().prepareCopyFromSalesVoucher(voucher.id);
                              }}
                              className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 hover:bg-violet-200 transition-colors flex items-center gap-1"
                              title="کپی به ثبت حواله"
                            >
                              <Icons.Download className="w-4 h-4" />
                              <span className="text-xs font-bold hidden lg:inline">کپی به ثبت</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SalesVoucherListWrapper;
export { SalesVoucherList };
