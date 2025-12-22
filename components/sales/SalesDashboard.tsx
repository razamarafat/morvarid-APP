
import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../layout/DashboardLayout';
import { Icons } from '../common/Icons';
import Reports from '../admin/Reports';
import { useStatisticsStore } from '../../store/statisticsStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useFarmStore } from '../../store/farmStore';
import { useToastStore } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { useAlertStore } from '../../store/alertStore';
import { getTodayJalali, normalizeDate, toPersianDigits } from '../../utils/dateUtils';
import Button from '../common/Button';
import MetroTile from '../common/MetroTile';
import { motion, AnimatePresence } from 'framer-motion';
import { FarmType } from '../../types';

// Helper for product sorting
const sortProducts = (products: any[], aId: string, bId: string) => {
    const pA = products.find(p => p.id === aId);
    const pB = products.find(p => p.id === bId);
    if (!pA || !pB) return 0;

    const getScore = (name: string) => {
        if (name.includes('مایع')) return 6; // Last
        if (name.includes('دوزرده')) return 5;
        if (name.includes('نوکی')) return 4;
        if (name.includes('کودی')) return 3;
        // Printi comes before Simple
        if (name.includes('پرینتی')) return 1;
        return 2; // Simple/Others
    };

    const scoreA = getScore(pA.name);
    const scoreB = getScore(pB.name);

    return scoreA - scoreB;
};

const FarmStatistics = () => {
    const { statistics, fetchStatistics, subscribeToStatistics, isLoading } = useStatisticsStore();
    const { farms, products } = useFarmStore(); 
    const { invoices, fetchInvoices } = useInvoiceStore();
    const { addToast } = useToastStore();
    const { sendAlert } = useAlertStore();
    
    // Always use TODAY
    const todayJalali = getTodayJalali();
    const normalizedSelectedDate = normalizeDate(todayJalali);
    const [expandedFarmId, setExpandedFarmId] = useState<string | null>(null);
    const [alertLoading, setAlertLoading] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Initial Fetch & Realtime Subscription
    useEffect(() => {
        fetchStatistics();
        fetchInvoices();
        
        // Subscribe to real-time changes in statistics
        const unsubscribeStats = subscribeToStatistics();
        
        return () => {
            unsubscribeStats();
        };
    }, []);

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        await Promise.all([fetchStatistics(), fetchInvoices()]);
        setTimeout(() => setIsRefreshing(false), 500);
        addToast('اطلاعات بروزرسانی شد', 'success');
    };

    const handleSendAlert = async (farmId: string, farmName: string, e: React.MouseEvent) => {
        e.stopPropagation(); 
        setAlertLoading(farmId);
        
        const message = `عدم ثبت آمار برای فارم ${farmName} در تاریخ ${normalizedSelectedDate}`;
        const success = await sendAlert(farmId, farmName, message);

        if (success) {
            addToast(`هشدار آنی برای ${farmName} ارسال شد`, 'success');
        } else {
            addToast('خطا در ارسال هشدار', 'error');
        }
        setAlertLoading(null);
    };

    const toggleFarm = (farmId: string) => {
        setExpandedFarmId(expandedFarmId === farmId ? null : farmId);
    };

    const calculatePercent = (partial: number, total: number) => {
        if (total === 0) return 0;
        return Math.min(100, Math.max(0, (partial / total) * 100));
    };
    
    return (
        <div className="space-y-6 lg:space-y-8">
            <div className="bg-white dark:bg-gray-800 p-4 lg:p-6 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row gap-4 lg:gap-6 items-center justify-between rounded-[28px]">
                <div className="flex-1 w-full">
                    <h3 className="font-black text-gray-800 dark:text-white text-lg lg:text-2xl flex items-center flex-wrap">
                        مشاهده آمار‌های ثبت شده فارم‌ها - امروز 
                        <span className="shiny-text text-xl lg:text-3xl mr-4">{toPersianDigits(todayJalali)}</span>
                    </h3>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        onClick={handleManualRefresh} 
                        disabled={isRefreshing}
                        className="h-[52px] px-6 rounded-xl bg-metro-blue hover:bg-metro-cobalt font-bold text-lg"
                        title="بروزرسانی لیست"
                    >
                        <Icons.Refresh className={`w-5 h-5 ml-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                        بروزرسانی
                    </Button>
                    <div className="hidden md:flex items-center gap-3 text-sm lg:text-base text-gray-500 bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-xl font-bold h-[52px]">
                        <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                        اتصال زنده
                    </div>
                </div>
            </div>

            <div className="grid gap-4 lg:gap-6 animate-in slide-in-from-bottom-2 duration-500">
                {isLoading && statistics.length === 0 && <div className="text-center py-10 text-gray-500 dark:text-gray-400 font-bold lg:text-2xl">در حال همگام‌سازی...</div>}
                
                {farms.map(farm => {
                    const farmStats = statistics.filter(s => 
                        s.farmId === farm.id && 
                        normalizeDate(s.date) === normalizedSelectedDate
                    );
                    
                    // Custom Sorting Logic (Task 8)
                    const sortedFarmStats = [...farmStats].sort((a, b) => sortProducts(products, a.productId, b.productId));

                    const hasStats = farmStats.length > 0;
                    const isExpanded = expandedFarmId === farm.id;

                    return (
                        <div key={farm.id} className="group shadow-sm hover:shadow-xl transition-all duration-300 rounded-[28px] overflow-hidden border border-gray-200 dark:border-gray-700">
                            <div 
                                onClick={() => toggleFarm(farm.id)}
                                className={`p-5 lg:p-7 flex items-center justify-between cursor-pointer transition-colors border-r-[8px] ${
                                    hasStats 
                                        ? 'bg-white dark:bg-gray-800 border-green-500 hover:bg-gray-50 dark:hover:bg-gray-700/50' 
                                        : 'bg-white dark:bg-gray-800 border-red-500 hover:bg-red-50 dark:hover:bg-red-900/10'
                                }`}
                            >
                                <div className="flex items-center gap-4 lg:gap-6">
                                    <div className={`p-4 rounded-[20px] shadow-sm text-white ${hasStats ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-rose-600'}`}>
                                        <Icons.Home className="w-6 h-6 lg:w-8 lg:h-8" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-xl lg:text-3xl text-gray-800 dark:text-white mb-1">{farm.name}</h4>
                                        <span className={`text-sm lg:text-lg font-bold px-2 py-0.5 rounded-full ${hasStats ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                                            {hasStats ? 'آمار ثبت شده' : 'منتظر ثبت'}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-4 lg:gap-8">
                                    {hasStats && (
                                        <div className="hidden sm:flex flex-col items-end mr-4">
                                            <span className="text-xs lg:text-base text-gray-400 font-bold">محصولات</span>
                                            <span className="text-xl lg:text-4xl font-black text-metro-blue">{toPersianDigits(farmStats.length)}</span>
                                        </div>
                                    )}
                                    {/* Alert Button */}
                                    {!hasStats && (
                                        <Button 
                                            size="sm" 
                                            variant="danger" 
                                            onClick={(e) => handleSendAlert(farm.id, farm.name, e)}
                                            isLoading={alertLoading === farm.id}
                                            className="font-black lg:text-lg lg:h-12 lg:px-6 rounded-full"
                                        >
                                            <Icons.Bell className="w-4 h-4 lg:w-6 lg:h-6 ml-2" />
                                            ارسال هشدار
                                        </Button>
                                    )}
                                    <Icons.ChevronDown className={`w-6 h-6 lg:w-8 lg:h-8 text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>
                            </div>

                            <AnimatePresence>
                                {isExpanded && hasStats && (
                                    <motion.div 
                                        initial={{ height: 0, opacity: 0 }} 
                                        animate={{ height: 'auto', opacity: 1 }} 
                                        exit={{ height: 0, opacity: 0 }} 
                                        className="bg-gray-50 dark:bg-black/20 p-5 lg:p-8 border-t border-gray-200 dark:border-gray-700"
                                    >
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8">
                                            {sortedFarmStats.map(stat => {
                                                const p = products.find(prod => prod.id === stat.productId);
                                                
                                                // Logical Calculation
                                                const production = stat.production || 0;
                                                const prevBalance = stat.previousBalance || 0;
                                                const isMotefereghe = farm.type === FarmType.MOTEFEREGHE;
                                                
                                                // Calculate Sales Dynamically from Invoices Store
                                                const relevantInvoices = invoices.filter(inv => 
                                                    inv.farmId === farm.id && 
                                                    inv.productId === stat.productId && 
                                                    normalizeDate(inv.date) === normalizeDate(stat.date)
                                                );
                                                
                                                const calculatedSales = relevantInvoices.reduce((sum, inv) => sum + (inv.totalCartons || 0), 0);
                                                const sold = Math.max(calculatedSales, stat.sales || 0);

                                                const totalCapacity = isMotefereghe ? production : (prevBalance + production);
                                                const remaining = totalCapacity - sold;
                                                const soldPercent = calculatePercent(sold, totalCapacity);

                                                return (
                                                    <div key={stat.id} className="bg-white dark:bg-gray-700 rounded-[24px] p-5 lg:p-6 shadow-sm border border-gray-200 dark:border-gray-600 relative overflow-hidden transition-shadow hover:shadow-md">
                                                        {/* Header */}
                                                        <div className="flex justify-between items-start mb-4 relative z-10">
                                                            <div>
                                                                <h5 className="font-black text-xl lg:text-3xl text-gray-800 dark:text-white mb-1">{p?.name}</h5>
                                                                <span className="text-xs lg:text-sm bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-3 py-1 rounded-full font-bold">
                                                                    واحد: {p?.unit === 'CARTON' ? 'کارتن' : 'عدد'}
                                                                </span>
                                                            </div>
                                                            {/* Creator Info - Larger Text */}
                                                            <div className="text-left flex flex-col items-end">
                                                                <span className="text-xs lg:text-sm text-gray-400 font-bold mb-0.5">مسئول ثبت</span>
                                                                <span className="text-sm lg:text-base font-black text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded-lg">{stat.creatorName}</span>
                                                                <span className="text-xs lg:text-sm text-gray-500 mt-1 font-mono font-bold">{new Date(stat.createdAt).toLocaleTimeString('fa-IR')}</span>
                                                            </div>
                                                        </div>

                                                        {/* Visual Progress Bar */}
                                                        <div className="mb-6 relative h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                            <div 
                                                                className="absolute top-0 right-0 h-full bg-metro-orange rounded-full transition-all duration-1000 ease-out" 
                                                                style={{ width: `${soldPercent}%` }}
                                                            ></div>
                                                        </div>

                                                        {/* Redesigned Metrics Grid */}
                                                        <div className={`grid ${isMotefereghe ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-4'} gap-3 relative z-10`}>
                                                            
                                                            {!isMotefereghe && (
                                                                <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-2xl text-center border border-gray-100 dark:border-gray-600">
                                                                    <span className="block text-xs lg:text-sm font-bold text-gray-400 mb-1">موجودی قبل</span>
                                                                    <span className="text-2xl lg:text-3xl font-black text-gray-600 dark:text-gray-300">{toPersianDigits(prevBalance)}</span>
                                                                </div>
                                                            )}

                                                            <div className="bg-green-50 dark:bg-green-900/10 p-3 rounded-2xl text-center border border-green-100 dark:border-green-900/30">
                                                                <span className="block text-xs lg:text-sm font-bold text-green-600 mb-1">{isMotefereghe ? 'اعلامی روز' : 'تولید روز'}</span>
                                                                <span className="text-2xl lg:text-3xl font-black text-green-700 dark:text-green-400">{toPersianDigits(production)}</span>
                                                            </div>

                                                            <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-2xl text-center border border-red-100 dark:border-red-900/30">
                                                                <span className="block text-xs lg:text-sm font-bold text-red-500 mb-1">فروش رفته</span>
                                                                <span className="text-2xl lg:text-3xl font-black text-red-600">{toPersianDigits(sold)}</span>
                                                            </div>

                                                            <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-2xl text-center border border-blue-100 dark:border-blue-900/30">
                                                                <span className="block text-xs lg:text-sm font-bold text-blue-500 mb-1">موجودی</span>
                                                                <span className="text-2xl lg:text-3xl font-black text-blue-600 dark:text-blue-400">{toPersianDigits(remaining)}</span>
                                                            </div>
                                                        </div>

                                                        {/* Background Decoration */}
                                                        <Icons.BarChart className="absolute -left-4 -bottom-4 w-32 h-32 text-gray-50 dark:text-gray-600 opacity-20 rotate-12 pointer-events-none" />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const InvoiceList = () => {
    const { invoices, fetchInvoices } = useInvoiceStore();
    const { farms } = useFarmStore(); 
    const { addToast } = useToastStore();
    const [selectedFarmId, setSelectedFarmId] = useState<string>('all');
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // Always use TODAY
    const today = getTodayJalali();
    const normalizedFilterDate = normalizeDate(today);

    const filteredInvoices = invoices
        .filter(i => {
            const dateMatch = i.date === normalizedFilterDate;
            const farmMatch = selectedFarmId === 'all' || i.farmId === selectedFarmId;
            return dateMatch && farmMatch;
        })
        .sort((a, b) => b.createdAt - a.createdAt); 

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchInvoices();
        setTimeout(() => setIsRefreshing(false), 500);
        addToast('لیست حواله‌ها بروزرسانی شد', 'info');
    };

    const renderInvoiceNumber = (num: string) => {
        const strNum = toPersianDigits(num);
        if (strNum.length < 4) return <span className="text-gray-800 dark:text-gray-200 lg:text-xl">{strNum}</span>;
        const mainPart = strNum.slice(0, -4);
        const lastPart = strNum.slice(-4);
        return (
            <div className="flex justify-center items-center gap-0.5">
                <span className="text-gray-500 dark:text-gray-400 font-bold text-lg lg:text-xl">{mainPart}</span>
                <span className="text-black dark:text-white font-black text-xl lg:text-3xl">{lastPart}</span>
            </div>
        );
    };

    return (
        <div className="space-y-6 lg:space-y-8">
             <div className="bg-white dark:bg-gray-800 p-6 lg:p-8 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row gap-6 items-end rounded-[28px]">
                
                <div className="w-full flex-1">
                    <h3 className="font-black text-gray-800 dark:text-white text-lg lg:text-2xl mb-4 flex items-center flex-wrap">
                        مشاهده حواله‌های ثبت شده فارم‌ها - امروز 
                        <span className="shiny-text text-xl lg:text-3xl mr-4">{toPersianDigits(today)}</span>
                    </h3>
                    <label className="block text-sm lg:text-lg font-bold mb-2 text-gray-700 dark:text-gray-300 px-1">فیلتر بر اساس فارم</label>
                    <select 
                        className="w-full p-3 lg:p-4 border-2 border-gray-200 dark:border-gray-700 bg-white text-gray-900 dark:bg-gray-800 dark:text-white font-bold outline-none focus:border-metro-orange rounded-xl text-base lg:text-xl transition-colors"
                        value={selectedFarmId}
                        onChange={(e) => setSelectedFarmId(e.target.value)}
                    >
                        <option value="all">همه فارم‌های فعال</option>
                        {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                </div>
                
                <Button onClick={handleRefresh} disabled={isRefreshing} className="bg-metro-orange h-[50px] lg:h-[60px] px-8 font-black w-full md:w-auto text-lg lg:text-xl !rounded-xl">
                    <Icons.Refresh className={`w-5 h-5 lg:w-6 lg:h-6 ml-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    بروزرسانی لیست
                </Button>
            </div>

            {/* --- Mobile View (Cards) --- */}
            <div className="md:hidden space-y-4">
                {filteredInvoices.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 font-bold text-lg bg-white dark:bg-gray-800 rounded-[24px] shadow-sm">
                        <Icons.FileText className="w-12 h-12 mb-3 opacity-20 mx-auto" />
                        <span>هیچ حواله‌ای برای امروز ثبت نشده است.</span>
                    </div>
                ) : (
                    filteredInvoices.map(i => (
                        <div key={i.id} className="bg-white dark:bg-gray-800 p-5 rounded-[24px] shadow-sm border-l-8 border-metro-orange">
                            <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100 dark:border-gray-700">
                                <span className="text-xs font-bold text-gray-400">کد حواله</span>
                                <div className="flex gap-1" dir="ltr">{renderInvoiceNumber(i.invoiceNumber)}</div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <span className="text-xs font-bold text-gray-400 block mb-1">فارم</span>
                                    <span className="font-bold text-lg dark:text-white">{farms.find(f => f.id === i.farmId)?.name}</span>
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-gray-400 block mb-1">ساعت</span>
                                    <span className="font-mono font-bold text-lg dark:text-gray-300">
                                        {toPersianDigits(new Date(i.createdAt).toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'}))}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl mb-4">
                                <div className="text-center">
                                    <span className="block text-[10px] font-bold text-gray-500 mb-1">تعداد</span>
                                    <span className="font-black text-xl text-gray-800 dark:text-white">{toPersianDigits(i.totalCartons)}</span>
                                </div>
                                <div className="text-center border-r border-gray-200 dark:border-gray-600">
                                    <span className="block text-[10px] font-bold text-gray-500 mb-1">وزن</span>
                                    <span className="font-black text-xl text-metro-blue">{toPersianDigits(i.totalWeight)}</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500">
                                        <Icons.User className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-bold text-gray-600 dark:text-gray-300">{(i as any).creatorName}</span>
                                </div>
                                <span className={`px-3 py-1 text-xs font-black text-white rounded-full ${i.updatedAt ? 'bg-amber-500' : 'bg-metro-green'}`}>
                                    {i.updatedAt ? 'ویرایش شده' : 'عادی'}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* --- Desktop View (Table) --- */}
            <div className="hidden md:block bg-white dark:bg-gray-800 p-0 shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700 rounded-[24px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-base lg:text-lg text-right border-collapse min-w-[800px]">
                        <thead className="bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 whitespace-nowrap text-base lg:text-xl font-black">
                            <tr>
                                <th className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 text-center">رمز حواله</th>
                                <th className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">تاریخ خروج</th>
                                <th className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">فارم</th>
                                <th className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 text-center">تعداد (کارتن)</th>
                                <th className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">وزن (Kg)</th>
                                <th className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">وضعیت</th>
                                <th className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">مسئول ثبت</th>
                                <th className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 text-center">ساعت ثبت</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800 font-sans tabular-nums">
                            {filteredInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-12 lg:py-24 text-gray-400 font-bold lg:text-xl">
                                        <div className="flex flex-col items-center">
                                            <Icons.FileText className="w-12 h-12 lg:w-20 lg:h-20 mb-3 opacity-20" />
                                            <span>هیچ حواله‌ای برای امروز ثبت نشده است.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredInvoices.map(i => (
                                    <tr key={i.id} className="hover:bg-blue-50 dark:hover:bg-gray-700/50 transition-colors text-gray-800 dark:text-gray-200">
                                        <td className="px-6 py-5 text-center dir-ltr" dir="ltr">
                                            {renderInvoiceNumber(i.invoiceNumber)}
                                        </td>
                                        <td className="px-6 py-5 font-black whitespace-nowrap tracking-tighter text-lg lg:text-2xl">{toPersianDigits(i.date)}</td>
                                        <td className="px-6 py-5 whitespace-nowrap font-bold text-lg lg:text-xl">{farms.find(f => f.id === i.farmId)?.name}</td>
                                        <td className="px-6 py-5 text-center font-black text-lg lg:text-2xl">{toPersianDigits(i.totalCartons)}</td>
                                        <td className="px-6 py-5 font-black text-metro-blue text-lg lg:text-2xl">{toPersianDigits(i.totalWeight)}</td>
                                        <td className="px-6 py-5">
                                            <span className={`px-4 py-1.5 text-sm lg:text-base font-black text-white w-fit rounded-full ${i.updatedAt ? 'bg-amber-500' : 'bg-metro-green'}`}>
                                                {i.updatedAt ? 'ویرایش شده' : 'عادی'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap text-base lg:text-lg font-black text-gray-700 dark:text-gray-200">
                                            {(i as any).creatorName}
                                        </td>
                                        <td className="px-6 py-5 text-center whitespace-nowrap font-mono font-bold text-base lg:text-lg text-gray-600 dark:text-gray-400">
                                            {toPersianDigits(new Date(i.createdAt).toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'}))}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const AnalyticsView = () => {
    // ... AnalyticsView Logic same
    const { statistics } = useStatisticsStore();
    const { invoices } = useInvoiceStore();
    const { farms } = useFarmStore();
    const [range, setRange] = useState<number>(7);
    const [selectedFarmId, setSelectedFarmId] = useState<string>('all');

    const chartData = useMemo(() => {
        // ... (data calc logic)
        const allDates = new Set<string>();
        const relevantStats = statistics.filter(s => selectedFarmId === 'all' || s.farmId === selectedFarmId);
        const relevantInvoices = invoices.filter(i => selectedFarmId === 'all' || i.farmId === selectedFarmId);
        relevantStats.forEach(s => allDates.add(s.date));
        relevantInvoices.forEach(i => allDates.add(i.date));
        const sortedDates = Array.from(allDates).sort().reverse().slice(0, range).reverse();
        let maxVal = 0;
        let totalProd = 0;
        let totalSales = 0;
        const dataPoints = sortedDates.map(date => {
            const prod = relevantStats.filter(s => s.date === date).reduce((sum, s) => sum + (s.production || 0), 0);
            const sale = relevantInvoices.filter(i => i.date === date).reduce((sum, i) => sum + (i.totalCartons || 0), 0);
            if (prod > maxVal) maxVal = prod;
            if (sale > maxVal) maxVal = sale;
            totalProd += prod;
            totalSales += sale;
            return { date, prod, sale };
        });
        maxVal = Math.max(10, Math.ceil(maxVal * 1.1));
        return { dataPoints, maxVal, totalProd, totalSales };
    }, [statistics, invoices, range, selectedFarmId]);

    const salesRate = chartData.totalProd > 0 ? ((chartData.totalSales / chartData.totalProd) * 100).toFixed(1) : '0';

    return (
        <div className="space-y-6 lg:space-y-8">
            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 p-6 lg:p-8 rounded-[28px] shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-6 justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-2xl text-purple-600">
                         <Icons.BarChart className="w-6 h-6 lg:w-8 lg:h-8" />
                    </div>
                    <h3 className="font-black text-xl lg:text-3xl dark:text-white">تحلیل تولید و فروش</h3>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <select 
                        value={selectedFarmId} 
                        onChange={(e) => setSelectedFarmId(e.target.value)} 
                        className="p-3 lg:p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-white font-bold text-sm lg:text-lg w-full sm:w-48 outline-none focus:border-purple-500 transition-colors"
                    >
                        <option value="all">همه فارم‌ها</option>
                        {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <select 
                        value={range} 
                        onChange={(e) => setRange(Number(e.target.value))} 
                        className="p-3 lg:p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-white font-bold text-sm lg:text-lg outline-none focus:border-purple-500 transition-colors"
                    >
                        <option value={7}>۷ روز اخیر</option>
                        <option value={14}>۱۴ روز اخیر</option>
                        <option value={30}>۳۰ روز اخیر</option>
                    </select>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-8">
                <div className="bg-green-50 dark:bg-green-900/20 p-6 lg:p-8 rounded-[28px] border border-green-100 dark:border-green-800 flex items-center justify-between shadow-sm">
                    <div>
                        <span className="text-sm lg:text-base font-bold text-green-700 dark:text-green-300 block mb-2">مجموع تولید دوره</span>
                        <span className="text-3xl lg:text-5xl font-black text-green-800 dark:text-green-100">{toPersianDigits(chartData.totalProd)}</span>
                    </div>
                    <div className="p-4 bg-white dark:bg-green-800/30 rounded-2xl">
                         <Icons.BarChart className="w-8 h-8 lg:w-10 lg:h-10 text-green-500" />
                    </div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-6 lg:p-8 rounded-[28px] border border-red-100 dark:border-red-800 flex items-center justify-between shadow-sm">
                    <div>
                        <span className="text-sm lg:text-base font-bold text-red-700 dark:text-red-300 block mb-2">مجموع فروش دوره</span>
                        <span className="text-3xl lg:text-5xl font-black text-red-800 dark:text-red-100">{toPersianDigits(chartData.totalSales)}</span>
                    </div>
                     <div className="p-4 bg-white dark:bg-red-800/30 rounded-2xl">
                        <Icons.FileText className="w-8 h-8 lg:w-10 lg:h-10 text-red-500" />
                     </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-6 lg:p-8 rounded-[28px] border border-blue-100 dark:border-blue-800 flex items-center justify-between shadow-sm">
                    <div>
                        <span className="text-sm lg:text-base font-bold text-blue-700 dark:text-blue-300 block mb-2">نرخ فروش به تولید</span>
                        <span className="text-3xl lg:text-5xl font-black text-blue-800 dark:text-blue-100">٪ {toPersianDigits(salesRate)}</span>
                    </div>
                     <div className="p-4 bg-white dark:bg-blue-800/30 rounded-2xl">
                        <Icons.Refresh className="w-8 h-8 lg:w-10 lg:h-10 text-blue-500" />
                     </div>
                </div>
            </div>

            {/* Chart Area */}
            <div className="bg-white dark:bg-gray-800 p-6 lg:p-10 rounded-[28px] shadow-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
                 <div className="min-w-[700px] h-[350px] lg:h-[450px] relative pt-6 pb-8 px-4 flex items-end gap-4 lg:gap-6">
                    {/* Background Grid Lines */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8 pt-6 px-4">
                        {[1, 0.75, 0.5, 0.25, 0].map((tick, i) => (
                            <div key={i} className="w-full border-b border-gray-100 dark:border-gray-700 h-0 relative">
                                <span className="absolute -left-8 -top-2 text-sm lg:text-base text-gray-400 font-mono">
                                    {toPersianDigits(Math.round(chartData.maxVal * tick))}
                                </span>
                            </div>
                        ))}
                    </div>

                    {chartData.dataPoints.length === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-400 lg:text-2xl font-bold">
                            داده‌ای برای نمایش وجود ندارد
                        </div>
                    ) : (
                        chartData.dataPoints.map((point, index) => {
                            const prodHeight = (point.prod / chartData.maxVal) * 100;
                            const saleHeight = (point.sale / chartData.maxVal) * 100;
                            
                            return (
                                <div key={index} className="flex-1 flex flex-col justify-end items-center gap-1 group relative h-full z-10">
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full mb-3 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs lg:text-base p-3 rounded-lg pointer-events-none whitespace-nowrap z-20 shadow-xl">
                                        <div className="text-center font-bold mb-1 border-b border-white/20 pb-1">{point.date}</div>
                                        <div>تولید: {toPersianDigits(point.prod)}</div>
                                        <div>فروش: {toPersianDigits(point.sale)}</div>
                                    </div>

                                    <div className="w-full flex justify-center items-end gap-1.5 h-full px-1">
                                        {/* Production Bar */}
                                        <motion.div 
                                            initial={{ height: 0 }} 
                                            animate={{ height: `${prodHeight}%` }}
                                            transition={{ duration: 0.5, delay: index * 0.05 }}
                                            className="w-full max-w-[24px] lg:max-w-[48px] bg-green-500 rounded-t-md hover:bg-green-400 transition-colors relative shadow-sm"
                                        >
                                            {prodHeight > 10 && <span className="absolute top-1 left-0 w-full text-center text-[10px] lg:text-xs text-white/90 font-bold">{toPersianDigits(point.prod)}</span>}
                                        </motion.div>
                                        
                                        {/* Sales Bar */}
                                        <motion.div 
                                            initial={{ height: 0 }} 
                                            animate={{ height: `${saleHeight}%` }}
                                            transition={{ duration: 0.5, delay: index * 0.05 + 0.1 }}
                                            className="w-full max-w-[24px] lg:max-w-[48px] bg-red-500 rounded-t-md hover:bg-red-400 transition-colors relative shadow-sm"
                                        >
                                            {saleHeight > 10 && <span className="absolute top-1 left-0 w-full text-center text-[10px] lg:text-xs text-white/90 font-bold">{toPersianDigits(point.sale)}</span>}
                                        </motion.div>
                                    </div>
                                    
                                    <div className="h-8 flex items-center justify-center">
                                        <span className="text-xs lg:text-base text-gray-500 dark:text-gray-400 -rotate-45 whitespace-nowrap origin-top-left translate-y-3 translate-x-2 font-medium">
                                            {toPersianDigits(point.date.slice(5))}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                
                {/* Legend */}
                <div className="flex justify-center gap-6 lg:gap-10 mt-6 lg:mt-10">
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 px-4 py-2 rounded-full">
                        <div className="w-3 h-3 lg:w-4 lg:h-4 bg-green-500 rounded-full"></div>
                        <span className="text-sm lg:text-lg font-bold text-gray-600 dark:text-gray-300">تولید روزانه</span>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 px-4 py-2 rounded-full">
                        <div className="w-3 h-3 lg:w-4 lg:h-4 bg-red-500 rounded-full"></div>
                        <span className="text-sm lg:text-lg font-bold text-gray-600 dark:text-gray-300">فروش روزانه</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const DashboardHome: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <MetroTile title="پایش آمار فارم‌ها" icon={Icons.BarChart} color="bg-metro-blue" size="wide" onClick={() => onNavigate('farm-stats')} />
            <MetroTile title="حواله‌های فروش" icon={Icons.FileText} color="bg-metro-orange" size="wide" onClick={() => onNavigate('invoices')} />
            <MetroTile title="تحلیل نموداری" icon={Icons.BarChart} color="bg-purple-600" size="medium" onClick={() => onNavigate('analytics')} />
            <MetroTile title="گزارشات اکسل جامع" icon={Icons.FileText} color="bg-metro-green" size="medium" onClick={() => onNavigate('reports')} />
        </div>
    );
};

const SalesDashboard: React.FC = () => {
    const [currentView, setCurrentView] = useState('dashboard');
    const getTitle = () => {
        if(currentView === 'farm-stats') return 'پایش آمار لحظه‌ای';
        if(currentView === 'invoices') return 'حواله‌های فروش';
        if(currentView === 'reports') return 'گزارشات فروش';
        if(currentView === 'analytics') return 'تحلیل نموداری تولید و فروش';
        return 'داشبورد فروش و توزیع';
    }

    const renderContent = () => {
        switch (currentView) {
            case 'farm-stats': return <FarmStatistics />;
            case 'invoices': return <InvoiceList />;
            case 'reports': return <Reports />;
            case 'analytics': return <AnalyticsView />;
            default: return <DashboardHome onNavigate={setCurrentView} />;
        }
    };

    return (
        <DashboardLayout title={getTitle()} onNavigate={setCurrentView} currentView={currentView}>
            {renderContent()}
        </DashboardLayout>
    );
};

export default SalesDashboard;
