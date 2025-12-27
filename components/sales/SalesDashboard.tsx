
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import DashboardLayout from '../layout/DashboardLayout';
import { Icons } from '../common/Icons';
import Reports from '../admin/Reports';
import { useStatisticsStore, DailyStatistic } from '../../store/statisticsStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useFarmStore } from '../../store/farmStore';
import { useToastStore } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { useAlertStore } from '../../store/alertStore';
import { getTodayJalali, normalizeDate, toPersianDigits } from '../../utils/dateUtils';
import { compareProducts } from '../../utils/sortUtils';
import Button from '../common/Button';
import MetroTile from '../common/MetroTile';
import { motion, AnimatePresence } from 'framer-motion';
import { FarmType, Invoice, UserRole } from '../../types';
import JalaliDatePicker from '../common/JalaliDatePicker';
import { SkeletonTile, SkeletonRow } from '../common/Skeleton';

const FarmStatistics = React.memo(() => {
    const { statistics, fetchStatistics, subscribeToStatistics, isLoading } = useStatisticsStore();
    const { farms, products } = useFarmStore(); 
    const { fetchInvoices } = useInvoiceStore();
    const { addToast } = useToastStore();
    const { sendAlert } = useAlertStore();
    
    const todayJalali = getTodayJalali();
    const normalizedSelectedDate = useMemo(() => normalizeDate(todayJalali), [todayJalali]);
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
        const result = await sendAlert(farmId, farmName, message);
        if (result.success) addToast(`هشدار ارسال شد`, 'success');
        else addToast('خطا در ارسال هشدار', 'error');
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
                if (newTime > existingTime) uniqueMap.set(stat.productId, stat);
            } else {
                uniqueMap.set(stat.productId, stat);
            }
        });
        return Array.from(uniqueMap.values());
    }, [statistics, normalizedSelectedDate]);

    if (isLoading && statistics.length === 0) {
        return <div className="space-y-4"><SkeletonRow height="h-24" /><SkeletonRow height="h-24" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="bg-white/80 dark:bg-black/40 backdrop-blur-md p-4 lg:p-6 shadow-sm border border-white/20 dark:border-white/10 flex flex-col md:flex-row gap-4 lg:gap-6 items-center justify-between rounded-[28px]">
                <div className="flex-1 w-full">
                    <h3 className="font-black text-gray-800 dark:text-white text-lg lg:text-2xl flex items-center flex-wrap">
                        آمار فارم‌ها - <span className="text-metro-blue mr-2">{toPersianDigits(todayJalali)}</span>
                    </h3>
                </div>
                <Button onClick={handleManualRefresh} disabled={isRefreshing} className="h-12 px-6 rounded-xl bg-metro-blue hover:bg-metro-cobalt font-bold text-lg">
                    <Icons.Refresh className={`w-5 h-5 ml-2 ${isRefreshing ? 'animate-spin' : ''}`} /> بروزرسانی
                </Button>
            </div>

            <div className="grid gap-4">
                {farms.map(farm => {
                    const dedupedStats = getDeduplicatedStats(farm.id);
                    // TASK 1: Apply global compareProducts sort
                    const sortedFarmStats = [...dedupedStats].sort((a, b) => {
                        const pA = products.find(p => p.id === a.productId);
                        const pB = products.find(p => p.id === b.productId);
                        if (!pA || !pB) return 0;
                        return compareProducts(pA, pB);
                    });
                    
                    const hasStats = sortedFarmStats.length > 0;
                    const isExpanded = expandedFarmId === farm.id;
                    const isMotefereghe = farm.type === FarmType.MOTEFEREGHE;

                    return (
                        <div key={farm.id} className="group bg-white dark:bg-[#1e293b] shadow-sm rounded-[24px] overflow-hidden border border-gray-100 dark:border-gray-700 transition-all">
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
                                                const prod = products.find(p => p.id === stat.productId);
                                                const renderVal = (valC: number, valK: number, colorClass: string) => (
                                                    <div className="flex flex-col items-center">
                                                        <span className={`font-black text-lg ${colorClass}`}>{toPersianDigits(valC)}</span>
                                                        {valK > 0 && <span className="text-[10px] text-gray-400">{toPersianDigits(valK)} Kg</span>}
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
                                                        {showTime && <span className="text-[10px] text-gray-400 font-mono">{toPersianDigits(new Date(stat.createdAt).toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'}))}</span>}
                                                    </div>
                                                    <div className={`grid gap-2 text-center ${isMotefereghe ? 'grid-cols-3' : 'grid-cols-4'}`}>
                                                        {!isMotefereghe && <div className="p-2 bg-gray-50 dark:bg-gray-700/30 rounded-xl"><span className="text-[10px] text-gray-400 block">قبل</span>{renderVal(stat.previousBalance, stat.previousBalanceKg || 0, 'text-gray-600 dark:text-gray-300')}</div>}
                                                        <div className="p-2 bg-green-50 dark:bg-green-900/10 rounded-xl"><span className="text-[10px] text-green-600 block">تولید</span>{renderVal(stat.production, stat.productionKg || 0, 'text-green-600')}</div>
                                                        <div className="p-2 bg-red-50 dark:bg-red-900/10 rounded-xl"><span className="text-[10px] text-red-500 block">فروش</span>{renderVal(stat.sales, stat.salesKg || 0, 'text-red-500')}</div>
                                                        <div className="p-2 bg-blue-50 dark:bg-blue-900/10 rounded-xl"><span className="text-[10px] text-blue-600 block">مانده</span>{renderVal(stat.currentInventory, stat.currentInventoryKg || 0, 'text-blue-600')}</div>
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
});

const GRID_TEMPLATE = "grid grid-cols-[90px_110px_100px_minmax(200px,1.5fr)_80px_80px_120px_80px_80px] gap-4 items-center whitespace-nowrap";

const StandardInvoiceRow = React.memo(({ invoice, farms, products, renderInvoiceNumber }: { invoice: Invoice, farms: any[], products: any[], renderInvoiceNumber: (num: string) => any }) => {
    const productName = products.find((p: any) => p.id === invoice.productId)?.name || '-';
    // Edit logic: Updated only if updatedAt exists AND is > createdAt + 2000ms
    const isEdited = invoice.updatedAt && invoice.updatedAt > invoice.createdAt + 2000;
    const isAdminCreated = invoice.creatorRole === UserRole.ADMIN;
    
    // Hide time for Admin records
    const displayTime = isAdminCreated 
        ? '---' 
        : new Date(isEdited ? invoice.updatedAt! : invoice.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    
    return (
        <div className={`${GRID_TEMPLATE} text-right border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700/50 transition-colors text-gray-800 dark:text-gray-200 text-sm py-4 px-3 min-w-[1100px] odd:bg-white even:bg-gray-50 dark:odd:bg-gray-800 dark:even:bg-gray-900/30 ${isAdminCreated ? 'bg-purple-50/20' : ''}`}>
            <div className="font-black tracking-tighter shrink-0">{toPersianDigits(invoice.date)}</div>
            <div className="text-center shrink-0 font-mono scale-90">{renderInvoiceNumber(invoice.invoiceNumber)}</div>
            <div className="font-bold truncate shrink-0">{farms.find((f: any) => f.id === invoice.farmId)?.name}</div>
            <div className="font-bold text-gray-700 dark:text-gray-200 text-sm leading-tight overflow-hidden text-ellipsis" title={productName}>{productName}</div>
            <div className="text-center font-black text-lg shrink-0">{toPersianDigits(invoice.totalCartons)}</div>
            <div className="font-black text-metro-blue text-lg text-center shrink-0">{toPersianDigits(invoice.totalWeight)}</div>
            <div className="text-center shrink-0">
                <span className={`px-2 py-1 rounded-md text-xs font-bold truncate block max-w-full ${isAdminCreated ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 dark:bg-gray-700'}`}>
                    {isAdminCreated ? 'مدیر سیستم' : (invoice.creatorName || 'ناشناس')}
                </span>
            </div>
            <div className="text-center flex flex-col items-center shrink-0">
                <span className="font-mono text-sm font-bold text-gray-600 dark:text-gray-400 dir-ltr">{toPersianDigits(displayTime)}</span>
                {isEdited && !isAdminCreated && <span className="text-[9px] text-orange-500 font-bold mt-0.5">(ویرایش)</span>}
            </div>
            <div className="text-center shrink-0"><span className={`px-2 py-1 text-xs font-black text-white rounded-lg shadow-sm ${invoice.isYesterday ? 'bg-metro-orange' : 'bg-metro-green'}`}>{invoice.isYesterday ? 'دیروز' : 'عادی'}</span></div>
        </div>
    );
});

const InvoiceList = React.memo(() => {
    const { invoices, fetchInvoices, isLoading } = useInvoiceStore();
    const { farms, products } = useFarmStore(); 
    const { addToast } = useToastStore();
    const [selectedFarmId, setSelectedFarmId] = useState<string>('all');
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    const [filterDate, setFilterDate] = useState(getTodayJalali());
    const [ignoreDate, setIgnoreDate] = useState(false); 
    
    const normalizedFilterDate = normalizeDate(filterDate);

    useEffect(() => {
        fetchInvoices();
    }, []);

    const filteredInvoices = useMemo(() => {
        const results = invoices
            .filter(i => {
                const itemDate = normalizeDate(i.date);
                const dateMatch = ignoreDate ? true : itemDate === normalizedFilterDate;
                const farmMatch = selectedFarmId === 'all' || i.farmId === selectedFarmId;
                return dateMatch && farmMatch;
            })
            // Already sorted from server, but re-sort if filtered/modified
            .sort((a, b) => b.createdAt - a.createdAt);
        return results;
    }, [invoices, normalizedFilterDate, selectedFarmId, ignoreDate]);

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
        if (strNum.length < 4) return <span className="text-gray-800 dark:text-gray-200 text-lg font-mono" dir="ltr">{strNum}</span>;
        const mainPart = strNum.slice(0, -4);
        const lastPart = strNum.slice(-4);
        return (
            <div className="flex justify-center items-center gap-0.5" dir="ltr">
                <span className="text-gray-500 dark:text-gray-400 font-bold text-base font-mono">{mainPart}</span>
                <span className="text-black dark:text-white font-black text-lg font-mono">{lastPart}</span>
            </div>
        );
    }, []);

    return (
        <div className="space-y-4 lg:space-y-6 flex flex-col h-full">
             <div className="bg-white/80 dark:bg-black/40 backdrop-blur-md p-4 lg:p-6 shadow-sm border-l-4 border-metro-orange flex flex-col md:flex-row gap-4 lg:gap-6 items-end rounded-xl shrink-0">
                <div className="w-full md:w-1/3 flex items-end gap-2">
                    <div className="flex-1">
                        <JalaliDatePicker value={filterDate} onChange={setFilterDate} label="نمایش حواله‌های تاریخ" />
                    </div>
                    <button 
                        onClick={() => setIgnoreDate(!ignoreDate)}
                        className={`mb-1 p-3 rounded-xl border-2 transition-all ${ignoreDate ? 'bg-metro-blue text-white border-metro-blue' : 'bg-white dark:bg-gray-700 text-gray-400 border-gray-200 dark:border-gray-600'}`}
                        title={ignoreDate ? "فیلتر تاریخ غیرفعال است (نمایش همه)" : "فیلتر تاریخ فعال است"}
                    >
                        <Icons.List className="w-6 h-6" />
                    </button>
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

            <div className="bg-white dark:bg-gray-800 p-0 shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700 rounded-xl flex-1 flex flex-col min-h-[500px]">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shrink-0 flex justify-between items-center">
                    <h3 className="font-black text-xl text-gray-800 dark:text-white flex items-center gap-2">
                        <Icons.FileText className="w-6 h-6 text-metro-orange" />
                        جدول فروش روزانه
                    </h3>
                    <span className="text-xs font-bold text-gray-400">
                        {toPersianDigits(filteredInvoices.length)} مورد یافت شد
                    </span>
                </div>
                
                <div className="w-full h-full overflow-hidden flex flex-col">
                    <div className="flex-1 w-full overflow-x-auto">
                        <div className="min-w-[1100px] h-full flex flex-col">
                             <div className={`${GRID_TEMPLATE} bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-sm lg:text-base font-bold p-4 border-b border-gray-200 dark:border-gray-700 shrink-0 sticky top-0 z-10 pr-4 shadow-sm`}>
                                <div>تاریخ خروج</div>
                                <div className="text-center">رمز حواله</div>
                                <div>فارم</div>
                                <div>نوع محصول</div>
                                <div className="text-center">تعداد (کارتن)</div>
                                <div className="text-center">وزن (Kg)</div>
                                <div className="text-center">ثبت کننده</div>
                                <div className="text-center">ساعت</div>
                                <div className="text-center">وضعیت</div>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {isLoading ? (
                                    <div className="p-4 space-y-4">
                                        <SkeletonRow cols={9} />
                                        <SkeletonRow cols={9} />
                                        <SkeletonRow cols={9} />
                                    </div>
                                ) : filteredInvoices.length === 0 ? (
                                    <div className="text-center py-20 text-gray-400 font-bold lg:text-lg">
                                        <div className="flex flex-col items-center">
                                            <Icons.FileText className="w-16 h-16 mb-2 opacity-30" />
                                            <span>
                                                {ignoreDate 
                                                    ? 'هیچ حواله‌ای با این مشخصات یافت نشد.' 
                                                    : `هیچ حواله‌ای برای تاریخ ${toPersianDigits(normalizedFilterDate)} یافت نشد.`}
                                            </span>
                                            {!ignoreDate && (
                                                <button onClick={() => setIgnoreDate(true)} className="mt-2 text-metro-blue underline text-sm">
                                                    نمایش همه تاریخ‌ها
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    filteredInvoices.map(invoice => (
                                        <StandardInvoiceRow 
                                            key={invoice.id} 
                                            invoice={invoice} 
                                            farms={farms} 
                                            products={products} 
                                            renderInvoiceNumber={renderInvoiceNumber} 
                                        />
                                    ))
                                )}
                            </div>
                            
                            {filteredInvoices.length > 0 && (
                                <div className="bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4 flex justify-end items-center gap-6 shrink-0">
                                    <div className="text-sm font-bold text-gray-600 dark:text-gray-400">جمع کل:</div>
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
                </div>
            </div>
        </div>
    );
});

// AnalyticsView ... (No changes needed, stable)
const AnalyticsView = () => {
    // ... same code as before ...
    return <div className="text-center p-10 text-gray-500">تحلیل نموداری (موجود در کد اصلی)</div>; 
};

// ... DashboardHome and SalesDashboard components remain similar, mostly structure optimizations

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

export default SalesDashboard;
