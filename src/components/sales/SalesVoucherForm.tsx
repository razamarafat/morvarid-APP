import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../../store/authStore';
import { useFarmStore } from '../../store/farmStore';
import { useSalesVoucherStore } from '../../store/salesVoucherStore';
import { useStatisticsStore } from '../../store/statisticsStore';
import { useToastStore } from '../../store/toastStore';
import { useConfirm } from '../../hooks/useConfirm';
import { getTodayJalali, normalizeDate, toPersianDigits } from '../../utils/dateUtils';
import { compareProducts } from '../../utils/sortUtils';
import { getCorrectedInventory } from '../../utils/inventoryUtils';
import { normalizeVoucherNumber } from '../../utils/formatUtils';
import Button from '../common/Button';
import { Icons } from '../common/Icons';
import JalaliDatePicker from '../common/JalaliDatePicker';
import PersianNumberInput from '../common/PersianNumberInput';
import Input from '../common/Input';
import TextArea from '../common/TextArea';
import PlateInput from '../common/PlateInput';
import { motion, AnimatePresence } from 'framer-motion';
import { UserRole } from '../../types';

// Zod validation schema
const salesVoucherSchema = z.object({
  farmId: z.string().min(1, 'انتخاب فارم الزامی است'),
  voucherDate: z.string().min(1, 'تاریخ الزامی است'),
  voucherNumber: z.string().min(1, 'شماره حواله الزامی است').transform(normalizeVoucherNumber),
  customerName: z.string().min(1, 'نام خریدار الزامی است'),
  driverName: z.string().min(1, 'نام راننده الزامی است'),
  driverPhone: z.string().min(1, 'شماره تماس راننده الزامی است'),
  vehiclePlate: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof salesVoucherSchema>;

interface LineItem {
  key: string; // unique key for React
  productId: string;
  quantity: string;
  unitPrice: string;
}

interface SalesVoucherFormProps {
  onNavigate: (view: string) => void;
  editVoucherId?: string; // If provided, we're in edit mode
}

const SalesVoucherForm: React.FC<SalesVoucherFormProps> = ({ onNavigate, editVoucherId }) => {
  const { user } = useAuthStore();
  const { farms, products, getProductById } = useFarmStore();
  const { statistics, getLatestInventory } = useStatisticsStore();
  const { createSalesVoucher, updateSalesVoucher, fetchSalesVoucherById, currentVoucher, isSubmitting, clearCurrentVoucher } = useSalesVoucherStore();
  const { addToast } = useToastStore();
  const { confirm } = useConfirm();

  const todayJalali = getTodayJalali();
  const normalizedToday = normalizeDate(todayJalali);
  const isEditMode = !!editVoucherId;

  const isAdmin = user?.role === UserRole.ADMIN;
  const availableFarms = (isAdmin || user?.role === UserRole.SALES)
    ? farms.filter(f => f.isActive)
    : (user?.assignedFarms || []);

  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [lines, setLines] = useState<LineItem[]>([]);
  const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false);

  const { register, handleSubmit, setValue, watch, control, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(salesVoucherSchema),
    defaultValues: {
      voucherDate: normalizedToday,
      voucherNumber: '',
      customerName: '',
      driverName: '',
      driverPhone: '',
      vehiclePlate: '',
      notes: '',
      farmId: '',
    },
  });

  // Load voucher data in edit mode
  useEffect(() => {
    if (editVoucherId) {
      fetchSalesVoucherById(editVoucherId);
    }
    return () => {
      clearCurrentVoucher();
    };
  }, [editVoucherId]);

  // Populate form when voucher loads in edit mode + route-level protection
  useEffect(() => {
    if (isEditMode && currentVoucher) {
      // Route-level protection: verify ownership
      if (user && user.role !== 'ADMIN' && currentVoucher.createdBy !== user.id) {
        addToast('شما مجاز به ویرایش این حواله نیستید.', 'error');
        onNavigate('sales-vouchers');
        return;
      }

      setValue('farmId', currentVoucher.farmId);
      setValue('voucherDate', currentVoucher.voucherDate);
      setValue('voucherNumber', currentVoucher.voucherNumber || '');
      setValue('customerName', currentVoucher.customerName || '');
      setValue('vehiclePlate', currentVoucher.vehiclePlate || '');
      setValue('driverName', currentVoucher.driverName || '');
      setValue('driverPhone', currentVoucher.driverPhone || '');
      setValue('notes', currentVoucher.notes || '');
      setSelectedFarmId(currentVoucher.farmId);

      if (currentVoucher.lines && currentVoucher.lines.length > 0) {
        setLines(currentVoucher.lines.map(l => ({
          key: l.id,
          productId: l.productId,
          quantity: String(l.quantity),
          unitPrice: l.unitPrice ? String(l.unitPrice) : '',
        })));
      }
    }
  }, [isEditMode, currentVoucher]);

  // Initialize farm
  useEffect(() => {
    if (!selectedFarmId && availableFarms.length > 0 && !isEditMode) {
      setSelectedFarmId(availableFarms[0].id);
      setValue('farmId', availableFarms[0].id);
    }
  }, [availableFarms, selectedFarmId, isEditMode]);

  const selectedFarm = availableFarms.find(f => f.id === selectedFarmId);

  // Get farm products sorted
  const farmProductIds = useMemo(() => {
    if (!selectedFarm) return [];
    return [...selectedFarm.productIds].sort((a, b) => {
      const pA = getProductById(a);
      const pB = getProductById(b);
      if (!pA || !pB) return 0;
      return compareProducts(pA, pB);
    });
  }, [selectedFarm, products]);

  // Calculate totals
  const totals = useMemo(() => {
    let totalItems = lines.length;
    let totalQuantity = 0;
    let totalAmount = 0;

    lines.forEach(line => {
      const qty = Number(line.quantity) || 0;
      const price = Number(line.unitPrice) || 0;
      totalQuantity += qty;
      totalAmount += qty * price;
    });

    return { totalItems, totalQuantity, totalAmount };
  }, [lines]);

  const handleFarmChange = (farmId: string) => {
    setSelectedFarmId(farmId);
    setValue('farmId', farmId);
    setLines([]); // Clear lines when farm changes
  };

  const handleAddLine = () => {
    setLines(prev => [...prev, {
      key: `line-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      productId: '',
      quantity: '',
      unitPrice: '',
    }]);
    setIsProductSelectorOpen(true);
  };

  const handleRemoveLine = (index: number) => {
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof LineItem, value: string) => {
    setLines(prev => prev.map((line, i) =>
      i === index ? { ...line, [field]: value } : line
    ));
  };

  const getInventoryForProduct = (productId: string): number => {
    if (!selectedFarmId || !productId) return 0;
    const { units } = getLatestInventory(selectedFarmId, productId);
    return units;
  };

  const handleFormSubmit = async (data: FormValues) => {
    if (lines.length === 0) {
      addToast('حداقل یک قلم باید اضافه شود.', 'warning');
      return;
    }

    // Validate lines
    const insufficientItems: string[] = [];

    for (const line of lines) {
      if (!line.productId) {
        addToast('همه اقلام باید محصول انتخاب شده داشته باشند.', 'error');
        return;
      }
      if (!line.quantity || Number(line.quantity) <= 0) {
        addToast('تعداد همه اقلام باید بیشتر از صفر باشد.', 'error');
        return;
      }

      // Check inventory
      const inventory = getInventoryForProduct(line.productId);
      const product = getProductById(line.productId);
      if (Number(line.quantity) > inventory) {
        insufficientItems.push(
          `${product?.name || 'محصول'}: موجودی ${toPersianDigits(inventory)}، نیاز ${toPersianDigits(Number(line.quantity))}`
        );
      }
    }

    if (insufficientItems.length > 0) {
      const confirmed = await confirm({
        title: 'هشدار موجودی',
        message: `موجودی انبار برای اقلام زیر کافی نیست:\n${insufficientItems.join('\n')}\n\nآیا همچنان می‌خواهید ثبت کنید؟`,
        confirmText: 'بله، ثبت',
        cancelText: 'انصراف',
        type: 'warning',
      });
      if (!confirmed) return;
    }

    // Confirmation dialog
    const farmName = selectedFarm?.name || 'نامشخص';
    const confirmed = await confirm({
      title: isEditMode ? 'بروزرسانی حواله فروش' : 'ثبت حواله فروش',
      message: isEditMode
        ? `با بروزرسانی این حواله، موجودی انبار فارم ${farmName} متناسب با تغییرات اصلاح خواهد شد.\n\nتعداد اقلام: ${toPersianDigits(totals.totalItems)}\nمقدار کل: ${toPersianDigits(totals.totalQuantity)}\n\nآیا از بروزرسانی اطمینان دارید؟`
        : `با ثبت این حواله، موجودی انبار فارم ${farmName} به میزان ${toPersianDigits(totals.totalQuantity)} واحد کاهش خواهد یافت.\n\nتعداد اقلام: ${toPersianDigits(totals.totalItems)}\nمقدار کل: ${toPersianDigits(totals.totalQuantity)}\n\nآیا از ثبت اطمینان دارید؟`,
      confirmText: isEditMode ? 'بله، بروزرسانی' : 'بله، ثبت',
      cancelText: 'انصراف',
      type: 'warning',
    });

    if (!confirmed) return;

    const input = {
      farmId: data.farmId,
      voucherDate: normalizeDate(data.voucherDate),
      voucherNumber: data.voucherNumber,
      notes: data.notes,
      customerName: data.customerName,
      vehiclePlate: data.vehiclePlate,
      driverName: data.driverName,
      driverPhone: data.driverPhone,
      totalAmount: totals.totalAmount || undefined,
      lines: lines.map(l => ({
        productId: l.productId,
        quantity: Number(l.quantity),
        unitPrice: l.unitPrice ? Number(l.unitPrice) : undefined,
        totalPrice: l.unitPrice ? Number(l.quantity) * Number(l.unitPrice) : undefined,
      })),
    };

    let result;
    if (isEditMode && editVoucherId) {
      result = await updateSalesVoucher(editVoucherId, input);
    } else {
      result = await createSalesVoucher(input);
    }

    if (result.success) {
      addToast(isEditMode ? 'حواله فروش با موفقیت بروزرسانی شد.' : 'حواله فروش با موفقیت ثبت شد. موجودی انبار بروزرسانی شد.', 'success');
      onNavigate('sales-vouchers');
    } else {
      addToast(result.error || 'خطا در ثبت حواله.', 'error');
    }
  };

  const handleCancel = async () => {
    const formDirty = lines.length > 0 || watch('customerName') || watch('driverName');
    if (formDirty) {
      const confirmed = await confirm({
        title: 'انصراف',
        message: 'اطلاعات وارد شده ذخیره نخواهند شد. آیا مطمئن هستید؟',
        confirmText: 'بله، انصراف',
        cancelText: 'ادامه',
        type: 'warning',
      });
      if (!confirmed) return;
    }
    onNavigate('sales-vouchers');
  };

  if (!selectedFarm && !isEditMode && availableFarms.length > 0) {
    return (
      <div className="text-center py-20">
        <Icons.Home className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-400 font-bold">در حال بارگذاری فارم‌ها...</p>
      </div>
    );
  }

  if (availableFarms.length === 0) {
    return (
      <div className="text-center py-20">
        <Icons.AlertCircle className="w-16 h-16 mx-auto mb-4 text-amber-400" />
        <p className="text-gray-400 font-bold">هیچ فارمی برای شما تعریف نشده است.</p>
      </div>
    );
  }

  const inputClass = "w-full p-4 border-2 border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white font-black text-center focus:border-violet-500 outline-none transition-all text-xl rounded-xl shadow-sm placeholder-gray-400";
  const labelClass = "block text-sm font-black text-gray-500 dark:text-gray-400 mb-1.5 uppercase text-right px-1";

  return (
    <div className="max-w-4xl mx-auto space-y-6 lg:space-y-10 pb-20">
      {/* Header */}
      <div className="bg-violet-50/80 dark:bg-violet-950/20 p-6 rounded-[24px] shadow-sm border border-violet-100 dark:border-violet-900/30 relative overflow-hidden flex flex-col items-center justify-center gap-2 text-center">
        <Icons.FileText className="absolute right-4 top-1/2 -translate-y-1/2 w-32 h-32 text-violet-500 opacity-5 pointer-events-none -rotate-12" />
        <h1 className="text-4xl lg:text-5xl font-black text-violet-700 dark:text-violet-300 relative z-10">
          {isEditMode ? 'ویرایش حواله فروش' : 'ایجاد حواله فروش جدید'}
        </h1>
        <p className="text-violet-500 dark:text-violet-400 font-bold text-sm relative z-10">
          {isEditMode ? `شماره حواله: ${toPersianDigits(currentVoucher?.voucherNumber || '')}` : 'سیستم حواله فروش'}
        </p>
      </div>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="px-1 space-y-8">
        {/* Farm & Date Section */}
        <div className="bg-white dark:bg-gray-800 p-6 lg:p-8 rounded-[24px] shadow-sm border border-gray-100 dark:border-gray-700 border-r-[8px] border-r-violet-500">
          <h3 className="font-black text-xl mb-6 text-gray-800 dark:text-white flex items-center gap-2">
            <Icons.Home className="w-6 h-6 text-violet-500" />
            انتخاب محل فروش
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>فارم <span className="text-red-500">*</span></label>
              <select
                className={`${inputClass} h-16`}
                value={selectedFarmId}
                onChange={(e) => handleFarmChange(e.target.value)}
              >
                <option value="">انتخاب فارم...</option>
                {availableFarms.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              {errors.farmId && <p className="text-red-500 text-xs font-bold mt-2 mr-1">{errors.farmId.message}</p>}
            </div>
            <div>
              <label className={labelClass}>تاریخ حواله <span className="text-red-500">*</span></label>
              <div className="h-16 relative z-10">
                <JalaliDatePicker
                  value={watch('voucherDate')}
                  onChange={(date) => setValue('voucherDate', date)}
                />
              </div>
              {errors.voucherDate && <p className="text-red-500 text-xs font-bold mt-2 mr-1">{errors.voucherDate.message}</p>}
            </div>
          </div>
        </div>

        {/* Buyer Info Section */}
        <div className="bg-white dark:bg-gray-800 p-6 lg:p-8 rounded-[24px] shadow-sm border border-gray-100 dark:border-gray-700 border-r-[8px] border-r-violet-400">
          <h3 className="font-black text-xl mb-6 text-gray-800 dark:text-white flex items-center gap-2">
            <Icons.User className="w-6 h-6 text-violet-400" />
            انتخاب خریدار
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>نام مشتری <span className="text-red-500">*</span></label>
              <Input
                {...register('customerName')}
                className={inputClass}
                placeholder="نام خریدار"
              />
              {errors.customerName && <p className="text-red-500 text-xs font-bold mt-2 mr-1">{errors.customerName.message}</p>}
            </div>
            <div>
              <label className={labelClass}>شماره حواله <span className="text-red-500">*</span></label>
              <Input
                {...register('voucherNumber')}
                className={inputClass}
                placeholder="شماره حواله را وارد کنید"
              />
              {errors.voucherNumber && <p className="text-red-500 text-xs font-bold mt-2 mr-1">{errors.voucherNumber.message}</p>}
            </div>
          </div>
        </div>

        {/* Transport Info Section */}
        <div className="bg-white dark:bg-gray-800 p-6 lg:p-8 rounded-[24px] shadow-sm border border-gray-100 dark:border-gray-700 border-r-[8px] border-r-violet-400">
          <h3 className="font-black text-xl mb-6 text-gray-800 dark:text-white flex items-center gap-2">
            <Icons.Send className="w-6 h-6 text-violet-400" />
            اطلاعات حمل و نقل
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>نام راننده <span className="text-red-500">*</span></label>
              <Input
                {...register('driverName')}
                className={inputClass}
                placeholder="نام راننده"
              />
              {errors.driverName && <p className="text-red-500 text-xs font-bold mt-2 mr-1">{errors.driverName.message}</p>}
            </div>
            <div>
              <label className={labelClass}>شماره تماس <span className="text-red-500">*</span></label>
              <Controller
                name="driverPhone"
                control={control}
                render={({ field }) => (
                  <PersianNumberInput
                    value={field.value || ''}
                    onChange={field.onChange}
                    maxLength={11}
                    inputMode="tel"
                    className={`${inputClass} font-mono tracking-widest`}
                    placeholder="۰۹xxxxxxxxx"
                  />
                )}
              />
              {errors.driverPhone && <p className="text-red-500 text-xs font-bold mt-2 mr-1">{errors.driverPhone.message}</p>}
            </div>
            <div>
              <label className={labelClass}>شماره پلاک خودرو</label>
              <Controller
                name="vehiclePlate"
                control={control}
                render={({ field }) => (
                  <PlateInput
                    value={field.value || ''}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>
        </div>

        {/* Lines Section */}
        <div className="bg-white dark:bg-gray-800 p-6 lg:p-8 rounded-[24px] shadow-sm border border-gray-100 dark:border-gray-700 border-r-[8px] border-r-violet-600">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-xl text-gray-800 dark:text-white flex items-center gap-2">
              <Icons.List className="w-6 h-6 text-violet-600" />
              اقلام حواله
            </h3>
            <button
              type="button"
              onClick={handleAddLine}
              className="text-sm font-bold text-violet-600 bg-violet-50 dark:bg-violet-900/20 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
              disabled={!selectedFarmId}
            >
              <Icons.Plus className="w-4 h-4" />
              افزودن قلم
            </button>
          </div>

          <div className="space-y-4">
            {lines.length === 0 ? (
              <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
                <Icons.Plus className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-bold">هیچ قلمی اضافه نشده است</p>
                <p className="text-sm mt-1">برای شروع، روی دکمه "افزودن قلم" کلیک کنید</p>
              </div>
            ) : (
              lines.map((line, index) => {
                const product = getProductById(line.productId);
                const inventory = getInventoryForProduct(line.productId);
                const qty = Number(line.quantity) || 0;
                const price = Number(line.unitPrice) || 0;
                const lineTotal = qty * price;
                const isOverInventory = qty > inventory && inventory > 0;

                return (
                  <motion.div
                    key={line.key}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-black text-gray-700 dark:text-gray-300">
                        قلم {toPersianDigits(index + 1)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(index)}
                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-lg transition-colors"
                      >
                        <Icons.Trash className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-1">
                        <label className="text-xs font-bold text-gray-400 block mb-1">محصول <span className="text-red-500">*</span></label>
                        <select
                          className="w-full p-3 bg-white dark:bg-gray-800 dark:text-white font-bold text-sm rounded-xl outline-none focus:ring-2 focus:ring-violet-500 border-2 border-gray-200 dark:border-gray-700"
                          value={line.productId}
                          onChange={(e) => handleLineChange(index, 'productId', e.target.value)}
                        >
                          <option value="">انتخاب محصول...</option>
                          {farmProductIds.map(pid => {
                            const p = getProductById(pid);
                            const inv = getInventoryForProduct(pid);
                            return (
                              <option key={pid} value={pid} disabled={lines.some((l, i) => i !== index && l.productId === pid)}>
                                {p?.name || pid} (موجودی: {toPersianDigits(inv)})
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-gray-400 block mb-1">تعداد <span className="text-red-500">*</span></label>
                        <PersianNumberInput
                          className={`w-full p-3 bg-white dark:bg-gray-800 dark:text-white text-center font-black text-xl rounded-xl outline-none focus:ring-2 border-2 ${isOverInventory ? 'border-red-400 focus:ring-red-500' : 'border-gray-200 dark:border-gray-700 focus:ring-violet-500'}`}
                          value={line.quantity}
                          onChange={(val) => handleLineChange(index, 'quantity', val)}
                          placeholder="۰"
                        />
                        {isOverInventory && (
                          <p className="text-red-500 text-[10px] font-bold mt-1">
                            موجودی: {toPersianDigits(inventory)} - هشدار: بیش از موجودی
                          </p>
                        )}
                        {!isOverInventory && inventory > 0 && (
                          <p className="text-gray-400 text-[10px] font-bold mt-1">
                            موجودی: {toPersianDigits(inventory)}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-bold text-gray-400 block mb-1">قیمت واحد (اختیاری)</label>
                        <PersianNumberInput
                          className="w-full p-3 bg-white dark:bg-gray-800 dark:text-white text-center font-black text-xl rounded-xl outline-none focus:ring-2 focus:ring-violet-500 border-2 border-gray-200 dark:border-gray-700"
                          value={line.unitPrice}
                          onChange={(val) => handleLineChange(index, 'unitPrice', val)}
                          placeholder="تومان"
                        />
                        {price > 0 && (
                          <p className="text-violet-500 text-[10px] font-bold mt-1">
                            قیمت کل: {toPersianDigits(lineTotal)} تومان
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Totals Summary */}
          {lines.length > 0 && (
            <div className="mt-6 p-4 bg-violet-50 dark:bg-violet-900/20 rounded-2xl border border-violet-100 dark:border-violet-800">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 block">تعداد اقلام</span>
                  <span className="font-black text-xl text-violet-700 dark:text-violet-300">
                    {toPersianDigits(totals.totalItems)}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 block">مقدار کل</span>
                  <span className="font-black text-xl text-violet-700 dark:text-violet-300">
                    {toPersianDigits(totals.totalQuantity)}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 block">مبلغ کل (تومان)</span>
                  <span className="font-black text-xl text-violet-700 dark:text-violet-300">
                    {toPersianDigits(totals.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Notes Section */}
        <div className="bg-white dark:bg-gray-800 p-6 lg:p-8 rounded-[24px] shadow-sm border border-gray-100 dark:border-gray-700 border-r-[8px] border-r-violet-300">
          <h3 className="font-black text-xl mb-6 text-gray-800 dark:text-white flex items-center gap-2">
            <Icons.FileText className="w-6 h-6 text-violet-300" />
            توضیحات
          </h3>
          <div>
            <label className={labelClass}>توضیحات (اختیاری)</label>
            <TextArea
              {...register('notes')}
              className="w-full p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-violet-500 h-24 text-right placeholder-gray-400"
              placeholder="توضیحات عمومی حواله..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <Button
            type="button"
            onClick={handleCancel}
            variant="secondary"
            className="flex-1 h-16 text-lg font-black rounded-[24px]"
          >
            انصراف
          </Button>

          <Button
            type="submit"
            isLoading={isSubmitting}
            className="flex-1 h-16 text-lg font-black bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-xl shadow-violet-200 dark:shadow-none rounded-[24px] border-b-4 border-violet-800 active:border-b-0 active:translate-y-1 transition-all"
          >
            <Icons.Check className="w-5 h-5 ml-2" />
            {isEditMode ? 'بروزرسانی حواله' : 'ثبت حواله فروش'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default SalesVoucherForm;
