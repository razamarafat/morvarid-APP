
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Icons } from '../components/common/Icons';
import Reports from '../components/admin/Reports';
import { useStatisticsStore, DailyStatistic } from '../../store/statisticsStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useFarmStore } from '../../store/farmStore';
import { useToastStore } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { useAlertStore } from '../../store/alertStore';
import { getTodayJalali, normalizeDate, toPersianDigits } from '../../utils/dateUtils';
import Button from '../components/common/Button';
import MetroTile from '../components/common/MetroTile';
import { motion, AnimatePresence } from 'framer-motion';
import { FarmType } from '../../types';
import JalaliDatePicker from '../components/common/JalaliDatePicker';
import { SkeletonTile, SkeletonRow } from '../components/common/Skeleton';

// --- DEBUG HELPER ---
const logOnce = (key: string, message: string, data?: any) => {
    // @ts-ignore
    if (!window[`_log_${key}`]) {
        console.log(`[DEBUG] ${message}`, data);
        // @ts-ignore
        window[`_log_${key}`] = true;
    }
};

const sortProducts = (products: any[], aId: string, bId: string) => {
    const pA = products.find(p => p.id === aId);
    const pB = products.find(p => p.id === bId);
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
};

const FarmStatistics = () => {
    const { statistics, fetchStatistics, subscribeToStatistics, isLoading } = useStatisticsStore();
    const { farms, products } = useFarmStore(); 
    const { fetchInvoices } = useInvoiceStore();
    const { addToast } = useToastStore();
    const { sendAlert } = useAlertStore();
    
    const todayJalali = getTodayJalali();
    const [selectedDate] = useState(todayJalali);
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
        
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                const ctx = new AudioContextClass();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.setValueAtTime(440, ctx.currentTime);
                osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                osc.start();
                osc.stop(ctx.currentTime + 0.3);
            }
        } catch(e) {}

        const message = `عدم ثبت آمار برای فارم ${farmName} در تاریخ ${normalizedSelectedDate}`;
        const result = await sendAlert(farmId, farmName, message);
        
        if (result.success) {
            addToast(`هشدار آنی برای مسئول ${farmName} ارسال شد`, 'success');
        } else {
            addToast('خطا در ارسال هشدار', 'error');
        }
        setAlertLoading(null);
    };

    const toggleFarm = (farmId: string) => {
        setExpandedFarmId(expandedFarmId === farmId ? null : farmId);
    };

    const getDeduplicatedStats = useCallback((farmId: string) => {
        const farmStats = statistics.filter(s => s.farmId === farmId && normalizeDate(s.date) === normalizedSelectedDate);
        const uniqueMap = new Map<string, DailyStatistic>();
        
        farmStats.forEach(stat => {
            if (uniqueMap.has(stat.productId)) {
                const existing = uniqueMap.get(stat.productId)!;
                const existingTime = new Date(existing.updatedAt || existing.createdAt).getTime();
                const newTime = new Date(stat.updatedAt || stat.createdAt).getTime();
                if (newTime > existingTime) {
                    uniqueMap.set(stat.productId, stat);
                }
            } else {
                uniqueMap.set(stat.productId, stat);
            }
        });
        
        return Array.from(uniqueMap.values());
    }, [statistics, normalizedSelectedDate]);

    if (isLoading && statistics.length === 0) {
        return (
            <div className="space-y-4">
                <SkeletonRow height="h-24" />
                <SkeletonRow height="h-24" />
                <SkeletonRow height="h-24" />
            </div>
        );
    }

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
                    const dedupedStats = getDeduplicatedStats(farm.id);
                    const sortedFarmStats = [...dedupedStats].sort((a, b) => sortProducts(products, a.productId, b.productId));
                    const hasStats = sortedFarmStats.length > 0;
                    const isExpanded = expandedFarmId === farm.id;
                    const isMotefereghe = farm.type === FarmType.MOTEFEREGHE;

                    return (
                        <div key={farm.id} className="group shadow-sm hover:shadow-xl transition-all duration-300 rounded-[28px] overflow-hidden border border-gray-200 dark:border-gray-700">
                            <div onClick={() => toggleFarm(farm.id)} className={`p-5 lg:p-7 flex items-center justify-between cursor-pointer transition-colors border-r-[8px] ${hasStats ? 'bg-white dark:bg-gray-800 border-green-500 hover:bg-gray-50 dark:hover:bg-gray-700/50' : 'bg-white dark:bg-gray-800 border-red-500 hover:bg-red-50 dark:hover:bg-red-900/10'}`}>
                                <div className="flex items-center gap-4 lg:gap-6">
                                    <div className={`p-4 rounded-[20px] shadow-sm text-white ${hasStats ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-rose-600'}`}><Icons.Home className="w-6 h-6 lg:w-8 lg:h-8" /></div>
                                    <div>
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
                                            <Icons.Bell className={`w-5 h-5 lg:ml-2 ${alertLoading === farm.id ? 'animate-bounce' : ''}`} />
                                            <span className="hidden lg:inline text-lg">ارسال هشدار</span>
                                        </Button>
                                    )}
                                    <Icons.ChevronDown className={`w-6 h-6 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>
                            </div>
                            <AnimatePresence>
                                {isExpanded && hasStats && (
                                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="bg-gray-50 dark:bg-black/20 p-5 lg:p-8 border-t">
                                        <div className="grid grid-cols-1 gap-4">
                                            {sortedFarmStats.map(stat => {
                                                const prod = products.find(p => p.id === stat.productId);
                                                
                                                const showCarton = stat.production > 0 || stat.sales > 0 || stat.previousBalance > 0 || stat.currentInventory > 0;
                                                const showKg = stat.productionKg > 0 || stat.salesKg > 0 || stat.previousBalanceKg > 0 || stat.currentInventoryKg > 0;

                                                const renderVal = (valC: number, valK: number, colorClass: string) => (
                                                    <div className="flex flex-col items-center">
                                                        {showCarton && <span className={`font-black text-xl lg:text-2xl ${colorClass}`}>{toPersianDigits(valC)} <small className="text-[10px] text-gray-500">کارتن</small></span>}
                                                        {showKg && <span className={`font-black text-lg lg:text-xl text-metro-blue`}>{toPersianDigits(valK)} <small className="text-[10px] text-gray-500">کیلوگرم</small></span>}
                                                        {!showCarton && !showKg && <span className="font-black text-xl text-gray-400">0</span>}
                                                    </div>
                                                );

                                                return (
                                                <div key={stat.id} className="bg-white dark:bg-gray-800 p-4 rounded-[24px] border border-gray-100 dark:border-gray-700 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                                    <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
                                                        <h5 className="font-black text-lg text-gray-800 dark:text-white">{prod?.name}</h5>
                                                        <div className="flex items-center gap-4 text-xs font-bold text-gray-400">
                                                            <div className="flex items-center gap-1">
                                                                <Icons.User className="w-3 h-3" />
                                                                <span>{stat.creatorName || 'ناشناس'}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <Icons.Clock className="w-3 h-3" />
                                                                <span className="font-mono">{new Date(stat.createdAt).toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'})}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className={`grid gap-2 ${isMotefereghe ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
                                                        
                                                        {!isMotefereghe && (
                                                            <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-500/10 border border-slate-200 dark:border-slate-700 shadow-sm">
                                                                <span className="text-xs font-bold text-slate-500 mb-1">موجودی قبل</span>
                                                                {renderVal(stat.previousBalance, stat.previousBalanceKg || 0, 'text-slate-600 dark:text-slate-300')}
                                                            </div>
                                                        )}
                                                        
                                                        <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-green-500/10 border border-green-200 dark:border-green-800 shadow-sm">
                                                            <span className="text-xs font-bold text-green-600 mb-1">{isMotefereghe ? 'موجودی اعلامی' : 'تولید روز'}</span>
                                                            {renderVal(stat.production, stat.productionKg || 0, 'text-green-600')}
                                                        </div>

                                                        <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-red-500/10 border border-red-200 dark:border-red-800 shadow-sm">
                                                            <span className="text-xs font-bold text-red-600 mb-1">فروش</span>
                                                            {renderVal(stat.sales, stat.salesKg || 0, 'text-red-500')}
                                                        </div>

                                                        <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-blue-500/10 border border-blue-200 dark:border-blue-800 shadow-sm">
                                                            <span className="text-xs font-bold text-blue-600 mb-1">مانده نهایی</span>
                                                            {renderVal(stat.currentInventory, stat.currentInventoryKg || 0, 'text-blue-600')}
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

// Robust Invoice Row Component with Internal Error Handling
const InvoiceRow = ({ index, style, data }: { index: number; style: React.CSSProperties; data: any }) => {
    try {
        if (!data || !data.invoices) {
            logOnce('invoice_row_no_data', 'Missing data object in InvoiceRow', { index });
            return <div style={style}></div>;
        }

        const invoice = data.invoices[index];
        if (!invoice) {
            // This is expected for virtual lists that overscan, but worth noting if index is vastly out of bounds
            return <div style={style} />; 
        }

        const { farms, products, renderInvoiceNumber } = data;
        const productName = products.find((p: any) => p.id === invoice.productId)?.name || '-';
        
        return (
            <div style={style} className="flex items-center text-right border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700/50 transition-colors text-gray-800 dark:text-gray-200 text-sm lg:text-lg overflow-hidden">
                <div className="flex-[1] px-2 font-black whitespace-nowrap tracking-tighter shrink-0">{toPersianDigits(invoice.date)}</div>
                <div className="flex-[1] px-2 text-center dir-ltr shrink-0">{renderInvoiceNumber(invoice.invoiceNumber)}</div>
                <div className="flex-[1] px-2 whitespace-nowrap font-bold truncate shrink-0">{farms.find((f: any) => f.id === invoice.farmId)?.name}</div>
                <div className="flex-[1] px-2 font-bold text-gray-600 dark:text-gray-300 truncate shrink-0">{productName}</div>
                <div className="flex-[1] px-2 text-center font-black lg:text-xl shrink-0">{toPersianDigits(invoice.totalCartons)}</div>
                <div className="flex-[1] px-2 font-black text-metro-blue lg:text-xl shrink-0">{toPersianDigits(invoice.totalWeight)}</div>
                <div className="flex-[1] px-2 shrink-0">
                    <span className={`px-2 py-0.5 text-xs lg:text-sm font-black text-white rounded ${invoice.isYesterday ? 'bg-metro-orange' : 'bg-metro-green'}`}>
                        {invoice.isYesterday ? 'دیروز' : 'عادی'}
                    </span>
                </div>
            </div>
        );
    } catch (e) {
        console.error('Crash in InvoiceRow:', e);
        return <div style={style} className="text-red-500 text-xs">Error rendering row</div>;
    }
};

const InvoiceList = () => {
    const { invoices, fetchInvoices, isLoading } = useInvoiceStore();
    const { farms, products } = useFarmStore(); 
    const { addToast } = useToastStore();
    const [selectedFarmId, setSelectedFarmId] = useState<string>('all');
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    const [filterDate, setFilterDate] = useState(getTodayJalali());
    const normalizedFilterDate = normalizeDate(filterDate);

    useEffect(() => {
        fetchInvoices();
    }, []);

    const filteredInvoices = useMemo(() => {
        const results = invoices
            .filter(i => {
                const dateMatch = normalizeDate(i.date) === normalizedFilterDate;
                const farmMatch = selectedFarmId === 'all' || i.farmId === selectedFarmId;
                return dateMatch && farmMatch;
            })
            .sort((a, b) => b.createdAt - a.createdAt);
        
        logOnce('filtered_invoices', `Filtered Invoices Count: ${results.length}`);
        return results;
    }, [invoices, normalizedFilterDate, selectedFarmId]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchInvoices();
        setTimeout(() => setIsRefreshing(false), 500);
        addToast('لیست حواله‌ها بروزرسانی شد', 'info');
    };

    const renderInvoiceNumber = useCallback((num: string) => {
        const strNum = toPersianDigits(num);
        if (strNum.length < 4) return <span className="text-gray-800 dark:text-gray-200 lg:text-xl">{strNum}</span>;
        const mainPart = strNum.slice(0, -4);
        const lastPart = strNum.slice(-4);
        return (
            <div className="flex justify-end items-center gap-0.5">
                <span className="text-gray-500 dark:text-gray-400 font-bold text-base lg:text-xl">{mainPart}</span>
                <span className="text-black dark:text-white font-black text-lg lg:text-2xl">{lastPart}</span>
            </div>
        );
    }, []);

    const itemData = useMemo(() => ({
        invoices: filteredInvoices,
        farms,
        products,
        renderInvoiceNumber
    }), [filteredInvoices, farms, products, renderInvoiceNumber]);

    return (
        <div className="space-y-4 lg:space-y-6 flex flex-col h-full">
             <div className="bg-white dark:bg-gray-800 p-4 lg:p-6 shadow-sm border-l-4 border-metro-orange flex flex-col md:flex-row gap-4 lg:gap-6 items-end rounded-xl shrink-0">
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

            <div className="bg-white dark:bg-gray-800 p-0 shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700 rounded-xl flex-1 flex flex-col h-[600px] md:h-auto min-h-[500px]">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shrink-0">
                    <h3 className="font-black text-xl text-gray-800 dark:text-white flex items-center gap-2">
                        <Icons.FileText className="w-6 h-6 text-metro-orange" />
                        جدول فروش روزانه
                    </h3>
                </div>
                
                {/* Fixed height container to ensure AutoSizer works */}
                <div className="flex-1 w-full relative" style={{ minHeight: '400px' }}>
                    {isLoading ? (
                        <div className="p-4">
                            <SkeletonRow cols={7} />
                            <SkeletonRow cols={7} />
                            <SkeletonRow cols={7} />
                        </div>
                    ) : filteredInvoices.length === 0 ? (
                        <div className="text-center py-20 text-gray-400 font-bold lg:text-lg">
                            <div className="flex flex-col items-center">
                                <Icons.FileText className="w-16 h-16 mb-2 opacity-30" />
                                <span>هیچ حواله‌ای برای تاریخ {toPersianDigits(normalizedFilterDate)} ثبت نشده است.</span>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full h-full overflow-hidden">
                            <div className="min-w-[900px] h-full flex flex-col">
                                 <div className="flex bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-sm lg:text-lg font-bold p-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
                                    <div className="flex-[1] px-2">تاریخ خروج</div>
                                    <div className="flex-[1] px-2 text-center">رمز حواله</div>
                                    <div className="flex-[1] px-2">فارم</div>
                                    <div className="flex-[1] px-2">نوع محصول</div>
                                    <div className="flex-[1] px-2 text-center">تعداد (کارتن)</div>
                                    <div className="flex-[1] px-2">وزن (Kg)</div>
                                    <div className="flex-[1] px-2">وضعیت</div>
                                </div>
                                <div className="flex-1 w-full h-full">
                                    <AutoSizer>
                                        {({ height, width }) => {
                                            // DIAGNOSTIC LOGGING FOR AUTOSIZER
                                            if (!height || !width || height === 0 || width === 0) {
                                                logOnce('autosizer_zero', 'AutoSizer detected 0 dimensions', { height, width });
                                                // Return a valid element to prevent #525
                                                return <div style={{ height: '100%', width: '100%' }} />;
                                            }
                                            
                                            return (
                                                <List
                                                    height={height}
                                                    itemCount={filteredInvoices.length}
                                                    itemSize={80} 
                                                    width={Math.max(width, 900)}
                                                    itemData={itemData}
                                                    className="custom-scrollbar"
                                                    style={{ direction: 'rtl' }}
                                                >
                                                    {InvoiceRow}
                                                </List>
                                            );
                                        }}
                                    </AutoSizer>
                                </div>
                            </div>
                        </div>
                    )}
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
            const prod = relevantStats
                .filter(s => s.date === date)
                .reduce((sum, s) => sum + (s.production || 0), 0);

            const sale = relevantInvoices
                .filter(i => i.date === date)
                .reduce((sum, i) => sum + (i.totalCartons || 0), 0);

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
                        <option value="all">همه فارم‌های</option>
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

            <div className="bg-white dark:bg-gray-800 p-6 lg:p-8 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-x-auto">
                <div className="min-w-[600px] h-[350px] lg:h-[450px] relative pt-6 pb-8 px-4 flex items-end gap-2 md:gap-4 lg:gap-6">
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
                                    <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] lg:text-sm p-2 lg:p-3 rounded pointer-events-none whitespace-nowrap z-20">
                                        <div className="text-center font-bold mb-1 border-b border-white/20 pb-1">{point.date}</div>
                                        <div>تولید: {toPersianDigits(point.prod)}</div>
                                        <div>فروش: {toPersianDigits(point.sale)}</div>
                                    </div>

                                    <div className="w-full flex justify-center items-end gap-1 h-full">
                                        <motion.div 
                                            initial={{ height: 0 }} 
                                            animate={{ height: `${prodHeight}%` }}
                                            transition={{ duration: 0.5, delay: index * 0.05 }}
                                            className="w-1/2 max-w-[20px] lg:max-w-[40px] bg-green-500 rounded-t-sm hover:bg-green-400 transition-colors relative"
                                        >
                                            {prodHeight > 10 && <span className="absolute top-1 left-0 w-full text-center text-[10px] lg:text-xs text-white/90 font-bold">{toPersianDigits(point.prod)}</span>}
                                        </motion.div>
                                        
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
    const { isLoading } = useAuthStore();

    const getTitle = () => {
        if(currentView === 'farm-stats') return 'پایش آمار لحظه‌ای';
        if(currentView === 'invoices') return 'جدول فروش روزانه';
        if(currentView === 'reports') return 'گزارشات فروش';
        if(currentView === 'analytics') return 'تحلیل نموداری تولید و فروش';
        return 'داشبورد فروش و توزیع';
    }

    const renderContent = () => {
        if (isLoading && currentView === 'dashboard') {
            return (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <SkeletonTile size="wide" />
                    <SkeletonTile size="wide" />
                    <SkeletonTile size="medium" />
                    <SkeletonTile size="medium" />
                </div>
            );
        }

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
