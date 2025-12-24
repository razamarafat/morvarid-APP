
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
import JalaliDatePicker from '../common/JalaliDatePicker';

const sortProducts = (products: any[], aId: string, bId: string) => {
    const pA = products.find(p => p.id === aId);
    const pB = products.find(p => p.id === bId);
    if (!pA || !pB) return 0;
    
    const getScore = (name: string) => {
        // Priority 1: Shirink Products
        if (name.includes('شیرینگ') || name.includes('شیرینک')) {
            if (name.includes('پرینتی')) return 1; // Highest Priority
            return 2; // Shirink Sadeh
        }

        // Priority 2: General Products (Carton/Bulk)
        if (name.includes('پرینتی')) return 3;
        if (name.includes('ساده')) return 4;

        // Priority 3: Special Types
        if (name.includes('دوزرده')) return 5;
        if (name.includes('نوکی')) return 6;
        if (name.includes('کودی')) return 7;
        if (name.includes('مایع')) return 8;

        return 9; // Others
    };
    
    // Ascending sort (Lower number comes first)
    return getScore(pA.name) - getScore(pB.name);
};

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
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        fetchStatistics();
        fetchInvoices();
        const unsubscribeStats = subscribeToStatistics();
        return () => { unsubscribeStats(); };
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
        if (success) addToast(`هشدار آنی برای ${farmName} ارسال شد`, 'success');
        else addToast('خطا در ارسال هشدار', 'error');
        setAlertLoading(null);
    };

    const toggleFarm = (farmId: string) => {
        setExpandedFarmId(expandedFarmId === farmId ? null : farmId);
    };

    return (
        <div className="space-y-6 lg:space-y-8">
            <div className="bg-white dark:bg-gray-800 p-4 lg:p-6 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row gap-4 lg:gap-6 items-center justify-between rounded-[28px]">
                <div className="flex-1 w-full">
                    <h3 className="font-black text-gray-800 dark:text-white text-lg lg:text-2xl flex items-center flex-wrap">
                        مشاهده آمار‌های ثبت شده فارم‌ها - امروز 
                        <span className="shiny-text text-xl lg:text-3xl mr-4 font-black">{toPersianDigits(todayJalali)}</span>
                    </h3>
                </div>
                <Button onClick={handleManualRefresh} disabled={isRefreshing} className="h-[52px] px-6 rounded-xl bg-metro-blue hover:bg-metro-cobalt font-bold text-lg">
                    <Icons.Refresh className={`w-5 h-5 ml-2 ${isRefreshing ? 'animate-spin' : ''}`} /> بروزرسانی
                </Button>
            </div>

            <div className="grid gap-4 lg:gap-6 animate-in slide-in-from-bottom-2 duration-500">
                {farms.map(farm => {
                    const farmStats = statistics.filter(s => s.farmId === farm.id && normalizeDate(s.date) === normalizedSelectedDate);
                    const sortedFarmStats = [...farmStats].sort((a, b) => sortProducts(products, a.productId, b.productId));
                    const hasStats = farmStats.length > 0;
                    const isExpanded = expandedFarmId === farm.id;
                    return (
                        <div key={farm.id} className="group shadow-sm hover:shadow-xl transition-all duration-300 rounded-[28px] overflow-hidden border border-gray-200 dark:border-gray-700">
                            <div onClick={() => toggleFarm(farm.id)} className={`p-5 lg:p-7 flex items-center justify-between cursor-pointer transition-colors border-r-[8px] ${hasStats ? 'bg-white dark:bg-gray-800 border-green-500 hover:bg-gray-50 dark:hover:bg-gray-700/50' : 'bg-white dark:bg-gray-800 border-red-500 hover:bg-red-50 dark:hover:bg-red-900/10'}`}>
                                <div className="flex items-center gap-4 lg:gap-6">
                                    <div className={`p-4 rounded-[20px] shadow-sm text-white ${hasStats ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-rose-600'}`}><Icons.Home className="w-6 h-6 lg:w-8 lg:h-8" /></div>
                                    <div>
                                        {/* Increased Font Size */}
                                        <h4 className="font-black text-2xl lg:text-3xl text-gray-800 dark:text-white mb-1">{farm.name}</h4>
                                        <span className={`text-base lg:text-lg font-bold px-2 py-0.5 rounded-full ${hasStats ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : 'bg-red-100 text-red-700 dark:bg-red-900/30'}`}>{hasStats ? 'آمار ثبت شده' : 'منتظر ثبت'}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 lg:gap-4">
                                    {!hasStats && (
                                        <Button 
                                            variant="danger" 
                                            size="sm" 
                                            isLoading={alertLoading === farm.id}
                                            onClick={(e) => handleSendAlert(farm.id, farm.name, e)}
                                            className="lg:h-12 lg:px-6 shadow-md"
                                        >
                                            <Icons.Bell className="w-5 h-5 lg:ml-2" />
                                            <span className="hidden lg:inline text-lg">ارسال هشدار</span>
                                        </Button>
                                    )}
                                    <Icons.ChevronDown className={`w-6 h-6 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>
                            </div>
                            <AnimatePresence>
                                {isExpanded && hasStats && (
                                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="bg-gray-50 dark:bg-black/20 p-5 lg:p-8 border-t">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {sortedFarmStats.map(stat => {
                                                const prod = products.find(p => p.id === stat.productId);
                                                const isLiquid = prod?.name.includes('مایع') || prod?.hasKilogramUnit;

                                                return (
                                                <div key={stat.id} className="bg-white dark:bg-gray-700 p-5 rounded-[24px] border relative overflow-hidden">
                                                    <div className="flex justify-between mb-4">
                                                        <h5 className="font-black text-xl">{prod?.name}</h5>
                                                        <span className="text-sm font-mono opacity-50 font-bold">{new Date(stat.createdAt).toLocaleTimeString('fa-IR')}</span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <div className="flex flex-col items-center justify-center">
                                                            {/* Improved readability for labels and values */}
                                                            <span className="block text-sm font-bold opacity-60 mb-1">تولید</span>
                                                            <span className="font-black text-2xl lg:text-3xl text-green-600">+{toPersianDigits(isLiquid ? (stat.productionKg || 0) : (stat.production || 0))} {isLiquid && <small className="text-xs">Kg</small>}</span>
                                                        </div>
                                                        <div className="flex flex-col items-center justify-center border-r border-l border-gray-100 dark:border-gray-600">
                                                            <span className="block text-sm font-bold opacity-60 mb-1">فروش</span>
                                                            <span className="font-black text-2xl lg:text-3xl text-red-500">-{toPersianDigits(isLiquid ? (stat.salesKg || 0) : (stat.sales || 0))} {isLiquid && <small className="text-xs">Kg</small>}</span>
                                                        </div>
                                                        <div className="flex flex-col items-center justify-center">
                                                            <span className="block text-sm font-bold opacity-60 mb-1">موجودی</span>
                                                            <span className="font-black text-2xl lg:text-3xl text-blue-600">{toPersianDigits(isLiquid ? (stat.currentInventoryKg || 0) : (stat.currentInventory || 0))} {isLiquid && <small className="text-xs">Kg</small>}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )})}
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
    const { farms, products } = useFarmStore(); 
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
        if (strNum.length < 4) return <span className="text-gray-800 dark:text-gray-200 lg:text-xl">{strNum}</span>;
        const mainPart = strNum.slice(0, -4);
        const lastPart = strNum.slice(-4);
        return (
            <div className="flex justify-end items-center gap-0.5">
                <span className="text-gray-500 dark:text-gray-400 font-bold text-lg lg:text-xl">{mainPart}</span>
                <span className="text-black dark:text-white font-black text-xl lg:text-2xl">{lastPart}</span>
            </div>
        );
    };

    return (
        <div className="space-y-4 lg:space-y-6">
             <div className="bg-white dark:bg-gray-800 p-4 lg:p-6 shadow-sm border-l-4 border-metro-orange flex flex-col md:flex-row gap-4 lg:gap-6 items-end rounded-xl">
                <div className="w-full md:w-1/3">
                    <JalaliDatePicker value={filterDate} onChange={setFilterDate} label="نمایش حواله‌های تاریخ" />
                </div>
                
                <div className="w-full md:w-1/3">
                    <label className="block text-sm font-bold mb-1 lg:mb-2 text-gray-700 dark:text-gray-300">فیلتر بر اساس فارم</label>
                    <select 
                        className="w-full p-2 lg:p-3 border-2 border-gray-300 bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-black outline-none focus:border-metro-orange h-[42px] lg:h-[52px] rounded-lg lg:text-lg"
                        value={selectedFarmId}
                        onChange={(e) => setSelectedFarmId(e.target.value)}
                    >
                        <option value="all">همه فارم‌های فعال</option>
                        {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                </div>
                
                <Button onClick={handleRefresh} disabled={isRefreshing} className="bg-metro-orange h-[42px] lg:h-[52px] px-6 font-black w-full md:w-auto lg:text-lg">
                    <Icons.Refresh className={`w-4 h-4 lg:w-6 lg:h-6 ml-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    بروزرسانی لیست
                </Button>
            </div>

            <div className="bg-white dark:bg-gray-800 p-0 shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700 rounded-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-base lg:text-lg text-right border-collapse">
                        <thead className="bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 whitespace-nowrap text-sm lg:text-lg font-bold">
                            <tr>
                                <th className="px-4 py-3 lg:px-6 lg:py-5 border-b border-gray-200 dark:border-gray-700">تاریخ خروج</th>
                                <th className="px-4 py-3 lg:px-6 lg:py-5 border-b border-gray-200 dark:border-gray-700 text-center">رمز حواله</th>
                                <th className="px-4 py-3 lg:px-6 lg:py-5 border-b border-gray-200 dark:border-gray-700">فارم</th>
                                <th className="px-4 py-3 lg:px-6 lg:py-5 border-b border-gray-200 dark:border-gray-700 text-center">تعداد (کارتن)</th>
                                <th className="px-4 py-3 lg:px-6 lg:py-5 border-b border-gray-200 dark:border-gray-700">وزن (Kg)</th>
                                <th className="px-4 py-3 lg:px-6 lg:py-5 border-b border-gray-200 dark:border-gray-700">وضعیت</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800 font-sans tabular-nums text-base lg:text-lg">
                            {filteredInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-10 lg:py-20 text-gray-400 font-bold lg:text-lg">
                                        <div className="flex flex-col items-center">
                                            <Icons.FileText className="w-10 h-10 lg:w-16 lg:h-16 mb-2 opacity-30" />
                                            <span>هیچ حواله‌ای برای تاریخ {toPersianDigits(normalizedFilterDate)} ثبت نشده است.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredInvoices.map(i => (
                                    <tr key={i.id} className="hover:bg-blue-50 dark:hover:bg-gray-700/50 transition-colors text-gray-800 dark:text-gray-200">
                                        <td className="px-4 py-3 lg:px-6 lg:py-6 font-black whitespace-nowrap tracking-tighter text-lg lg:text-xl">{toPersianDigits(i.date)}</td>
                                        <td className="px-4 py-3 lg:px-6 lg:py-6 text-center dir-ltr" dir="ltr">
                                            {renderInvoiceNumber(i.invoiceNumber)}
                                        </td>
                                        <td className="px-4 py-3 lg:px-6 lg:py-6 whitespace-nowrap font-bold text-lg lg:text-xl">{farms.find(f => f.id === i.farmId)?.name}</td>
                                        <td className="px-4 py-3 lg:px-6 lg:py-6 text-center font-black text-xl lg:text-2xl">{toPersianDigits(i.totalCartons)}</td>
                                        <td className="px-4 py-3 lg:px-6 lg:py-6 font-black text-metro-blue text-xl lg:text-2xl">{toPersianDigits(i.totalWeight)}</td>
                                        <td className="px-4 py-3 lg:px-6 lg:py-6">
                                            <div className="flex flex-col gap-1">
                                                <span className={`px-2 lg:px-3 py-0.5 lg:py-1 text-sm lg:text-base font-black text-white w-fit rounded ${i.isYesterday ? 'bg-metro-orange' : 'bg-metro-green'}`}>
                                                    {i.isYesterday ? 'دیروزی' : 'عادی'}
                                                </span>
                                                {i.updatedAt && (
                                                    <span className="text-xs text-amber-600 dark:text-amber-400 font-bold">(اصلاح شده)</span>
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
        <div className="space-y-6 lg:space-y-8">
            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 p-4 lg:p-6 rounded-xl shadow-sm border-l-4 border-purple-500 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="flex items-center gap-2">
                    <Icons.BarChart className="w-6 h-6 lg:w-8 lg:h-8 text-purple-600" />
                    <h3 className="font-black text-lg lg:text-2xl dark:text-white">تحلیل تولید و فروش</h3>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <select 
                        value={selectedFarmId} 
                        onChange={(e) => setSelectedFarmId(e.target.value)} 
                        className="p-2 lg:p-3 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-bold text-sm lg:text-lg w-full sm:w-40"
                    >
                        <option value="all">همه فارم‌ها</option>
                        {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <select 
                        value={range} 
                        onChange={(e) => setRange(Number(e.target.value))} 
                        className="p-2 lg:p-3 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-bold text-sm lg:text-lg"
                    >
                        <option value={7}>۷ روز اخیر</option>
                        <option value={14}>۱۴ روز اخیر</option>
                        <option value={30}>۳۰ روز اخیر</option>
                    </select>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-8">
                <div className="bg-green-50 dark:bg-green-900/20 p-4 lg:p-6 rounded-xl border border-green-200 dark:border-green-800 flex items-center justify-between">
                    <div>
                        <span className="text-sm font-bold text-green-700 dark:text-green-300 block mb-1 lg:mb-2">مجموع تولید دوره</span>
                        <span className="text-2xl lg:text-4xl font-black text-green-800 dark:text-green-100">{toPersianDigits(chartData.totalProd)}</span>
                    </div>
                    <Icons.BarChart className="w-8 h-8 lg:w-12 lg:h-12 text-green-300 opacity-50" />
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-4 lg:p-6 rounded-xl border border-red-200 dark:border-red-800 flex items-center justify-between">
                    <div>
                        <span className="text-sm font-bold text-red-700 dark:text-red-300 block mb-1 lg:mb-2">مجموع فروش دوره</span>
                        <span className="text-2xl lg:text-4xl font-black text-red-800 dark:text-red-100">{toPersianDigits(chartData.totalSales)}</span>
                    </div>
                    <Icons.FileText className="w-8 h-8 lg:w-12 lg:h-12 text-red-300 opacity-50" />
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 lg:p-6 rounded-xl border border-blue-200 dark:border-blue-800 flex items-center justify-between">
                    <div>
                        <span className="text-sm font-bold text-blue-700 dark:text-blue-300 block mb-1 lg:mb-2">نرخ فروش به تولید</span>
                        <span className="text-2xl lg:text-4xl font-black text-blue-800 dark:text-blue-100">٪ {toPersianDigits(salesRate)}</span>
                    </div>
                    <Icons.Refresh className="w-8 h-8 lg:w-12 lg:h-12 text-blue-300 opacity-50" />
                </div>
            </div>

            {/* Chart Area */}
            <div className="bg-white dark:bg-gray-800 p-6 lg:p-8 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-x-auto">
                <div className="min-w-[600px] h-[350px] lg:h-[450px] relative pt-6 pb-8 px-4 flex items-end gap-2 md:gap-4 lg:gap-6">
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
                        <div className="absolute inset-0 flex items-center justify-center text-gray-400 lg:text-xl">
                            داده‌ای برای نمایش وجود ندارد
                        </div>
                    ) : (
                        chartData.dataPoints.map((point, index) => {
                            const prodHeight = (point.prod / chartData.maxVal) * 100;
                            const saleHeight = (point.sale / chartData.maxVal) * 100;
                            
                            return (
                                <div key={index} className="flex-1 flex flex-col justify-end items-center gap-1 group relative h-full z-10">
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] lg:text-sm p-2 lg:p-3 rounded pointer-events-none whitespace-nowrap z-20">
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
                                            className="w-1/2 max-w-[20px] lg:max-w-[40px] bg-green-500 rounded-t-sm hover:bg-green-400 transition-colors relative"
                                        >
                                            {prodHeight > 10 && <span className="absolute top-1 left-0 w-full text-center text-[10px] lg:text-xs text-white/90 font-bold">{toPersianDigits(point.prod)}</span>}
                                        </motion.div>
                                        
                                        {/* Sales Bar */}
                                        <motion.div 
                                            initial={{ height: 0 }} 
                                            animate={{ height: `${saleHeight}%` }}
                                            transition={{ duration: 0.5, delay: index * 0.05 + 0.1 }}
                                            className="w-1/2 max-w-[20px] lg:max-w-[40px] bg-red-500 rounded-t-sm hover:bg-red-400 transition-colors relative"
                                        >
                                            {saleHeight > 10 && <span className="absolute top-1 left-0 w-full text-center text-[10px] lg:text-xs text-white/90 font-bold">{toPersianDigits(point.sale)}</span>}
                                        </motion.div>
                                    </div>
                                    
                                    <div className="h-8 flex items-center justify-center">
                                        <span className="text-xs lg:text-sm text-gray-500 dark:text-gray-400 -rotate-45 whitespace-nowrap origin-top-left translate-y-2 translate-x-2">
                                            {toPersianDigits(point.date.slice(5))}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                
                {/* Legend */}
                <div className="flex justify-center gap-6 lg:gap-10 mt-4 lg:mt-8">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 lg:w-5 lg:h-5 bg-green-500 rounded-sm"></div>
                        <span className="text-sm lg:text-base font-bold text-gray-600 dark:text-gray-300">تولید</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 lg:w-5 lg:h-5 bg-red-500 rounded-sm"></div>
                        <span className="text-sm lg:text-base font-bold text-gray-600 dark:text-gray-300">فروش</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const DashboardHome: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 lg:gap-6">
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
        <DashboardLayout title={getTitle()} onNavigate={setCurrentView} currentView={currentView}>
            {renderContent()}
        </DashboardLayout>
    );
};

export default SalesDashboard;
