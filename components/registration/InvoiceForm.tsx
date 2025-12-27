
import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import PersianNumberInput from '../common/PersianNumberInput';
import PlateInput from '../common/PlateInput';
import { useSMS, ParsedSMS } from '../../hooks/useSMS';
import { v4 as uuidv4 } from 'uuid';

const persianLettersRegex = /^[\u0600-\u06FF\s]+$/;
const mobileRegex = /^09\d{9}$/;
const invoiceNumberRegex = /^(17|18)\d{8}$/; 

const invoiceGlobalSchema = z.object({
    invoiceNumber: z.string()
        .min(1, 'رمز حواله الزامی است')
        .regex(invoiceNumberRegex, 'رمز حواله باید ۱۰ رقم باشد و با ۱۷ یا ۱۸ شروع شود'),
    contactPhone: z.string()
        .min(1, 'شماره تماس الزامی است')
        .regex(mobileRegex, 'شماره همراه باید ۱۱ رقم و با ۰۹ شروع شود'),
    driverName: z.string().optional(),
    description: z.string().optional()
        .refine(val => !val || persianLettersRegex.test(val.replace(/[0-9]/g, '')), 'توضیحات باید فارسی باشد'),
    plateNumber: z.string().optional(),
});

type GlobalValues = z.infer<typeof invoiceGlobalSchema>;

interface SMSDraft extends ParsedSMS {
    id: string;
}

export const InvoiceForm: React.FC = () => {
    const { user } = useAuthStore();
    const { getProductById } = useFarmStore();
    const { addInvoice } = useInvoiceStore();
    const { statistics } = useStatisticsStore(); 
    const { addToast } = useToastStore();
    const { confirm } = useConfirm();
    const { readFromClipboard } = useSMS();
    
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
    const [plateError, setPlateError] = useState<string | null>(null);

    const [smsDrafts, setSmsDrafts] = useState<SMSDraft[]>([]);
    const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
    const [pendingDraftData, setPendingDraftData] = useState<{cartons: number, weight: number} | null>(null);

    const { register, handleSubmit, setValue, control, formState: { errors } } = useForm<GlobalValues>({
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

    useEffect(() => {
        if (pendingDraftData && selectedProductIds.length > 0) {
            setItemsState(prev => {
                const newState = { ...prev };
                selectedProductIds.forEach(pid => {
                    if (!newState[pid]?.cartons && !newState[pid]?.weight) {
                        newState[pid] = {
                            cartons: String(pendingDraftData.cartons),
                            weight: String(pendingDraftData.weight)
                        };
                    }
                });
                return newState;
            });
        }
    }, [selectedProductIds, pendingDraftData]);

    const handleReadSMS = async () => {
        const confirmed = await confirm({
            title: 'خواندن از پیامک',
            message: 'کاربر گرامی برای استفاده از این ویژگی ابتدا باید پیامک‌های ارسال شده با محتوای رمز حواله را کپی کرده باشید. آیا مطمئن هستید؟',
            confirmText: 'تأیید',
            cancelText: 'انصراف',
            type: 'info'
        });

        if (confirmed) {
            const parsed = await readFromClipboard();
            if (parsed.length > 0) {
                const uniqueNewDrafts = parsed.filter(p => !smsDrafts.some(d => d.invoiceNumber === p.invoiceNumber));
                
                if (uniqueNewDrafts.length < parsed.length) {
                    addToast('رمز پیامک تکراری است (برخی موارد نادیده گرفته شدند)', 'warning');
                }

                if (uniqueNewDrafts.length > 0) {
                    const newDrafts = uniqueNewDrafts.map(p => ({ ...p, id: uuidv4() }));
                    setSmsDrafts(prev => [...prev, ...newDrafts]); 
                    addToast(`${toPersianDigits(uniqueNewDrafts.length)} حواله جدید شناسایی شد.`, 'success');
                } else if (parsed.length > 0) {
                    addToast('همه حواله‌های کپی شده تکراری هستند.', 'warning');
                }
            } else {
                addToast('هیچ اطلاعات معتبری در حافظه یافت نشد.', 'warning');
            }
        }
    };

    const applyDraft = (draft: SMSDraft) => {
        setValue('invoiceNumber', draft.invoiceNumber);
        if (draft.date) {
            setReferenceDate(normalizeDate(draft.date));
        }
        
        setPendingDraftData({ cartons: draft.cartons, weight: draft.weight });
        setActiveDraftId(draft.id);

        if (selectedProductIds.length > 0) {
            setItemsState(prev => {
                const newState = { ...prev };
                selectedProductIds.forEach(pid => {
                    newState[pid] = {
                        cartons: String(draft.cartons),
                        weight: String(draft.weight)
                    };
                });
                return newState;
            });
            addToast('اطلاعات حواله در فرم جایگذاری شد.', 'success');
        } else {
            addToast('اطلاعات پایه پر شد. لطفاً اکنون محصول را انتخاب کنید.', 'info');
            setIsProductSelectorOpen(true);
        }
    };

    const removeDraft = (id: string) => {
        setSmsDrafts(prev => prev.filter(d => d.id !== id));
        if (activeDraftId === id) {
            setActiveDraftId(null);
            setPendingDraftData(null);
        }
    };

    const handleProductToggle = (pid: string) => {
        const statRecord = statistics.find(s => s.farmId === selectedFarmId && s.date === referenceDate && s.productId === pid);
        if (!statRecord) {
            addToast(`ابتدا باید آمار تولید ${getProductById(pid)?.name} برای تاریخ ${referenceDate} ثبت شود.`, 'error');
            return;
        }

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

        if (plateError) {
            addToast(plateError, 'error');
            return;
        }

        for (const pid of selectedProductIds) {
            const item = itemsState[pid];
            const product = getProductById(pid);
            const name = product?.name || 'محصول';
            
            const weightVal = Number(item.weight);
            const cartonsVal = Number(item.cartons);

            if (!item.weight || weightVal <= 0) {
                addToast(`وزن برای "${name}" وارد نشده است.`, 'error');
                return;
            }
            if (!item.cartons || cartonsVal <= 0) {
                addToast(`تعداد کارتن برای "${name}" وارد نشده است.`, 'error');
                return;
            }

            if (weightVal > 6000) {
                addToast(`خطا: وزن ثبت شده برای "${name}" (${toPersianDigits(weightVal)} Kg) غیرمتعارف و بالاتر از ۶۰۰۰ کیلوگرم است.`, 'error');
                return;
            }
            if (cartonsVal > 2000) {
                addToast(`خطا: تعداد کارتن ثبت شده برای "${name}" (${toPersianDigits(cartonsVal)}) غیرمتعارف است.`, 'error');
                return;
            }

            const statRecord = statistics.find(s => s.farmId === selectedFarmId && s.date === referenceDate && s.productId === pid);
            if (!statRecord) {
                addToast(`خطا: آمار تولید برای "${name}" یافت نشد.`, 'error');
                return;
            }
            
            if (statRecord.currentInventory < cartonsVal) {
                addToast(`خطا: موجودی "${name}" کافی نیست. (موجود: ${statRecord.currentInventory})`, 'error');
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
        let successCount = 0;
        let errorsList: string[] = [];

        for (const pid of selectedProductIds) {
            const item = itemsState[pid];
            const result = await addInvoice({
                farmId: selectedFarmId,
                date: referenceDate, 
                invoiceNumber: globalData.invoiceNumber,
                totalCartons: Number(item.cartons || 0), 
                totalWeight: Number(item.weight),
                productId: pid,
                driverName: globalData.driverName || '',
                driverPhone: globalData.contactPhone,
                plateNumber: globalData.plateNumber,
                description: globalData.description,
                isYesterday: referenceDate !== normalizedDate
            });

            if (result.success) {
                successCount++;
            } else {
                errorsList.push(result.error || 'Unknown error');
            }
        }

        setIsSubmitting(false);

        if (errorsList.length > 0) {
            if (errorsList.some(e => e.includes('تکراری') || e.includes('Duplicate'))) {
                addToast('این شماره حواله قبلاً برای این محصول ثبت شده است.', 'error');
            } else if (errorsList.some(e => e.includes('فارم دیگر'))) {
                addToast('این شماره حواله متعلق به فارم دیگری است.', 'error');
            } else {
                addToast(`خطا در ثبت: ${errorsList[0]}`, 'error');
            }
        } 
        
        if (successCount > 0) {
            addToast(`${toPersianDigits(successCount)} آیتم با موفقیت ثبت شد.`, 'success');
            
            if (activeDraftId) {
                removeDraft(activeDraftId);
            }

            setSelectedProductIds([]);
            setItemsState({});
            setValue('invoiceNumber', '');
            setValue('contactPhone', '');
            setValue('driverName', '');
            setValue('description', '');
            setValue('plateNumber', '');
            setPendingDraftData(null);
            setActiveDraftId(null);
        }
    };

    const inputClass = "w-full p-4 border-2 border-gray-200 bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white font-black text-center focus:border-metro-blue outline-none transition-all text-xl rounded-xl shadow-sm";
    const labelClass = "block text-sm font-black text-gray-500 dark:text-gray-400 mb-1.5 uppercase text-right px-1";

    if (!selectedFarm) return <div className="p-20 text-center font-bold text-gray-400">فارمی یافت نشد.</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6 lg:space-y-10 pb-20">
            <div className="bg-gradient-to-br from-metro-blue via-blue-600 to-indigo-600 p-6 text-white shadow-xl relative overflow-hidden flex flex-col items-center justify-center gap-3 rounded-b-[32px] border-b-4 border-blue-800/20 gpu-accelerated">
                 <div className="absolute inset-0 shimmer-bg z-0"></div>
                 <Icons.FileText className="absolute -right-8 -bottom-8 w-48 h-48 opacity-10 pointer-events-none -rotate-12" />
                 <div className="relative z-10 flex flex-col items-center w-full">
                     <div className="flex items-center gap-3 mb-1">
                        <span className="text-blue-100 font-bold text-sm tracking-widest uppercase bg-black/10 px-3 py-0.5 rounded-full backdrop-blur-sm">
                             {todayDayName}
                        </span>
                        <div className="text-xl font-bold opacity-90 font-sans tabular-nums tracking-wide">{toPersianDigits(currentTime)}</div>
                     </div>
                     <div className="flex items-center gap-4">
                         <h1 className="text-5xl lg:text-6xl font-black font-sans tabular-nums tracking-tighter drop-shadow-lg leading-none">
                             {toPersianDigits(referenceDate)}
                         </h1>
                     </div>
                     <div className="mt-3 text-white font-black tracking-wide text-lg border-b-2 border-white/20 pb-1">
                        ثبت حواله فروش
                     </div>
                     <button 
                        onClick={handleReadSMS}
                        className="mt-3 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 backdrop-blur-sm transition-all border border-white/20 active:scale-95"
                     >
                         <Icons.Download className="w-4 h-4" />
                         خواندن از پیامک
                     </button>
                     <div className="mt-2 text-[10px] text-blue-100 bg-black/20 px-3 py-1 rounded-full flex items-center gap-1 backdrop-blur-md border border-white/10">
                         <Icons.AlertCircle className="w-3 h-3" />
                         نکته: برای ثبت گروهی، لطفاً تمام پیامک‌ها را یکجا انتخاب و کپی کنید.
                     </div>
                 </div>
            </div>

            <AnimatePresence>
                {smsDrafts.length > 0 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="px-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                            <h4 className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
                                <Icons.Download className="w-4 h-4" />
                                حواله‌های شناسایی شده ({toPersianDigits(smsDrafts.length)})
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {smsDrafts.map(draft => (
                                    <div key={draft.id} className={`p-3 rounded-xl bg-white dark:bg-gray-800 border-2 transition-all relative ${activeDraftId === draft.id ? 'border-metro-orange shadow-md scale-[1.02]' : 'border-gray-100 dark:border-gray-700'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <span className="text-xs text-gray-400 block">رمز حواله</span>
                                                <span className="font-black text-lg text-gray-800 dark:text-white tracking-widest">{toPersianDigits(draft.invoiceNumber)}</span>
                                            </div>
                                            <div className="text-left">
                                                <span className="text-xs text-gray-400 block">تاریخ</span>
                                                <span className="font-bold text-sm text-gray-700 dark:text-gray-300">{toPersianDigits(draft.date || referenceDate)}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-4 mb-3">
                                            <div>
                                                <span className="text-[10px] text-gray-400 block">کارتن</span>
                                                <span className="font-black text-metro-blue">{toPersianDigits(draft.cartons)}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-gray-400 block">وزن</span>
                                                <span className="font-black text-metro-blue">{toPersianDigits(draft.weight)}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => applyDraft(draft)} className="flex-1 bg-metro-blue text-white py-1.5 rounded-lg text-xs font-bold hover:bg-metro-cobalt transition-colors">انتقال به فرم</button>
                                            <button onClick={() => removeDraft(draft.id)} className="px-3 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300 rounded-lg hover:bg-red-200 transition-colors"><Icons.Trash className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <form onSubmit={handleSubmit(handleFinalSubmit)} className="px-4 space-y-8">
                <div className="bg-white dark:bg-gray-800 p-6 lg:p-8 rounded-[24px] shadow-sm border border-gray-100 dark:border-gray-700 relative border-r-[8px] border-r-metro-orange">
                    <h3 className="font-black text-xl mb-6 text-gray-800 dark:text-white flex items-center gap-2">
                        <Icons.FileText className="w-6 h-6 text-metro-orange" />
                        اطلاعات پایه
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={labelClass}>رمز حواله (۱۰ رقم)</label>
                            <Controller
                                name="invoiceNumber"
                                control={control}
                                render={({ field }) => (
                                    <PersianNumberInput
                                        value={field.value}
                                        onChange={field.onChange}
                                        maxLength={10}
                                        className={`${inputClass} tracking-[0.3em] text-3xl h-16 border-metro-orange/30 focus:border-metro-orange focus:ring-4 focus:ring-orange-500/10`}
                                        placeholder=""
                                    />
                                )}
                            />
                            {errors.invoiceNumber && <p className="text-red-500 text-xs font-bold mt-2 mr-1">{errors.invoiceNumber.message}</p>}
                        </div>
                        
                        <div>
                            <label className={labelClass}>تاریخ صدور</label>
                            <div className="h-16 relative z-10">
                                <JalaliDatePicker value={referenceDate} onChange={setReferenceDate} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 lg:p-8 rounded-[24px] shadow-sm border border-gray-100 dark:border-gray-700 relative border-r-[8px] border-r-metro-blue">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-black text-xl text-gray-800 dark:text-white flex items-center gap-2">
                            <Icons.List className="w-6 h-6 text-metro-blue" />
                            اقلام حواله
                        </h3>
                        <button type="button" onClick={() => setIsProductSelectorOpen(!isProductSelectorOpen)} className="text-sm font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
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
                                                className={`p-3 rounded-xl text-sm font-bold transition-all ${isSelected ? 'bg-metro-blue text-white shadow-lg scale-95' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
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
                            <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
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
                                                <PersianNumberInput 
                                                    className="w-full p-3 bg-white dark:bg-gray-800 dark:text-white text-center font-black text-xl rounded-xl outline-none focus:ring-2 focus:ring-metro-blue border-2 border-transparent dark:border-gray-700"
                                                    value={itemsState[pid]?.cartons || ''}
                                                    onChange={val => handleItemChange(pid, 'cartons', val)}
                                                    placeholder=""
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 block mb-1">وزن (کیلوگرم)</label>
                                                <PersianNumberInput 
                                                    inputMode="decimal"
                                                    className="w-full p-3 bg-white dark:bg-gray-800 dark:text-white text-center font-black text-xl rounded-xl outline-none focus:ring-2 focus:ring-metro-blue border-b-4 border-metro-blue dark:border-metro-blue"
                                                    value={itemsState[pid]?.weight || ''}
                                                    onChange={val => handleItemChange(pid, 'weight', val)}
                                                    placeholder=""
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 lg:p-8 rounded-[24px] shadow-sm border border-gray-100 dark:border-gray-700 relative border-r-[8px] border-r-metro-green">
                    <h3 className="font-black text-xl mb-6 text-gray-800 dark:text-white flex items-center gap-2">
                        <Icons.User className="w-6 h-6 text-metro-green" />
                        مشخصات راننده
                    </h3>

                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className={labelClass}>نام راننده (اختیاری)</label>
                                <input 
                                    type="text" 
                                    {...register('driverName')} 
                                    className={inputClass} 
                                    placeholder="" 
                                    onInput={(e) => {
                                        e.currentTarget.value = e.currentTarget.value.replace(/[0-9]/g, '');
                                    }}
                                />
                                {errors.driverName && <p className="text-red-500 text-xs font-bold mt-2">{errors.driverName.message}</p>}
                            </div>
                            <div>
                                <label className={labelClass}>شماره تماس</label>
                                <Controller
                                    name="contactPhone"
                                    control={control}
                                    render={({ field }) => (
                                        <PersianNumberInput
                                            value={field.value}
                                            onChange={field.onChange}
                                            maxLength={11}
                                            inputMode="tel"
                                            className={`${inputClass} font-mono tracking-widest`}
                                            placeholder=""
                                        />
                                    )}
                                />
                                {errors.contactPhone && <p className="text-red-500 text-xs font-bold mt-2">{errors.contactPhone.message}</p>}
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>شماره پلاک</label>
                            <Controller
                                name="plateNumber"
                                control={control}
                                render={({ field }) => (
                                    <PlateInput 
                                        value={field.value} 
                                        onChange={field.onChange} 
                                        onError={setPlateError} 
                                    />
                                )}
                            />
                        </div>

                        <div>
                            <label className={labelClass}>توضیحات (اختیاری)</label>
                            <textarea {...register('description')} className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 dark:text-white outline-none focus:border-metro-blue h-24 text-right" placeholder=""></textarea>
                            {errors.description && <p className="text-red-500 text-xs font-bold mt-2">{errors.description.message}</p>}
                        </div>
                    </div>
                </div>

                <Button type="submit" isLoading={isSubmitting} className="w-full h-20 text-2xl lg:text-3xl font-black bg-gradient-to-r from-metro-blue to-indigo-600 hover:to-indigo-500 shadow-xl shadow-blue-200 dark:shadow-none rounded-[24px] border-b-4 border-blue-800 active:border-b-0 active:translate-y-1 transition-all mt-8">
                    ثبت نهایی حواله
                </Button>
            </form>
        </div>
    );
};
