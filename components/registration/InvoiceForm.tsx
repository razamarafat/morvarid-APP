
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../../store/authStore';
import { useFarmStore } from '../../store/farmStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useStatisticsStore } from '../../store/statisticsStore';
import { useToastStore } from '../../store/toastStore';
import { getTodayJalali, getTodayDayName, getCurrentTime, normalizeDate, toPersianDigits } from '../../utils/dateUtils';
import Button from '../common/Button';
import { Icons } from '../common/Icons';
import { useConfirm } from '../../hooks/useConfirm';
import JalaliDatePicker from '../common/JalaliDatePicker';
import { motion, AnimatePresence } from 'framer-motion';

// Regex Definitions
const noLatinRegex = /^[^a-zA-Z]*$/;
const mobileRegex = /^09\d{9}$/;
const invoiceNumberRegex = /^(17|18)\d{8}$/; // Starts with 17 or 18, followed by 8 digits (Total 10)
// Plate format: 2 digits - 3 digits + Persian Char - 2 digits (flexible on dashes)
const plateRegex = /^\d{2}[\s-]?\d{3}[\s-]?[\u0600-\u06FF][\s-]?\d{2}$/;

const invoiceGlobalSchema = z.object({
    invoiceNumber: z.string()
        .min(1, 'شماره حواله الزامی است')
        .regex(invoiceNumberRegex, 'شماره حواله باید ۱۰ رقم باشد و با ۱۷ یا ۱۸ شروع شود (مثال: ۱۷۶۱۲۳۴۵۶۷)'),
    contactPhone: z.string()
        .min(1, 'شماره تماس الزامی است')
        .regex(mobileRegex, 'شماره همراه باید ۱۱ رقم و با ۰۹ شروع شود (مثال: ۰۹۱۲۳۴۵۶۷۸۹)'),
    driverName: z.string().optional()
        .refine(val => !val || noLatinRegex.test(val), 'استفاده از حروف انگلیسی در نام راننده مجاز نیست'),
    plateNumber: z.string().optional()
        .refine(val => !val || plateRegex.test(val), 'فرمت پلاک صحیح نیست. مثال: ۱۵-۳۶۵ج۱۱'),
    driverMobile: z.string().optional()
        .refine(val => !val || mobileRegex.test(val), 'شماره موبایل راننده معتبر نیست (فرمت: ۰۹xxxxxxxxx)'),
    description: z.string().optional()
        .refine(val => !val || noLatinRegex.test(val), 'استفاده از حروف انگلیسی در توضیحات مجاز نیست'),
});

type GlobalValues = z.infer<typeof invoiceGlobalSchema>;

export const InvoiceForm: React.FC = () => {
    const { user } = useAuthStore();
    const { getProductById } = useFarmStore();
    const { addInvoice } = useInvoiceStore();
    const { statistics } = useStatisticsStore(); // Access stats for validation
    const { addToast } = useToastStore();
    const { confirm } = useConfirm();
    
    const todayJalali = getTodayJalali();
    const todayDayName = getTodayDayName();
    const normalizedDate = normalizeDate(todayJalali);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const userFarms = user?.assignedFarms || [];
    const [selectedFarmId] = useState<string>(userFarms[0]?.id || '');
    const selectedFarm = userFarms.find(f => f.id === selectedFarmId);
    
    const [referenceDate, setReferenceDate] = useState(normalizedDate);
    const [currentTime, setCurrentTime] = useState(getCurrentTime(false));
    
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
    const [itemsState, setItemsState] = useState<Record<string, { cartons: string; weight: string }>>({});
    
    const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false);

    const { register, handleSubmit, setValue, formState: { errors } } = useForm<GlobalValues>({
        resolver: zodResolver(invoiceGlobalSchema),
        defaultValues: { description: '' }
    });

    useEffect(() => {
        setReferenceDate(normalizedDate);
    }, [normalizedDate]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(getCurrentTime(false)), 30000);
        return () => clearInterval(timer);
    }, []);

    const handleProductToggle = (pid: string) => {
        setSelectedProductIds(prev => {
            const exists = prev.includes(pid);
            if (exists) {
                const newState = { ...itemsState };
                delete newState[pid];
                setItemsState(newState);
                return prev.filter(id => id !== pid);
            } else {
                setItemsState(s => ({ ...s, [pid]: { cartons: '', weight: '' } }));
                return [...prev, pid];
            }
        });
    };

    // Strict Input Sanitization
    const handleItemChange = (pid: string, field: 'cartons' | 'weight', val: string) => {
        // Remove any non-digit/decimal characters immediately
        let cleanVal = val;
        
        if (field === 'cartons') {
            // Integers only
            cleanVal = val.replace(/[^0-9]/g, '');
            // Limit length
            if (cleanVal.length > 6) return;
        } else {
            // Decimals allowed
            cleanVal = val.replace(/[^0-9.]/g, '');
            // Prevent multiple dots
            if ((cleanVal.match(/\./g) || []).length > 1) return;
            // Limit length
            if (cleanVal.length > 8) return;
        }

        setItemsState(prev => ({
            ...prev,
            [pid]: { ...prev[pid], [field]: cleanVal }
        }));
    };

    const handleFinalSubmit = async (globalData: GlobalValues) => {
        if (selectedProductIds.length === 0) {
            addToast('لطفا حداقل یک محصول انتخاب کنید.', 'warning');
            return;
        }

        // Logic & Validation Check
        for (const pid of selectedProductIds) {
            const item = itemsState[pid];
            const product = getProductById(pid);
            const name = product?.name || 'محصول';
            
            const cartons = Number(item.cartons);
            const weight = Number(item.weight);

            if (!item.cartons || cartons <= 0) {
                addToast(`تعداد برای "${name}" وارد نشده است.`, 'error');
                return;
            }
            
            if (!item.weight || weight <= 0) {
                addToast(`وزن برای "${name}" وارد نشده است. (وزن حواله الزامی است)`, 'error');
                return;
            }

            // --- LOGICAL INVENTORY CHECK ---
            // Find statistics for this specific farm/date/product
            const statRecord = statistics.find(s => 
                s.farmId === selectedFarmId && 
                s.date === referenceDate && 
                s.productId === pid
            );

            // 1. Check if Statistics Exist
            if (!statRecord) {
                addToast(`خطا: آمار تولید برای "${name}" در تاریخ ${referenceDate} ثبت نشده است. ابتدا آمار را ثبت کنید تا موجودی ایجاد شود.`, 'error');
                return;
            }

            // 2. Check if Inventory is Sufficient
            const totalAvailable = (statRecord.previousBalance || 0) + (statRecord.production || 0);
            const currentSales = statRecord.sales || 0;
            const remaining = totalAvailable - currentSales;

            if (cartons > remaining) {
                addToast(`موجودی ناکافی برای "${name}". (موجود: ${toPersianDigits(remaining)} - درخواستی: ${toPersianDigits(cartons)})`, 'error');
                return;
            }
        }

        const confirmed = await confirm({
            title: 'ثبت نهایی حواله',
            message: `آیا از ثبت ${toPersianDigits(selectedProductIds.length)} قلم کالا در حواله شماره ${toPersianDigits(globalData.invoiceNumber)} اطمینان دارید؟`,
            confirmText: 'بله، ثبت نهایی',
            type: 'info'
        });

        if (!confirmed) return;

        setIsSubmitting(true);
        const isDateChanged = referenceDate !== normalizedDate;
        
        const dateSuffix = isDateChanged ? ` (مربوط به تاریخ ${referenceDate})` : '';
        const mobileSuffix = globalData.driverMobile ? ` | موبایل راننده: ${globalData.driverMobile}` : '';
        const finalDescription = `${(globalData.description || '').trim()}${dateSuffix}${mobileSuffix}`;

        let successCount = 0;
        let failCount = 0;
        let lastError = '';

        for (const pid of selectedProductIds) {
            const item = itemsState[pid];
            const result = await addInvoice({
                farmId: selectedFarmId,
                date: referenceDate, // Use reference date strictly
                invoiceNumber: globalData.invoiceNumber,
                totalCartons: Number(item.cartons),
                totalWeight: Number(item.weight),
                productId: pid,
                driverName: globalData.driverName || '',
                driverPhone: globalData.contactPhone,
                plateNumber: globalData.plateNumber || '',
                description: finalDescription,
                isYesterday: isDateChanged
            });
            
            if (result.success) {
                successCount++;
            } else {
                failCount++;
                lastError = result.error || 'خطای نامشخص';
            }
        }

        setIsSubmitting(false);
        if (failCount === 0) {
            addToast(`حواله با موفقیت ثبت شد (${toPersianDigits(successCount)} قلم).`, 'success');
            setSelectedProductIds([]);
            setItemsState({});
            setValue('invoiceNumber', '');
            setValue('contactPhone', '');
            setValue('driverName', '');
            setValue('plateNumber', '');
            setValue('driverMobile', '');
            setValue('description', '');
        } else {
            addToast(`خطا در ثبت: ${lastError}`, 'error');
        }
    };

    const inputClass = "w-full p-3 lg:p-4 lg:text-2xl lg:h-16 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-black text-center focus:border-metro-blue outline-none transition-all text-lg shadow-sm";
    const labelClass = "block text-[10px] lg:text-sm font-black text-gray-400 dark:text-gray-500 mb-1 uppercase text-right px-1";

    if (!selectedFarm) return <div className="p-20 text-center font-bold text-gray-400">فارمی یافت نشد.</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6 lg:space-y-10 pb-20">
            {/* Animated Header */}
            <div className="bg-metro-blue p-8 text-white shadow-xl relative overflow-hidden flex flex-col items-center justify-center gap-4 border-b-8 border-blue-900/30">
                <div className="absolute inset-0 z-0 bg-gradient-to-r from-metro-blue via-metro-cobalt to-metro-blue bg-[length:200%_200%] animate-[gradient-xy_3s_ease_infinite]"></div>
                <Icons.FileText className="absolute -right-12 -bottom-8 w-64 h-64 opacity-10 pointer-events-none rotate-12" />
                <div className="relative z-10 flex justify-center items-center gap-4 text-xl font-bold bg-white/10 backdrop-blur-md px-8 py-3 w-full max-w-sm border-r-4 border-white shadow-lg transition-transform hover:scale-[1.02]">
                    <span className="opacity-90">{todayDayName}</span>
                    <div className="w-[2px] h-6 bg-white/30 rounded-full"></div>
                    <span className="font-sans tracking-tight text-3xl lg:text-4xl font-black drop-shadow-sm">{toPersianDigits(referenceDate)}</span>
                </div>
                <div className="relative z-10 text-7xl lg:text-8xl font-black font-sans tabular-nums tracking-widest mt-2 drop-shadow-2xl flex items-center gap-2">{currentTime}</div>
            </div>

            {/* TASK 1: Main Specifications Section */}
            <div className="bg-white dark:bg-gray-800 p-6 lg:p-8 shadow-md border-l-[12px] border-metro-blue rounded-xl space-y-6 relative">
                <div className="absolute top-0 right-0 bg-metro-blue text-white px-3 py-1 text-xs lg:text-sm font-bold rounded-bl-lg">مشخصات اصلی حواله</div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8 mt-2">
                    <div className="group">
                        <label className={labelClass}>رمز حواله (شروع با ۱۷ یا ۱۸ - ۱۰ رقم)</label>
                        <input dir="ltr" type="tel" inputMode="numeric" {...register('invoiceNumber')} className={`${inputClass} !text-2xl lg:!text-3xl tracking-[0.2em] border-metro-blue/30`} placeholder="" maxLength={10} />
                        {errors.invoiceNumber && <p className="text-red-500 text-xs mt-1 font-bold">{errors.invoiceNumber.message}</p>}
                    </div>

                    <div className="bg-blue-50 dark:bg-black/20 p-2 border-2 border-dashed border-blue-200 dark:border-gray-700 rounded-lg">
                        <JalaliDatePicker label="تاریخ حواله" value={referenceDate} onChange={setReferenceDate} />
                    </div>
                </div>

                <div>
                    <label className={labelClass}>شماره تماس (اصلی)</label>
                    <input dir="ltr" type="tel" inputMode="numeric" {...register('contactPhone')} className={`${inputClass} !text-xl lg:!text-3xl font-mono border-metro-blue/30`} placeholder="" maxLength={11} />
                    {errors.contactPhone && <p className="text-red-500 text-xs mt-1 font-bold">{errors.contactPhone.message}</p>}
                </div>
            </div>

            {/* TASK 2: Product Dropdown Selection */}
            <div className="bg-white dark:bg-gray-800 p-6 lg:p-8 shadow-md border-l-[12px] border-metro-orange rounded-xl space-y-2">
                <button 
                    onClick={() => setIsProductSelectorOpen(!isProductSelectorOpen)}
                    className="w-full flex justify-between items-center bg-gray-100 dark:bg-gray-700 p-4 lg:p-6 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Icons.Check className="w-5 h-5 lg:w-8 lg:h-8 text-metro-orange" />
                        <span className="font-bold text-gray-700 dark:text-white lg:text-xl">انتخاب محصولات</span>
                        <span className="text-xs lg:text-base bg-orange-100 text-orange-800 px-2 lg:px-4 py-0.5 lg:py-1 rounded-full font-bold mr-2">
                            {toPersianDigits(selectedProductIds.length)} مورد
                        </span>
                    </div>
                    <Icons.ChevronDown className={`w-5 h-5 lg:w-8 lg:h-8 transition-transform text-gray-500 ${isProductSelectorOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                    {isProductSelectorOpen && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700"
                        >
                            <div className="p-2 lg:p-4 space-y-1 lg:space-y-2">
                                {selectedFarm.productIds.map(pid => {
                                    const p = getProductById(pid);
                                    const isSelected = selectedProductIds.includes(pid);
                                    return (
                                        <label 
                                            key={pid} 
                                            className="flex items-center p-3 lg:p-4 rounded-md hover:bg-white dark:hover:bg-gray-800 cursor-pointer transition-colors select-none"
                                        >
                                            <input 
                                                type="checkbox" 
                                                className="w-5 h-5 lg:w-6 lg:h-6 ml-3 rounded text-metro-orange focus:ring-metro-orange border-gray-300"
                                                checked={isSelected}
                                                onChange={() => handleProductToggle(pid)}
                                            />
                                            <span className={`flex-1 font-medium lg:text-xl ${isSelected ? 'text-metro-orange font-bold' : 'text-gray-700 dark:text-gray-300'}`}>
                                                {p?.name}
                                            </span>
                                            <span className="text-[10px] lg:text-sm text-gray-400">
                                                {p?.unit === 'CARTON' ? 'کارتن' : 'واحد'}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* TASK 2: Dynamic Input Tables for Selected Products */}
            <AnimatePresence>
                {selectedProductIds.length > 0 && (
                    <div className="space-y-4 lg:space-y-6">
                        <h4 className="text-sm lg:text-lg font-black text-gray-500 dark:text-gray-400 px-2 flex items-center gap-2">
                            <Icons.Edit className="w-4 h-4 lg:w-6 lg:h-6" />
                            ورود اطلاعات اقلام
                        </h4>
                        {selectedProductIds.map(pid => {
                            const p = getProductById(pid);
                            const state = itemsState[pid] || { cartons: '', weight: '' };
                            
                            // Visual Feedback for Inventory
                            const statRecord = statistics.find(s => s.farmId === selectedFarmId && s.date === referenceDate && s.productId === pid);
                            const currentInv = statRecord ? (statRecord.production || 0) + (statRecord.previousBalance || 0) - (statRecord.sales || 0) : 0;
                            const hasStats = !!statRecord;

                            return (
                                <motion.div 
                                    key={pid} 
                                    initial={{ opacity: 0, x: -20 }} 
                                    animate={{ opacity: 1, x: 0 }} 
                                    exit={{ opacity: 0, scale: 0.95 }} 
                                    className="bg-white dark:bg-gray-800 p-4 lg:p-6 border-r-8 border-metro-green shadow-sm rounded-lg flex flex-col md:flex-row items-center gap-4 lg:gap-8"
                                >
                                    <div className="w-full md:w-1/3 flex flex-col gap-2 border-b-2 md:border-b-0 md:border-l-2 border-gray-100 dark:border-gray-700 pb-2 md:pb-0 md:pl-4">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-green-100 text-green-700 p-2 lg:p-3 rounded-full">
                                                <Icons.Check className="w-5 h-5 lg:w-8 lg:h-8" />
                                            </div>
                                            <div>
                                                <h5 className="font-black text-gray-800 dark:text-white lg:text-2xl">{p?.name}</h5>
                                                <span className="text-[10px] lg:text-sm text-gray-400">{p?.unit === 'CARTON' ? 'واحد: کارتن' : 'واحد: عدد'}</span>
                                            </div>
                                        </div>
                                        
                                        {/* Available Inventory Badge */}
                                        <div className={`text-xs lg:text-sm px-2 lg:px-4 py-1 lg:py-2 rounded font-bold text-center ${hasStats ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700 animate-pulse'}`}>
                                            {hasStats ? `موجودی قابل فروش: ${toPersianDigits(currentInv)}` : 'هشدار: آمار ثبت نشده است'}
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4 lg:gap-8 flex-1 w-full">
                                        <div>
                                            <label className={labelClass}>تعداد</label>
                                            <input 
                                                type="tel"
                                                inputMode="numeric" 
                                                value={state.cartons} 
                                                onChange={e => handleItemChange(pid, 'cartons', e.target.value)} 
                                                className={inputClass} 
                                                placeholder="" 
                                            />
                                        </div>
                                        <div>
                                            <label className={`${labelClass} text-red-500`}>وزن (Kg) *</label>
                                            <input 
                                                type="tel"
                                                inputMode="decimal" 
                                                value={state.weight} 
                                                onChange={e => handleItemChange(pid, 'weight', e.target.value)} 
                                                className={inputClass} 
                                                placeholder="الزامی" 
                                            />
                                        </div>
                                    </div>
                                    
                                    <button 
                                        onClick={() => handleProductToggle(pid)} 
                                        className="p-3 lg:p-4 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                        title="حذف این قلم"
                                    >
                                        <Icons.Trash className="w-6 h-6 lg:w-8 lg:h-8" />
                                    </button>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </AnimatePresence>

            {/* TASK 1: Optional Specifications (Bottom Section) */}
            <div className="bg-gray-100 dark:bg-gray-900/50 p-6 lg:p-8 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 space-y-4 lg:space-y-6 mt-8">
                <h4 className="text-xs lg:text-base font-black text-gray-500 uppercase flex items-center gap-2">
                    <Icons.Plus className="w-4 h-4 lg:w-6 lg:h-6" />
                    اطلاعات تکمیلی (اختیاری)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                    <div>
                        <label className={labelClass}>نام راننده</label>
                        <input {...register('driverName')} className={`${inputClass} !text-sm lg:!text-lg`} placeholder="فقط حروف فارسی" />
                        {errors.driverName && <p className="text-red-500 text-xs mt-1">{errors.driverName.message}</p>}
                    </div>
                    <div>
                        <label className={labelClass}>شماره پلاک</label>
                        <input {...register('plateNumber')} className={`${inputClass} !text-sm lg:!text-lg`} placeholder="مثال: ۱۵-۳۶۵ج۱۱" />
                        {errors.plateNumber && <p className="text-red-500 text-xs mt-1">{errors.plateNumber.message}</p>}
                    </div>
                    <div>
                        <label className={labelClass}>موبایل راننده</label>
                        <input dir="ltr" inputMode="numeric" {...register('driverMobile')} className={`${inputClass} !text-sm lg:!text-lg font-mono`} placeholder="" maxLength={11} />
                        {errors.driverMobile && <p className="text-red-500 text-xs mt-1">{errors.driverMobile.message}</p>}
                    </div>
                </div>
                <div>
                    <label className={labelClass}>توضیحات تکمیلی</label>
                    <textarea {...register('description')} className={`${inputClass} !text-sm lg:!text-lg h-20 lg:h-32 text-right !font-medium py-2`} placeholder="فقط حروف فارسی..."></textarea>
                    {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
                </div>
            </div>

            <div className="pt-6 lg:pt-8">
                <Button 
                    onClick={handleSubmit(handleFinalSubmit)} 
                    isLoading={isSubmitting} 
                    className="w-full h-16 lg:h-20 text-2xl lg:text-3xl font-black bg-metro-green hover:bg-green-600 shadow-xl rounded-xl"
                >
                    <Icons.Check className="mr-2 w-8 h-8 lg:w-10 lg:h-10" />
                    ثبت نهایی حواله
                </Button>
            </div>
            
            <style>{`
                @keyframes gradient-xy {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }
            `}</style>
        </div>
    );
};
