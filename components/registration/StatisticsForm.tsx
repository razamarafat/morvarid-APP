
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useFarmStore } from '../../store/farmStore';
import { useStatisticsStore } from '../../store/statisticsStore';
import { useToastStore } from '../../store/toastStore';
import { useThemeStore } from '../../store/themeStore';
import { FarmType, ProductUnit, UserRole } from '../../types';
import { THEMES } from '../../constants';
import { getTodayJalali, getTodayDayName, getCurrentTime, normalizeDate, toPersianDigits } from '../../utils/dateUtils';
import Button from '../common/Button';
import { useConfirm } from '../../hooks/useConfirm';
import { Icons } from '../common/Icons';
import { motion, AnimatePresence } from 'framer-motion';

interface StatisticsFormProps {
    onNavigate?: (view: string) => void;
}

// Local state structure for holding form values before bulk submit
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
    
    // State to hold all form values: { [productId]: ProductFormState }
    const [formsState, setFormsState] = useState<Record<string, ProductFormState>>({});
    const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentTime, setCurrentTime] = useState(getCurrentTime(false)); // False = No seconds

    const todayJalali = getTodayJalali();
    const todayDayName = getTodayDayName();
    const normalizedDate = normalizeDate(todayJalali);

    const userFarms = user?.assignedFarms || [];
    const [selectedFarmId] = useState<string>(userFarms[0]?.id || '');
    const selectedFarm = userFarms.find(f => f.id === selectedFarmId);

    const role = user?.role || UserRole.REGISTRATION;
    const themeColors = THEMES[theme][role];

    // Update time every minute
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(getCurrentTime(false)), 30000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        fetchStatistics();
    }, [fetchStatistics]);

    // Initialize local state from existing statistics when loaded
    useEffect(() => {
        if (!selectedFarm) return;

        const newState: Record<string, ProductFormState> = {};
        selectedFarm.productIds.forEach(pid => {
            const record = statistics.find(s => s.farmId === selectedFarmId && s.date === normalizedDate && s.productId === pid);
            
            // Logic: If record exists, show value. If not, show empty string.
            // Note: Even if record exists, we will DISABLE the inputs in the UI so user can't edit here.
            newState[pid] = {
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
        // Prevent negative values manually as well
        if (Number(value) < 0) return;
        
        setFormsState(prev => ({
            ...prev,
            [productId]: {
                ...prev[productId],
                [field]: value
            }
        }));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Prevent negative signs, 'e', etc.
        if (['-', '+', 'e', 'E'].includes(e.key)) {
            e.preventDefault();
        }
    };

    const handleFinalSubmit = async () => {
        if (!selectedFarm) return;

        // 1. Identify which products are ALREADY registered
        const registeredProductIds = statistics
            .filter(s => s.farmId === selectedFarmId && s.date === normalizedDate)
            .map(s => s.productId);

        const payloads = [];
        let skippedCount = 0;

        // 2. Build payload ONLY for products that are NOT registered yet and have data
        for (const pid of selectedFarm.productIds) {
            // If already registered, SKIP immediately
            if (registeredProductIds.includes(pid)) {
                skippedCount++;
                continue;
            }

            const vals = formsState[pid];
            if (!vals) continue;

            // Check if user entered any data for this new product
            const hasData = vals.production || vals.sales || vals.previousBalance || 
                            vals.productionKg || vals.salesKg || vals.previousBalanceKg;

            if (!hasData) continue;

            // Use 0 if empty string for DB calculation
            const prod = vals.production === '' ? 0 : Number(vals.production);
            const sale = vals.sales === '' ? 0 : Number(vals.sales);
            const prev = vals.previousBalance === '' ? 0 : Number(vals.previousBalance);
            
            const prodKg = vals.productionKg === '' ? 0 : Number(vals.productionKg);
            const saleKg = vals.salesKg === '' ? 0 : Number(vals.salesKg);
            const prevKg = vals.previousBalanceKg === '' ? 0 : Number(vals.previousBalanceKg);

            // --- LOGICAL VALIDATION START ---
            const product = getProductById(pid);
            const productName = product?.name || 'محصول';

            // Only apply inventory logic checks for standard farms (MORVARIDI)
            // Or apply generally if logic dictates 'sales' cannot happen without 'stock'
            if (selectedFarm.type !== FarmType.MOTEFEREGHE) {
                // Check Cartons
                const availableStock = prev + prod;
                if (sale > availableStock) {
                    addToast(`خطا در ${productName}: تعداد فروش (${sale}) نمی‌تواند بیشتر از مجموع تولید و موجودی قبل (${availableStock}) باشد.`, 'error');
                    return; // Stop execution
                }

                // Check Kg
                if (product?.hasKilogramUnit) {
                    const availableStockKg = prevKg + prodKg;
                    // Allow a small margin of error for float calculations if needed, but strict is better for now
                    if (saleKg > availableStockKg) {
                        addToast(`خطا در ${productName}: وزن فروش (${saleKg}) نمی‌تواند بیشتر از مجموع تولید و موجودی قبل (${availableStockKg}) باشد.`, 'error');
                        return; // Stop execution
                    }
                }
            }
            // --- LOGICAL VALIDATION END ---

            const current = selectedFarm?.type === FarmType.MOTEFEREGHE ? prod : (prev + prod - sale);
            const currentKg = selectedFarm?.type === FarmType.MOTEFEREGHE ? prodKg : (prevKg + prodKg - saleKg);

            // Double check for negative inventory just in case
            if (current < 0 || currentKg < 0) {
                 addToast(`خطا در ${productName}: موجودی نهایی نمی‌تواند منفی باشد.`, 'error');
                 return;
            }

            payloads.push({
                farmId: selectedFarmId,
                date: normalizedDate,
                productId: pid,
                previousBalance: prev,
                production: prod,
                sales: sale,
                currentInventory: current,
                previousBalanceKg: prevKg,
                productionKg: prodKg,
                salesKg: saleKg,
                currentInventoryKg: currentKg
            });
        }

        // 3. Logic handling for various scenarios
        if (payloads.length === 0) {
            if (skippedCount > 0) {
                // User clicked submit but all valid items were already registered
                addToast('محصولات وارد شده قبلاً ثبت شده‌اند. برای تغییر مقادیر لطفا به منوی "سوابق اخیر" مراجعه کنید.', 'info');
            } else {
                // User clicked submit without entering any data
                addToast('تغییری برای ثبت وجود ندارد. لطفا مقادیر محصولات جدید را وارد کنید.', 'warning');
            }
            return;
        }

        // 4. Confirm and Submit
        const confirmed = await confirm({
            title: 'ثبت نهایی آمار',
            message: `آیا از ثبت آمار برای ${toPersianDigits(payloads.length)} محصول جدید اطمینان دارید؟`,
            confirmText: 'بله، ثبت شود',
            cancelText: 'بازگشت',
            type: 'info'
        });

        if (!confirmed) return;

        setIsSubmitting(true);
        const result = await bulkUpsertStatistics(payloads);
        setIsSubmitting(false);

        if (result.success) {
            addToast(`آمار ${toPersianDigits(payloads.length)} محصول جدید با موفقیت ثبت شد.`, 'success');
            // We do NOT navigate away, allowing user to see status change to green
        } else {
            addToast('خطا در ثبت آمار: ' + result.error, 'error');
        }
    };

    if (!selectedFarm) return <div className="p-20 text-center font-bold text-gray-400">فارمی یافت نشد.</div>;

    const farmProducts = selectedFarm.productIds.map(pid => getProductById(pid)).filter(Boolean);

    return (
        <div className="max-w-4xl mx-auto space-y-4 pb-12"> 
             {/* Updated Header - Animated Background */}
            <div className="bg-metro-orange p-8 text-white shadow-xl relative overflow-hidden flex flex-col items-center justify-center gap-4 border-b-8 border-orange-700/20">
                {/* Continuous Animated Background */}
                <div className="absolute inset-0 z-0 bg-gradient-to-r from-metro-orange via-amber-500 to-metro-orange bg-[length:200%_200%] animate-[gradient-xy_3s_ease_infinite]"></div>

                {/* Decorative Background Icon */}
                <Icons.BarChart className="absolute -right-12 -bottom-8 w-64 h-64 opacity-10 pointer-events-none rotate-12" />
                
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

            {/* Container with Vertical Orange Line */}
            <div className="bg-white dark:bg-gray-800 p-4 md:p-6 shadow-xl border-l-[12px] border-metro-orange rounded-xl space-y-4">
                {farmProducts.map((product) => {
                    const pid = product!.id;
                    const vals = formsState[pid] || { production: '', sales: '', previousBalance: '', productionKg: '', salesKg: '', previousBalanceKg: '' };
                    const isExpanded = expandedProductId === pid;
                    
                    // Check if record exists
                    const record = statistics.find(s => s.farmId === selectedFarmId && s.date === normalizedDate && s.productId === pid);
                    const isRegistered = !!record;

                    // Calculate inventory for display
                    const num = (v: string) => v === '' ? 0 : Number(v);
                    const currentInventory = selectedFarm.type === FarmType.MOTEFEREGHE ? num(vals.production) : (num(vals.previousBalance) + num(vals.production) - num(vals.sales));
                    const currentInventoryKg = selectedFarm.type === FarmType.MOTEFEREGHE ? num(vals.productionKg) : (num(vals.previousBalanceKg) + num(vals.productionKg) - num(vals.salesKg));
                    
                    // Check logic for red highlighting in UI (Visual feedback before submit)
                    const isNegative = currentInventory < 0;

                    return (
                        <div key={pid} className={`bg-gray-50 dark:bg-gray-900/50 shadow-sm transition-all overflow-hidden border-r-[8px] rounded-lg ${isRegistered ? 'border-green-500 opacity-95' : 'border-metro-orange'}`}>
                            <div 
                                onClick={() => setExpandedProductId(isExpanded ? null : pid)}
                                className={`p-4 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 ${isExpanded ? 'bg-orange-50 dark:bg-orange-900/10' : ''}`}
                            >
                                <div className="flex items-center gap-4 flex-1 overflow-hidden">
                                    {/* Status Indicator */}
                                    <div className={`w-3 h-3 min-w-[12px] rounded-full shadow-sm ${isRegistered ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}></div>
                                    <div className="flex flex-col">
                                        <h3 className="text-base font-black text-gray-800 dark:text-white truncate">{product!.name}</h3>
                                        {isRegistered && <span className="text-[10px] text-green-600 font-bold">ثبت شده</span>}
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    {isRegistered && onNavigate && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onNavigate('recent'); }}
                                            className="text-xs bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shadow-sm"
                                        >
                                            ویرایش
                                        </button>
                                    )}
                                    <Icons.ChevronDown className={`w-6 h-6 transition-transform text-gray-400 shrink-0 ${isExpanded ? 'rotate-180 text-metro-orange' : ''}`} />
                                </div>
                            </div>

                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div 
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900/20"
                                    >
                                        <div className={`space-y-6 ${isRegistered ? 'pointer-events-none grayscale-[0.5] opacity-70' : ''}`}>
                                            {/* Disclaimer for Registered Items */}
                                            {isRegistered && (
                                                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border border-yellow-200 dark:border-yellow-800 text-center mb-4">
                                                    <p className="text-xs text-yellow-800 dark:text-yellow-200 font-bold">
                                                        این محصول قبلا ثبت شده است. جهت تغییر مقادیر به منوی "سوابق اخیر" مراجعه کنید.
                                                    </p>
                                                </div>
                                            )}

                                            {/* Visual Alert for Negative Inventory */}
                                            {!isRegistered && isNegative && selectedFarm.type !== FarmType.MOTEFEREGHE && (
                                                <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-800 text-center animate-pulse">
                                                    <p className="text-xs text-red-600 dark:text-red-300 font-bold flex items-center justify-center gap-2">
                                                        <Icons.AlertCircle className="w-4 h-4" />
                                                        هشدار: موجودی منفی شده است (فروش بیشتر از دارایی)
                                                    </p>
                                                </div>
                                            )}

                                            {/* UNIT SECTION */}
                                            <div className="space-y-4">
                                                <h4 className="text-sm font-black text-metro-orange flex items-center gap-2">
                                                    <Icons.BarChart className="w-4 h-4" />
                                                    کارتن
                                                </h4>
                                                <div className="flex items-end gap-3">
                                                     <div className="flex-1">
                                                        <label className="block text-xs font-bold text-gray-500 mb-1">موجودی قبل</label>
                                                        <input 
                                                            type="number" 
                                                            min="0"
                                                            disabled={isRegistered}
                                                            onKeyDown={handleKeyDown}
                                                            placeholder=""
                                                            value={vals.previousBalance} 
                                                            onChange={e => handleInputChange(pid, 'previousBalance', e.target.value)} 
                                                            className="w-full p-2 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 text-center font-bold text-2xl rounded focus:border-metro-orange outline-none h-14 placeholder-gray-300 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                                                        />
                                                     </div>
                                                     <div className="flex-1">
                                                        <label className="block text-xs font-bold text-green-600 mb-1">تولید</label>
                                                        <input 
                                                            type="number" 
                                                            min="0"
                                                            disabled={isRegistered}
                                                            onKeyDown={handleKeyDown}
                                                            placeholder=""
                                                            value={vals.production} 
                                                            onChange={e => handleInputChange(pid, 'production', e.target.value)} 
                                                            className="w-full p-2 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 text-center font-bold text-2xl rounded focus:border-metro-orange outline-none h-14 placeholder-gray-300 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                                                        />
                                                     </div>
                                                     <div className="flex-1">
                                                        <label className="block text-xs font-bold text-red-600 mb-1">فروش</label>
                                                        <input 
                                                            type="number" 
                                                            min="0"
                                                            disabled={isRegistered}
                                                            onKeyDown={handleKeyDown}
                                                            placeholder=""
                                                            value={vals.sales} 
                                                            onChange={e => handleInputChange(pid, 'sales', e.target.value)} 
                                                            className="w-full p-2 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 text-center font-bold text-2xl rounded focus:border-metro-orange outline-none h-14 placeholder-gray-300 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                                                        />
                                                     </div>
                                                </div>
                                                <div className={`bg-metro-orange/10 dark:bg-metro-orange/20 p-2 rounded text-center flex justify-between items-center px-4 transition-colors ${isNegative && !isRegistered ? 'bg-red-100 dark:bg-red-900/30 ring-2 ring-red-500' : ''}`}>
                                                    <span className={`text-xs font-bold ${isNegative ? 'text-red-600' : 'text-gray-600 dark:text-gray-300'}`}>موجودی نهایی:</span>
                                                    <span className={`text-2xl font-black ${isNegative ? 'text-red-600' : 'text-metro-orange'}`}>{toPersianDigits(currentInventory)}</span>
                                                </div>
                                            </div>

                                            {/* KG SECTION */}
                                            {product!.hasKilogramUnit && (
                                                <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                                    <h4 className="text-sm font-black text-metro-blue flex items-center gap-2">
                                                        <Icons.HardDrive className="w-4 h-4" />
                                                        کیلوگرم
                                                    </h4>
                                                    <div className="flex items-end gap-3">
                                                         <div className="flex-1">
                                                            <label className="block text-xs font-bold text-gray-500 mb-1">قبل (Kg)</label>
                                                            <input 
                                                                type="number" 
                                                                min="0"
                                                                step="0.1"
                                                                disabled={isRegistered}
                                                                onKeyDown={handleKeyDown}
                                                                placeholder=""
                                                                value={vals.previousBalanceKg} 
                                                                onChange={e => handleInputChange(pid, 'previousBalanceKg', e.target.value)} 
                                                                className="w-full p-2 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 text-center font-bold text-2xl rounded focus:border-metro-blue outline-none h-14 placeholder-gray-300 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                                                            />
                                                         </div>
                                                         <div className="flex-1">
                                                            <label className="block text-xs font-bold text-green-600 mb-1">تولید (Kg)</label>
                                                            <input 
                                                                type="number" 
                                                                min="0"
                                                                step="0.1"
                                                                disabled={isRegistered}
                                                                onKeyDown={handleKeyDown}
                                                                placeholder=""
                                                                value={vals.productionKg} 
                                                                onChange={e => handleInputChange(pid, 'productionKg', e.target.value)} 
                                                                className="w-full p-2 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 text-center font-bold text-2xl rounded focus:border-metro-blue outline-none h-14 placeholder-gray-300 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                                                            />
                                                         </div>
                                                         <div className="flex-1">
                                                            <label className="block text-xs font-bold text-red-600 mb-1">فروش (Kg)</label>
                                                            <input 
                                                                type="number" 
                                                                min="0"
                                                                step="0.1"
                                                                disabled={isRegistered}
                                                                onKeyDown={handleKeyDown}
                                                                placeholder=""
                                                                value={vals.salesKg} 
                                                                onChange={e => handleInputChange(pid, 'salesKg', e.target.value)} 
                                                                className="w-full p-2 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 text-center font-bold text-2xl rounded focus:border-metro-blue outline-none h-14 placeholder-gray-300 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                                                            />
                                                         </div>
                                                    </div>
                                                    <div className="bg-metro-blue/10 dark:bg-metro-blue/20 p-2 rounded text-center flex justify-between items-center px-4">
                                                        <span className="text-xs font-bold text-gray-600 dark:text-gray-300">موجودی نهایی (Kg):</span>
                                                        <span className="text-2xl font-black text-metro-blue">{toPersianDigits(currentInventoryKg.toFixed(1))}</span>
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

            {/* Consolidated Submit Button - Static at Bottom of List */}
            <div className="flex justify-center pt-8 pb-4 px-4">
                <Button 
                    onClick={handleFinalSubmit} 
                    isLoading={isSubmitting}
                    className="w-full max-w-md h-16 text-2xl font-black bg-metro-green hover:bg-green-600 shadow-xl rounded-xl"
                >
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
