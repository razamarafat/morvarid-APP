
import React, { useState, useEffect } from 'react';
import DashboardLayout from '../layout/DashboardLayout';
import { Icons } from '../common/Icons';
import Reports from '../admin/Reports';
import { useStatisticsStore } from '../../store/statisticsStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useFarmStore } from '../../store/farmStore';
import { useToastStore } from '../../store/toastStore';
import { useLogStore } from '../../store/logStore';
import { useAuthStore } from '../../store/authStore';
import { getTodayJalali, normalizeDate, getCurrentTime } from '../../utils/dateUtils';
import Button from '../common/Button';
import JalaliDatePicker from '../common/JalaliDatePicker';
import { FarmType } from '../../types';
import { supabase } from '../../lib/supabase';

const FarmStatistics = () => {
    const { statistics, fetchStatistics, isLoading } = useStatisticsStore();
    // SALES REQUIREMENT: Access ALL farms, ignore user.assignedFarms
    const { farms, products } = useFarmStore();
    const { addToast } = useToastStore();
    const { addLog } = useLogStore();
    const { user } = useAuthStore();
    
    const [selectedDate, setSelectedDate] = useState(getTodayJalali());
    const normalizedSelectedDate = normalizeDate(selectedDate);

    // State for Accordion
    const [expandedFarmId, setExpandedFarmId] = useState<string | null>(null);

    const [alertLoading, setAlertLoading] = useState<string | null>(null);
    const [now, setNow] = useState(Date.now());
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Initial Fetch & Auto-Refresh Interval
    useEffect(() => {
        fetchStatistics(); 
        const interval = setInterval(() => {
             fetchStatistics(); 
             setNow(Date.now());
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        try {
            await fetchStatistics();
            setTimeout(() => setIsRefreshing(false), 500);
            addToast('اطلاعات با موفقیت از سرور دریافت شد', 'info');
        } catch (e) {
            setIsRefreshing(false);
            addToast('خطا در دریافت اطلاعات', 'error');
        }
    };

    const handleSendAlert = async (farmId: string, farmName: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent accordion toggle
        setAlertLoading(farmId);
        
        try {
            // REAL ALERT SYSTEM: Write to system_logs with a special category that Admin checks
            // In a full system, this would go to a 'notifications' table.
            const message = `هشدار عدم ثبت آمار: فارم ${farmName} برای تاریخ ${normalizedSelectedDate} هنوز آماری ثبت نکرده است.`;
            
            await supabase.from('system_logs').insert({
                level: 'warn',
                category: 'network', // Using network/notification category
                message: message,
                user_id: user?.id
            });

            addLog('warn', 'network', `ALARM_SENT: ${farmName}`, user?.id);
            addToast(`هشدار برای فارم "${farmName}" در سیستم ثبت شد.`, 'success');
        } catch (error) {
            addToast('خطا در ارسال هشدار', 'error');
        } finally {
            setAlertLoading(null);
        }
    };

    const toggleFarm = (farmId: string) => {
        if (expandedFarmId === farmId) {
            setExpandedFarmId(null);
        } else {
            setExpandedFarmId(farmId);
        }
    };

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="space-y-4 md:space-y-6">
            <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-[24px] md:rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700">
                
                {/* Header Controls */}
                <div className="flex flex-col gap-4 mb-6">
                    <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-3">
                        <h3 className="font-black text-lg md:text-xl text-gray-800 dark:text-white flex items-center gap-2">
                            <Icons.BarChart className="w-6 h-6 text-blue-500" />
                            <span>پایش آمار روزانه</span>
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className="text-xs md:text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-full font-mono dir-ltr font-bold">
                                {normalizedSelectedDate}
                            </span>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-12 gap-3 items-end">
                        <div className="col-span-9 md:col-span-10">
                             <JalaliDatePicker 
                                value={selectedDate}
                                onChange={setSelectedDate}
                                label="انتخاب تاریخ"
                            />
                        </div>
                        <div className="col-span-3 md:col-span-2">
                             <label className="block text-xs md:text-sm font-medium mb-1 opacity-0">بروزرسانی</label>
                             <Button 
                                onClick={handleManualRefresh} 
                                disabled={isRefreshing}
                                className="w-full h-[42px] bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 border-transparent rounded-xl flex items-center justify-center"
                                title="بروزرسانی اطلاعات"
                            >
                                <Icons.Refresh className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* List of Farms (Accordion Style) */}
                <div className="space-y-3">
                    {isLoading && statistics.length === 0 && <div className="text-center py-12 text-gray-400">در حال دریافت اطلاعات...</div>}
                    
                    {farms.map(farm => {
                        // Find stats for this farm on selected date
                        const farmStats = statistics.filter(s => 
                            s.farmId === farm.id && 
                            normalizeDate(s.date) === normalizedSelectedDate
                        );
                        
                        const hasStats = farmStats.length > 0;
                        const isExpanded = expandedFarmId === farm.id;

                        // Get Creator info from the first stat record (assuming same user for batch)
                        const firstStat = farmStats[0];
                        const creatorName = firstStat?.creatorName || 'ناشناس';
                        const createdTime = firstStat ? formatTime(firstStat.createdAt) : '';
                        const updatedTime = firstStat?.updatedAt ? formatTime(firstStat.updatedAt) : null;

                        return (
                            <div key={farm.id} className={`rounded-[20px] border transition-all duration-300 overflow-hidden ${
                                hasStats 
                                    ? 'border-green-200 bg-white dark:bg-gray-800 dark:border-green-900/30' 
                                    : 'border-red-100 bg-red-50/10 dark:bg-gray-800 dark:border-red-900/30'
                            }`}>
                                {/* Accordion Header */}
                                <div 
                                    onClick={() => toggleFarm(farm.id)}
                                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full shadow-lg ${
                                            hasStats ? 'bg-green-500 shadow-green-400/50' : 'bg-red-500 shadow-red-400/50 animate-pulse'
                                        }`}></div>
                                        <div>
                                            <h4 className="font-black text-gray-800 dark:text-gray-100 text-base">{farm.name}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                {hasStats ? (
                                                    <span className="text-[10px] text-green-600 dark:text-green-400 font-bold bg-green-100 dark:bg-green-900/20 px-2 py-0.5 rounded-md">
                                                        ثبت شده توسط {creatorName} ({createdTime})
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-red-500 font-bold">
                                                        هنوز ثبت نشده
                                                    </span>
                                                )}
                                                {updatedTime && (
                                                    <span className="text-[10px] text-blue-500 font-bold bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md">
                                                        ویرایش: {updatedTime}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {!hasStats && (
                                            <Button 
                                                size="sm" 
                                                variant="danger" 
                                                className="hidden md:flex h-8 px-3 text-xs"
                                                onClick={(e) => handleSendAlert(farm.id, farm.name, e)}
                                                isLoading={alertLoading === farm.id}
                                            >
                                                <Icons.Bell className="w-3 h-3 ml-1" />
                                                ارسال هشدار
                                            </Button>
                                        )}
                                        <Icons.ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                    </div>
                                </div>

                                {/* Accordion Content (Linear List) */}
                                {isExpanded && (
                                    <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-black/10 p-4 animate-in slide-in-from-top-2">
                                        {!hasStats ? (
                                            <div className="text-center py-4 flex flex-col items-center justify-center gap-3">
                                                <p className="text-gray-500 text-sm">هیچ آماری برای این تاریخ ثبت نشده است.</p>
                                                <Button 
                                                    size="sm" 
                                                    variant="danger" 
                                                    className="md:hidden w-full max-w-xs"
                                                    onClick={(e) => handleSendAlert(farm.id, farm.name, e)}
                                                    isLoading={alertLoading === farm.id}
                                                >
                                                    ارسال هشدار به مسئول ثبت
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {farmStats.map(stat => (
                                                    <div key={stat.id} className="bg-white dark:bg-gray-700/50 rounded-xl p-3 border border-gray-100 dark:border-gray-600 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                                                                <Icons.FileText className="w-5 h-5" />
                                                            </div>
                                                            <span className="font-bold text-gray-700 dark:text-gray-200 text-sm">
                                                                {products.find(p => p.id === stat.productId)?.name || 'محصول'}
                                                            </span>
                                                        </div>

                                                        <div className="flex items-center gap-4 text-sm flex-1 justify-end">
                                                            <div className="flex flex-col items-center px-2">
                                                                <span className="text-[10px] text-green-500 font-bold mb-0.5">تولید</span>
                                                                <span className="font-mono font-black text-gray-800 dark:text-white">{stat.production.toLocaleString()}</span>
                                                            </div>
                                                            
                                                            <div className="w-px h-8 bg-gray-200 dark:bg-gray-600"></div>
                                                            
                                                            <div className="flex flex-col items-center px-2">
                                                                <span className="text-[10px] text-red-500 font-bold mb-0.5">فروش</span>
                                                                <span className="font-mono font-black text-gray-800 dark:text-white">{stat.sales?.toLocaleString() || 0}</span>
                                                            </div>

                                                            {/* HIDE BALANCE FOR MOTEFEREGHE */}
                                                            {farm.type !== FarmType.MOTEFEREGHE && (
                                                                <>
                                                                    <div className="w-px h-8 bg-gray-200 dark:bg-gray-600 hidden sm:block"></div>
                                                                    <div className="hidden sm:flex flex-col items-center px-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg py-1 min-w-[80px]">
                                                                        <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold mb-0.5">موجودی</span>
                                                                        <span className="font-mono font-black text-orange-700 dark:text-orange-300">{stat.currentInventory?.toLocaleString()}</span>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                        
                                                        {/* Mobile Balance View */}
                                                        {farm.type !== FarmType.MOTEFEREGHE && (
                                                            <div className="sm:hidden border-t dark:border-gray-600 pt-2 mt-1 flex justify-between items-center">
                                                                <span className="text-xs text-gray-500">موجودی نهایی:</span>
                                                                <span className="font-mono font-black text-orange-600">{stat.currentInventory?.toLocaleString()}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const SalesDashboard: React.FC = () => {
    const [currentView, setCurrentView] = useState('dashboard');

    const renderContent = () => {
        switch (currentView) {
            case 'farm-stats': return <FarmStatistics />;
            case 'invoices': return <InvoiceList />;
            case 'reports': return <Reports />;
            default: return <DashboardHome onNavigate={setCurrentView} />;
        }
    };

    return (
        <DashboardLayout title="داشبورد نظارتی فروش" onNavigate={setCurrentView}>
            {renderContent()}
        </DashboardLayout>
    );
};

const InvoiceList = () => {
    const { invoices, fetchInvoices } = useInvoiceStore();
    // Use full farms list
    const { farms } = useFarmStore(); 
    const { addToast } = useToastStore();
    const [selectedFarmId, setSelectedFarmId] = useState<string>('all');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const filteredInvoices = invoices
        .filter(i => (selectedFarmId === 'all' || i.farmId === selectedFarmId))
        .sort((a, b) => b.date.localeCompare(a.date));

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchInvoices();
        setTimeout(() => setIsRefreshing(false), 500);
        addToast('لیست حواله‌ها بروزرسانی شد', 'info');
    };

    return (
        <div className="space-y-6">
             <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-[24px] md:rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col gap-4 mb-2">
                    <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-3">
                         <h3 className="font-black text-lg md:text-xl text-gray-800 dark:text-white flex items-center gap-2">
                            <Icons.FileText className="w-6 h-6 text-orange-500" />
                            لیست حواله‌های فروش
                        </h3>
                         <span className="bg-orange-50 text-orange-600 px-3 py-1 rounded-full text-xs font-black">
                             {filteredInvoices.length} مورد
                         </span>
                    </div>

                    <div className="grid grid-cols-12 gap-3 items-end">
                        <div className="col-span-9 md:col-span-10">
                            <label className="block text-xs md:text-sm font-medium mb-1 dark:text-gray-300">فیلتر بر اساس فارم</label>
                            <select 
                                className="w-full p-2.5 border rounded-xl bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-bold h-[42px] outline-none"
                                value={selectedFarmId}
                                onChange={(e) => setSelectedFarmId(e.target.value)}
                            >
                                <option value="all">همه فارم‌ها</option>
                                {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                        </div>
                        <div className="col-span-3 md:col-span-2">
                            <Button 
                                onClick={handleRefresh} 
                                disabled={isRefreshing}
                                className="w-full h-[42px] bg-orange-100 text-orange-600 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 border-transparent rounded-xl flex items-center justify-center"
                            >
                                <Icons.Refresh className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-[24px] md:rounded-[32px] shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-50/50 dark:bg-gray-700/50">
                            <tr>
                                <th className="px-6 py-4">تاریخ بارگیری</th>
                                <th className="px-6 py-4">کد حواله</th>
                                <th className="px-6 py-4">مبدا (فارم)</th>
                                <th className="px-6 py-4">کارتن</th>
                                <th className="px-6 py-4">وزن</th>
                                <th className="px-6 py-4">وضعیت</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                            {filteredInvoices.map(i => (
                                <tr key={i.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="px-6 py-4 font-bold">{i.date}</td>
                                    <td className="px-6 py-4 font-mono font-black text-blue-600">{i.invoiceNumber}</td>
                                    <td className="px-6 py-4 font-bold">{farms.find(f => f.id === i.farmId)?.name}</td>
                                    <td className="px-6 py-4">{i.totalCartons}</td>
                                    <td className="px-6 py-4 font-bold">{i.totalWeight}</td>
                                    <td className="px-6 py-4">
                                        {i.isYesterday ? (
                                            <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-1 rounded-lg font-black">حواله دیروز</span>
                                        ) : (
                                            <span className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-lg font-black">ثبت روز</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                             {filteredInvoices.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-gray-400 font-bold">حواله‌ای برای نمایش وجود ندارد.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const DashboardHome: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
    const cards = [
        { title: 'آمار فارم‌ها', icon: Icons.BarChart, view: 'farm-stats', desc: 'تولید، فروش و موجودی لحظه‌ای' },
        { title: 'حواله‌های فروش', icon: Icons.FileText, view: 'invoices', desc: 'مشاهده حواله‌های ثبت شده' },
        { title: 'گزارشات جامع', icon: Icons.FileText, view: 'reports', desc: 'خروجی اکسل و فیلترهای پیشرفته' },
        { title: 'رانندگان', icon: Icons.User, view: 'drivers', desc: 'مدیریت ناوگان حمل و نقل' },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto pt-4">
            {cards.map((card, index) => (
                <button
                    key={index}
                    onClick={() => onNavigate(card.view)}
                    className="p-8 rounded-[32px] bg-white dark:bg-gray-800 shadow-xl shadow-gray-200/20 dark:shadow-none hover:scale-[1.02] transition-all duration-300 text-right group relative overflow-hidden border border-gray-100 dark:border-gray-700"
                >
                    <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -ml-10 -mt-10 transition-all group-hover:bg-blue-500/10"></div>
                    <div className="flex items-start justify-between mb-4 relative z-10">
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <card.icon className="w-8 h-8" />
                        </div>
                        <Icons.ChevronLeft className="w-6 h-6 text-gray-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <h3 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-2 relative z-10">{card.title}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium relative z-10">{card.desc}</p>
                </button>
            ))}
        </div>
    );
};

export default SalesDashboard;
