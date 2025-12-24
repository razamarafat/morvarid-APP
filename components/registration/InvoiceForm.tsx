
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

const noLatinRegex = /^[^a-zA-Z]*$/;
const mobileRegex = /^09\d{9}$/;
const invoiceNumberRegex = /^(17|18)\d{8}$/; 

const invoiceGlobalSchema = z.object({
    invoiceNumber: z.string()
        .min(1, 'رمز حواله الزامی است')
        .regex(invoiceNumberRegex, 'رمز حواله باید ۱۰ رقم باشد و با ۱۷ یا ۱۸ شروع شود'),
    contactPhone: z.string()
        .min(1, 'شماره تماس الزامی است')
        .regex(mobileRegex, 'شماره همراه باید ۱۱ رقم و با ۰۹ شروع شود'),
    driverName: z.string().optional()
        .refine(val => !val || noLatinRegex.test(val), 'استفاده از حروف انگلیسی در نام راننده مجاز نیست'),
    description: z.string().optional()
        .refine(val => !val || noLatinRegex.test(val), 'استفاده از حروف انگلیسی در توضیحات مجاز نیست'),
});

type GlobalValues = z.infer<typeof invoiceGlobalSchema>;

const PERSIAN_LETTERS = [
    'الف', 'ب', 'پ', 'ت', 'ث', 'ج', 'چ', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'ژ', 
    'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ک', 'گ', 'ل', 'م', 'ن', 'و', 'ه', 'ی'
];

export const InvoiceForm: React.FC = () => {
    const { user } = useAuthStore();
    const { getProductById } = useFarmStore();
    const { addInvoice } = useInvoiceStore();
    const { statistics } = useStatisticsStore(); 
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

    // Plate State LTR: Part1(2) - Letter - Part3(3) - Part4(2-Iran)
    const [plateParts, setPlateParts] = useState({ part1: '', letter: '', part3: '', part4: '' });
    const [showLetterPicker, setShowLetterPicker] = useState(false);

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

    const handleItemChange = (pid: string, field: 'cartons' | 'weight', val: string) => {
        let cleanVal = val.replace(/[^0-9.]/g, '');
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

        const { part1, letter, part3, part4 } = plateParts;
        const finalPlate = (part1 && letter && part3 && part4) ? `${part1}-${letter}-${part3}-${part4}` : '';

        for (const pid of selectedProductIds) {
            const item = itemsState[pid];
            const product = getProductById(pid);
            const name = product?.name || 'محصول';
            
            if (!item.weight || Number(item.weight) <= 0) {
                addToast(`وزن برای "${name}" وارد نشده است.`, 'error');
                return;
            }

            const statRecord = statistics.find(s => s.farmId === selectedFarmId && s.date === referenceDate && s.productId === pid);
            if (!statRecord) {
                addToast(`خطا: آمار تولید برای "${name}" در تاریخ ${referenceDate} هنوز ثبت نشده است. ابتدا آمار را ثبت کنید.`, 'error');
                return;
            }
        }

        const confirmed = await confirm({
            title: 'ثبت نهایی حواله',
            message: `آیا از ثبت این حواله با ${toPersianDigits(selectedProductIds.length)} قلم کالا اطمینان دارید؟`,
            confirmText: 'بله، ثبت نهایی',
            type: 'info'
        });

        if (!confirmed) return;

        setIsSubmitting(true);
        for (const pid of selectedProductIds) {
            const item = itemsState[pid];
            await addInvoice({
                farmId: selectedFarmId,
                date: referenceDate, 
                invoiceNumber: globalData.invoiceNumber,
                totalCartons: Number(item.cartons || 0), 
                totalWeight: Number(item.weight),
                productId: pid,
                driverName: globalData.driverName || '',
                driverPhone: globalData.contactPhone,
                plateNumber: finalPlate,
                description: globalData.description,
                isYesterday: referenceDate !== normalizedDate
            });
        }

        setIsSubmitting(false);
        addToast(`حواله با موفقیت ثبت شد.`, 'success');
        setSelectedProductIds([]);
        setItemsState({});
        setPlateParts({ part1: '', letter: '', part3: '', part4: '' });
        setValue('invoiceNumber', '');
        setValue('contactPhone', '');
        setValue('driverName', '');
        setValue('description', '');
    };

    const inputClass = "w-full p-4 border-2 border-gray-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-black text-center focus:border-metro-blue outline-none transition-all text-xl rounded-xl shadow-sm";
    const labelClass = "block text-sm font-black text-gray-500 dark:text-gray-400 mb-1.5 uppercase text-right px-1";

    if (!selectedFarm) return <div className="p-20 text-center font-bold text-gray-400">فارمی یافت نشد.</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6 lg:space-y-10 pb-20">
            
            {/* Header */}
            <div className="bg-gradient-to-br from-metro-blue via-blue-600 to-indigo-600 p-6 text-white shadow-xl relative overflow-hidden flex flex-col items-center justify-center gap-3 rounded-b-[32px] border-b-4 border-blue-800/20 gpu-accelerated">
                 <div className="absolute inset-0 shimmer-bg z-0"></div>
                 <Icons.FileText className="absolute -right-8 -bottom-8 w-48 h-48 opacity-10 pointer-events-none -rotate-12" />
                 <div className="relative z-10 flex flex-col items-center w-full">
                     <div className="flex items-center gap-3 mb-1">
                        <span className="text-blue-100 font-bold text-sm tracking-widest uppercase bg-black/10 px-3 py-0.5 rounded-full backdrop-blur-sm">
                             {todayDayName}
                        </span>
                        <div className="text-xl font-bold opacity-90 font-sans tabular-nums tracking-wide">{currentTime}</div>
                     </div>
                     <div className="flex items-center gap-4">
                         <h1 className="text-5xl lg:text-6xl font-black font-sans tabular-nums tracking-tighter drop-shadow-lg leading-none">
                             {toPersianDigits(referenceDate)}
                         </h1>
                     </div>
                     <div className="mt-3 text-white font-black tracking-wide text-lg border-b-2 border-white/20 pb-1">
                        ثبت حواله فروش
                     </div>
                 </div>
            </div>

            {/* Invoice Info */}
            <div className="bg-white dark:bg-gray-800 p-6 lg:p-8 shadow-md border-l-[12px] border-metro-blue rounded-[28px] space-y-6 relative gpu-accelerated">
                <div className="absolute top-0 right-0 bg-metro-blue text-white px-4 py-1.5 text-xs font-black rounded-bl-[20px]">مشخصات اصلی حواله</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8 mt-2">
                    <div>
                        <label className={labelClass}>رمز حواله</label>
                        <input dir="ltr" type="tel" inputMode="numeric" {...register('invoiceNumber')} className={`${inputClass} !text-3xl tracking-[0.2em] border-metro-blue/20 bg-white`} maxLength={10} />
                    </div>
                    <div className="bg-white p-2 border-2 border-dashed border-blue-200 rounded-[20px]">
                        <JalaliDatePicker label="تاریخ حواله" value={referenceDate} onChange={setReferenceDate} />
                    </div>
                </div>
            </div>

            {/* Product Selector */}
            <div className="bg-white dark:bg-gray-800 p-6 lg:p-8 shadow-md border-l-[12px] border-metro-orange rounded-[28px] space-y-2">
                <button onClick={() => setIsProductSelectorOpen(!isProductSelectorOpen)} className="w-full flex justify-between items-center bg-gray-50 p-5 rounded-[20px] hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-2">
                        <Icons.Check className="w-6 h-6 text-metro-orange" />
                        <span className="font-black text-gray-700 lg:text-xl">انتخاب محصولات</span>
                    </div>
                    <Icons.ChevronDown className={`w-6 h-6 transition-transform duration-200 ${isProductSelectorOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                    {isProductSelectorOpen && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }} 
                            animate={{ height: 'auto', opacity: 1 }} 
                            exit={{ height: 0, opacity: 0 }} 
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="overflow-hidden bg-white rounded-[20px] border border-gray-100"
                            style={{ willChange: "height, opacity", transform: "translateZ(0)" }}
                        >
                            <div className="p-3 space-y-1">
                                {selectedFarm.productIds.map(pid => {
                                    const p = getProductById(pid);
                                    const isSelected = selectedProductIds.includes(pid);
                                    return (
                                        <label key={pid} className={`flex items-center p-4 rounded-xl cursor-pointer transition-all ${isSelected ? 'bg-orange-50 text-orange-700' : 'hover:bg-gray-50 text-gray-700'}`}>
                                            <input type="checkbox" className="w-5 h-5 ml-4 rounded text-metro-orange border-gray-300" checked={isSelected} onChange={() => handleProductToggle(pid)} />
                                            <span className="flex-1 font-black lg:text-xl">{p?.name}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Selected Product Inputs (Reordered: Now above Phone) */}
            <AnimatePresence>
                {selectedProductIds.map(pid => {
                    const p = getProductById(pid);
                    const state = itemsState[pid] || { cartons: '', weight: '' };
                    return (
                        <motion.div 
                            key={pid} 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="bg-white p-5 lg:p-7 border-r-8 border-metro-green shadow-lg rounded-[24px] flex flex-col md:flex-row items-center gap-4 lg:gap-8 gpu-accelerated"
                        >
                            <h5 className="font-black text-gray-800 lg:text-2xl w-full md:w-1/3 border-b md:border-b-0 md:border-l pb-2 md:pb-0">{p?.name}</h5>
                            <div className="grid grid-cols-2 gap-4 flex-1 w-full">
                                <div><label className={labelClass}>تعداد</label><input type="tel" inputMode="numeric" value={state.cartons} onChange={e => handleItemChange(pid, 'cartons', e.target.value)} className={`${inputClass} bg-white`} /></div>
                                <div><label className={`${labelClass} text-blue-600`}>وزن (Kg)</label><input type="tel" inputMode="decimal" value={state.weight} onChange={e => handleItemChange(pid, 'weight', e.target.value)} className={`${inputClass} !border-blue-100 bg-white`} /></div>
                            </div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>

            {/* Customer Phone (Moved Down) */}
            <div className="bg-white dark:bg-gray-800 p-6 lg:p-8 shadow-md border-l-[12px] border-metro-blue rounded-[28px] gpu-accelerated">
                <label className={labelClass}>شماره تماس مشتری</label>
                <input dir="ltr" type="tel" inputMode="numeric" {...register('contactPhone')} className={`${inputClass} bg-white`} maxLength={11} />
            </div>

            {/* Driver Details */}
            <div className="bg-white dark:bg-gray-800 p-6 lg:p-8 rounded-[28px] border-2 border-dashed border-gray-200 space-y-6 mt-8">
                <h4 className="text-xs font-black text-gray-500 uppercase flex items-center gap-2">اطلاعات تکمیلی راننده (اختیاری)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><label className={labelClass}>نام راننده</label><input {...register('driverName')} className={`${inputClass} bg-white`} placeholder="فقط حروف فارسی" /></div>
                    <div>
                        <label className={labelClass}>شماره پلاک</label>
                        <div className="flex flex-row gap-2 items-center" dir="ltr">
                            <input type="tel" maxLength={2} value={plateParts.part1} onChange={e => setPlateParts(p => ({...p, part1: e.target.value.replace(/\D/g, '')}))} className="w-14 h-16 border-2 rounded-xl text-center font-black text-xl bg-white focus:border-metro-blue outline-none" placeholder="11" />
                            <div className="relative">
                                <button type="button" onClick={() => setShowLetterPicker(!showLetterPicker)} className="w-16 h-16 border-2 rounded-xl font-black text-xl bg-white text-blue-600 border-blue-100 flex items-center justify-center">{plateParts.letter || 'حرف'}</button>
                                <AnimatePresence>
                                    {showLetterPicker && (
                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute bottom-full left-0 right-0 mb-2 bg-white shadow-2xl rounded-[20px] p-1 z-50 flex flex-col h-64 overflow-y-auto custom-scrollbar border border-gray-100" dir="rtl">
                                            {PERSIAN_LETTERS.map(l => (
                                                <button key={l} type="button" onClick={() => { setPlateParts(p => ({...p, letter: l})); setShowLetterPicker(false); }} className="p-4 border-b last:border-0 hover:bg-metro-blue hover:text-white text-gray-700 font-black transition-colors rounded-lg">{l}</button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            <input type="tel" maxLength={3} value={plateParts.part3} onChange={e => setPlateParts(p => ({...p, part3: e.target.value.replace(/\D/g, '')}))} className="w-24 h-16 border-2 rounded-xl text-center font-black text-xl bg-white focus:border-metro-blue outline-none" placeholder="365" />
                            <div className="relative">
                                <input type="tel" maxLength={2} value={plateParts.part4} onChange={e => setPlateParts(p => ({...p, part4: e.target.value.replace(/\D/g, '')}))} className="w-14 h-16 border-2 rounded-xl text-center font-black text-xl bg-white focus:border-metro-blue outline-none" placeholder="15" />
                                <span className="absolute -top-3 left-0 right-0 text-center text-[8px] font-black text-gray-400">ایران</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div><label className={labelClass}>توضیحات</label><textarea {...register('description')} className={`${inputClass} h-24 text-right !font-medium bg-white`} /></div>
            </div>

            <Button onClick={handleSubmit(handleFinalSubmit)} isLoading={isSubmitting} className="w-full h-16 text-2xl font-black bg-metro-green hover:bg-green-600 shadow-xl !rounded-[24px]">
                <Icons.Check className="ml-2 w-8 h-8" /> ثبت نهایی حواله خروج
            </Button>
        </div>
    );
};
