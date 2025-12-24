
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

            <form onSubmit={handleSubmit(handleFinalSubmit)} className="px-4 space-y-8">
                
                {/* Invoice Code Section */}
                <div className="bg-white dark:bg-gray-800 p-6 lg:p-8 rounded-[24px] shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-2 h-full bg-metro-orange"></div>
                    <h3 className="font-black text-xl mb-6 text-gray-800 dark:text-white flex items-center gap-2">
                        <Icons.FileText className="w-6 h-6 text-metro-orange" />
                        اطلاعات پایه
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={labelClass}>رمز حواله (۱۰ رقم)</label>
                            <input 
                                type="tel" 
                                dir="ltr" 
                                maxLength={10}
                                {...register('invoiceNumber')} 
                                className={`${inputClass} tracking-[0.3em] text-3xl h-16 border-metro-orange/30 focus:border-metro-orange focus:ring-4 focus:ring-orange-500/10`}
                                placeholder="1700000000"
                            />
                            {errors.invoiceNumber && <p className="text-red-500 text-xs font-bold mt-2 mr-1">{errors.invoiceNumber.message}</p>}
                        </div>
                        
                        <div>
                            <label className={labelClass}>تاریخ صدور</label>
                            <div className="h-16">
                                <JalaliDatePicker value={referenceDate} onChange={setReferenceDate} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Product Selection */}
                <div className="bg-white dark:bg-gray-800 p-6 lg:p-8 rounded-[24px] shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-2 h-full bg-metro-blue"></div>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-black text-xl text-gray-800 dark:text-white flex items-center gap-2">
                            <Icons.List className="w-6 h-6 text-metro-blue" />
                            اقلام حواله
                        </h3>
                        <button type="button" onClick={() => setIsProductSelectorOpen(!isProductSelectorOpen)} className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg flex items-center gap-1">
                            <Icons.Plus className="w-4 h-4" /> افزودن کالا
                        </button>
                    </div>

                    <AnimatePresence>
                        {isProductSelectorOpen && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-6 overflow-hidden">
                                <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                                    {selectedFarm.productIds.map(pid => {
                                        const p = getProductById(pid);
                                        const isSelected = selectedProductIds.includes(pid);
                                        return (
                                            <button 
                                                key={pid}
                                                type="button"
                                                onClick={() => handleProductToggle(pid)}
                                                className={`p-3 rounded-xl text-sm font-bold transition-all ${isSelected ? 'bg-metro-blue text-white shadow-lg scale-95' : 'bg-white text-gray-600 border hover:bg-gray-100'}`}
                                            >
                                                {p?.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="space-y-4">
                        {selectedProductIds.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
                                هیچ کالایی انتخاب نشده است
                            </div>
                        ) : (
                            selectedProductIds.map(pid => {
                                const p = getProductById(pid);
                                return (
                                    <div key={pid} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="font-black text-gray-700 dark:text-gray-300">{p?.name}</span>
                                            <button type="button" onClick={() => handleProductToggle(pid)} className="text-red-500 p-1"><Icons.X className="w-5 h-5" /></button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 block mb-1">تعداد (کارتن)</label>
                                                <input type="tel" className="w-full p-3 bg-white text-center font-black text-xl rounded-xl outline-none focus:ring-2 focus:ring-metro-blue" placeholder="0" value={itemsState[pid]?.cartons || ''} onChange={e => handleItemChange(pid, 'cartons', e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 block mb-1">وزن (کیلوگرم)</label>
                                                <input type="tel" className="w-full p-3 bg-white text-center font-black text-xl rounded-xl outline-none focus:ring-2 focus:ring-metro-blue border-b-4 border-metro-blue" placeholder="0" value={itemsState[pid]?.weight || ''} onChange={e => handleItemChange(pid, 'weight', e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Driver Info */}
                <div className="bg-white dark:bg-gray-800 p-6 lg:p-8 rounded-[24px] shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-2 h-full bg-metro-green"></div>
                    <h3 className="font-black text-xl mb-6 text-gray-800 dark:text-white flex items-center gap-2">
                        <Icons.User className="w-6 h-6 text-metro-green" />
                        مشخصات راننده
                    </h3>

                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className={labelClass}>نام راننده</label>
                                <input type="text" {...register('driverName')} className={inputClass} placeholder="نام و نام خانوادگی" />
                                {errors.driverName && <p className="text-red-500 text-xs font-bold mt-2">{errors.driverName.message}</p>}
                            </div>
                            <div>
                                <label className={labelClass}>شماره تماس</label>
                                <input type="tel" dir="ltr" maxLength={11} {...register('contactPhone')} className={`${inputClass} font-mono tracking-widest`} placeholder="0912..." />
                                {errors.contactPhone && <p className="text-red-500 text-xs font-bold mt-2">{errors.contactPhone.message}</p>}
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>شماره پلاک</label>
                            <div className="flex flex-row gap-2 items-center justify-center bg-gray-100 p-4 rounded-2xl border-2 border-gray-300" dir="ltr">
                                {/* IRAN CODE */}
                                <div className="flex flex-col items-center justify-center w-12 h-16 border-r-2 border-black pr-2">
                                    <span className="text-[8px] font-bold">IRAN</span>
                                    <input 
                                        type="tel" 
                                        maxLength={2} 
                                        value={plateParts.part4} 
                                        onChange={e => setPlateParts(p => ({...p, part4: e.target.value.replace(/\D/g, '')}))} 
                                        className="w-full h-full bg-transparent text-center font-black text-xl outline-none" 
                                        placeholder="11" 
                                    />
                                </div>
                                
                                <input type="tel" maxLength={3} value={plateParts.part3} onChange={e => setPlateParts(p => ({...p, part3: e.target.value.replace(/\D/g, '')}))} className="w-16 h-16 bg-transparent text-center font-black text-2xl outline-none" placeholder="365" />
                                
                                <div className="relative">
                                    <button type="button" onClick={() => setShowLetterPicker(!showLetterPicker)} className="w-12 h-16 font-black text-2xl flex items-center justify-center text-red-600">
                                        {plateParts.letter || 'الف'}
                                    </button>
                                    <AnimatePresence>
                                        {showLetterPicker && (
                                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="absolute bottom-full mb-2 bg-white shadow-xl rounded-xl p-2 grid grid-cols-4 gap-2 w-64 z-50 h-48 overflow-y-auto">
                                                {PERSIAN_LETTERS.map(l => (
                                                    <button key={l} type="button" onClick={() => { setPlateParts(p => ({...p, letter: l})); setShowLetterPicker(false); }} className="p-2 hover:bg-gray-100 rounded font-bold">{l}</button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <input type="tel" maxLength={2} value={plateParts.part1} onChange={e => setPlateParts(p => ({...p, part1: e.target.value.replace(/\D/g, '')}))} className="w-12 h-16 bg-transparent text-center font-black text-2xl outline-none" placeholder="22" />
                                
                                <div className="flex flex-col h-full justify-between pl-2">
                                    <div className="w-4 h-full bg-blue-700"></div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>توضیحات (اختیاری)</label>
                            <textarea {...register('description')} className="w-full p-4 border-2 border-gray-200 rounded-xl bg-white outline-none focus:border-metro-blue h-24 text-right" placeholder="توضیحات تکمیلی..."></textarea>
                            {errors.description && <p className="text-red-500 text-xs font-bold mt-2">{errors.description.message}</p>}
                        </div>
                    </div>
                </div>

                <Button type="submit" isLoading={isSubmitting} className="w-full h-16 text-xl font-black bg-gradient-to-r from-metro-blue to-indigo-600 hover:to-indigo-500 shadow-xl shadow-blue-200 dark:shadow-none rounded-[24px] border-b-4 border-blue-800 active:border-b-0 active:translate-y-1 transition-all mt-8">
                    ثبت نهایی حواله
                </Button>
            </form>
        </div>
    );
};
