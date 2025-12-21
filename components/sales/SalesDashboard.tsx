
import React, { useState, useEffect } from 'react';
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
import JalaliDatePicker from '../common/JalaliDatePicker';
import { FarmType } from '../../types';
import MetroTile from '../common/MetroTile';
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

const DashboardHome: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <MetroTile title="پایش آمار فارم‌ها" icon={Icons.BarChart} color="bg-metro-blue" size="wide" onClick={() => onNavigate('farm-stats')} />
            <MetroTile title="لیست حواله‌های فروش" icon={Icons.FileText} color="bg-metro-orange" size="wide" onClick={() => onNavigate('invoices')} />
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
        return 'داشبورد فروش و توزیع';
    }

    const renderContent = () => {
        switch (currentView) {
            case 'farm-stats': return <FarmStatistics />;
            case 'invoices': return <InvoiceList />;
            case 'reports': return <Reports />;
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
