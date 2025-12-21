
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../../store/authStore';
import { useFarmStore } from '../../store/farmStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useToastStore } from '../../store/toastStore';
import { getTodayJalali, getTodayDayName, getCurrentTime, normalizeDate, toPersianDigits } from '../../utils/dateUtils';
import Button from '../common/Button';
import { Icons } from '../common/Icons';
import { useConfirm } from '../../hooks/useConfirm';
import { FarmType } from '../../types';
import JalaliDatePicker from '../common/JalaliDatePicker';
import { motion, AnimatePresence } from 'framer-motion';

// Schema for global info (Task 1: Code, Date, Contact Phone)
const invoiceGlobalSchema = z.object({
    invoiceNumber: z.string().min(1, 'شماره حواله الزامی است'),
    contactPhone: z.string().min(1, 'شماره تماس الزامی است'),
    // Optional fields (Task 1: at bottom)
    driverName: z.string().optional(),
    plateNumber: z.string().optional(),
    driverMobile: z.string().optional(),
    description: z.string().optional(),
});

type GlobalValues = z.infer<typeof invoiceGlobalSchema>;

// Internal Item State for selected products
interface SelectedProductItem {
    productId: string;
    totalCartons: string;
    totalWeight: string;
}

const InvoiceForm: React.FC = () => {
    const { user } = useAuthStore();
    const { getProductById } = useFarmStore();
    const { invoices, addInvoice } = useInvoiceStore();
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
    
    // TASK 2: Multi-select product IDs and their details
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
    const [itemsState, setItemsState] = useState<Record<string, { cartons: string; weight: string }>>({});

    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<GlobalValues>({
        resolver: zodResolver(invoiceGlobalSchema),
        defaultValues: { description: '' }
    });

    const isMorvaridi = selectedFarm?.type === FarmType.MORVARIDI;

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

    const handleItemChange = (pid: string, field: 'cartons' | 'weight', val: string) => {
        setItemsState(prev => ({
            ...prev,
            [pid]: { ...prev[pid], [field]: val }
        }));
    };

    const handleFinalSubmit = async (globalData: GlobalValues) => {
        if (selectedProductIds.length === 0) {
            addToast('لطفا حداقل یک محصول انتخاب کنید.', 'warning');
            return;
        }

        // TASK 2: Validation for natural numbers
        for (const pid of selectedProductIds) {
            const item = itemsState[pid];
            const product = getProductById(pid);
            const name = product?.name || 'محصول';
            if (!item.cartons || Number(item.cartons) <= 0) {
                addToast(`تعداد برای "${name}" باید عددی بزرگتر از صفر باشد.`, 'error');
                return;
            }
            if (!item.weight || Number(item.weight) <= 0) {
                addToast(`وزن برای "${name}" باید عددی بزرگتر از صفر باشد.`, 'error');
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
        const finalDescription = (globalData.description || '').trim() + dateSuffix;

        let successCount = 0;
        for (const pid of selectedProductIds) {
            const item = itemsState[pid];
            const result = await addInvoice({
                farmId: selectedFarmId,
                date: normalizedDate,
                invoiceNumber: globalData.invoiceNumber,
                totalCartons: Number(item.cartons),
                totalWeight: Number(item.weight),
                productId: pid,
                driverName: globalData.driverName || '',
                driverPhone: globalData.driverMobile || '', // Mapping mobile to db driverPhone
                plateNumber: globalData.plateNumber || '',
                description: finalDescription,
                isYesterday: isDateChanged
            });
            if (result.success) successCount++;
        }

        setIsSubmitting(false);
        if (successCount === selectedProductIds.length) {
            addToast(`حواله با موفقیت ثبت شد.`, 'success');
            setSelectedProductIds([]);
            setItemsState({});
            setValue('invoiceNumber', '');
        } else {
            addToast(`ثبت برخی اقلام با خطا مواجه شد.`, 'error');
        }
    };

    const inputClass = "w-full p-3 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-black text-center focus:border-metro-blue outline-none transition-all text-lg shadow-sm";
    const labelClass = "block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1 uppercase text-right px-1";

    if (!selectedFarm) return <div className="p-20 text-center font-bold text-gray-400">فارمی یافت نشد.</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="bg-metro-blue p-8 text-white shadow-xl relative overflow-hidden flex flex-col items-center justify-center gap-4 border-b-8 border-blue-900/30">
                <div className="absolute inset-0 z-0 bg-gradient-to-r from-metro-blue via-metro-cobalt to-metro-blue bg-[length:200%_200%] animate-[gradient-xy_3s_ease_infinite]"></div>
                <Icons.FileText className="absolute -right-12 -bottom-8 w-64 h-64 opacity-10 pointer-events-none rotate-12" />
                <div className="relative z-10 flex justify-center items-center gap-4 text-xl font-bold bg-white/10 backdrop-blur-md px-8 py-3 w-full max-w-sm border-r-4 border-white shadow-lg transition-transform hover:scale-[1.02]">
                    <span className="opacity-90">{todayDayName}</span>
                    <div className="w-[2px] h-6 bg-white/30 rounded-full"></div>
                    <span className="font-sans tracking-tight text-3xl font-black drop-shadow-sm">{toPersianDigits(normalizedDate)}</span>
                </div>
                <div className="relative z-10 text-7xl font-black font-sans tracking-widest mt-2 drop-shadow-2xl flex items-center gap-2">{currentTime}</div>
            </div>

            {/* TASK 1: Main Specifications Section */}
            <div className="bg-white dark:bg-gray-800 p-6 shadow-md border-l-[12px] border-metro-blue rounded-xl space-y-6 relative">
                <div className="absolute top-0 right-0 bg-metro-blue text-white px-3 py-1 text-xs font-bold">مشخصات اصلی حواله</div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div className="group">
                        <label className={labelClass}>رمز حواله</label>
                        <input dir="ltr" {...register('invoiceNumber')} className={`${inputClass} !text-2xl tracking-[0.2em] border-metro-blue/30`} placeholder="000000" />
                        {errors.invoiceNumber && <p className="text-red-500 text-xs mt-1 font-bold">{errors.invoiceNumber.message}</p>}
                    </div>

                    <div className="bg-blue-50 dark:bg-black/20 p-2 border-2 border-dashed border-blue-200 dark:border-gray-700">
                        <JalaliDatePicker label="تاریخ حواله" value={referenceDate} onChange={setReferenceDate} />
                    </div>
                </div>

                <div>
                    <label className={labelClass}>شماره تماس (راننده یا مقصد)</label>
                    <input dir="ltr" {...register('contactPhone')} className={`${inputClass} !text-xl font-mono border-metro-blue/30`} placeholder="09..." />
                    {errors.contactPhone && <p className="text-red-500 text-xs mt-1 font-bold">{errors.contactPhone.message}</p>}
                </div>
            </div>

            {/* TASK 2: Product Multi-Selection List */}
            <div className="bg-white dark:bg-gray-800 p-6 shadow-md border-l-[12px] border-metro-orange rounded-xl space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-black text-metro-orange">انتخاب محصولات حواله</h3>
                    <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 font-bold">{toPersianDigits(selectedProductIds.length)} مورد انتخاب شده</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {selectedFarm.productIds.map(pid => {
                        const p = getProductById(pid);
                        const isSelected = selectedProductIds.includes(pid);
                        return (
                            <button key={pid} onClick={() => handleProductToggle(pid)} className={`p-3 text-xs font-black border-2 transition-all flex items-center justify-center gap-2 ${isSelected ? 'bg-metro-orange text-white border-metro-orange' : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-700 dark:border-gray-600'}`}>
                                {isSelected ? <Icons.Check className="w-4 h-4" /> : <Icons.Plus className="w-4 h-4" />}
                                {p?.name}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* TASK 2: Dynamic Input Tables for Selected Products */}
            <AnimatePresence>
                {selectedProductIds.length > 0 && (
                    <div className="space-y-4">
                        {selectedProductIds.map(pid => {
                            const p = getProductById(pid);
                            const state = itemsState[pid] || { cartons: '', weight: '' };
                            return (
                                <motion.div key={pid} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-gray-800 p-4 border-r-8 border-metro-green shadow-sm flex flex-col md:flex-row items-center gap-4">
                                    <div className="w-full md:w-48 font-black text-gray-800 dark:text-white border-b-2 md:border-b-0 md:border-l-2 border-gray-100 dark:border-gray-700 pb-2 md:pb-0 md:pl-4">{p?.name}</div>
                                    <div className="grid grid-cols-2 gap-4 flex-1 w-full">
                                        <div>
                                            <label className={labelClass}>تعداد ({p?.unit === 'CARTON' ? 'کارتن' : 'واحد'})</label>
                                            <input type="number" value={state.cartons} onChange={e => handleItemChange(pid, 'cartons', e.target.value)} className={inputClass} placeholder="0" />
                                        </div>
                                        <div>
                                            <label className={labelClass}>وزن نهایی (Kg)</label>
                                            <input type="number" step="0.01" value={state.weight} onChange={e => handleItemChange(pid, 'weight', e.target.value)} className={inputClass} placeholder="0.00" />
                                        </div>
                                    </div>
                                    <button onClick={() => handleProductToggle(pid)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Icons.Trash className="w-5 h-5" /></button>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </AnimatePresence>

            {/* TASK 1: Optional Specifications (Bottom Section) */}
            <div className="bg-gray-100 dark:bg-gray-900/50 p-6 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 space-y-4">
                <h4 className="text-xs font-black text-gray-500 uppercase flex items-center gap-2"><Icons.Plus className="w-4 h-4" />لیست اختیاری (فقط برای مرواریدی)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className={labelClass}>نام راننده</label>
                        <input {...register('driverName')} className={`${inputClass} !text-sm`} placeholder="-" />
                    </div>
                    <div>
                        <label className={labelClass}>شماره پلاک</label>
                        <input {...register('plateNumber')} className={`${inputClass} !text-sm`} placeholder="-" />
                    </div>
                    <div>
                        <label className={labelClass}>شماره همراه</label>
                        <input dir="ltr" {...register('driverMobile')} className={`${inputClass} !text-sm font-mono`} placeholder="09..." />
                    </div>
                </div>
                <div>
                    <label className={labelClass}>توضیحات تکمیلی</label>
                    <textarea {...register('description')} className={`${inputClass} !text-sm h-16 text-right !font-medium`} placeholder="..."></textarea>
                </div>
            </div>

            <div className="pt-6">
                <Button onClick={handleSubmit(handleFinalSubmit)} isLoading={isSubmitting} className="w-full h-16 text-2xl font-black bg-metro-green hover:bg-green-600 shadow-xl">
                    <Icons.Check className="mr-2 w-7 h-7" />
                    ثبت نهایی کل حواله
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

export default InvoiceForm;
