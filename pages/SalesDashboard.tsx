
import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Icons } from '../components/common/Icons';
import Reports from '../components/admin/Reports';
import { useStatisticsStore } from '../store/statisticsStore';
import { useInvoiceStore } from '../store/invoiceStore';
import { useFarmStore } from '../store/farmStore';
import { useToastStore } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';
import { useAlertStore } from '../store/alertStore';
import { getTodayJalali, normalizeDate, toPersianDigits } from '../utils/dateUtils';
import Button from '../components/common/Button';
import JalaliDatePicker from '../components/common/JalaliDatePicker';
import { FarmType } from '../types';
import MetroTile from '../components/common/MetroTile';
import { motion, AnimatePresence } from 'framer-motion';

const FarmStatistics = () => {
    const { statistics, fetchStatistics, subscribeToStatistics, isLoading } = useStatisticsStore();
    const { farms, products } = useFarmStore(); 
    const { invoices, fetchInvoices } = useInvoiceStore();
    const { addToast } = useToastStore();
    const { sendAlert } = useAlertStore();
    
    const todayJalali = getTodayJalali();
    const [selectedDate, setSelectedDate] = useState(todayJalali);
    const normalizedSelectedDate = normalizeDate(selectedDate);
    const [expandedFarmId, setExpandedFarmId] = useState<string | null>(null);
    const [alertLoading, setAlertLoading] = useState<string | null>(null);

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
    
    const isToday = normalizedSelectedDate === normalizeDate(todayJalali);

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-4 shadow-md border-l-4 border-metro-blue flex flex-col md:flex-row gap-4 items-end rounded-xl">
                <div className="flex-1 w-full">
                    <JalaliDatePicker value={selectedDate} onChange={setSelectedDate} label="تاریخ پایش فروش" />
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    اتصال زنده به سرور برقرار است
                </div>
            </div>

            <div className="grid gap-3 animate-in slide-in-from-bottom-2 duration-500">
                {isLoading && statistics.length === 0 && <div className="text-center py-8 text-gray-500 dark:text-gray-400 font-bold">در حال همگام‌سازی...</div>}
                
                {farms.map(farm => {
                    const farmStats = statistics.filter(s => 
                        s.farmId === farm.id && 
                        normalizeDate(s.date) === normalizedSelectedDate
                    );
                    const hasStats = farmStats.length > 0;
                    const isExpanded = expandedFarmId === farm.id;

                    return (
                        <div key={farm.id} className="group shadow-md rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700">
                            <div 
                                onClick={() => toggleFarm(farm.id)}
                                className={`p-4 flex items-center justify-between cursor-pointer transition-colors border-r-8 ${
                                    hasStats 
                                        ? 'bg-white dark:bg-gray-800 border-green-500 hover:bg-gray-50 dark:hover:bg-gray-700' 
                                        : 'bg-white dark:bg-gray-800 border-red-500 hover:bg-red-50 dark:hover:bg-gray-900/50'
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-full shadow-sm text-white ${hasStats ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-rose-600'}`}>
                                        <Icons.Home className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-xl text-gray-800 dark:text-white">{farm.name}</h4>
                                        <span className={`text-xs font-bold ${hasStats ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {hasStats ? 'آمار تولید ثبت شده' : 'منتظر ثبت آمار'}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                    {hasStats && (
                                        <div className="hidden sm:flex flex-col items-end mr-4">
                                            <span className="text-[10px] text-gray-400 font-bold">محصولات</span>
                                            <span className="text-lg font-black text-metro-blue">{toPersianDigits(farmStats.length)}</span>
                                        </div>
                                    )}
                                    {/* Alert Button: Only visible if it is TODAY and NO Stats */}
                                    {!hasStats && isToday && (
                                        <Button 
                                            size="sm" 
                                            variant="danger" 
                                            onClick={(e) => handleSendAlert(farm.id, farm.name, e)}
                                            isLoading={alertLoading === farm.id}
                                            className="font-black"
                                        >
                                            <Icons.Bell className="w-4 h-4 ml-1" />
                                            ارسال هشدار
                                        </Button>
                                    )}
                                    <Icons.ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>
                            </div>

                            <AnimatePresence>
                                {isExpanded && hasStats && (
                                    <motion.div 
                                        initial={{ height: 0, opacity: 0 }} 
                                        animate={{ height: 'auto', opacity: 1 }} 
                                        exit={{ height: 0, opacity: 0 }} 
                                        className="bg-gray-50 dark:bg-black/20 p-4 border-t border-gray-200 dark:border-gray-700"
                                    >
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {farmStats.map(stat => {
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
                                                
                                                // Use DB 'sales' as fallback, but prefer calculation
                                                const calculatedSales = relevantInvoices.reduce((sum, inv) => sum + (inv.totalCartons || 0), 0);
                                                const sold = Math.max(calculatedSales, stat.sales || 0);

                                                // Determine Base Capacity
                                                const totalCapacity = isMotefereghe ? production : (prevBalance + production);
                                                
                                                // Determine Final Remaining
                                                const remaining = totalCapacity - sold;
                                                const soldPercent = calculatePercent(sold, totalCapacity);

                                                return (
                                                    <div key={stat.id} className="bg-white dark:bg-gray-700 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-600 relative overflow-hidden">
                                                        {/* Header */}
                                                        <div className="flex justify-between items-start mb-4 relative z-10">
                                                            <div>
                                                                <h5 className="font-black text-lg text-gray-800 dark:text-white mb-1">{p?.name}</h5>
                                                                <span className="text-[10px] bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded font-bold">
                                                                    واحد: {p?.unit === 'CARTON' ? 'کارتن' : 'عدد'}
                                                                </span>
                                                            </div>
                                                            {/* Display Separated Metrics */}
                                                            <div className="text-left space-y-1">
                                                                {!isMotefereghe && (
                                                                    <div className="flex items-center justify-end gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                                        <span>موجودی قبل:</span>
                                                                        <span className="font-bold text-gray-800 dark:text-white">{toPersianDigits(prevBalance)}</span>
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center justify-end gap-2 text-xs text-green-600 dark:text-green-400">
                                                                    <span>{isMotefereghe ? 'موجودی اعلامی:' : 'تولید روز:'}</span>
                                                                    <span className="font-black text-lg">{toPersianDigits(production)}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Visual Progress Bar */}
                                                        <div className="mb-4 relative h-3 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                                                            <div 
                                                                className="absolute top-0 right-0 h-full bg-metro-orange rounded-full transition-all duration-1000 ease-out" 
                                                                style={{ width: `${soldPercent}%` }}
                                                            ></div>
                                                        </div>

                                                        {/* Metrics Grid */}
                                                        <div className="grid grid-cols-2 gap-3 relative z-10">
                                                            <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
                                                                <span className="block text-xs font-bold text-red-500 mb-1">فروش رفته (حواله)</span>
                                                                <div className="flex items-center gap-1">
                                                                    <Icons.FileText className="w-4 h-4 text-red-500" />
                                                                    <span className="text-xl font-black text-red-600">{toPersianDigits(sold)}</span>
                                                                </div>
                                                            </div>
                                                            <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                                                <span className="block text-xs font-bold text-blue-500 mb-1">موجودی انبار</span>
                                                                <div className="flex items-center gap-1">
                                                                    <Icons.Check className="w-4 h-4 text-blue-500" />
                                                                    <span className="text-xl font-black text-blue-600">{toPersianDigits(remaining)}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Background Decoration */}
                                                        <Icons.BarChart className="absolute -left-4 -bottom-4 w-32 h-32 text-gray-50 dark:text-gray-600 opacity-50 rotate-12 pointer-events-none" />
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
    
    // Date Filter Defaulting to Today
    const [filterDate, setFilterDate] = useState(getTodayJalali());
    const normalizedFilterDate = normalizeDate(filterDate);

    const filteredInvoices = invoices
        .filter(i => {
            const dateMatch = i.date === normalizedFilterDate;
            const farmMatch = selectedFarmId === 'all' || i.farmId === selectedFarmId;
            return dateMatch && farmMatch;
        })
        .sort((a, b) => b.createdAt - a.createdAt); // Sort by time created for daily view

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchInvoices();
        setTimeout(() => setIsRefreshing(false), 500);
        addToast('لیست حواله‌ها بروزرسانی شد', 'info');
    };

    const renderInvoiceNumber = (num: string) => {
        const strNum = toPersianDigits(num);
        if (strNum.length < 4) return <span className="text-gray-800 dark:text-gray-200">{strNum}</span>;
        const mainPart = strNum.slice(0, -4);
        const lastPart = strNum.slice(-4);
        return (
            <div className="flex justify-end items-center gap-0.5">
                <span className="text-gray-500 dark:text-gray-400 font-bold">{mainPart}</span>
                <span className="text-black dark:text-white font-black text-base">{lastPart}</span>
            </div>
        );
    };

    return (
        <div className="space-y-4">
             <div className="bg-white dark:bg-gray-800 p-4 shadow-sm border-l-4 border-metro-orange flex flex-col md:flex-row gap-4 items-end rounded-xl">
                <div className="w-full md:w-1/3">
                    <JalaliDatePicker value={filterDate} onChange={setFilterDate} label="نمایش حواله‌های تاریخ" />
                </div>
                
                <div className="w-full md:w-1/3">
                    <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">فیلتر بر اساس فارم</label>
                    <select 
                        className="w-full p-2 border-2 border-gray-300 bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-black outline-none focus:border-metro-orange h-[42px] rounded-lg"
                        value={selectedFarmId}
                        onChange={(e) => setSelectedFarmId(e.target.value)}
                    >
                        <option value="all">همه فارم‌های فعال</option>
                        {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                </div>
                
                <Button onClick={handleRefresh} disabled={isRefreshing} className="bg-metro-orange h-[42px] px-6 font-black w-full md:w-auto">
                    <Icons.Refresh className={`w-4 h-4 ml-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    بروزرسانی لیست
                </Button>
            </div>

            <div className="bg-white dark:bg-gray-800 p-0 shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700 rounded-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right border-collapse">
                        <thead className="bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            <tr>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">تاریخ خروج</th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-center">کد حواله</th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">فارم</th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-center">تعداد (کارتن)</th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">وزن (Kg)</th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">وضعیت</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800 font-sans tabular-nums">
                            {filteredInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-10 text-gray-400">
                                        <div className="flex flex-col items-center">
                                            <Icons.FileText className="w-10 h-10 mb-2 opacity-30" />
                                            <span>هیچ حواله‌ای برای تاریخ {toPersianDigits(normalizedFilterDate)} ثبت نشده است.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredInvoices.map(i => (
                                    <tr key={i.id} className="hover:bg-blue-50 dark:hover:bg-gray-700/50 transition-colors text-gray-800 dark:text-gray-200">
                                        <td className="px-4 py-3 font-black whitespace-nowrap tracking-tighter text-base">{toPersianDigits(i.date)}</td>
                                        <td className="px-4 py-3 text-center dir-ltr" dir="ltr">
                                            {renderInvoiceNumber(i.invoiceNumber)}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap font-bold">{farms.find(f => f.id === i.farmId)?.name}</td>
                                        <td className="px-4 py-3 text-center font-black">{toPersianDigits(i.totalCartons)}</td>
                                        <td className="px-4 py-3 font-black text-metro-blue">{toPersianDigits(i.totalWeight)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1">
                                                <span className={`px-2 py-0.5 text-[10px] font-black text-white w-fit ${i.isYesterday ? 'bg-metro-orange' : 'bg-metro-green'}`}>
                                                    {i.isYesterday ? 'دیروزی' : 'عادی'}
                                                </span>
                                                {i.updatedAt && (
                                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-black">(اصلاح شده)</span>
                                                )}
                                            </div>
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
    const { statistics } = useStatisticsStore();
    const { invoices } = useInvoiceStore();
    const { farms } = useFarmStore();
    const [range, setRange] = useState<number>(7);
    const [selectedFarmId, setSelectedFarmId] = useState<string>('all');

    const chartData = useMemo(() => {
        // 1. Collect all unique dates from stats/invoices relevant to selection
        const allDates = new Set<string>();
        const relevantStats = statistics.filter(s => selectedFarmId === 'all' || s.farmId === selectedFarmId);
        const relevantInvoices = invoices.filter(i => selectedFarmId === 'all' || i.farmId === selectedFarmId);

        relevantStats.forEach(s => allDates.add(s.date));
        relevantInvoices.forEach(i => allDates.add(i.date));

        // Sort dates descending and take top N
        const sortedDates = Array.from(allDates).sort().reverse().slice(0, range).reverse();

        let maxVal = 0;
        let totalProd = 0;
        let totalSales = 0;

        const dataPoints = sortedDates.map(date => {
            // Sum Production for this date
            const prod = relevantStats
                .filter(s => s.date === date)
                .reduce((sum, s) => sum + (s.production || 0), 0);

            // Sum Sales for this date (using Invoices for accuracy)
            const sale = relevantInvoices
                .filter(i => i.date === date)
                .reduce((sum, i) => sum + (i.totalCartons || 0), 0);

            if (prod > maxVal) maxVal = prod;
            if (sale > maxVal) maxVal = sale;

            totalProd += prod;
            totalSales += sale;

            return { date, prod, sale };
        });

        // Add 10% headroom to maxVal
        maxVal = Math.max(10, Math.ceil(maxVal * 1.1));

        return { dataPoints, maxVal, totalProd, totalSales };
    }, [statistics, invoices, range, selectedFarmId]);

    const salesRate = chartData.totalProd > 0 ? ((chartData.totalSales / chartData.totalProd) * 100).toFixed(1) : '0';

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-l-4 border-purple-500 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="flex items-center gap-2">
                    <Icons.BarChart className="w-6 h-6 text-purple-600" />
                    <h3 className="font-black text-lg dark:text-white">تحلیل تولید و فروش</h3>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <select 
                        value={selectedFarmId} 
                        onChange={(e) => setSelectedFarmId(e.target.value)} 
                        className="p-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-bold text-sm w-full sm:w-40"
                    >
                        <option value="all">همه فارم‌ها</option>
                        {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <select 
                        value={range} 
                        onChange={(e) => setRange(Number(e.target.value))} 
                        className="p-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-bold text-sm"
                    >
                        <option value={7}>۷ روز اخیر</option>
                        <option value={14}>۱۴ روز اخیر</option>
                        <option value={30}>۳۰ روز اخیر</option>
                    </select>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800 flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold text-green-700 dark:text-green-300 block mb-1">مجموع تولید دوره</span>
                        <span className="text-2xl font-black text-green-800 dark:text-green-100">{toPersianDigits(chartData.totalProd)}</span>
                    </div>
                    <Icons.BarChart className="w-8 h-8 text-green-300 opacity-50" />
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-200 dark:border-red-800 flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold text-red-700 dark:text-red-300 block mb-1">مجموع فروش دوره</span>
                        <span className="text-2xl font-black text-red-800 dark:text-red-100">{toPersianDigits(chartData.totalSales)}</span>
                    </div>
                    <Icons.FileText className="w-8 h-8 text-red-300 opacity-50" />
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800 flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-300 block mb-1">نرخ فروش به تولید</span>
                        <span className="text-2xl font-black text-blue-800 dark:text-blue-100">٪ {toPersianDigits(salesRate)}</span>
                    </div>
                    <Icons.Refresh className="w-8 h-8 text-blue-300 opacity-50" />
                </div>
            </div>

            {/* Chart Area */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-x-auto">
                <div className="min-w-[600px] h-[350px] relative pt-6 pb-8 px-4 flex items-end gap-2 md:gap-4">
                    {/* Background Grid Lines */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8 pt-6 px-4">
                        {[1, 0.75, 0.5, 0.25, 0].map((tick, i) => (
                            <div key={i} className="w-full border-b border-gray-100 dark:border-gray-700 h-0 relative">
                                <span className="absolute -left-8 -top-2 text-[10px] text-gray-400 font-mono">
                                    {toPersianDigits(Math.round(chartData.maxVal * tick))}
                                </span>
                            </div>
                        ))}
                    </div>

                    {chartData.dataPoints.length === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                            داده‌ای برای نمایش وجود ندارد
                        </div>
                    ) : (
                        chartData.dataPoints.map((point, index) => {
                            const prodHeight = (point.prod / chartData.maxVal) * 100;
                            const saleHeight = (point.sale / chartData.maxVal) * 100;
                            
                            return (
                                <div key={index} className="flex-1 flex flex-col justify-end items-center gap-1 group relative h-full z-10">
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] p-2 rounded pointer-events-none whitespace-nowrap z-20">
                                        <div className="text-center font-bold mb-1 border-b border-white/20 pb-1">{point.date}</div>
                                        <div>تولید: {toPersianDigits(point.prod)}</div>
                                        <div>فروش: {toPersianDigits(point.sale)}</div>
                                    </div>

                                    <div className="w-full flex justify-center items-end gap-1 h-full">
                                        {/* Production Bar */}
                                        <motion.div 
                                            initial={{ height: 0 }} 
                                            animate={{ height: `${prodHeight}%` }}
                                            transition={{ duration: 0.5, delay: index * 0.05 }}
                                            className="w-1/2 max-w-[20px] bg-green-500 rounded-t-sm hover:bg-green-400 transition-colors relative"
                                        >
                                            {prodHeight > 10 && <span className="absolute top-1 left-0 w-full text-center text-[8px] text-white/90 font-bold">{toPersianDigits(point.prod)}</span>}
                                        </motion.div>
                                        
                                        {/* Sales Bar */}
                                        <motion.div 
                                            initial={{ height: 0 }} 
                                            animate={{ height: `${saleHeight}%` }}
                                            transition={{ duration: 0.5, delay: index * 0.05 + 0.1 }}
                                            className="w-1/2 max-w-[20px] bg-red-500 rounded-t-sm hover:bg-red-400 transition-colors relative"
                                        >
                                            {saleHeight > 10 && <span className="absolute top-1 left-0 w-full text-center text-[8px] text-white/90 font-bold">{toPersianDigits(point.sale)}</span>}
                                        </motion.div>
                                    </div>
                                    
                                    <div className="h-8 flex items-center justify-center">
                                        <span className="text-[10px] text-gray-500 dark:text-gray-400 -rotate-45 whitespace-nowrap origin-top-left translate-y-2 translate-x-2">
                                            {toPersianDigits(point.date.slice(5))}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                
                {/* Legend */}
                <div className="flex justify-center gap-6 mt-4">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                        <span className="text-xs font-bold text-gray-600 dark:text-gray-300">تولید</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                        <span className="text-xs font-bold text-gray-600 dark:text-gray-300">فروش</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const DashboardHome: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <MetroTile title="پایش آمار فارم‌ها" icon={Icons.BarChart} color="bg-metro-blue" size="wide" onClick={() => onNavigate('farm-stats')} />
            <MetroTile title="لیست حواله‌های فروش" icon={Icons.FileText} color="bg-metro-orange" size="wide" onClick={() => onNavigate('invoices')} />
            <MetroTile title="تحلیل نموداری" icon={Icons.BarChart} color="bg-purple-600" size="medium" onClick={() => onNavigate('analytics')} />
            <MetroTile title="گزارشات اکسل جامع" icon={Icons.FileText} color="bg-metro-green" size="medium" onClick={() => onNavigate('reports')} />
        </div>
    );
};

const SalesDashboard: React.FC = () => {
    const [currentView, setCurrentView] = useState('dashboard');
    const getTitle = () => {
        if(currentView === 'farm-stats') return 'پایش آمار لحظه‌ای';
        if(currentView === 'invoices') return 'حواله‌های توزیع';
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
        <DashboardLayout title={getTitle()} onNavigate={setCurrentView}>
            {renderContent()}
        </DashboardLayout>
    );
};

export default SalesDashboard;
