import React, { useEffect, useState } from 'react';
import { useSalesVoucherStore } from '../../store/salesVoucherStore';
import { useFarmStore } from '../../store/farmStore';
import { useAuthStore } from '../../store/authStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { Icons } from '../common/Icons';
import { toPersianDigits, formatNumberFa } from '../../utils/dateUtils';
import { SALES_VOUCHER_STATUS_LABELS, SALES_VOUCHER_STATUS_COLORS } from '../../constants';
import Button from '../common/Button';

interface SalesVoucherDetailProps {
  voucherId: string;
  onBack: () => void;
  readOnly?: boolean;
}

const SalesVoucherDetail: React.FC<SalesVoucherDetailProps> = ({ voucherId, onBack, readOnly = false }) => {
  const { currentVoucher, isLoading, fetchSalesVoucherById, clearCurrentVoucher } = useSalesVoucherStore();
  const { getProductById, farms } = useFarmStore();
  const { user } = useAuthStore();
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    fetchSalesVoucherById(voucherId);
    return () => clearCurrentVoucher();
  }, [voucherId]);

  // Check farm access for operators (Issue 1 fix)
  useEffect(() => {
    setAccessDenied(false); // Reset on every voucher change
    if (currentVoucher && user && user.role !== 'ADMIN' && user.role !== 'SALES') {
      const userFarmIds = (user.assignedFarms || []).map(f => f.id);
      if (!userFarmIds.includes(currentVoucher.farmId)) {
        setAccessDenied(true);
      }
    }
  }, [currentVoucher, user]);

  if (isLoading || !currentVoucher) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500"></div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="text-center py-20">
        <Icons.AlertTriangle className="w-16 h-16 mx-auto mb-4 text-amber-400" />
        <p className="text-gray-500 font-bold text-lg">شما به این حواله دسترسی ندارید.</p>
        <Button onClick={onBack} variant="secondary" className="mt-6">بازگشت</Button>
      </div>
    );
  }

  const voucher = currentVoucher;
  const statusColors = SALES_VOUCHER_STATUS_COLORS[voucher.status] || SALES_VOUCHER_STATUS_COLORS.submitted;
  const statusLabel = SALES_VOUCHER_STATUS_LABELS[voucher.status] || 'نامشخص';
  const farm = farms.find(f => f.id === voucher.farmId);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="bg-violet-50/80 dark:bg-violet-950/20 p-6 rounded-[24px] shadow-sm border border-violet-100 dark:border-violet-900/30 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white dark:bg-gray-800 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Icons.ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-violet-700 dark:text-violet-300">
              حواله فروش {toPersianDigits(voucher.voucherNumber)}
            </h1>
            <p className="text-sm text-violet-500 font-bold mt-1">
              {farm?.name || 'نامشخص'} | {toPersianDigits(voucher.voucherDate)}
            </p>
          </div>
        </div>
        <span className={`px-4 py-2 rounded-full text-sm font-bold ${statusColors.bg} ${statusColors.text} border ${statusColors.border}`}>
          {statusLabel}
        </span>
      </div>

      {/* Inventory Warning for Operator Copy (submitted is the only status after 20260617 rebuild) */}
      {readOnly && voucher.status === 'submitted' && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <Icons.AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-amber-700 dark:text-amber-300 text-sm">
                توجه: موجودی انبار قبلاً توسط این حواله فروش کاهش یافته است.
              </p>
              <p className="text-amber-600 dark:text-amber-400 text-xs mt-1">
                در صورت کپی این حواله به ثبت حواله مصرف، تأثیر مجددی بر موجودی انبار نخواهد داشت.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Voucher Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Buyer Info */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-[20px] shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="font-black text-sm text-gray-500 dark:text-gray-400 mb-4 flex items-center gap-2">
            <Icons.User className="w-4 h-4" />
            انتخاب خریدار
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400 text-xs font-bold">نام مشتری</span>
              <span className="font-bold text-gray-800 dark:text-white">{voucher.customerName || '---'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 text-xs font-bold">شماره حواله</span>
              <span className="font-bold text-violet-600 dark:text-violet-400">{toPersianDigits(voucher.voucherNumber)}</span>
            </div>
          </div>
        </div>

        {/* Transport Info */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-[20px] shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="font-black text-sm text-gray-500 dark:text-gray-400 mb-4 flex items-center gap-2">
            <Icons.Send className="w-4 h-4" />
            اطلاعات حمل و نقل
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400 text-xs font-bold">نام راننده</span>
              <span className="font-bold text-gray-800 dark:text-white">{voucher.driverName || '---'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 text-xs font-bold">شماره تماس</span>
              <span className="font-bold text-gray-800 dark:text-white" dir="ltr">{voucher.driverPhone || '---'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 text-xs font-bold">شماره پلاک</span>
              <span className="font-bold text-gray-800 dark:text-white">{voucher.vehiclePlate || '---'}</span>
            </div>
          </div>
        </div>

        {/* Status & Audit Info */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-[20px] shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="font-black text-sm text-gray-500 dark:text-gray-400 mb-4 flex items-center gap-2">
            <Icons.Info className="w-4 h-4" />
            وضعیت و ثبت
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400 text-xs font-bold">ایجاد کننده :</span>
              <span className="font-bold text-gray-800 dark:text-white">{voucher.creatorName || '---'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 text-xs font-bold">تاریخ ایجاد</span>
              <span className="font-bold text-gray-800 dark:text-white">
                {voucher.createdAt ? toPersianDigits(new Date(voucher.createdAt).toLocaleDateString('fa-IR')) : '---'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 text-xs font-bold">وضعیت موجودی</span>
              <span className="font-bold text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                کسر شده
              </span>
            </div>
          </div>
        </div>

        {/* Audit Info */}
        {voucher.updatedAt && new Date(voucher.updatedAt).getTime() > new Date(voucher.createdAt).getTime() + 2000 && (
          <div className="bg-white dark:bg-gray-800 p-5 rounded-[20px] shadow-sm border border-amber-100 dark:border-amber-900/30">
            <h3 className="font-black text-sm text-amber-600 dark:text-amber-400 mb-4 flex items-center gap-2">
              <Icons.Edit className="w-4 h-4" />
              تاریخچه ویرایش
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400 text-xs font-bold">آخرین ویرایش :</span>
                <span className="font-bold text-gray-800 dark:text-white">
                  {toPersianDigits(new Date(voucher.updatedAt).toLocaleDateString('fa-IR'))} ساعت {toPersianDigits(new Date(voucher.updatedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }))}
                </span>
              </div>
              {voucher.editorName && (
                <div className="flex justify-between">
                  <span className="text-gray-400 text-xs font-bold">ویرایش توسط :</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400">{voucher.editorName}</span>
                </div>
              )}
            </div>
          </div>
        )}
        {(!voucher.updatedAt || new Date(voucher.updatedAt).getTime() <= new Date(voucher.createdAt).getTime() + 2000) && (
          <div className="bg-white dark:bg-gray-800 p-5 rounded-[20px] shadow-sm border border-green-100 dark:border-green-900/30">
            <h3 className="font-black text-sm text-green-600 dark:text-green-400 mb-4 flex items-center gap-2">
              <Icons.Check className="w-4 h-4" />
              وضعیت ویرایش
            </h3>
            <p className="text-green-700 dark:text-green-300 text-sm font-bold">این حواله تاکنون ویرایش نشده است.</p>
          </div>
        )}
      </div>

      {/* Lines Table */}
      <div className="bg-white dark:bg-gray-800 rounded-[24px] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-5 bg-violet-50 dark:bg-violet-900/20 border-b border-violet-100 dark:border-violet-800">
          <h3 className="font-black text-lg text-gray-800 dark:text-white flex items-center gap-2">
            <Icons.List className="w-5 h-5 text-violet-600" />
            اقلام حواله ({toPersianDigits(voucher.totalItems || voucher.lines?.length || 0)} قلم)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 font-black text-xs uppercase">
              <tr>
                <th className="p-3 text-center">ردیف</th>
                <th className="p-3 text-center">محصول</th>
                <th className="p-3 text-center">تعداد</th>
                <th className="p-3 text-center">قیمت واحد</th>
                <th className="p-3 text-center">قیمت کل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {(voucher.lines || []).map((line, idx) => (
                <tr key={line.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="p-3 text-center font-bold text-gray-400">
                    {toPersianDigits(idx + 1)}
                  </td>
                  <td className="p-3 text-center font-black text-gray-800 dark:text-white">
                    {line.productName || getProductById(line.productId)?.name || 'نامشخص'}
                  </td>
                  <td className="p-3 text-center">
                    <span className="inline-block px-3 py-1 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 font-black text-lg rounded-lg">
                      {toPersianDigits(line.quantity)}
                    </span>
                  </td>
                  <td className="p-3 text-center font-bold text-gray-600 dark:text-gray-300">
                    {line.unitPrice ? toPersianDigits(line.unitPrice) : '---'}
                  </td>
                  <td className="p-3 text-center font-bold text-gray-600 dark:text-gray-300">
                    {line.totalPrice ? toPersianDigits(line.totalPrice) : '---'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-6">
          <div className="text-sm font-bold">
            <span className="text-gray-400">تعداد کل: </span>
            <span className="text-violet-600">{toPersianDigits(voucher.totalQuantity || 0)}</span>
          </div>
          {voucher.totalAmount && (
            <div className="text-sm font-bold">
              <span className="text-gray-400">مبلغ کل: </span>
              <span className="text-violet-600 font-mono tracking-wider">{formatNumberFa(voucher.totalAmount)} تومان</span>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {voucher.notes && (
        <div className="bg-white dark:bg-gray-800 p-5 rounded-[20px] shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="font-black text-sm text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
            <Icons.FileText className="w-4 h-4" />
            توضیحات
          </h3>
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{voucher.notes}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button
          onClick={onBack}
          variant="secondary"
          className="flex-1 h-14 rounded-[20px] font-black"
        >
          <Icons.ArrowLeft className="w-4 h-4 ml-2" />
          بازگشت
        </Button>

        {readOnly && voucher.status === 'submitted' && (
          <Button
            // 20260619 fix: dispatch the typed payload via the Zustand
            // `copiedSalesVoucher` slot instead of the old
            // `onCopyToInvoice` callback prop (which was tightly coupled
            // to RegistrationDashboard's internal mount state). The
            // Dashboard subscribes via a zustand selector and switches to
            // its 'invoice' view automatically.
            onClick={() => useInvoiceStore.getState().prepareCopyFromSalesVoucher(voucher.id)}
            className="flex-1 h-14 rounded-[20px] font-black bg-gradient-to-r from-violet-500 to-purple-600"
          >
            <Icons.Download className="w-4 h-4 ml-2" />
            کپی به ثبت حواله
          </Button>
        )}
      </div>
    </div>
  );
};

export default SalesVoucherDetail;
