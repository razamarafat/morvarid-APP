
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import DashboardLayout from '../layout/DashboardLayout';
import { Icons } from '../common/Icons';
import Reports from '../admin/Reports';
import { useStatisticsStore, DailyStatistic, calculateFarmStats } from '../../store/statisticsStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useFarmStore } from '../../store/farmStore';
import { useToastStore } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { useAlertStore } from '../../store/alertStore';
import { getTodayJalali, normalizeDate, toPersianDigits } from '../../utils/dateUtils';
import { useSyncStore, SyncItem } from '../../store/syncStore';
import { formatPlateNumber } from '../../utils/formatUtils';
import { compareProducts } from '../../utils/sortUtils';
import Button from '../common/Button';
import MetroTile from '../common/MetroTile';
import { motion, AnimatePresence } from 'framer-motion';
import { FarmType, Invoice, UserRole } from '../../types';
import { SkeletonTile, SkeletonRow } from '../common/Skeleton';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

// --- COMPONENT: FarmGroup ---
const FarmGroup = React.memo(({ title, farms, statistics, normalizedSelectedDate, products, invoiceTotalsMap }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const [expandedFarmId, setExpandedFarmId] = useState<string | null>(null);
    const { sendAlert } = useAlertStore();
    const { addToast } = useToastStore();
    const [alertLoading, setAlertLoading] = useState<string | null>(null);

    // Calculate group status
    const allRegistered = farms.every((farm: any) => {
        const hasStats = statistics.some((s: any) => s.farmId === farm.id && normalizeDate(s.date) === normalizedSelectedDate);
        return hasStats;
    });

    const handleSendAlert = async (farmId: string, farmName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setAlertLoading(farmId);
        const message = `عدم ثبت آمار برای فارم ${farmName} در تاریخ ${normalizedSelectedDate}`;
        const result = await sendAlert(farmId, farmName, message);
        if (result.success) addToast(`هشدار ارسال شد`, 'success');
        else addToast('خطا در ارسال هشدار', 'error');
        setAlertLoading(null);
    };

    const toggleFarm = (farmId: string) => {
        setExpandedFarmId(expandedFarmId === farmId ? null : farmId);
    };

    return (
        <div className="mb-6">
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-between p-4 mb-4 cursor-pointer bg-white dark:bg-gray-800 rounded-[20px] shadow-sm border border-gray-100 dark:border-gray-700 transition-all hover:shadow-md ${isOpen ? 'ring-2 ring-gray-100 dark:ring-gray-700' : ''}`}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-8 rounded-full ${allRegistered ? 'bg-green-500 shadow-green-500/50' : 'bg-red-500 shadow-red-500/50'} shadow-lg`}></div>
                    <h3 className="text-xl font-black text-gray-800 dark:text-white">
                        {title}
                    </h3>
                    <span className="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                        {toPersianDigits(farms.length)} فارم
                    </span>
                </div>
                <Icons.ChevronDown className={`w-6 h-6 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-4 overflow-hidden pl-2 lg:pl-4 mr-4"
                    >
                        {farms.map((farm: any) => {
                            const farmStats = statistics.filter((s: any) => s.farmId === farm.id && normalizeDate(s.date) === normalizedSelectedDate);
                            const uniqueMap = new Map<string, DailyStatistic>();
                            farmStats.forEach((stat: any) => {
                                if (uniqueMap.has(stat.productId)) {
                                    const existing = uniqueMap.get(stat.productId)!;
                                    const existingTime = new Date(existing.updatedAt || existing.createdAt).getTime();
                                    const newTime = new Date(stat.updatedAt || stat.createdAt).getTime();
                                    if (newTime > existingTime) uniqueMap.set(stat.productId, stat);
                                } else {
                                    uniqueMap.set(stat.productId, stat);
                                }
                            });
                            const dedupedStats = Array.from(uniqueMap.values());

                            const sortedFarmStats = [...dedupedStats].sort((a, b) => {
                                const pA = products.find((p: any) => p.id === a.productId);
                                const pB = products.find((p: any) => p.id === b.productId);
                                if (!pA || !pB) return 0;
                                return compareProducts(pA, pB);
                            });

                            const hasStats = sortedFarmStats.length > 0;
                            const isExpanded = expandedFarmId === farm.id;
                            const isMotefereghe = farm.type === FarmType.MOTEFEREGHE;

                            return (
                                <div key={farm.id} className="group bg-white dark:bg-[#1e293b] shadow-sm rounded-[24px] overflow-hidden border border-gray-100 dark:border-gray-700 transition-all hover:shadow-md">
                                    <div onClick={() => toggleFarm(farm.id)} className={`p-5 flex items-center justify-between cursor-pointer border-r-[6px] ${hasStats ? 'border-green-500' : 'border-red-500'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-2xl text-white ${hasStats ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-rose-600'}`}><Icons.Home className="w-6 h-6" /></div>
                                            <div>
                                                <h4 className="font-black text-xl text-gray-800 dark:text-white">{farm.name}</h4>
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${hasStats ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : 'bg-red-100 text-red-700 dark:bg-red-900/30'}`}>{hasStats ? 'ثبت شده' : 'منتظر ثبت'}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!hasStats && (
                                                <Button variant="danger" size="sm" isLoading={alertLoading === farm.id} onClick={(e) => handleSendAlert(farm.id, farm.name, e)} className="shadow-none px-4">
                                                    <Icons.Bell className="w-4 h-4" />
                                                    <span className="hidden lg:inline ml-2 text-sm">ارسال هشدار</span>
                                                </Button>
                                            )}
                                            <Icons.ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                    </div>
                                    <AnimatePresence>
                                        {isExpanded && hasStats && (
                                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="bg-gray-50/50 dark:bg-black/10 p-4 border-t border-gray-100 dark:border-gray-700">
                                                <div className="grid grid-cols-1 gap-3">
                                                    {sortedFarmStats.map(stat => {
                                                        const prod = products.find((p: any) => p.id === stat.productId);
                                                        const invoiceKey = `${stat.farmId}|${normalizeDate(stat.date)}|${stat.productId}`;
                                                        const invoiceTotals = invoiceTotalsMap?.get(invoiceKey);

                                                        // DISPLAY SALES: What was actually invoiced for this product (Total Cartons on Invoice)
                                                        const displaySales = invoiceTotals?.salesCartons ?? (stat.sales || 0);
                                                        const displaySalesKg = invoiceTotals?.salesWeight ?? (stat.salesKg || 0);

                                                        // PHYSICAL USAGE: What was actually deducted from inventory
                                                        const physicalUsage = invoiceTotals?.usageCartons ?? (stat.sales || 0);
                                                        const physicalUsageKg = invoiceTotals?.usageWeight ?? (stat.salesKg || 0);

                                                        // Calculation uses USAGE, not Display Sales
                                                        const effectiveRemaining = calculateFarmStats({
                                                            previousStock: stat.previousBalance || 0,
                                                            production: stat.production || 0,
                                                            sales: physicalUsage, // Pass USAGE here for correct remaining calculation
                                                            previousStockKg: stat.previousBalanceKg || 0,
                                                            productionKg: stat.productionKg || 0,
                                                            salesKg: physicalUsageKg
                                                        });

                                                        const renderVal = (valC: number, valK: number, colorClass: string) => (
                                                            <div className="flex flex-col items-center">
                                                                <span className={`font-black text-lg lg:text-2xl ${colorClass}`}>{toPersianDigits(valC)}</span>
                                                                {valK > 0 && <span className="text-[10px] lg:text-xs font-bold text-gray-500 dark:text-gray-400">{toPersianDigits(valK)} Kg</span>}
                                                            </div>
                                                        );

                                                        const isAdminCreated = stat.creatorRole === UserRole.ADMIN;
                                                        const showTime = !isAdminCreated;

                                                        return (
                                                            <div key={stat.id} className={`bg-white dark:bg-gray-800 p-4 rounded-[20px] shadow-sm border ${isAdminCreated ? 'border-purple-300 dark:border-purple-800 bg-purple-50/30' : 'border-gray-100 dark:border-gray-700'}`}>
                                                                <div className="flex justify-between items-center mb-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <h5 className="font-bold text-gray-800 dark:text-white">{prod?.name}</h5>
                                                                        {isAdminCreated && <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">ثبت توسط مدیر</span>}
                                                                    </div>
                                                                    {showTime && (
                                                                        <div className="text-[10px] text-gray-400 font-bold flex items-center gap-2">
                                                                            <span>ساعت: {toPersianDigits(new Date(stat.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }))}</span>
                                                                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                                            <span>مسئول: {stat.creatorName || 'نامشخص'}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className={`grid gap-2 text-center text-xs ${isMotefereghe ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'}`}>
                                                                    {!isMotefereghe && <div className="p-2 bg-gray-50 dark:bg-gray-700/30 rounded-xl"><span className="text-xs lg:text-sm font-bold text-gray-500 dark:text-gray-400 block mb-1">قبل</span>{renderVal(stat.previousBalance, stat.previousBalanceKg || 0, 'text-gray-700 dark:text-gray-200')}</div>}
                                                                    <div className="p-2 bg-green-50 dark:bg-green-900/10 rounded-xl"><span className="text-xs lg:text-sm font-bold text-green-700 dark:text-green-400 block mb-1">تولید</span>{renderVal(stat.production, stat.productionKg || 0, 'text-green-600 dark:text-green-400')}</div>
                                                                    {!isMotefereghe && <div className="p-2 bg-purple-50 dark:bg-purple-900/10 rounded-xl"><span className="text-xs lg:text-sm font-bold text-purple-600 dark:text-purple-400 block mb-1">جداسازی</span>{renderVal(stat.separationAmount || 0, 0, 'text-purple-600 dark:text-purple-400')}</div>}

                                                                    {/* SALES CARD: Shows Display Sales (What was sold), but calculated using physical usage behind the scenes */}
                                                                    <div className="p-2 bg-red-50 dark:bg-red-900/10 rounded-xl"><span className="text-xs lg:text-sm font-bold text-red-600 dark:text-red-400 block mb-1">فروش</span>{renderVal(displaySales, displaySalesKg, 'text-red-600 dark:text-red-400')}</div>

                                                                    <div className="p-2 bg-blue-50 dark:bg-blue-900/10 rounded-xl"><span className="text-xs lg:text-sm font-bold text-blue-700 dark:text-blue-400 block mb-1">مانده</span>{renderVal(effectiveRemaining.remaining, effectiveRemaining.remainingKg || 0, 'text-blue-600 dark:text-blue-400')}</div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

const FarmStatistics = React.memo(() => {
    const { statistics, fetchStatistics, subscribeToStatistics, isLoading } = useStatisticsStore();
    const { farms, products } = useFarmStore();
    const { invoices, fetchInvoices } = useInvoiceStore();
    const { addToast } = useToastStore();

    const todayJalali = getTodayJalali();
    const normalizedSelectedDate = useMemo(() => normalizeDate(todayJalali), [todayJalali]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

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

    const filteredFarms = useMemo(() => {
        const activeFarms = farms.filter(f => f.isActive);
        if (!searchTerm) return activeFarms;
        return activeFarms.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [farms, searchTerm]);

    const invoiceTotalsMap = useMemo(() => {
        const map = new Map<string, { salesCartons: number; salesWeight: number; usageCartons: number; usageWeight: number }>();

        invoices.forEach(inv => {
            const totalCartons = inv.totalCartons || 0;
            const totalWeight = inv.totalWeight || 0;
            const convertedAmount = inv.convertedAmount || 0;
            const sourceProductId = inv.sourceProductId;

            // --- A. SALES RECORDING (What is displayed as "Sold") ---
            // Attributed to the PRODUCT listed on the invoice
            const salesKey = `${inv.farmId}|${normalizeDate(inv.date)}|${inv.productId || ''}`;
            const prevSales = map.get(salesKey) || { salesCartons: 0, salesWeight: 0, usageCartons: 0, usageWeight: 0 };

            map.set(salesKey, {
                ...prevSales,
                salesCartons: prevSales.salesCartons + totalCartons,
                salesWeight: prevSales.salesWeight + totalWeight
                // usageCartons will be updated in part B
            });

            // --- B. USAGE RECORDING (What is physically deducted) ---

            // 1. Primary Product Deduction (For the product ON the invoice)
            // Deduction = Total - ConvertedAmount
            const primaryUsage = Math.max(0, totalCartons - convertedAmount);
            const primaryWeight = totalCartons > 0 ? (primaryUsage / totalCartons) * totalWeight : 0;

            const prevPrimary = map.get(salesKey) || { salesCartons: 0, salesWeight: 0, usageCartons: 0, usageWeight: 0 };

            // NOTE: We fetch again nicely because map.set in 'A' might have updated it.
            // Using a temporary variable from A logic is safer but we are sequential here.

            map.set(salesKey, {
                ...prevPrimary, // Preserve the sales we just added
                usageCartons: (prevPrimary.usageCartons || 0) + primaryUsage,
                usageWeight: (prevPrimary.usageWeight || 0) + primaryWeight
            });

            // 2. Source Product Deduction (For the converted part)
            if (convertedAmount > 0 && sourceProductId) {
                const sourceKey = `${inv.farmId}|${normalizeDate(inv.date)}|${sourceProductId}`;
                const prevSource = map.get(sourceKey) || { salesCartons: 0, salesWeight: 0, usageCartons: 0, usageWeight: 0 };

                const sourceWeight = totalCartons > 0 ? (convertedAmount / totalCartons) * totalWeight : 0;

                map.set(sourceKey, {
                    ...prevSource,
                    // Sales don't change for Source Product (it wasn't sold, it was converted)
                    usageCartons: prevSource.usageCartons + convertedAmount,
                    usageWeight: prevSource.usageWeight + sourceWeight
                });
            }
        });
        return map;
    }, [invoices]);

    const morvaridiFarms = filteredFarms.filter(f => f.type === FarmType.MORVARIDI);
    const moteferegheFarms = filteredFarms.filter(f => f.type === FarmType.MOTEFEREGHE);

    if (isLoading && statistics.length === 0) {
        return <div className="space-y-4"><SkeletonRow height="h-24" /><SkeletonRow height="h-24" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="bg-white/80 dark:bg-black/40 backdrop-blur-md py-2 px-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between rounded-[24px]">
                <div className="flex-1 w-full flex flex-col gap-3">
                    <h3 className="font-black text-gray-800 dark:text-white text-lg flex items-center flex-wrap">
                        آمار فارم‌ها - <span className="mr-2 shiny-text text-orange-500 font-black">{toPersianDigits(todayJalali)}</span>
                    </h3>
                    <div className="w-full md:w-1/3">
                        <div className="relative">
                            <Icons.Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="جستجوی فارم..."
                                className="w-full h-10 pr-9 pl-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-bold focus:outline-none focus:border-metro-blue"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleManualRefresh} disabled={isRefreshing} className="h-10 px-4 rounded-xl bg-metro-blue hover:bg-metro-cobalt font-bold text-sm">
                        <Icons.Refresh className={`w-4 h-4 ml-2 ${isRefreshing ? 'animate-spin' : ''}`} /> بروزرسانی
                    </Button>
                </div>
            </div>

            <FarmGroup
                title="فارم‌های مرواریدی"
                farms={morvaridiFarms}
                statistics={statistics}
                normalizedSelectedDate={normalizedSelectedDate}
                products={products}
                invoiceTotalsMap={invoiceTotalsMap}
            />

            <FarmGroup
                title="فارم‌های متفرقه"
                farms={moteferegheFarms}
                statistics={statistics}
                normalizedSelectedDate={normalizedSelectedDate}
                products={products}
                invoiceTotalsMap={invoiceTotalsMap}
            />
        </div>
    );
});

// Optimized Row Component for react-window
const VirtualizedInvoiceRow = ({ index, style, data }: { index: number, style: React.CSSProperties, data: { invoices: Invoice[], farms: any[], products: any[], renderInvoiceNumber: any } }) => {
    const invoice = data.invoices[index];
    const { farms, products, renderInvoiceNumber } = data;

    if (!invoice) return null;

    const productName = products.find((p: any) => p.id === invoice.productId)?.name || '-';
    const isEdited = invoice.updatedAt && invoice.updatedAt > invoice.createdAt + 2000;
    const isAdminCreated = invoice.creatorRole === UserRole.ADMIN;
    const isPending = invoice.isPending;
    const isOffline = invoice.isOffline;

    const displayTime = isAdminCreated
        ? '---'
        : new Date(isEdited ? invoice.updatedAt! : invoice.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

    const farmName = farms.find((f: any) => f.id === invoice.farmId)?.name || 'نامشخص';

    return (
        <div style={style} className={`grid grid-cols-[0.8fr_1fr_1.2fr_1.5fr_0.8fr_0.8fr_1fr_0.8fr] gap-2 items-center px-4 text-gray-800 dark:text-gray-200 text-sm border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700/50 transition-colors ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900/30'} ${isAdminCreated ? 'bg-purple-50/20' : ''} ${isPending ? 'bg-blue-50/50 animate-pulse' : ''} ${isOffline ? 'bg-orange-50/30' : ''}`}>
            {/* 1. Date */}
            <div className={`font-black tracking-tight text-center truncate ${isPending ? 'text-blue-500' : isOffline ? 'text-orange-600' : ''}`}>
                {toPersianDigits(invoice.date)}
            </div>

            {/* 2. Invoice Num */}
            <div className="text-center font-mono font-bold scale-95 truncate flex items-center justify-center gap-1" dir="ltr">
                {isPending && <Icons.Refresh className="w-3 h-3 animate-spin text-blue-500" />}
                {isOffline && <Icons.Clock className="w-3 h-3 text-orange-500" />}
                {renderInvoiceNumber(invoice.invoiceNumber)}
            </div>

            {/* 3. Farm */}
            <div className="font-bold text-right truncate text-xs lg:text-sm" title={farmName}>
                {farmName}
            </div>

            {/* 4. Product */}
            <div className="font-bold text-gray-700 dark:text-gray-200 text-xs leading-tight truncate" title={productName}>
                {productName}
            </div>

            {/* 5. Count */}
            <div className="text-center">
                <span className={`text-base px-2 py-0.5 rounded shadow-sm inline-block min-w-[40px] ${isOffline ? 'bg-orange-100 text-orange-700 font-black' : isPending ? 'bg-blue-100 text-blue-700 font-black' : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 font-bold'}`}>
                    {toPersianDigits(invoice.totalCartons)}
                </span>
            </div>

            {/* 6. Weight */}
            <div className="text-center">
                <span className={`text-base px-2 py-0.5 rounded shadow-sm inline-block min-w-[50px] ${isOffline ? 'bg-orange-50 text-orange-600 font-black' : isPending ? 'bg-blue-50 text-blue-500 font-black' : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 font-bold'}`}>
                    {toPersianDigits(invoice.totalWeight)}
                </span>
            </div>

            {/* 7. Registrar */}
            <div className="text-center">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold truncate inline-block max-w-[90%] ${isOffline ? 'bg-orange-500 text-white' : isPending ? 'bg-blue-500 text-white' : isAdminCreated ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 dark:bg-gray-700'}`}>
                    {isOffline ? 'آفلاین' : isPending ? 'کمی صبر...' : (isAdminCreated ? 'مدیر' : (invoice.creatorName || 'ناشناس'))}
                </span>
            </div>

            {/* 8. Time */}
            <div className="text-center">
                <div className="flex flex-col items-center">
                    <span className="font-mono text-[10px] font-bold text-gray-600 dark:text-gray-400 dir-ltr">{toPersianDigits(displayTime)}</span>
                    {isEdited && !isAdminCreated && <span className="text-[8px] text-orange-500 font-bold mt-0.5">(ویرایش)</span>}
                    {isPending && <span className="text-[8px] text-blue-500 font-black animate-bounce mt-0.5">ارسال...</span>}
                    {isOffline && <span className="text-[8px] text-orange-600 font-black mt-0.5">در صف</span>}
                </div>
            </div>
        </div>
    );
};

const InvoiceList = React.memo(() => {
    const { invoices, fetchInvoices, isLoading } = useInvoiceStore();
    const { farms, products } = useFarmStore();
    const { addToast } = useToastStore();
    const [selectedFarmId, setSelectedFarmId] = useState<string>('all');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const today = getTodayJalali();
    const normalizedToday = normalizeDate(today);

    useEffect(() => {
        fetchInvoices();
    }, []);

    const filteredInvoices = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        const { queue } = useSyncStore.getState();

        // 1. Base results from store
        const baseResults = invoices.filter(i => {
            const itemDate = normalizeDate(i.date);
            const dateMatch = itemDate === normalizedToday;
            const farmMatch = selectedFarmId === 'all' || i.farmId === selectedFarmId;
            const searchMatch = !term || (
                i.invoiceNumber.includes(term) ||
                i.driverName?.toLowerCase().includes(term) ||
                i.plateNumber?.includes(term) ||
                formatPlateNumber(i.plateNumber).includes(term)
            );
            return dateMatch && farmMatch && searchMatch;
        });

        // 2. Add queued invoices
        const currentUser = useAuthStore.getState().user;
        const queuedInvoices: Invoice[] = queue
            .filter((item: SyncItem) => item.type === 'INVOICE')
            .map((item: SyncItem) => ({
                ...item.payload,
                id: item.id,
                createdAt: item.timestamp,
                isPending: false,
                isOffline: true,
                creatorName: currentUser?.fullName || 'شما',
                creatorRole: currentUser?.role
            }))
            .filter((i: Invoice) => {
                const itemDate = normalizeDate(i.date);
                const dateMatch = itemDate === normalizedToday;
                const farmMatch = selectedFarmId === 'all' || i.farmId === selectedFarmId;
                const searchMatch = !term || (
                    i.invoiceNumber.includes(term) ||
                    i.driverName?.toLowerCase().includes(term) ||
                    i.plateNumber?.includes(term)
                );
                return dateMatch && farmMatch && searchMatch;
            });

        const merged = [...baseResults];
        queuedInvoices.forEach(queued => {
            const isDuplicate = baseResults.some(base =>
                base.invoiceNumber === queued.invoiceNumber &&
                base.productId === queued.productId
            );
            if (!isDuplicate) merged.push(queued);
        });

        return merged.sort((a, b) => b.createdAt - a.createdAt);
    }, [invoices, normalizedToday, selectedFarmId, searchTerm, farms, products]);

    const totals = useMemo(() => {
        return filteredInvoices.reduce((acc, curr) => ({
            cartons: acc.cartons + (curr.totalCartons || 0),
            weight: acc.weight + (curr.totalWeight || 0)
        }), { cartons: 0, weight: 0 });
    }, [filteredInvoices]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchInvoices();
        setTimeout(() => setIsRefreshing(false), 500);
        addToast('لیست حواله‌ها بروزرسانی شد', 'info');
    };

    const renderInvoiceNumber = useCallback((num: string) => {
        const strNum = toPersianDigits(num);
        if (strNum.length < 4) return <span className="text-gray-800 dark:text-gray-200 text-lg font-mono">{strNum}</span>;
        const mainPart = strNum.slice(0, -4);
        const lastPart = strNum.slice(-4);
        return (
            <div className="flex justify-center items-center gap-0.5">
                <span className="text-gray-500 dark:text-gray-400 font-bold text-base font-mono">{mainPart}</span>
                <span className="text-black dark:text-white font-black text-lg font-mono">{lastPart}</span>
            </div>
        );
    }, []);

    // Helper for List Data
    const itemData = useMemo(() => ({
        invoices: filteredInvoices,
        farms,
        products,
        renderInvoiceNumber
    }), [filteredInvoices, farms, products, renderInvoiceNumber]);

    return (
        <div className="space-y-4 lg:space-y-6 flex flex-col h-full">
            <div className="bg-white/80 dark:bg-black/40 backdrop-blur-md p-4 lg:p-6 shadow-sm border-l-4 border-metro-orange flex flex-col md:flex-row gap-4 lg:gap-6 items-end rounded-xl shrink-0">
                <div className="w-full md:w-1/3">
                    <label className="block text-sm font-bold mb-1 lg:mb-2 text-gray-700 dark:text-gray-300">جستجو در حواله‌های امروز</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            placeholder="شماره حواله، راننده، پلاک..."
                            className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 dark:text-white font-bold outline-none focus:border-metro-orange transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="w-full md:w-1/3">
                    <label className="block text-sm font-bold mb-1 lg:mb-2 text-gray-700 dark:text-gray-300">فیلتر بر اساس فارم</label>
                    <select
                        className="w-full p-3 border-2 border-gray-300 bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-black outline-none focus:border-metro-orange h-[50px] rounded-lg lg:text-lg"
                        value={selectedFarmId}
                        onChange={(e) => setSelectedFarmId(e.target.value)}
                    >
                        <option value="all">همه فارم‌های فعال</option>
                        {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <Button onClick={handleRefresh} disabled={isRefreshing} className="bg-metro-orange h-[50px] px-6 font-black w-full lg:text-lg">
                        <Icons.Refresh className={`w-4 h-4 lg:w-6 lg:h-6 ml-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                        بروزرسانی
                    </Button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-0 shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700 rounded-xl flex-1 flex flex-col min-h-[500px]">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shrink-0 flex justify-between items-center">
                    <h3 className="font-black text-xl text-gray-800 dark:text-white flex items-center gap-2">
                        <Icons.FileText className="w-6 h-6 text-metro-orange" />
                        فروش امروز ({toPersianDigits(today)})
                    </h3>
                    <span className="text-xs font-bold text-gray-400">
                        {toPersianDigits(filteredInvoices.length)} مورد
                    </span>
                </div>

                {/* Virtualized List Container */}
                <div className="flex-1 w-full relative">
                    {/* Header Row - Sticky */}
                    <div className="grid grid-cols-[0.8fr_1fr_1.2fr_1.5fr_0.8fr_0.8fr_1fr_0.8fr] gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 text-xs lg:text-sm font-black uppercase border-b border-gray-200 dark:border-gray-700">
                        <div className="text-center">تاریخ خروج</div>
                        <div className="text-center">رمز حواله</div>
                        <div className="text-right">فارم</div>
                        <div className="text-right">نوع محصول</div>
                        <div className="text-center">تعداد (کارتن)</div>
                        <div className="text-center">وزن (Kg)</div>
                        <div className="text-center">ثبت کننده</div>
                        <div className="text-center">ساعت</div>
                    </div>

                    <div className="absolute top-[45px] bottom-0 left-0 right-0">
                        {isLoading ? (
                            <div className="p-4 space-y-4">
                                <SkeletonRow cols={8} />
                                <SkeletonRow cols={8} />
                                <SkeletonRow cols={8} />
                            </div>
                        ) : filteredInvoices.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <Icons.FileText className="w-16 h-16 mb-2 opacity-30" />
                                <span className="font-bold lg:text-lg">هیچ حواله‌ای برای امروز ثبت نشده است.</span>
                            </div>
                        ) : (
                            <AutoSizer>
                                {({ height, width }: { height: number, width: number }) => (
                                    <List
                                        height={height}
                                        itemCount={filteredInvoices.length}
                                        itemSize={64} // Row height
                                        width={width}
                                        itemData={itemData}
                                        className="custom-scrollbar"
                                        direction="rtl"
                                    >
                                        {VirtualizedInvoiceRow}
                                    </List>
                                )}
                            </AutoSizer>
                        )}
                    </div>
                </div>

                {filteredInvoices.length > 0 && (
                    <div className="bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4 flex justify-end items-center gap-6 shrink-0 z-20 shadow-md">
                        <div className="text-sm font-bold text-gray-600 dark:text-gray-400">جمع کل امروز:</div>
                        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                            <span className="text-gray-500 text-xs font-bold">کارتن:</span>
                            <span className="font-black text-lg text-gray-800 dark:text-white">{toPersianDigits(totals.cartons)}</span>
                        </div>
                        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                            <span className="text-gray-500 text-xs font-bold">وزن:</span>
                            <span className="font-black text-lg text-metro-blue">{toPersianDigits(totals.weight)}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

const DashboardHome: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 lg:gap-6">
            <MetroTile title="پایش آمار فارم‌ها" icon={Icons.BarChart} color="bg-metro-blue" size="wide" onClick={() => onNavigate('farm-stats')} />
            <MetroTile title="لیست حواله‌های فروش" icon={Icons.List} color="bg-metro-orange" size="wide" onClick={() => onNavigate('invoices')} />
            <MetroTile title="گزارشات اکسل جامع" icon={Icons.FileText} color="bg-metro-purple" size="wide" onClick={() => onNavigate('reports')} />
        </div>
    );
};

const SalesDashboard: React.FC = () => {
    const [currentView, setCurrentView] = useState('dashboard');
    const { isLoading } = useAuthStore();

    const getTitle = () => {
        if (currentView === 'farm-stats') return 'پایش آمار لحظه‌ای';
        if (currentView === 'invoices') return 'جدول فروش امروز';
        if (currentView === 'reports') return 'گزارشات فروش';
        return 'میز کار آمار و فروش';
    }

    const renderContent = () => {
        if (isLoading && currentView === 'dashboard') {
            return (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <SkeletonTile size="wide" />
                    <SkeletonTile size="wide" />
                    <SkeletonTile size="wide" />
                </div>
            );
        }

        switch (currentView) {
            case 'farm-stats': return <FarmStatistics />;
            case 'invoices': return <InvoiceList />;
            case 'reports': return <Reports />;
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
