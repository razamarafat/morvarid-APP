
import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useFarmStore } from '../../store/farmStore';
import { useStatisticsStore } from '../../store/statisticsStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useToastStore } from '../../store/toastStore';
import { getTodayJalali, getTodayDayName, getCurrentTime, normalizeDate, toPersianDigits } from '../../utils/dateUtils';
import Button from '../common/Button';
import { useConfirm } from '../../hooks/useConfirm';
import { Icons } from '../common/Icons';
import { motion, AnimatePresence } from 'framer-motion';
import { FarmType } from '../../types';

interface StatisticsFormProps {
    onNavigate?: (view: string) => void;
}

interface ProductFormState {
    production: string;
    productionKg: string;
    previousBalance: string;
    previousBalanceKg: string;
}

const StatisticsForm: React.FC<StatisticsFormProps> = ({ onNavigate }) => {
    const { user } = useAuthStore();
    const { getProductById } = useFarmStore();
    const { statistics, bulkUpsertStatistics } = useStatisticsStore();
    const { invoices } = useInvoiceStore();
    const { addToast } = useToastStore();
    const { confirm } = useConfirm();
    
    const [formsState, setFormsState] = useState<Record<string, ProductFormState>>({});
    const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentTime, setCurrentTime] = useState(getCurrentTime(false));

    const todayJalali = getTodayJalali();
    const todayDayName = getTodayDayName();
    const normalizedDate = normalizeDate(todayJalali);

    const userFarms = user?.assignedFarms || [];
    const [selectedFarmId] = useState<string>(userFarms[0]?.id || '');
    const selectedFarm = userFarms.find(f => f.id === selectedFarmId);

    // --- SORT LOGIC START ---
    const sortedProductIds = useMemo(() => {
        if (!selectedFarm) return [];
        return [...selectedFarm.productIds].sort((aId, bId) => {
            const pA = getProductById(aId);
            const pB = getProductById(bId);
            if (!pA || !pB) return 0;
            
            const getScore = (name: string) => {
                if (name.includes('شیرینگ') || name.includes('شیرینک')) {
                    if (name.includes('پرینتی')) return 1; 
                    return 2; 
                }
                if (name.includes('پرینتی')) return 3;
                if (name.includes('ساده')) return 4;
                if (name.includes('دوزرده')) return 5;
                if (name.includes('نوکی')) return 6;
                if (name.includes('کودی')) return 7;
                if (name.includes('مایع')) return 8;
                return 9; 
            };
            return getScore(pA.name) - getScore(pB.name);
        });
    }, [selectedFarm, getProductById]);
    // --- SORT LOGIC END ---

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(getCurrentTime(false)), 30000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!selectedFarm) return;
        const newState: Record<string, ProductFormState> = {};
        selectedFarm.productIds.forEach(pid => {
            const record = statistics.find(s => s.farmId === selectedFarmId && s.date === normalizedDate && s.productId === pid);
            const fmt = (val: any) => (val === undefined || val === null || val === 0) ? '' : String(val);
            newState[pid] = {
                production: fmt(record?.production),
                productionKg: fmt(record?.productionKg),
                previousBalance: fmt(record?.previousBalance),
                previousBalanceKg: fmt(record?.previousBalanceKg)
            };
        });
        setFormsState(newState);
    }, [selectedFarmId, statistics, selectedFarm, normalizedDate]);

    const handleInputChange = (productId: string, field: keyof ProductFormState, value: string) => {
        let cleanVal = '';
        if (field === 'production' || field === 'previousBalance') {
            cleanVal = value.replace(/[^0-9]/g, '');
        } else {
            cleanVal = value.replace(/[^0-9.]/g, '');
        }
        setFormsState(prev => ({ ...prev, [productId]: { ...prev[productId], [field]: cleanVal } }));
    };

    const handleFinalSubmit = async () => {
        if (!selectedFarm) return;
        const isMotefereghe = selectedFarm.type === FarmType.MOTEFEREGHE;
        const payloads = [];

        for (const pid of selectedFarm.productIds) {
            if (statistics.some(s => s.farmId === selectedFarmId && s.date === normalizedDate && s.productId === pid)) continue;
            
            const vals = formsState[pid];
            if (!vals) continue;

            const inputVal = vals.production === '' ? 0 : Number(vals.production);
            const inputValKg = vals.productionKg === '' ? 0 : Number(vals.productionKg);
            
            const prev = vals.previousBalance === '' ? 0 : Number(vals.previousBalance);
            const prevKg = vals.previousBalanceKg === '' ? 0 : Number(vals.previousBalanceKg);

            if (vals.production === '' && vals.productionKg === '' && vals.previousBalance === '' && vals.previousBalanceKg === '') continue;

            const prodName = getProductById(pid)?.name || 'محصول';
            
            if (inputVal > 10000) {
                addToast(`خطا: عدد وارد شده برای ${isMotefereghe ? 'موجودی' : 'تولید'} محصول "${prodName}" (${toPersianDigits(inputVal)}) غیرمتعارف است.`, 'error');
                return;
            }
            if (inputValKg > 150000) { 
                 addToast(`خطا: وزن وارد شده برای محصول "${prodName}" (${toPersianDigits(inputValKg)}) غیرمتعارف است.`, 'error');
                 return;
            }

            const relevantInvoices = invoices.filter(inv => inv.farmId === selectedFarmId && inv.date === normalizedDate && inv.productId === pid);
            const totalSales = relevantInvoices.reduce((sum, inv) => sum + (inv.totalCartons || 0), 0);
            const totalSalesKg = relevantInvoices.reduce((sum, inv) => sum + (inv.totalWeight || 0), 0);

            let finalPrevious = prev;
            let finalProduction = inputVal;
            let finalCurrent = 0;

            let finalPreviousKg = prevKg;
            let finalProductionKg = inputValKg;
            let finalCurrentKg = 0;

            if (isMotefereghe) {
                finalPrevious = 0;
                finalPreviousKg = 0;
                finalCurrent = inputVal;
                finalCurrentKg = inputValKg;
                finalProduction = inputVal + totalSales;
                finalProductionKg = inputValKg + totalSalesKg;
            } else {
                finalCurrent = prev + inputVal - totalSales;
                finalCurrentKg = prevKg + inputValKg - totalSalesKg;
            }

            payloads.push({
                farmId: selectedFarmId,
                date: normalizedDate,
                productId: pid,
                production: finalProduction,
                productionKg: finalProductionKg,
                previousBalance: finalPrevious,
                previousBalanceKg: finalPreviousKg,
                sales: totalSales,
                salesKg: totalSalesKg,
                currentInventory: finalCurrent,
                currentInventoryKg: finalCurrentKg
            });
        }

        if (payloads.length === 0) {
            addToast('تغییری برای ثبت وجود ندارد.', 'warning');
            return;
        }

        const confirmed = await confirm({
            title: 'ثبت نهایی آمار',
            message: `آیا از ثبت آمار برای ${toPersianDigits(payloads.length)} محصول اطمینان دارید؟`,
            confirmText: 'بله، ثبت شود',
            type: 'info'
        });

        if (!confirmed) return;

        setIsSubmitting(true);
        const result = await bulkUpsertStatistics(payloads);
        setIsSubmitting(false);

        if (result.success) {
            addToast('آمار با موفقیت ثبت شد.', 'success');
            setExpandedProductId(null); // Collapse the list
        }
        else addToast(`خطا: ${result.error}`, 'error');
    };

    if (!selectedFarm) return <div className="p-20 text-center font-bold text-gray-400">فارمی یافت نشد.</div>;

    const isMotefereghe = selectedFarm.type === FarmType.MOTEFEREGHE;
    
    const inputClasses = "w-full p-3 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 text-center font-black text-3xl text-gray-900 dark:text-white rounded-xl focus:border-metro-orange focus:ring-4 focus:ring-orange-100 dark:focus:ring-orange-900/20 outline-none h-16 transition-all shadow-sm";

    return (
        <div className="max-w-4xl mx-auto pb-24"> 
            <div className="bg-gradient-to-br from-metro-orange via-orange-500 to-amber-500 p-6 text-white shadow-xl relative overflow-hidden flex flex-col items-center justify-center gap-3 rounded-b-[32px] mb-8 border-b-4 border-orange-700/20 gpu-accelerated">
                 <div className="absolute inset-0 shimmer-bg z-0"></div>
                 <Icons.BarChart className="absolute -left-8 -bottom-8 w-48 h-48 text-white opacity-10 pointer-events-none rotate-12" />

                 <div className="relative z-10 flex flex-col items-center w-full">
                     <div className="flex items-center gap-3 mb-1">
                        <span className="text-orange-100 font-bold text-sm tracking-widest uppercase bg-black/10 px-3 py-0.5 rounded-full backdrop-blur-sm">
                             {todayDayName}
                        </span>
                        <div className="text-xl font-bold opacity-90 font-sans tabular-nums tracking-wide">{currentTime}</div>
                     </div>
                     
                     <div className="flex items-center gap-4">
                         <h1 className="text-5xl lg:text-6xl font-black font-sans tabular-nums tracking-tighter drop-shadow-lg leading-none">
                             {toPersianDigits(normalizedDate)}
                         </h1>
                     </div>
                     
                     <div className="mt-3 text-white font-black tracking-wide text-lg border-b-2 border-white/20 pb-1">
                        ثبت آمار تولید
                     </div>
                 </div>
            </div>

            <div className="px-4 space-y-4">
                {sortedProductIds.map((pid) => {
                    const product = getProductById(pid);
                    if (!product) return null;

                    const isLiq = product.name.includes('مایع');
                    const statRecord = statistics.find(s => s.farmId === selectedFarmId && s.date === normalizedDate && s.productId === pid);
                    const isRegistered = !!statRecord;
                    const vals = formsState[pid] || { production: '', productionKg: '', previousBalance: '', previousBalanceKg: '' };
                    const isExpanded = expandedProductId === pid;

                    const productInvoices = invoices.filter(inv => inv.farmId === selectedFarmId && inv.date === normalizedDate && inv.productId === pid);
                    const soldUnits = productInvoices.reduce((sum, inv) => sum + (inv.totalCartons || 0), 0);
                    const soldKg = productInvoices.reduce((sum, inv) => sum + (inv.totalWeight || 0), 0);

                    return (
                        <div key={pid} className={`relative bg-white dark:bg-gray-800 rounded-[20px] shadow-sm overflow-hidden border-r-[8px] transition-transform duration-200 gpu-accelerated ${isRegistered ? 'border-green-500' : 'border-red-500'}`}>
                            <div 
                                onClick={() => setExpandedProductId(isExpanded ? null : pid)} 
                                className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 active:bg-gray-100"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full shadow-sm ring-2 ${isRegistered ? 'bg-green-100 ring-green-50 text-green-600' : 'bg-red-100 ring-red-50 text-red-600'}`}>
                                        {isRegistered ? <Icons.Check className="w-5 h-5" /> : <Icons.X className="w-5 h-5" />}
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 leading-tight">{product.name}</h3>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md mt-1 inline-block ${isRegistered ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                            {isRegistered ? 'ثبت شده' : 'ثبت نشده'}
                                        </span>
                                    </div>
                                </div>
                                <Icons.ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                            
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div 
                                        initial={{ height: 0, opacity: 0 }} 
                                        animate={{ height: 'auto', opacity: 1 }} 
                                        exit={{ height: 0, opacity: 0 }} 
                                        transition={{ duration: 0.2, ease: "easeOut" }}
                                        className="bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700"
                                    >
                                        <div className="p-5 space-y-5">
                                            
                                            {!isMotefereghe && (
                                                <div className="flex gap-3">
                                                    <div className="flex-1 bg-red-50 dark:bg-red-900/10 p-3 rounded-xl border border-red-100 dark:border-red-900/20 text-center">
                                                        <span className="block text-gray-500 dark:text-gray-400 text-sm font-bold mb-1">فروش حواله (تعداد)</span>
                                                        <span className="text-xl font-black text-red-600 tracking-tight">{toPersianDigits(soldUnits)}</span>
                                                    </div>
                                                    {isLiq && (
                                                        <div className="flex-1 bg-orange-50 dark:bg-orange-900/10 p-3 rounded-xl border border-orange-100 dark:border-orange-900/20 text-center">
                                                            <span className="block text-gray-500 dark:text-gray-400 text-sm font-bold mb-1">فروش حواله (Kg)</span>
                                                            <span className="text-xl font-black text-orange-600 tracking-tight">{toPersianDigits(soldKg)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className={`space-y-5 ${isRegistered ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                                                <div className="space-y-3">
                                                    <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-metro-orange"></span>
                                                        اطلاعات تعداد (کارتن)
                                                    </h4>
                                                    <div className={`grid gap-3 ${isMotefereghe ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                                        
                                                        {!isMotefereghe && (
                                                            <div>
                                                                <label className="block text-sm font-bold mb-1.5 text-gray-400 pr-1">موجودی قبل</label>
                                                                <input type="tel" inputMode="numeric" value={vals.previousBalance} onChange={e => handleInputChange(pid, 'previousBalance', e.target.value)} className={inputClasses} placeholder="" />
                                                            </div>
                                                        )}
                                                        
                                                        <div>
                                                            <label className="block text-sm font-bold mb-1.5 text-gray-400 pr-1">
                                                                {isMotefereghe ? 'موجودی اعلامی (روز)' : 'تولید روز'}
                                                            </label>
                                                            <input type="tel" inputMode="numeric" value={vals.production} onChange={e => handleInputChange(pid, 'production', e.target.value)} className={inputClasses} placeholder="" />
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* CONDITIONAL RENDERING FOR WEIGHT ROW - TASK 5 */}
                                                {isLiq && (
                                                    <div className="space-y-3 pt-3 border-t border-dashed border-gray-200 dark:border-gray-700">
                                                        <h4 className="text-sm font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-metro-blue"></span>
                                                            اطلاعات وزن (کیلوگرم)
                                                        </h4>
                                                        <div className={`grid gap-3 ${isMotefereghe ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                                            {!isMotefereghe && (
                                                                <div>
                                                                    <label className="block text-sm font-bold mb-1.5 text-gray-400 pr-1">وزن قبل</label>
                                                                    <input type="tel" inputMode="decimal" value={vals.previousBalanceKg} onChange={e => handleInputChange(pid, 'previousBalanceKg', e.target.value)} className={`${inputClasses} border-blue-100 dark:border-blue-900/30 focus:border-metro-blue focus:ring-blue-100 dark:focus:ring-blue-900/20`} placeholder="" />
                                                                </div>
                                                            )}
                                                            <div>
                                                                <label className="block text-sm font-bold mb-1.5 text-gray-400 pr-1">
                                                                    {isMotefereghe ? 'موجودی اعلامی (وزن)' : 'تولید روز (وزن)'}
                                                                </label>
                                                                <input type="tel" inputMode="decimal" value={vals.productionKg} onChange={e => handleInputChange(pid, 'productionKg', e.target.value)} className={`${inputClasses} border-blue-100 dark:border-blue-900/30 focus:border-metro-blue focus:ring-blue-100 dark:focus:ring-blue-900/20`} placeholder="" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {isRegistered && (
                                                <div className="flex items-center justify-center gap-2 text-green-700 text-base font-black bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border border-green-200 dark:border-green-900/30">
                                                    <Icons.Check className="w-6 h-6" /> اطلاعات ثبت شده است
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>

            <div className="px-4 mt-8">
                <Button onClick={handleFinalSubmit} isLoading={isSubmitting} className="w-full h-20 text-2xl lg:text-3xl font-black bg-gradient-to-r from-metro-green to-emerald-600 hover:to-emerald-500 shadow-lg shadow-green-200 dark:shadow-none rounded-[20px] border-b-4 border-green-700 active:border-b-0 active:translate-y-1 transition-all">
                    <Icons.Check className="ml-2 w-10 h-10" /> ثبت نهایی آمار
                </Button>
            </div>
        </div>
    );
};

export default StatisticsForm;
