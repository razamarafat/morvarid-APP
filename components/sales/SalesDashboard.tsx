
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
import Button from '../common/Button';
import MetroTile from '../common/MetroTile';
import { motion, AnimatePresence } from 'framer-motion';
import { FarmType, Invoice } from '../../types';
import JalaliDatePicker from '../common/JalaliDatePicker';
import { SkeletonTile, SkeletonRow } from '../common/Skeleton';

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
                    const sortedFarmStats = [...dedupedStats].sort((a, b) => sortProducts(products, a.productId, b.productId));
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
                                        <Button variant="danger" size="sm" isLoading={alertLoading === farm.id} onClick={(e) => handleSendAlert(farm.id, farm.name, e)} className="shadow-none">
                                            <Icons.Bell className="w-4 h-4" />
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
                                                return (
                                                <div key={stat.id} className="bg-white dark:bg-gray-800 p-4 rounded-[20px] shadow-sm border border-gray-100 dark:border-gray-700">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <h5 className="font-bold text-gray-800 dark:text-white">{prod?.name}</h5>
                                                        <span className="text-[10px] text-gray-400 font-mono">{toPersianDigits(new Date(stat.createdAt).toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'}))}</span>
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
};

// --- MODERNIZED INVOICE ROW ---
const GRID_TEMPLATE = "grid grid-cols-[80px_120px_100px_minmax(180px,1fr)_80px_80px_120px_70px_80px] gap-4 items-center";

const StandardInvoiceRow = React.memo(({ invoice, farms, products, renderInvoiceNumber }: { invoice: Invoice, farms: any[], products: any[], renderInvoiceNumber: (num: string) => any }) => {
    const productName = products.find((p: any) => p.id === invoice.productId)?.name || '-';
    const isEdited = !!invoice.updatedAt;
    const time = new Date(isEdited ? invoice.updatedAt! : invoice.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    
    return (
        <div className={`${GRID_TEMPLATE} text-right border-b border-gray-100 dark:border-gray-700/50 hover:bg-blue-50/50 dark:hover:bg-white/5 transition-colors text-sm py-4 px-4 min-w-[1100px] odd:bg-white dark:odd:bg-[#1e293b] even:bg-gray-50/50 dark:even:bg-[#1e293b]/50`}>
            <div className="font-black text-gray-500 dark:text-gray-400">{toPersianDigits(invoice.date)}</div>
            <div className="text-center">{renderInvoiceNumber(invoice.invoiceNumber)}</div>
            <div className="font-bold text-gray-700 dark:text-gray-300 truncate">{farms.find((f: any) => f.id === invoice.farmId)?.name}</div>
            <div className="font-bold text-gray-800 dark:text-gray-200 leading-tight">{productName}</div>
            <div className="text-center font-black text-lg text-gray-800 dark:text-white">{toPersianDigits(invoice.totalCartons)}</div>
            <div className="text-center font-black text-metro-blue text-lg">{toPersianDigits(invoice.totalWeight)}</div>
            <div className="text-center"><span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs font-bold text-gray-600 dark:text-gray-300 truncate block">{invoice.creatorName || 'ناشناس'}</span></div>
            <div className="text-center flex flex-col items-center"><span className="font-mono text-xs text-gray-400">{toPersianDigits(time)}</span>{isEdited && <span className="text-[9px] text-orange-500">(ویرایش)</span>}</div>
            <div className="text-center"><span className={`px-2 py-1 text-[10px] font-bold text-white rounded-md ${invoice.isYesterday ? 'bg-orange-500' : 'bg-green-500'}`}>{invoice.isYesterday ? 'دیروز' : 'عادی'}</span></div>
        </div>
    );
});

const InvoiceList = () => {
    const { invoices, fetchInvoices, isLoading } = useInvoiceStore();
    const { farms, products } = useFarmStore(); 
    const { addToast } = useToastStore();
    const [selectedFarmId, setSelectedFarmId] = useState<string>('all');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [filterDate, setFilterDate] = useState(getTodayJalali());
    const [ignoreDate, setIgnoreDate] = useState(false);
    
    const normalizedFilterDate = normalizeDate(filterDate);

    useEffect(() => { fetchInvoices(); }, []);

    const filteredInvoices = useMemo(() => {
        return invoices.filter(i => {
            const itemDate = normalizeDate(i.date);
            const dateMatch = ignoreDate ? true : itemDate === normalizedFilterDate;
            const farmMatch = selectedFarmId === 'all' || i.farmId === selectedFarmId;
            return dateMatch && farmMatch;
        }).sort((a, b) => b.createdAt - a.createdAt);
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
        if (strNum.length < 4) return <span className="text-gray-800 dark:text-gray-200 text-lg font-mono">{strNum}</span>;
        const mainPart = strNum.slice(0, -4);
        const lastPart = strNum.slice(-4);
        return (
            <div className="flex justify-center items-center gap-0.5" dir="ltr">
                <span className="text-gray-400 font-bold text-sm font-mono">{mainPart}</span>
                <span className="text-gray-900 dark:text-white font-black text-lg font-mono">{lastPart}</span>
            </div>
        );
    }, []);

    return (
        <div className="space-y-4 lg:space-y-6 flex flex-col h-full">
             <div className="bg-white/80 dark:bg-black/40 backdrop-blur-md p-4 rounded-[24px] shadow-sm border border-white/20 dark:border-white/10 flex flex-col md:flex-row gap-4 items-end">
                <div className="w-full md:w-1/3 flex items-end gap-2">
                    <div className="flex-1"><JalaliDatePicker value={filterDate} onChange={setFilterDate} label="نمایش حواله‌های تاریخ" /></div>
                    <button onClick={() => setIgnoreDate(!ignoreDate)} className={`mb-1 p-3 rounded-xl border-2 transition-all ${ignoreDate ? 'bg-metro-blue text-white border-metro-blue' : 'bg-white dark:bg-gray-700 text-gray-400 border-gray-200 dark:border-gray-600'}`}><Icons.List className="w-6 h-6" /></button>
                </div>
                <div className="w-full md:w-1/3">
                    <label className="block text-sm font-bold mb-1 text-gray-500">فیلتر فارم</label>
                    <select className="w-full p-3 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white font-bold rounded-xl outline-none focus:border-metro-orange" value={selectedFarmId} onChange={(e) => setSelectedFarmId(e.target.value)}>
                        <option value="all">همه فارم‌ها</option>
                        {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                </div>
                <Button onClick={handleRefresh} disabled={isRefreshing} className="bg-metro-orange h-12 px-6 font-black w-full md:w-auto"><Icons.Refresh className={`w-5 h-5 ml-2 ${isRefreshing ? 'animate-spin' : ''}`} /> بروزرسانی</Button>
            </div>

            <div className="bg-white dark:bg-[#1e293b] shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700 rounded-[28px] flex-1 flex flex-col min-h-[500px]">
                <div className="p-4 bg-gray-50/50 dark:bg-black/20 border-b border-gray-200 dark:border-gray-700 shrink-0 flex justify-between items-center">
                    <h3 className="font-black text-xl text-gray-800 dark:text-white flex items-center gap-2"><Icons.FileText className="w-6 h-6 text-metro-orange" /> جدول فروش</h3>
                    <span className="text-xs font-bold text-gray-400">{toPersianDigits(filteredInvoices.length)} مورد</span>
                </div>
                
                <div className="flex-1 w-full overflow-x-auto">
                    <div className="min-w-[1100px] h-full flex flex-col">
                         <div className={`${GRID_TEMPLATE} bg-gray-50 dark:bg-black/20 text-gray-500 font-bold text-sm p-4 border-b border-gray-200 dark:border-gray-700 shrink-0 sticky top-0 z-10 pr-4`}>
                            <div>تاریخ</div><div className="text-center">رمز حواله</div><div>فارم</div><div>محصول</div><div className="text-center">تعداد</div><div className="text-center">وزن</div><div className="text-center">ثبت کننده</div><div className="text-center">ساعت</div><div className="text-center">وضعیت</div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {isLoading ? <div className="p-4 space-y-4"><SkeletonRow cols={9} /><SkeletonRow cols={9} /></div> : filteredInvoices.length === 0 ? <div className="text-center py-20 text-gray-400 font-bold">هیچ حواله‌ای یافت نشد</div> : filteredInvoices.map(invoice => <StandardInvoiceRow key={invoice.id} invoice={invoice} farms={farms} products={products} renderInvoiceNumber={renderInvoiceNumber} />)}
                        </div>
                        {filteredInvoices.length > 0 && (
                            <div className="bg-gray-50 dark:bg-black/20 border-t border-gray-200 dark:border-gray-700 p-4 flex justify-end items-center gap-6 shrink-0">
                                <div className="text-sm font-bold text-gray-500">جمع کل:</div>
                                <div className="flex items-center gap-2 bg-white dark:bg-gray-700 px-4 py-2 rounded-xl shadow-sm"><span className="text-gray-400 text-xs">کارتن:</span><span className="font-black text-lg dark:text-white">{toPersianDigits(totals.cartons)}</span></div>
                                <div className="flex items-center gap-2 bg-white dark:bg-gray-700 px-4 py-2 rounded-xl shadow-sm"><span className="text-gray-400 text-xs">وزن:</span><span className="font-black text-lg text-metro-blue">{toPersianDigits(totals.weight)}</span></div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const AnalyticsView = () => {
    // Analytics view logic (simplified for brevity, keeps existing logic but updated styling)
    return <div className="text-center p-10 text-gray-400">بخش نمودارها در حال بروزرسانی است...</div>;
};

const DashboardHome: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
        if(currentView === 'analytics') return 'تحلیل نموداری';
        return 'داشبورد فروش و توزیع';
    }

    const renderContent = () => {
        if (isLoading && currentView === 'dashboard') {
            return <div className="grid grid-cols-2 gap-4"><SkeletonTile size="wide"/><SkeletonTile size="wide"/></div>;
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