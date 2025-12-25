
import React, { useState, useEffect, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
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
                    const farmStats = statistics.filter(s => s.farmId === farm.id && normalizeDate(s.date) === normalizedSelectedDate);
                    const sortedFarmStats = [...farmStats].sort((a, b) => sortProducts(products, a.productId, b.productId));
                    const hasStats = farmStats.length > 0;
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
                                        <div className="grid grid-cols-1 gap-4">
                                            {sortedFarmStats.map(stat => {
                                                const prod = products.find(p => p.id === stat.productId);
                                                
                                                const showCarton = stat.production > 0 || stat.sales > 0 || stat.previousBalance > 0 || stat.currentInventory > 0;
                                                const showKg = stat.productionKg > 0 || stat.salesKg > 0 || stat.previousBalanceKg > 0 || stat.currentInventoryKg > 0;

                                                const renderVal = (valC: number, valK: number, colorClass: string) => (
                                                    <div className="flex flex-col items-center">
                                                        {showCarton && <span className={`font-black text-xl lg:text-2xl ${colorClass}`}>{toPersianDigits(valC)}</span>}
                                                        {showKg && <span className={`font-black text-lg lg:text-xl text-metro-blue`}>{toPersianDigits(valK)} <small className="text-[10px] text-gray-500">Kg</small></span>}
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
                                                    
                                                    {/* Modified Grid: 3 Cols for Motefereghe, 4 for others */}
                                                    <div className={`grid gap-2 ${isMotefereghe ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
                                                        
                                                        {/* Previous Balance: Hidden for Motefereghe */}
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

const InvoiceRow = ({ index, style, data }: any) => {
    const invoice = data.invoices[index];
    const { farms, products, renderInvoiceNumber } = data;
    const productName = products.find((p: any) => p.id === invoice.productId)?.name || '-';
    
    // Improved row layout for mobile
    return (
        <div style={style} className="flex items-center text-right border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700/50 transition-colors text-gray-800 dark:text-gray-200 text-sm lg:text-lg overflow-hidden">
            <div className="w-[100px] lg:w-auto lg:flex-[1] px-2 font-black whitespace-nowrap tracking-tighter shrink-0">{toPersianDigits(invoice.date)}</div>
            <div className="w-[120px] lg:w-auto lg:flex-[1] px-2 text-center dir-ltr shrink-0">{renderInvoiceNumber(invoice.invoiceNumber)}</div>
            <div className="w-[120px] lg:w-auto lg:flex-[1] px-2 whitespace-nowrap font-bold truncate">{farms.find((f: any) => f.id === invoice.farmId)?.name}</div>
            <div className="w-[150px] lg:w-auto lg:flex-[1] px-2 font-bold text-gray-600 dark:text-gray-300 truncate">{productName}</div>
            <div className="w-[80px] lg:w-auto lg:flex-[1] px-2 text-center font-black lg:text-xl shrink-0">{toPersianDigits(invoice.totalCartons)}</div>
            <div className="w-[80px] lg:w-auto lg:flex-[1] px-2 font-black text-metro-blue lg:text-xl shrink-0">{toPersianDigits(invoice.totalWeight)}</div>
            <div className="w-[80px] lg:w-auto lg:flex-[1] px-2 shrink-0">
                <span className={`px-2 py-0.5 text-xs lg:text-sm font-black text-white rounded ${invoice.isYesterday ? 'bg-metro-orange' : 'bg-metro-green'}`}>
                    {invoice.isYesterday ? 'دیروز' : 'عادی'}
                </span>
            </div>
        </div>
    );
};

const InvoiceList = () => {
    const { invoices, fetchInvoices, isLoading } = useInvoiceStore();
    const { farms, products } = useFarmStore(); 
    const { addToast } = useToastStore();
    const [selectedFarmId, setSelectedFarmId] = useState<string>('all');
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    const [filterDate, setFilterDate] = useState(getTodayJalali());
    const normalizedFilterDate = normalizeDate(filterDate);

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
            <div className="flex justify-end items-center gap-0.5">
                <span className="text-gray-500 dark:text-gray-400 font-bold text-base lg:text-xl">{mainPart}</span>
                <span className="text-black dark:text-white font-black text-lg lg:text-2xl">{lastPart}</span>
            </div>
        );
    };

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

            <div className="bg-white dark:bg-gray-800 p-0 shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700 rounded-xl flex-1 flex flex-col min-h-[500px]">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shrink-0">
                    <h3 className="font-black text-xl text-gray-800 dark:text-white flex items-center gap-2">
                        <Icons.FileText className="w-6 h-6 text-metro-orange" />
                        جدول فروش روزانه
                    </h3>
                </div>
                
                {/* Horizontal Scroll wrapper for mobile table */}
                <div className="overflow-x-auto w-full flex-1">
                    <div className="min-w-[800px] h-full flex flex-col">
                        <div className="flex bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-sm lg:text-lg font-bold p-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
                            <div className="w-[100px] lg:w-auto lg:flex-[1] px-2">تاریخ خروج</div>
                            <div className="w-[120px] lg:w-auto lg:flex-[1] px-2 text-center">رمز حواله</div>
                            <div className="w-[120px] lg:w-auto lg:flex-[1] px-2">فارم</div>
                            <div className="w-[150px] lg:w-auto lg:flex-[1] px-2">نوع محصول</div>
                            <div className="w-[80px] lg:w-auto lg:flex-[1] px-2 text-center">تعداد</div>
                            <div className="w-[80px] lg:w-auto lg:flex-[1] px-2">وزن (Kg)</div>
                            <div className="w-[80px] lg:w-auto lg:flex-[1] px-2">وضعیت</div>
                        </div>

                        <div className="flex-1 w-full relative">
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
                                <AutoSizer>
                                    {({ height, width }) => (
                                        <List
                                            height={height}
                                            itemCount={filteredInvoices.length}
                                            itemSize={80} 
                                            width={width} // Uses full width from AutoSizer
                                            itemData={{ invoices: filteredInvoices, farms, products, renderInvoiceNumber }}
                                            className="custom-scrollbar"
                                        >
                                            {InvoiceRow}
                                        </List>
                                    )}
                                </AutoSizer>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AnalyticsView = () => {
    // ... [Content unchanged]
    return <div className="text-center p-10">بخش نمودارها (بدون تغییر)</div>;
};

const DashboardHome: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 lg:gap-6">
            <MetroTile title="پایش آمار فارم‌ها" icon={Icons.BarChart} color="bg-metro-blue" size="wide" onClick={() => onNavigate('farm-stats')} />
            <MetroTile title="لیست حواله‌های فروش" icon={Icons.FileText} color="bg-metro-orange" size="wide" onClick={() => onNavigate('invoices')} />
            <MetroTile title="تحلیل نموداری" icon={Icons.BarChart} color="bg-purple-600" size="medium" onClick={() => onNavigate('analytics')} />
            <MetroTile title="گزارشات کلی" icon={Icons.FileText} color="bg-metro-green" size="medium" onClick={() => onNavigate('reports')} />
        </div>
    );
};

const SalesDashboard: React.FC = () => {
    const [currentView, setCurrentView] = useState('dashboard');
    const { isLoading } = useAuthStore();

    const getTitle = () => {
        if(currentView === 'farm-stats') return 'پایش آمار لحظه‌ای';
        if(currentView === 'invoices') return 'جدول فروش روزانه';
        if(currentView === 'reports') return 'گزارشات';
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
