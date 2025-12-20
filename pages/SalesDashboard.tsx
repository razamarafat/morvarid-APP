
import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Icons } from '../components/common/Icons';
import Reports from '../components/admin/Reports';
import { useStatisticsStore } from '../store/statisticsStore';
import { useInvoiceStore } from '../store/invoiceStore';
import { useFarmStore } from '../store/farmStore';
import { useToastStore } from '../store/toastStore';
import { useLogStore } from '../store/logStore';
import { useAuthStore } from '../store/authStore';
import { getTodayJalali, normalizeDate } from '../utils/dateUtils';
import Button from '../components/common/Button';
import JalaliDatePicker from '../components/common/JalaliDatePicker';

const FarmStatistics = () => {
    const { statistics, fetchStatistics, isLoading } = useStatisticsStore();
    const { farms, products } = useFarmStore();
    const { addToast } = useToastStore();
    const { addLog } = useLogStore();
    const { user } = useAuthStore();
    
    // Default to Today. normalizeDate ensures it matches the Store format exactly.
    const [selectedDate, setSelectedDate] = useState(getTodayJalali());
    // Ensure strict normalization for comparison
    const normalizedSelectedDate = normalizeDate(selectedDate);

    const [selectedFarmId, setSelectedFarmId] = useState<string>('all');
    const [alertCooldowns, setAlertCooldowns] = useState<Record<string, number>>({});
    const [now, setNow] = useState(Date.now());
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Initial Fetch & Auto-Refresh Interval
    useEffect(() => {
        fetchStatistics(); // Fetch on mount
        const interval = setInterval(() => {
             fetchStatistics(); // Silent update every 30s
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

    const handleSendAlert = (farmId: string, farmName: string) => {
        const logMsg = `SEND_ALERT: Manual alert by ${user?.fullName} for ${farmName} on ${normalizedSelectedDate}`;
        addLog('warn', 'network', logMsg, user?.id);

        const cooldownTime = 10 * 60 * 1000; // 10 minutes
        setAlertCooldowns(prev => ({ ...prev, [farmId]: Date.now() + cooldownTime }));
        
        addToast(`هشدار عدم ثبت آمار برای فارم "${farmName}" ثبت شد.`, 'success');
    };

    const isCooldownActive = (farmId: string) => alertCooldowns[farmId] && alertCooldowns[farmId] > now;

    // Filter farms based on dropdown
    const filteredFarms = selectedFarmId === 'all' ? farms : farms.filter(f => f.id === selectedFarmId);

    return (
        <div className="space-y-4 md:space-y-6">
            <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-[24px] md:rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700">
                
                {/* Header Controls - Grid Layout for Mobile Stability */}
                <div className="flex flex-col gap-4 mb-6">
                    {/* Title Row */}
                    <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-3">
                        <h3 className="font-black text-lg md:text-xl text-gray-800 dark:text-white flex items-center gap-2">
                            <Icons.BarChart className="w-6 h-6 text-blue-500" />
                            <span>پایش آمار روزانه</span>
                        </h3>
                        <span className="text-xs md:text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-full font-mono dir-ltr font-bold">
                            {normalizedSelectedDate}
                        </span>
                    </div>
                    
                    {/* Filters Row - Optimized for Mobile */}
                    <div className="grid grid-cols-12 gap-3 items-end">
                        {/* Date Picker: Full width on mobile, 4 cols on desktop */}
                        <div className="col-span-12 md:col-span-4">
                             <JalaliDatePicker 
                                value={selectedDate}
                                onChange={setSelectedDate}
                                label="انتخاب تاریخ"
                            />
                        </div>

                        {/* Farm Select: Grows to fill available space */}
                        <div className="col-span-9 md:col-span-6">
                            <label className="block text-xs md:text-sm font-medium mb-1 dark:text-gray-300">فیلتر فارم</label>
                            <select 
                                className="w-full p-2.5 border rounded-xl bg-gray-50 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:border-blue-500 font-bold h-[42px] transition-colors"
                                value={selectedFarmId}
                                onChange={(e) => setSelectedFarmId(e.target.value)}
                            >
                                <option value="all">نمایش همه فارم‌ها</option>
                                {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                        </div>
                        
                        {/* Refresh Button: Fixed width */}
                        <div className="col-span-3 md:col-span-2">
                             <label className="block text-xs md:text-sm font-medium mb-1 opacity-0">بروزرسانی</label>
                             <Button 
                                onClick={handleManualRefresh} 
                                disabled={isRefreshing}
                                className="w-full h-[42px] bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 border-transparent rounded-xl flex items-center justify-center"
                                title="بروزرسانی اطلاعات از سرور"
                            >
                                <Icons.Refresh className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Farm Cards Grid */}
                <div className="grid gap-4">
                    {isLoading && statistics.length === 0 && <div className="text-center py-12 text-gray-400">در حال دریافت اطلاعات...</div>}
                    
                    {!isLoading && filteredFarms.length === 0 && (
                        <div className="text-center py-8 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
                            فارمی برای نمایش وجود ندارد.
                        </div>
                    )}

                    {filteredFarms.map(farm => {
                        // CORE LOGIC: Find stats specifically for the selected normalized date
                        const farmStats = statistics.filter(s => 
                            s.farmId === farm.id && 
                            normalizeDate(s.date) === normalizedSelectedDate
                        );
                        
                        const hasStats = farmStats.length > 0;
                        const onCooldown = isCooldownActive(farm.id);
                        const isToday = normalizedSelectedDate === normalizeDate(getTodayJalali());

                        const latestStat = statistics
                            .filter(s => s.farmId === farm.id)
                            .sort((a, b) => b.date.localeCompare(a.date))[0];
                        
                        return (
                            <div key={farm.id} className={`rounded-[24px] overflow-hidden border-2 transition-all ${hasStats ? 'border-green-100 bg-green-50/10 dark:border-green-900/20' : 'border-red-100 bg-red-50/10 dark:border-red-900/20'}`}>
                                <div className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                                    <div className="flex items-center gap-3 w-full md:w-auto">
                                        <div className={`w-3 h-3 rounded-full shrink-0 ${hasStats ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.4)]'}`}></div>
                                        <div className="flex-1">
                                            <h4 className="font-black text-lg text-gray-800 dark:text-white leading-none">{farm.name}</h4>
                                            {!hasStats && (
                                                <p className="text-[10px] text-gray-400 font-bold mt-1.5">
                                                    {latestStat ? `آخرین آمار: ${latestStat.date}` : 'فاقد سابقه'}
                                                </p>
                                            )}
                                        </div>
                                        {/* Mobile Status Badge */}
                                        {hasStats && (
                                            <span className="md:hidden text-green-600 dark:text-green-400 font-bold text-[10px] bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full flex items-center gap-1">
                                                <Icons.Check className="w-3 h-3" />
                                                تایید
                                            </span>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="w-full md:w-auto flex justify-end">
                                        {!hasStats && isToday && (
                                            <Button 
                                                size="sm" 
                                                variant={onCooldown ? "secondary" : "danger"} 
                                                onClick={() => handleSendAlert(farm.id, farm.name)}
                                                disabled={onCooldown}
                                                className="w-full md:w-auto font-black rounded-xl py-2.5"
                                            >
                                                <Icons.Bell className="w-4 h-4 ml-2" />
                                                {onCooldown ? 'هشدار ارسال شد' : 'ارسال هشدار'}
                                            </Button>
                                        )}
                                        {hasStats && (
                                            <span className="hidden md:flex text-green-600 dark:text-green-400 font-bold text-sm bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full items-center gap-1">
                                                <Icons.Check className="w-3 h-3" />
                                                آمار تایید شده
                                            </span>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Stats Content */}
                                {hasStats ? (
                                    <div className="p-3 md:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                                        {farmStats.map(stat => (
                                            <div key={stat.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 relative group hover:border-blue-200 transition-colors">
                                                <h5 className="font-black text-blue-600 dark:text-blue-400 mb-3 border-b pb-2 text-sm">
                                                    {products.find(p => p.id === stat.productId)?.name || 'محصول'}
                                                </h5>
                                                <div className="space-y-2 text-xs font-bold">
                                                    <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/30 p-1.5 rounded-lg">
                                                        <span className="text-gray-400">مانده قبل:</span>
                                                        <span className="text-gray-700 dark:text-gray-300 font-mono">{stat.previousBalance?.toLocaleString() || 0}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-green-50 dark:bg-green-900/10 p-1.5 rounded-lg">
                                                        <span className="text-gray-400">تولید (+):</span>
                                                        <span className="text-green-600 font-mono text-sm">{stat.production?.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center bg-red-50 dark:bg-red-900/10 p-1.5 rounded-lg">
                                                        <span className="text-gray-400">فروش (-):</span>
                                                        <span className="text-red-500 font-mono text-sm">{stat.sales?.toLocaleString() || 0}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center pt-2 border-t dark:border-gray-700 mt-2">
                                                        <span className="text-gray-600 dark:text-gray-300 font-black">موجودی نهایی:</span>
                                                        <span className="text-blue-600 dark:text-blue-400 text-lg font-black font-mono">{stat.currentInventory?.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-6 text-center bg-gray-50/50 dark:bg-gray-800/50">
                                        <p className="text-gray-400 font-medium italic text-xs md:text-sm">
                                            هنوز آماری برای تاریخ <span dir="ltr" className="mx-1 font-bold text-gray-500">{normalizedSelectedDate}</span> ثبت نشده است.
                                        </p>
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
                
                {/* Mobile-Friendly Header for Invoices */}
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
