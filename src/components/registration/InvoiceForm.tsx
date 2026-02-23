
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
import { compareProducts } from '../../utils/sortUtils';
import Button from '../common/Button';
import { Icons } from '../common/Icons';
import { useConfirm } from '../../hooks/useConfirm';
import JalaliDatePicker from '../common/JalaliDatePicker';
import { motion, AnimatePresence } from 'framer-motion';
import PersianNumberInput from '../common/PersianNumberInput';
import PlateInput from '../common/PlateInput';
import Input from '../common/Input';
import TextArea from '../common/TextArea';
import { useSMS, ParsedSMS } from '../../hooks/useSMS';
import { v4 as uuidv4 } from 'uuid';
import Modal from '../common/Modal';
import { useValidation } from '../../hooks/useValidation';
import { useAutoSave } from '../../hooks/useAutoSave';
import { sanitizeString } from '../../utils/sanitizers';

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

// Composite state for auto-save
interface InvoiceDraftState {
    globalValues: GlobalValues;
    itemsState: Record<string, { cartons: string; weight: string; isSorted: boolean }>;
    selectedProductIds: string[];
    referenceDate: string;
}

export const InvoiceForm: React.FC = () => {
    const { user } = useAuthStore();
    const { getProductById, farms: allFarms } = useFarmStore();
    const { bulkAddInvoices } = useInvoiceStore();
    const { statistics } = useStatisticsStore();
    const { addToast } = useToastStore();
    const { confirm } = useConfirm();
    const { readFromClipboard, parseMultipleInvoices } = useSMS();
    const { cleanPersianText } = useValidation();

    const todayJalali = getTodayJalali();
    const todayDayName = getTodayDayName();
    const normalizedDate = normalizeDate(todayJalali);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const isAdmin = user?.role === 'ADMIN';
    const availableFarms = isAdmin ? allFarms : (user?.assignedFarms || []);
    const [selectedFarmId, setSelectedFarmId] = useState<string>('');

    // Initialize farm ID
    useEffect(() => {
        if (!selectedFarmId && availableFarms.length > 0) {
            setSelectedFarmId(availableFarms[0].id);
        }
    }, [availableFarms, selectedFarmId]);

    const selectedFarm = availableFarms.find(f => f.id === selectedFarmId);

    const [referenceDate, setReferenceDate] = useState(normalizedDate);
    const [currentTime, setCurrentTime] = useState(getCurrentTime(false));

    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
    const [itemsState, setItemsState] = useState<Record<string, { cartons: string; weight: string; isSorted: boolean }>>({});

    const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false);
    const [plateError, setPlateError] = useState<string | null>(null);

    const [smsDrafts, setSmsDrafts] = useState<SMSDraft[]>([]);
    const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
    const [pendingDraftData, setPendingDraftData] = useState<{ cartons: number, weight: number } | null>(null);

    // Manual Paste Modal State
    const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
    const [pastedText, setPastedText] = useState('');

    const { register, handleSubmit, setValue, control, watch, reset, formState: { errors } } = useForm<GlobalValues>({
        resolver: zodResolver(invoiceGlobalSchema),
        defaultValues: { description: '', invoiceNumber: '', contactPhone: '', driverName: '', plateNumber: '' }
    });

    // --- AUTO SAVE INTEGRATION ---
    const watchedValues = watch();
    const compositeState: InvoiceDraftState = {
        globalValues: watchedValues,
        itemsState,
        selectedProductIds,
        referenceDate
    };

    const { clear: clearDraft } = useAutoSave<InvoiceDraftState>(
        'morvarid_invoice_form_draft',
        compositeState,
        (saved) => {
            if (saved.globalValues) reset(saved.globalValues);
            if (saved.itemsState) setItemsState(saved.itemsState);
            if (saved.selectedProductIds) setSelectedProductIds(saved.selectedProductIds);
            if (saved.referenceDate) setReferenceDate(saved.referenceDate);
            addToast('اطلاعات تایپ شده قبلی بازیابی شد.', 'info');
        }
    );
    // -----------------------------

    useEffect(() => {
        // Only set default if not loaded from draft (draft logic handles override)
        // But we want to ensure referenceDate defaults to today if draft is empty
        if (!referenceDate) setReferenceDate(normalizedDate);
    }, [normalizedDate]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(getCurrentTime(false)), 30000); // TIMING.TIME_UPDATE_INTERVAL
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (pendingDraftData && selectedProductIds.length > 0) {
            setItemsState(prev => {
                const newState = { ...prev };
                selectedProductIds.forEach(pid => {
                    if (!newState[pid]?.cartons && !newState[pid]?.weight) {
                        // Smart Sorting: preserve isSorted if exists, default to false
                        const product = getProductById(pid);
                        const productName = product?.name?.toLowerCase() || '';
                        const isPrintable = productName.includes('پرینت') || productName.includes('printable');
                        newState[pid] = {
                            cartons: String(pendingDraftData.cartons),
                            weight: '', // Weight must be entered manually
                            isSorted: isPrintable
                        };
                    }
                });
                return newState;
            });
        }
    }, [selectedProductIds, pendingDraftData, getProductById]);

    const handleReadSMS = async () => {
        const parsed = await readFromClipboard();
        processParsedMessages(parsed);
    };

    const handleManualParse = () => {
        if (!pastedText.trim()) {
            addToast('متنی برای پردازش وارد نشده است.', 'warning');
            return;
        }
        const parsed = parseMultipleInvoices(pastedText);
        processParsedMessages(parsed);
        setIsPasteModalOpen(false);
        setPastedText('');
    };

    const processParsedMessages = (parsed: ParsedSMS[]) => {
        if (parsed.length > 0) {
            const uniqueNewDrafts = parsed.filter(p => !smsDrafts.some(d => d.invoiceNumber === p.invoiceNumber));

            if (uniqueNewDrafts.length === 0) {
                addToast('این پیامک(ها) قبلاً در لیست موجود هستند.', 'warning');
                return;
            }

            const newDrafts = uniqueNewDrafts.map(p => ({ ...p, id: uuidv4() }));
            setSmsDrafts(prev => [...prev, ...newDrafts]);
            addToast(`${toPersianDigits(uniqueNewDrafts.length)} حواله جدید به لیست اضافه شد.`, 'success');
        } else {
            addToast('هیچ الگوی معتبری یافت نشد.', 'warning');
        }
    };

    const applyDraft = (draft: SMSDraft) => {
        setValue('invoiceNumber', draft.invoiceNumber);
        if (draft.date) {
            setReferenceDate(normalizeDate(draft.date));
        }

        setPendingDraftData({ cartons: draft.cartons, weight: 0 }); // Weight is zeroed out for manual entry
        setActiveDraftId(draft.id);

        if (selectedProductIds.length > 0) {
            setItemsState(prev => {
                const newState = { ...prev };
                selectedProductIds.forEach(pid => {
                    // Smart Sorting: preserve existing isSorted value
                    const product = getProductById(pid);
                    const productName = product?.name?.toLowerCase() || '';
                    const isPrintable = productName.includes('پرینت') || productName.includes('printable');
                    newState[pid] = {
                        cartons: String(draft.cartons),
                        weight: '', // Weight must be entered manually
                        isSorted: prev[pid]?.isSorted ?? isPrintable
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
        const normalizedRefDate = normalizeDate(referenceDate);
        const statRecord = statistics.find(s => s.farmId === selectedFarmId && normalizeDate(s.date) === normalizedRefDate && s.productId === pid);
        if (!statRecord) {
            // Decode HTML entities in date for display
            const decodedDate = referenceDate.replace(/&#x2F;/g, '/').replace(/&#[xX]0+;/g, '').replace(/&\w+;/g, '');
            addToast(`ابتدا باید آمار تولید ${getProductById(pid)?.name} برای تاریخ ${decodedDate} ثبت شود.`, 'error');
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
                // Smart Sorting: Auto-set isSorted based on product type
                const product = getProductById(pid);
                const productName = product?.name?.toLowerCase() || '';
                const isPrintable = productName.includes('پرینت') || productName.includes('printable');
                setItemsState(s => ({ ...s, [pid]: { cartons: '', weight: '', isSorted: isPrintable } }));
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

        // Initialize the array to collect invoices
        const invoicesToRegister: any[] = [];

        // Iterate through selected products
        for (let i = 0; i < selectedProductIds.length; i++) {
            const pid = selectedProductIds[i];
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

            const statRecord = statistics.find(s => s.farmId === selectedFarmId && normalizeDate(s.date) === normalizeDate(referenceDate) && s.productId === pid);
            if (!statRecord) {
                addToast(`خطا: آمار تولید برای "${name}" یافت نشد.`, 'error');
                return;
            }

            // --- Inventory Conversion Logic (Split Item Strategy) ---
            const isSimpleProduct = name.includes('ساده') || name.toLowerCase().includes('simple');
            const currentStock = statRecord.currentInventory || 0;

            // CONVERSION CONDITION: Simple Product AND Not Enough Stock
            if (isSimpleProduct && currentStock < cartonsVal) {
                const printableProduct = selectedFarm?.productIds
                    .map(id => getProductById(id))
                    .find(p => p && (p.name.includes('پرینت') || p.name.toLowerCase().includes('printable')));

                if (printableProduct) {
                    const printableStat = statistics.find(s =>
                        s.farmId === selectedFarmId &&
                        normalizeDate(s.date) === normalizeDate(referenceDate) &&
                        s.productId === printableProduct.id
                    );

                    // Check if Printable has enough stock to cover the DEFICIT
                    const deficit = cartonsVal - currentStock;
                    const printableStock = printableStat?.currentInventory || 0;

                    if (printableStat && printableStock >= deficit) {
                        const convertConfirmed = await confirm({
                            title: 'تبدیل موجودی (کسری بار)',
                            message: `موجودی "${name}" کافی نیست (${toPersianDigits(currentStock)} کارتن موجود). \nآیا کسری بار (${toPersianDigits(deficit)} کارتن) از موجودی "${printableProduct.name}" تبدیل شود؟`,
                            confirmText: 'بله، تبدیل کن',
                            cancelText: 'انصراف',
                            type: 'warning'
                        });

                        if (convertConfirmed) {
                            // SINGLE ITEM LOGIC
                            // We register ONE invoice for the full amount.
                            // We mark it as converted and store the Deficit amount in convertedAmount.

                            invoicesToRegister.push({
                                farmId: selectedFarmId,
                                date: normalizeDate(referenceDate),
                                productId: pid, // Simple
                                invoiceNumber: globalData.invoiceNumber,
                                totalCartons: cartonsVal, // Full Amount
                                totalWeight: weightVal,
                                driverName: globalData.driverName,
                                driverPhone: globalData.contactPhone,
                                plateNumber: globalData.plateNumber,
                                // Append note about conversion
                                description: `${globalData.description || ''} (تبدیل ${toPersianDigits(deficit)} کارتن از ${printableProduct.name})`,
                                isSorted: item.isSorted || false,
                                isConverted: true,
                                sourceProductId: printableProduct.id,
                                convertedAmount: deficit, // The amount taken from Source
                                isYesterday: referenceDate !== normalizedDate
                            });

                            // Move to next product
                            continue;
                        } else {
                            return; // User cancelled
                        }
                    } else {
                        // Printable doesn't have enough either
                        addToast(`خطا: موجودی "${name}" کافی نیست. (کسری: ${toPersianDigits(deficit)}). موجودی "${printableProduct.name}" هم برای پوشش این کسری کافی نیست (${toPersianDigits(printableStock)}).`, 'error');
                        return;
                    }
                }
                // No printable product found -> fall through to standard error
            }

            // Standard Check (No Conversion or Not Needed)
            if (currentStock < cartonsVal) {
                addToast(`خطا: موجودی "${name}" کافی نیست. (موجود: ${toPersianDigits(currentStock)})`, 'error');
                return;
            }

            // Standard Add (Sufficient Stock)
            invoicesToRegister.push({
                farmId: selectedFarmId,
                date: normalizeDate(referenceDate),
                productId: pid,
                invoiceNumber: globalData.invoiceNumber,
                totalCartons: cartonsVal,
                totalWeight: weightVal,
                driverName: globalData.driverName,
                driverPhone: globalData.contactPhone,
                plateNumber: globalData.plateNumber,
                description: globalData.description,
                isSorted: item.isSorted || false,
                isConverted: false,
                isYesterday: referenceDate !== normalizedDate
            });
        }

        // Confirmation before saving
        const totalCartons = invoicesToRegister.reduce((sum, inv) => sum + inv.totalCartons, 0);
        const uniqueProducts = new Set(invoicesToRegister.map(inv => inv.productId)).size;

        const confirmed = await confirm({
            title: 'ثبت نهایی',
            message: `آیا از ثبت ${toPersianDigits(uniqueProducts)} محصول و مجموع ${toPersianDigits(totalCartons)} کارتن اطمینان دارید؟`,
            confirmText: 'ثبت',
            cancelText: 'بررسی مجدد'
        });

        if (!confirmed) return;

        setIsSubmitting(true);

        // Sanitize data before sending to Store
        const sanitizedInvoices = invoicesToRegister.map(inv => ({
            ...inv,
            driverName: sanitizeString(inv.driverName || ''),
            description: sanitizeString(inv.description || ''),
            plateNumber: sanitizeString(inv.plateNumber || '')
        }));

        const result = await bulkAddInvoices(sanitizedInvoices);
        setIsSubmitting(false);

        if (!result.success) {
            const err = result.error || '';
            if (err.includes('تکراری') || err.includes('Duplicate')) {
                addToast('این شماره حواله قبلاً ثبت شده است (احتمالاً برای یکی از این محصولات).', 'error');
            } else if (err.includes('فارم دیگر')) {
                addToast('این شماره حواله متعلق به فارم دیگری است.', 'error');
            } else {
                addToast(`خطا در ثبت: ${err}`, 'error');
            }
            return;
        }

        // SUCCESS PATH
        addToast(`${toPersianDigits(invoicesToRegister.length)} آیتم با موفقیت ثبت شد.`, 'success');

        // CLEAR AUTO SAVE
        clearDraft();

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

    const inputClass = "w-full p-4 border-2 border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white font-black text-center focus:border-metro-blue outline-none transition-all text-xl rounded-xl shadow-sm placeholder-gray-400";
    const labelClass = "block text-sm font-black text-gray-500 dark:text-gray-400 mb-1.5 uppercase text-right px-1";

    if (!selectedFarm) return <div className="p-20 text-center font-bold text-gray-400">فارمی یافت نشد.</div>;

    const sortedProductIds = [...selectedFarm.productIds].sort((aId, bId) => {
        const pA = getProductById(aId);
        const pB = getProductById(bId);
        if (!pA || !pB) return 0;
        return compareProducts(pA, pB);
    });

    return (
        <div className="max-w-4xl mx-auto space-y-6 lg:space-y-10 pb-20">
            {isAdmin && availableFarms.length > 1 && (
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row items-center gap-4 animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center gap-2 text-metro-purple font-black">
                        <Icons.Settings className="w-5 h-5" />
                        <span>انتخاب فارم (دسترسی مدیریت):</span>
                    </div>
                    <div className="flex flex-wrap gap-2 flex-1">
                        {availableFarms.map(f => (
                            <button
                                key={f.id}
                                onClick={() => setSelectedFarmId(f.id)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedFarmId === f.id ? 'bg-metro-purple text-white shadow-lg shadow-purple-200 dark:shadow-none scale-105' : 'bg-gray-50 dark:bg-gray-900 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 border border-gray-100 dark:border-gray-700'}`}
                            >
                                {f.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            <div className="bg-blue-50/80 dark:bg-blue-950/20 p-6 rounded-[24px] shadow-sm border border-blue-100 dark:border-blue-900/30 relative overflow-hidden flex flex-col items-center justify-center gap-2 text-center transition-colors">
                <Icons.FileText className="absolute right-4 top-1/2 -translate-y-1/2 w-32 h-32 text-metro-blue opacity-5 pointer-events-none -rotate-12" />

                <div className="flex items-center gap-3 mb-1 relative z-10">
                    <span className="text-gray-500 dark:text-gray-400 font-bold text-xs tracking-widest uppercase bg-gray-100 dark:bg-gray-700/50 px-3 py-1 rounded-full">
                        {todayDayName}
                    </span>
                    <div className="text-xl font-bold text-gray-400 font-sans tabular-nums tracking-wide">{toPersianDigits(currentTime)}</div>
                </div>

                <div className="flex items-center gap-4 relative z-10">
                    <h1 className="text-5xl lg:text-6xl font-black font-sans tabular-nums tracking-tighter leading-none text-gray-900 dark:text-white">
                        {toPersianDigits(referenceDate)}
                    </h1>
                </div>

                <div className="mt-2 text-metro-blue font-black tracking-wide text-lg relative z-10">
                    ثبت حواله فروش
                </div>

                <div className="flex gap-2 mt-4 relative z-10">
                    <button
                        onClick={handleReadSMS}
                        className="bg-metro-blue hover:bg-metro-cobalt text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md active:scale-95"
                    >
                        <Icons.Download className="w-4 h-4" />
                        خواندن از پیامک
                    </button>

                    <button
                        onClick={() => setIsPasteModalOpen(true)}
                        className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95"
                        title="ورود دستی / تاریخچه"
                    >
                        <Icons.List className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <Modal isOpen={isPasteModalOpen} onClose={() => setIsPasteModalOpen(false)} title="پردازش متن انبوه / تاریخچه">
                <div className="space-y-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                        اگر چندین پیامک در تاریخچه کیبورد دارید، همه آن‌ها را در کادر زیر Paste کنید. سیستم تمام حواله‌ها را استخراج می‌کند.
                    </p>
                    <TextArea
                        className="w-full h-48"
                        placeholder="متن پیامک‌ها را اینجا قرار دهید..."
                        value={pastedText}
                        onChange={(e) => setPastedText(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setIsPasteModalOpen(false)}>انصراف</Button>
                        <Button onClick={handleManualParse}>پردازش متن</Button>
                    </div>
                </div>
            </Modal>

            <AnimatePresence>
                {smsDrafts.length > 0 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="px-1">
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

            <form onSubmit={handleSubmit(handleFinalSubmit)} className="px-1 space-y-8">
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
                                    {sortedProductIds.map(pid => {
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
                                const productName = p?.name?.toLowerCase() || '';
                                const isPrintable = productName.includes('پرینت') || productName.includes('printable');
                                const isSortedValue = itemsState[pid]?.isSorted || false;

                                return (
                                    <div key={pid} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="font-black text-gray-700 dark:text-gray-300">{p?.name}</span>
                                            <button type="button" onClick={() => handleProductToggle(pid)} className="text-red-500 p-1"><Icons.X className="w-5 h-5" /></button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-gray-400 block mb-1">تعداد (کارتن)</label>
                                                <PersianNumberInput
                                                    className="w-full p-3 bg-white dark:bg-gray-800 dark:text-white text-center font-black text-xl rounded-xl outline-none focus:ring-2 focus:ring-metro-blue border-2 border-transparent dark:border-gray-700 placeholder-gray-400"
                                                    value={itemsState[pid]?.cartons || ''}
                                                    onChange={val => handleItemChange(pid, 'cartons', val)}
                                                    placeholder=""
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-400 block mb-1">وزن (کیلوگرم)</label>
                                                <PersianNumberInput
                                                    inputMode="decimal"
                                                    className="w-full p-3 bg-white dark:bg-gray-800 dark:text-white text-center font-black text-xl rounded-xl outline-none focus:ring-2 focus:ring-metro-blue border-b-4 border-metro-blue dark:border-metro-blue"
                                                    value={itemsState[pid]?.weight || ''}
                                                    onChange={val => handleItemChange(pid, 'weight', val)}
                                                    placeholder=""
                                                />
                                            </div>
                                        </div>
                                        {/* Smart Sorting: isSorted Toggle - Only for MORVARIDI */}
                                        {selectedFarm?.type !== 'MOTEFEREGHE' && (
                                            <>
                                                <div className="mt-4 flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-900/30">
                                                    <span className="text-sm font-bold text-purple-700 dark:text-purple-300 flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                                        سورت شده
                                                    </span>
                                                    <button
                                                        type="button"
                                                        disabled={isPrintable}
                                                        onClick={() => {
                                                            if (!isPrintable) {
                                                                setItemsState(s => ({
                                                                    ...s,
                                                                    [pid]: { ...s[pid], isSorted: !s[pid]?.isSorted }
                                                                }));
                                                            }
                                                        }}
                                                        className={`relative w-14 h-7 rounded-full transition-all ${isSortedValue
                                                            ? 'bg-purple-600'
                                                            : 'bg-gray-300 dark:bg-gray-600'
                                                            } ${isPrintable ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                                    >
                                                        <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${isSortedValue ? 'right-1' : 'left-1'
                                                            }`}></span>
                                                    </button>
                                                </div>
                                                {isPrintable && (
                                                    <p className="text-[10px] text-purple-500 mt-1 text-center font-bold">
                                                        محصول پرینتی همیشه سورت شده است
                                                    </p>
                                                )}
                                            </>
                                        )}
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
                                <label className={labelClass}>نام راننده (اختیاری - فقط فارسی)</label>
                                <Controller
                                    name="driverName"
                                    control={control}
                                    render={({ field }) => (
                                        <Input
                                            {...field}
                                            className={inputClass}
                                            placeholder=""
                                            onChange={(e) => field.onChange(cleanPersianText(e.target.value))}
                                        />
                                    )}
                                />
                                {errors.driverName && <p className="text-red-500 text-xs font-bold mt-2">{errors.driverName.message}</p>}
                            </div>
                            <div>
                                <label className={labelClass}>شماره تماس (۱۱ رقم - ۰۹)</label>
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
                            <label className={labelClass}>توضیحات (اختیاری - فقط فارسی)</label>
                            <Controller
                                name="description"
                                control={control}
                                render={({ field }) => (
                                    <TextArea
                                        {...field}
                                        className="w-full p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 dark:text-white outline-none focus:border-metro-blue h-24 text-right placeholder-gray-400"
                                        placeholder=""
                                        onChange={(e) => field.onChange(cleanPersianText(e.target.value))}
                                    />
                                )}
                            />
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
