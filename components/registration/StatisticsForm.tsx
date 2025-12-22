
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useFarmStore } from '../../store/farmStore';
import { useStatisticsStore } from '../../store/statisticsStore';
import { useToastStore } from '../../store/toastStore';
import { useThemeStore } from '../../store/themeStore';
import { FarmType, UserRole } from '../../types';
import { THEMES } from '../../constants';
import { getTodayJalali, getTodayDayName, getCurrentTime, normalizeDate, toPersianDigits } from '../../utils/dateUtils';
import Button from '../common/Button';
import { useConfirm } from '../../hooks/useConfirm';
import { Icons } from '../common/Icons';
import { motion, AnimatePresence } from 'framer-motion';

interface StatisticsFormProps {
    onNavigate?: (view: string) => void;
}

interface ProductFormState {
    production: string;
    productionKg: string;
    sales: string;
    salesKg: string;
    previousBalance: string;
    previousBalanceKg: string;
}

const StatisticsForm: React.FC<StatisticsFormProps> = ({ onNavigate }) => {
    const { user } = useAuthStore();
    const { getProductById } = useFarmStore();
    const { statistics, bulkUpsertStatistics, fetchStatistics } = useStatisticsStore();
    const { addToast } = useToastStore();
    const theme = useThemeStore(state => state.theme);
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

    const role = user?.role || UserRole.REGISTRATION;
    const isMotefereghe = selectedFarm?.type === FarmType.MOTEFEREGHE;

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(getCurrentTime(false)), 30000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        fetchStatistics();
    }, [fetchStatistics]);

    useEffect(() => {
        if (!selectedFarm) return;

        const newState: Record<string, ProductFormState> = {};
        selectedFarm.productIds.forEach(pid => {
            const record = statistics.find(s => s.farmId === selectedFarmId && s.date === normalizedDate && s.productId === pid);
            newState[pid] = {
                // If record exists, show it. If not, empty string (no default 0).
                production: record?.production !== undefined ? String(record.production) : '',
                productionKg: record?.productionKg !== undefined ? String(record.productionKg) : '',
                sales: record?.sales !== undefined ? String(record.sales) : '',
                salesKg: record?.salesKg !== undefined ? String(record.salesKg) : '',
                previousBalance: record?.previousBalance !== undefined ? String(record.previousBalance) : '',
                previousBalanceKg: record?.previousBalanceKg !== undefined ? String(record.previousBalanceKg) : ''
            };
        });
        setFormsState(newState);
    }, [selectedFarmId, statistics.length, selectedFarm]);

    const handleInputChange = (productId: string, field: keyof ProductFormState, value: string) => {
        if (Number(value) < 0) return;
        setFormsState(prev => ({
            ...prev,
            [productId]: { ...prev[productId], [field]: value }
        }));
    };

    const handleFinalSubmit = async () => {
        if (!selectedFarm) return;

        const registeredProductIds = statistics
            .filter(s => s.farmId === selectedFarmId && s.date === normalizedDate)
            .map(s => s.productId);

        const payloads = [];
        for (const pid of selectedFarm.productIds) {
            if (registeredProductIds.includes(pid)) continue;
            
            const vals = formsState[pid];
            if (!vals) continue;

            const prod = vals.production === '' ? 0 : Number(vals.production);
            const prev = vals.previousBalance === '' ? 0 : Number(vals.previousBalance);
            const prodKg = vals.productionKg === '' ? 0 : Number(vals.productionKg);
            const prevKg = vals.previousBalanceKg === '' ? 0 : Number(vals.previousBalanceKg);
            
            // Sales are automatically calculated from invoices, so we submit 0 initially unless manually entered logic changes
            const sale = 0; 
            const saleKg = 0;

            // Skip empty submissions if user didn't touch anything
            if (vals.production === '' && vals.previousBalance === '' && vals.productionKg === '' && vals.previousBalanceKg === '') continue;

            const current = isMotefereghe ? prod : (prev + prod - sale);
            const currentKg = isMotefereghe ? prodKg : (prevKg + prodKg - saleKg);

            payloads.push({
                farmId: selectedFarmId,
                date: normalizedDate,
                productId: pid,
                previousBalance: isMotefereghe ? 0 : prev,
                production: prod,
                sales: sale, 
                currentInventory: current,
                previousBalanceKg: isMotefereghe ? 0 : prevKg,
                productionKg: prodKg,
                salesKg: saleKg,
                currentInventoryKg: currentKg
            });
        }

        if (payloads.length === 0) {
            addToast('تغییری برای ثبت وجود ندارد یا تمام محصولات قبلاً ثبت شده‌اند.', 'warning');
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
        } else {
            addToast(`خطا: ${result.error}`, 'error');
        }
    };

    if (!selectedFarm) return <div className="p-20 text-center font-bold text-gray-400">فارمی یافت نشد.</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-4 pb-12"> 
            <div className="bg-metro-orange p-8 text-white shadow-xl relative overflow-hidden flex flex-col items-center justify-center gap-4 border-b-8 border-orange-700/20">
                <div className="absolute inset-0 z-0 bg-gradient-to-r from-metro-orange via-amber-500 to-metro-orange bg-[length:200%_200%] animate-[gradient-xy_3s_ease_infinite]"></div>
                <Icons.BarChart className="absolute -right-12 -bottom-8 w-64 h-64 opacity-10 pointer-events-none rotate-12 animate-pulse" />
                
                <div className="relative z-10 flex justify-center items-center gap-4 text-xl font-bold bg-white/10 backdrop-blur-md px-8 py-3 w-full max-w-sm border-r-4 border-white shadow-lg transition-transform hover:scale-[1.02]">
                    <span className="opacity-90">{todayDayName}</span>
                    <div className="w-[2px] h-6 bg-white/30 rounded-full"></div>
                    <span className="font-sans tracking-tight text-3xl font-black drop-shadow-sm">{toPersianDigits(normalizedDate)}</span>
                </div>

                <div className="relative z-10 text-7xl font-black font-sans tabular-nums tracking-widest mt-2 drop-shadow-2xl flex items-center gap-2">
                    {currentTime}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 md:p-6 shadow-xl border-l-[12px] border-metro-orange rounded-xl space-y-4">
                {selectedFarm.productIds.map((pid) => {
                    const product = getProductById(pid);
                    const vals = formsState[pid] || { production: '', sales: '', previousBalance: '', productionKg: '', salesKg: '', previousBalanceKg: '' };
                    const isExpanded = expandedProductId === pid;
                    const isRegistered = statistics.some(s => s.farmId === selectedFarmId && s.date === normalizedDate && s.productId === pid);
                    
                    const num = (v: string) => v === '' ? 0 : Number(v);
                    
                    const currentInventory = isMotefereghe ? num(vals.production) : (num(vals.previousBalance) + num(vals.production) - num(vals.sales));
                    const isNegative = currentInventory < 0;

                    return (
                        <div key={pid} className={`bg-gray-50 dark:bg-gray-900/50 shadow-sm transition-all overflow-hidden border-r-[8px] rounded-lg ${isRegistered ? 'border-green-500 opacity-95' : 'border-metro-orange'}`}>
                            <div onClick={() => setExpandedProductId(isExpanded ? null : pid)} className={`p-4 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 ${isExpanded ? 'bg-orange-50 dark:bg-orange-900/10' : ''}`}>
                                <div className="flex items-center gap-4 flex-1 overflow-hidden">
                                    <div className={`w-3 h-3 min-w-[12px] rounded-full shadow-sm ${isRegistered ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}></div>
                                    <div className="flex flex-col">
                                        <h3 className="text-base font-black text-gray-800 dark:text-white truncate">{product?.name}</h3>
                                        {isRegistered && <span className="text-[10px] text-green-600 font-bold">ثبت شده</span>}
                                    </div>
                                </div>
                                <Icons.ChevronDown className={`w-6 h-6 transition-transform text-gray-400 shrink-0 ${isExpanded ? 'rotate-180 text-metro-orange' : ''}`} />
                            </div>

                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900/20">
                                        <div className={`space-y-6 ${isRegistered ? 'pointer-events-none grayscale-[0.5] opacity-70' : ''}`}>
                                            {isRegistered && (
                                                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border border-yellow-200 dark:border-yellow-800 text-center mb-4 flex flex-col gap-1">
                                                    <p className="text-xs text-yellow-800 dark:text-yellow-200 font-bold">این محصول قبلا ثبت شده است.</p>
                                                    <p className="text-[10px] text-yellow-700 dark:text-yellow-300 font-bold">(برای ویرایش به قسمت سوابق اخیر مراجعه کنید)</p>
                                                </div>
                                            )}
                                            {!isRegistered && isNegative && !isMotefereghe && <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-800 text-center animate-pulse"><p className="text-xs text-red-600 dark:text-red-300 font-bold">هشدار: موجودی منفی است</p></div>}
                                            
                                            <div className="space-y-4">
                                                <h4 className="text-sm font-black text-metro-orange flex items-center gap-2"><Icons.BarChart className="w-4 h-4" />کارتن</h4>
                                                <div className="flex items-end gap-3">
                                                     {!isMotefereghe && (
                                                         <div className="flex-1">
                                                            <label className="block text-xs font-bold text-gray-500 mb-1">موجودی قبل</label>
                                                            <input type="number" disabled={isRegistered} value={vals.previousBalance} onChange={e => handleInputChange(pid, 'previousBalance', e.target.value)} className="w-full p-2 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 text-center font-bold text-2xl rounded focus:border-metro-orange outline-none h-14" placeholder="" />
                                                         </div>
                                                     )}
                                                     
                                                     <div className="flex-1">
                                                        <label className="block text-xs font-bold text-green-600 mb-1">{isMotefereghe ? 'موجودی اعلامی' : 'تولید روز'}</label>
                                                        <input type="number" disabled={isRegistered} value={vals.production} onChange={e => handleInputChange(pid, 'production', e.target.value)} className="w-full p-2 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 text-center font-bold text-2xl rounded focus:border-metro-orange outline-none h-14" placeholder="" />
                                                     </div>
                                                     
                                                     {!isMotefereghe && (
                                                         <div className="flex-1 relative">
                                                            <label className="block text-xs font-bold text-red-600 mb-1">فروش (خودکار)</label>
                                                            <div className="relative">
                                                                <input 
                                                                    type="number" 
                                                                    disabled={true} 
                                                                    value={vals.sales} 
                                                                    className="w-full p-2 bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-red-200 dark:border-red-900 text-center font-bold text-2xl rounded text-gray-500 cursor-not-allowed h-14" 
                                                                    placeholder=""
                                                                />
                                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                                                                    <Icons.Lock className="w-6 h-6 text-red-500" />
                                                                </div>
                                                            </div>
                                                            <span className="text-[9px] text-gray-400 absolute -bottom-4 right-0 w-full text-center">محاسبه از حواله</span>
                                                         </div>
                                                     )}
                                                </div>
                                            </div>
                                            
                                            {product?.hasKilogramUnit && (
                                                <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                                    <h4 className="text-sm font-black text-metro-blue flex items-center gap-2"><Icons.HardDrive className="w-4 h-4" />کیلوگرم</h4>
                                                    <div className="flex items-end gap-3">
                                                         {!isMotefereghe && (
                                                             <div className="flex-1">
                                                                <label className="block text-xs font-bold text-gray-500 mb-1">قبل (Kg)</label>
                                                                <input type="number" step="0.1" disabled={isRegistered} value={vals.previousBalanceKg} onChange={e => handleInputChange(pid, 'previousBalanceKg', e.target.value)} className="w-full p-2 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 text-center font-bold text-2xl rounded focus:border-metro-blue outline-none h-14" placeholder="" />
                                                             </div>
                                                         )}
                                                         <div className="flex-1">
                                                            <label className="block text-xs font-bold text-green-600 mb-1">{isMotefereghe ? 'موجودی (Kg)' : 'تولید (Kg)'}</label>
                                                            <input type="number" step="0.1" disabled={isRegistered} value={vals.productionKg} onChange={e => handleInputChange(pid, 'productionKg', e.target.value)} className="w-full p-2 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 text-center font-bold text-2xl rounded focus:border-metro-blue outline-none h-14" placeholder="" />
                                                         </div>
                                                         
                                                         {!isMotefereghe && (
                                                             <div className="flex-1 relative">
                                                                <label className="block text-xs font-bold text-red-600 mb-1">فروش (Kg)</label>
                                                                <div className="relative">
                                                                    <input 
                                                                        type="number" 
                                                                        step="0.1" 
                                                                        disabled={true} 
                                                                        value={vals.salesKg} 
                                                                        className="w-full p-2 bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-red-200 dark:border-red-900 text-center font-bold text-2xl rounded text-gray-500 cursor-not-allowed h-14" 
                                                                        placeholder=""
                                                                    />
                                                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                                                                        <Icons.Lock className="w-6 h-6 text-red-500" />
                                                                    </div>
                                                                </div>
                                                             </div>
                                                         )}
                                                    </div>
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

            <div className="flex justify-center pt-8 pb-4">
                <Button onClick={handleFinalSubmit} isLoading={isSubmitting} className="w-full max-w-md h-16 text-2xl font-black bg-metro-green hover:bg-green-600 shadow-xl">
                    ثبت نهایی آمار
                    <Icons.Check className="mr-2 w-8 h-8" />
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

export default StatisticsForm;
