
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

const invoiceSchema = z.object({
    invoiceNumber: z.string().min(1, 'شماره حواله الزامی است'),
    totalCartons: z.number().min(1, 'تعداد کارتن معتبر نیست'),
    totalWeight: z.number().min(0.1, 'وزن خالص الزامی است'),
    productId: z.string().min(1, 'انتخاب محصول الزامی است'),
    // isYesterday removed from schema input as it's calculated
    driverName: z.string().optional(),
    driverPhone: z.string().optional(),
    plateNumber: z.string().optional(),
    description: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

const InvoiceForm: React.FC = () => {
    const { user } = useAuthStore();
    const { getProductById } = useFarmStore();
    const { invoices, addInvoice } = useInvoiceStore();
    const { addToast } = useToastStore();
    const { confirm } = useConfirm();
    
    const todayJalali = getTodayJalali();
    const todayDayName = getTodayDayName(); // Added for header consistency
    const normalizedDate = normalizeDate(todayJalali);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const userFarms = user?.assignedFarms || [];
    const [selectedFarmId, setSelectedFarmId] = useState<string>(userFarms[0]?.id || '');
    const selectedFarm = userFarms.find(f => f.id === selectedFarmId);

    // State for the Reference Date (Invoice Code Date)
    const [referenceDate, setReferenceDate] = useState(normalizedDate);
    
    // Time state for header consistency
    const [currentTime, setCurrentTime] = useState(getCurrentTime(false));

    const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<InvoiceFormValues>({
        resolver: zodResolver(invoiceSchema),
        defaultValues: { productId: '', description: '' }
    });

    const isMorvaridi = selectedFarm?.type === FarmType.MORVARIDI;

    // Reset reference date when today changes or on mount
    useEffect(() => {
        setReferenceDate(normalizedDate);
    }, [normalizedDate]);

    // Update time for header
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(getCurrentTime(false)), 30000);
        return () => clearInterval(timer);
    }, []);

    const handleSave = async (data: InvoiceFormValues, keepInvoiceInfo: boolean) => {
        // Multi-product support: Only block if SAME product in SAME invoice
        const duplicateEntry = invoices.find(i => 
            i.invoiceNumber === data.invoiceNumber && 
            i.productId === data.productId
        );

        if (duplicateEntry) {
            addToast(`خطا: محصول "${getProductById(data.productId)?.name}" قبلاً در این حواله ثبت شده است.`, 'error');
            return;
        }

        const confirmed = await confirm({
            title: 'ثبت حواله خروج',
            message: `آیا از ثبت محصول در حواله شماره ${toPersianDigits(data.invoiceNumber)} اطمینان دارید؟`,
            confirmText: 'تایید و ثبت',
            type: 'info'
        });

        if (!confirmed) return;

        setIsSubmitting(true);

        // Calculate Description and Flag based on Date Selection
        const isDateChanged = referenceDate !== normalizedDate;
        
        // Append date info to description if it's not today
        const dateSuffix = isDateChanged ? ` (مربوط به تاریخ ${referenceDate})` : '';
        const finalDescription = (data.description || '').trim() + dateSuffix;

        const result = await addInvoice({
            farmId: selectedFarmId,
            date: normalizedDate, // Log date remains today (submission date)
            invoiceNumber: data.invoiceNumber,
            totalCartons: data.totalCartons,
            totalWeight: data.totalWeight,
            productId: data.productId,
            driverName: data.driverName || '',
            driverPhone: data.driverPhone || '',
            plateNumber: data.plateNumber || '',
            description: finalDescription,
            isYesterday: isDateChanged // We use this flag now to indicate ANY past date
        });
        setIsSubmitting(false);

        if (result.success) {
            addToast('آیتم با موفقیت ثبت شد.', 'success');
            if (keepInvoiceInfo) {
                // Keep shared driver/invoice info
                setValue('totalCartons', 0);
                setValue('totalWeight', 0);
                setValue('productId', '');
                setValue('description', '');
                addToast('مشخصات حواله حفظ شد. محصول بعدی را انتخاب کنید.', 'info');
            } else {
                reset();
                setReferenceDate(normalizedDate); // Reset date to today
            }
        } else {
            addToast('خطا در ثبت حواله: ' + result.error, 'error');
        }
    };

    const inputClass = "w-full p-4 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-black text-center focus:border-metro-blue outline-none transition-all text-xl shadow-sm";
    const labelClass = "block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1 uppercase text-right px-1";

    if (!selectedFarm) return <div className="p-20 text-center font-bold text-gray-400">فارمی یافت نشد.</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-4">
            
            {/* Header - MATCHING STATISTICS FORM STYLE EXACTLY */}
            <div className="bg-metro-blue p-8 text-white shadow-xl relative overflow-hidden flex flex-col items-center justify-center gap-4 border-b-8 border-blue-900/30">
                {/* Continuous Animated Background */}
                <div className="absolute inset-0 z-0 bg-gradient-to-r from-metro-blue via-metro-cobalt to-metro-blue bg-[length:200%_200%] animate-[gradient-xy_3s_ease_infinite]"></div>
                
                {/* Decorative Background Icon (Moving) */}
                <Icons.FileText className="absolute -right-12 -bottom-8 w-64 h-64 opacity-10 pointer-events-none rotate-12 animate-pulse" />
                
                {/* Date Container - Glass Style with Metro Border */}
                <div className="relative z-10 flex justify-center items-center gap-4 text-xl font-bold bg-white/10 backdrop-blur-md px-8 py-3 w-full max-w-sm border-r-4 border-white shadow-lg transition-transform hover:scale-[1.02]">
                    <span className="opacity-90">{todayDayName}</span>
                    <div className="w-[2px] h-6 bg-white/30 rounded-full"></div>
                    <span className="font-sans tracking-tight text-3xl font-black drop-shadow-sm">{toPersianDigits(normalizedDate)}</span>
                </div>

                {/* Time Container - Ultra Bold */}
                <div className="relative z-10 text-7xl font-black font-sans tracking-widest mt-2 drop-shadow-2xl flex items-center gap-2">
                    {currentTime}
                </div>
            </div>

            <form onSubmit={handleSubmit((d) => handleSave(d, false))} className="space-y-4">
                <div className="bg-white dark:bg-gray-800 p-6 shadow-xl border-l-[12px] border-metro-blue space-y-6">
                    
                    {/* Invoice ID Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="group">
                            <label className={labelClass}>شماره حواله (رمز)</label>
                            <div className="relative">
                                <input dir="ltr" {...register('invoiceNumber')} className={`${inputClass} !text-2xl tracking-[0.2em] border-metro-blue/30`} placeholder="000000" />
                                <Icons.Fingerprint className="absolute left-4 top-5 w-6 h-6 text-gray-300" />
                            </div>
                            {errors.invoiceNumber && <p className="text-red-500 text-xs mt-1 font-bold">{errors.invoiceNumber.message}</p>}
                        </div>

                        {/* Date Picker Module for Invoice Reference */}
                        <div className="flex items-center gap-4 bg-blue-50 dark:bg-black/20 p-4 border-2 border-dashed border-blue-200 dark:border-gray-700 rounded-lg">
                             <div className="w-full">
                                <JalaliDatePicker 
                                    label="رمز حواله مربوط به تاریخ" 
                                    value={referenceDate} 
                                    onChange={setReferenceDate} 
                                />
                             </div>
                        </div>
                    </div>

                    {/* Product Selection - DROPDOWN STYLE */}
                    <div>
                        <label className={labelClass}>انتخاب محصول</label>
                        <div className="relative">
                            <select 
                                {...register('productId')} 
                                className={`${inputClass} appearance-none cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700`}
                            >
                                <option value="" disabled>-- محصول را انتخاب کنید --</option>
                                {selectedFarm.productIds.map(pid => {
                                    const p = getProductById(pid);
                                    return (
                                        <option key={pid} value={pid}>
                                            {p?.name} {p?.unit === 'CARTON' ? '(کارتن)' : '(واحد)'}
                                        </option>
                                    );
                                })}
                            </select>
                            <Icons.ChevronDown className="absolute left-4 top-5 w-6 h-6 text-gray-400 pointer-events-none" />
                        </div>
                        {errors.productId && <p className="text-red-500 text-xs mt-2 font-bold text-center">{errors.productId.message}</p>}
                    </div>

                    {/* Quantities */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <div>
                            <label className={labelClass}>تعداد (واحد)</label>
                            <input type="number" {...register('totalCartons', { valueAsNumber: true })} className={inputClass} placeholder="0" />
                        </div>
                        <div>
                            <label className={labelClass}>وزن خالص (Kg)</label>
                            <input type="number" step="0.01" {...register('totalWeight', { valueAsNumber: true })} className={inputClass} placeholder="0.00" />
                        </div>
                    </div>

                    {/* Driver Section - Stacked on Mobile */}
                    {isMorvaridi && (
                        <div className="space-y-4 pt-4 border-t border-dashed border-gray-200 dark:border-gray-700">
                            <h4 className="text-xs font-black text-gray-400 uppercase">اطلاعات ناوگان و حمل و نقل</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className={labelClass}>نام راننده</label>
                                    <input {...register('driverName')} className={`${inputClass} !text-sm`} placeholder="-" />
                                </div>
                                <div>
                                    <label className={labelClass}>تلفن همراه</label>
                                    <input dir="ltr" {...register('driverPhone')} className={`${inputClass} !text-sm font-mono`} placeholder="09..." />
                                </div>
                                <div>
                                    <label className={labelClass}>پلاک خودرو</label>
                                    <input {...register('plateNumber')} className={`${inputClass} !text-sm`} placeholder="-" />
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className={labelClass}>توضیحات و یادداشت</label>
                        <textarea {...register('description')} className={`${inputClass} !text-sm h-24 text-right !font-medium`} placeholder="نکته خاصی اگر وجود دارد بنویسید..."></textarea>
                    </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    <Button 
                        type="button" 
                        onClick={handleSubmit((d) => handleSave(d, true))} 
                        isLoading={isSubmitting} 
                        variant="secondary"
                        className="h-16 border-metro-blue text-metro-blue hover:bg-blue-50 font-black text-lg border-2"
                    >
                        <Icons.Plus className="ml-2 w-5 h-5" />
                        ثبت و افزودن محصول دیگر
                    </Button>
                    
                    <Button 
                        type="submit" 
                        isLoading={isSubmitting} 
                        className="bg-metro-blue hover:bg-metro-cobalt h-16 text-2xl font-black shadow-2xl active:scale-95"
                    >
                        <Icons.Check className="ml-2 w-7 h-7" />
                        ثبت نهایی و اتمام حواله
                    </Button>
                </div>
            </form>
            
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
