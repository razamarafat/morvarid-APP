
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
import { SkeletonTile, SkeletonRow } from '../common/Skeleton';

// --- NEW COMPONENT: FarmGroup ---
const FarmGroup = React.memo(({ title, farms, statistics, normalizedSelectedDate, products }: any) => {
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
                        // TASK 2: Removed border-r-2 border-dashed
                        className="space-y-4 overflow-hidden pl-2 lg:pl-4 mr-4"
                    >
                        {farms.map((farm: any) => {
                            // Filter stats for this farm and date
                            const farmStats = statistics.filter((s: any) => s.farmId === farm.id && normalizeDate(s.date) === normalizedSelectedDate);
                            // Dedup logic (simplified for view)
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
                                                                {/* TASK 10: Show Creator Name Inline */}
                                                                {showTime && (
                                                                    <div className="text-[10px] text-gray-400 font-bold flex items-center gap-2">
                                                                        <span>ساعت: {toPersianDigits(new Date(stat.createdAt).toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'}))}</span>
                                                                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                                        <span>مسئول: {stat.creatorName || 'نامشخص'}</span>
                                                                    </div>
                                                                )}
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
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

const FarmStatistics = React.memo(() => {
    const { statistics, fetchStatistics, subscribeToStatistics, isLoading } = useStatisticsStore();
    const { farms, products } = useFarmStore(); 
    const { fetchInvoices } = useInvoiceStore();
    const { addToast } = useToastStore();
    
    const todayJalali = getTodayJalali();
    const normalizedSelectedDate = useMemo(() => normalizeDate(todayJalali), [todayJalali]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // TASK 5: Add Search Term
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

    if (isLoading && statistics.length === 0) {
        return <div className="space-y-4"><SkeletonRow height="h-24" /><SkeletonRow height="h-24" /></div>;
    }

    // TASK 5: Filter Farms based on search
    const filteredFarms = useMemo(() => {
        if (!searchTerm) return farms;
        return farms.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [farms, searchTerm]);

    const morvaridiFarms = filteredFarms.filter(f => f.type === FarmType.MORVARIDI);
    const moteferegheFarms = filteredFarms.filter(f => f.type === FarmType.MOTEFEREGHE);

    return (
        <div className="space-y-6">
            {/* TASK 5: Reduced padding (py-2 instead of p-4) */}
            <div className="bg-white/80 dark:bg-black/40 backdrop-blur-md py-2 px-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between rounded-[24px]">
                <div className="flex-1 w-full flex flex-col gap-3">
                    <h3 className="font-black text-gray-800 dark:text-white text-lg flex items-center flex-wrap">
                        آمار فارم‌ها - <span className="mr-2 shiny-text text-orange-500 font-black">{toPersianDigits(todayJalali)}</span>
                    </h3>
                    {/* TASK 5: Search Input (1/3 width) */}
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
            />

            <FarmGroup 
                title="فارم‌های متفرقه" 
                farms={moteferegheFarms} 
                statistics={statistics} 
                normalizedSelectedDate={normalizedSelectedDate} 
                products={products}
            />
        </div>
    );
});

// TASK 6: Optimized Grid Template - Reduced gap and adjusted widths for better fit
// Date, Invoice#, Farm, Product, Count, Weight, Registrar, Time
const GRID_TEMPLATE = "grid grid-cols-[85px_100px_90px_minmax(140px,1.5fr)_70px_70px_100px_70px] gap-0 items-center whitespace-nowrap px-2";

const StandardInvoiceRow = React.memo(({ invoice, farms, products, renderInvoiceNumber }: { invoice: Invoice, farms: any[], products: any[], renderInvoiceNumber: (num: string) => any }) => {
    const productName = products.find((p: any) => p.id === invoice.productId)?.name || '-';
    const isEdited = invoice.updatedAt && invoice.updatedAt > invoice.createdAt + 2000;
    const isAdminCreated = invoice.creatorRole === UserRole.ADMIN;
    
    const displayTime = isAdminCreated 
        ? '---' 
        : new Date(isEdited ? invoice.updatedAt! : invoice.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    
    return (
        <div className={`${GRID_TEMPLATE} text-right border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700/50 transition-colors text-gray-800 dark:text-gray-200 text-sm py-3 min-w-[900px] odd:bg-white even:bg-gray-50 dark:odd:bg-gray-800 dark:even:bg-gray-900/30 ${isAdminCreated ? 'bg-purple-50/20' : ''}`}>
            <div className="font-black tracking-tighter shrink-0 text-sm">{toPersianDigits(invoice.date)}</div>
            <div className="text-center shrink-0 font-mono scale-90 text-base font-bold">{renderInvoiceNumber(invoice.invoiceNumber)}</div>
            <div className="font-bold truncate shrink-0 text-xs">{farms.find((f: any) => f.id === invoice.farmId)?.name}</div>
            <div className="font-bold text-gray-700 dark:text-gray-200 text-xs leading-tight overflow-hidden text-ellipsis px-1" title={productName}>{productName}</div>
            
            <div className="text-center">
                <span className="font-black text-base bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded block">{toPersianDigits(invoice.totalCartons)}</span>
            </div>
            <div className="text-center">
                <span className="font-black text-metro-blue text-base bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded block">{toPersianDigits(invoice.totalWeight)}</span>
            </div>
            
            <div className="text-center shrink-0">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold truncate block max-w-full ${isAdminCreated ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 dark:bg-gray-700'}`}>
                    {isAdminCreated ? 'مدیر' : (invoice.creatorName || 'ناشناس')}
                </span>
            </div>
            <div className="text-center flex flex-col items-center shrink-0">
                <span className="font-mono text-[10px] font-bold text-gray-600 dark:text-gray-400 dir-ltr">{toPersianDigits(displayTime)}</span>
                {isEdited && !isAdminCreated && <span className="text-[8px] text-orange-500 font-bold mt-0.5">(ویرایش)</span>}
            </div>
        </div>
    );
});

const InvoiceList = React.memo(() => {
    const { invoices, fetchInvoices, isLoading } = useInvoiceStore();
    const { farms, products } = useFarmStore(); 
    const { addToast } = useToastStore();
    const [selectedFarmId, setSelectedFarmId] = useState<string>('all');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // TASK 8: Lock to Today
    const today = getTodayJalali();
    const normalizedToday = normalizeDate(today);

    useEffect(() => {
        fetchInvoices();
    }, []);

    const filteredInvoices = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        
        const results = invoices
            .filter(i => {
                const itemDate = normalizeDate(i.date);
                // STRICTLY TODAY
                const dateMatch = itemDate === normalizedToday;
                const farmMatch = selectedFarmId === 'all' || i.farmId === selectedFarmId;
                const searchMatch = !term || (
                    i.invoiceNumber.includes(term) || 
                    i.driverName?.toLowerCase().includes(term) ||
                    i.plateNumber?.includes(term)
                );

                return dateMatch && farmMatch && searchMatch;
            })
            // Sort Order: Date(Desc) -> Farm Name -> Product Order
            .sort((a, b) => {
                // 1. Date Desc (Though all are today, good practice)
                if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
                
                // 2. Farm Name Alphabetic
                const farmA = farms.find(f => f.id === a.farmId)?.name || '';
                const farmB = farms.find(f => f.id === b.farmId)?.name || '';
                const farmDiff = farmA.localeCompare(farmB, 'fa');
                if (farmDiff !== 0) return farmDiff;

                // 3. Product Rank
                const prodA = products.find(p => p.id === a.productId);
                const prodB = products.find(p => p.id === b.productId);
                if (prodA && prodB) {
                    return compareProducts(prodA, prodB);
                }
                return 0;
            });
        return results;
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
                
                <div className="w-full h-full overflow-hidden flex flex-col">
                    <div className="flex-1 w-full overflow-x-auto">
                        <div className="min-w-[900px] h-full flex flex-col">
                             <div className={`${GRID_TEMPLATE} bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-sm lg:text-base font-bold p-3 border-b border-gray-200 dark:border-gray-700 shrink-0 sticky top-0 z-10 pr-2 shadow-sm`}>
                                <div>تاریخ خروج</div>
                                <div className="text-center">رمز حواله</div>
                                <div>فارم</div>
                                <div>نوع محصول</div>
                                <div className="text-center">تعداد (کارتن)</div>
                                <div className="text-center">وزن (Kg)</div>
                                <div className="text-center">ثبت کننده</div>
                                <div className="text-center">ساعت</div>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {isLoading ? (
                                    <div className="p-4 space-y-4">
                                        <SkeletonRow cols={8} />
                                        <SkeletonRow cols={8} />
                                        <SkeletonRow cols={8} />
                                    </div>
                                ) : filteredInvoices.length === 0 ? (
                                    <div className="text-center py-20 text-gray-400 font-bold lg:text-lg">
                                        <div className="flex flex-col items-center">
                                            <Icons.FileText className="w-16 h-16 mb-2 opacity-30" />
                                            <span>
                                                هیچ حواله‌ای برای امروز ({toPersianDigits(normalizedToday)}) ثبت نشده است.
                                            </span>
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
                </div>
            </div>
        </div>
    );
});

const DashboardHome: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 lg:gap-6">
            <MetroTile title="پایش آمار فارم‌ها" icon={Icons.BarChart} color="bg-metro-blue" size="wide" onClick={() => onNavigate('farm-stats')} />
            <MetroTile title="لیست حواله‌های فروش" icon={Icons.List} color="bg-metro-orange" size="wide" onClick={() => onNavigate('invoices')} />
            <MetroTile title="گزارشات اکسل جامع" icon={Icons.FileText} color="bg-metro-green" size="wide" onClick={() => onNavigate('reports')} />
        </div>
    );
};

const SalesDashboard: React.FC = () => {
    const [currentView, setCurrentView] = useState('dashboard');
    const { isLoading } = useAuthStore();

    const getTitle = () => {
        if(currentView === 'farm-stats') return 'پایش آمار لحظه‌ای';
        if(currentView === 'invoices') return 'جدول فروش امروز';
        if(currentView === 'reports') return 'گزارشات فروش';
        // TASK 1: Updated Title
        return 'میزکار آمار و فروش';
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
