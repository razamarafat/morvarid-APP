
import React, { useState, useEffect } from 'react';
import DashboardLayout from '../layout/DashboardLayout';
import { Icons } from '../common/Icons';
import Reports from '../admin/Reports';
import { useStatisticsStore } from '../../store/statisticsStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useFarmStore } from '../../store/farmStore';
import { useToastStore } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { useAlertStore } from '../../store/alertStore'; // Import Alert Store
import { getTodayJalali, normalizeDate, toPersianDigits } from '../../utils/dateUtils';
import Button from '../common/Button';
import JalaliDatePicker from '../common/JalaliDatePicker';
import { FarmType } from '../../types';
import MetroTile from '../common/MetroTile';

const FarmStatistics = () => {
    const { statistics, fetchStatistics, isLoading } = useStatisticsStore();
    const { farms, products } = useFarmStore(); 
    const { addToast } = useToastStore();
    const { sendAlert } = useAlertStore(); // Use sendAlert
    
    const [selectedDate, setSelectedDate] = useState(getTodayJalali());
    const normalizedSelectedDate = normalizeDate(selectedDate);
    const [expandedFarmId, setExpandedFarmId] = useState<string | null>(null);
    const [alertLoading, setAlertLoading] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        fetchStatistics(); 
        const interval = setInterval(() => { fetchStatistics(); }, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        await fetchStatistics();
        setTimeout(() => setIsRefreshing(false), 500);
        addToast('اطلاعات بروزرسانی شد', 'info');
    };

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

    return (
        <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 p-4 shadow-md border-l-4 border-metro-blue flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                    <JalaliDatePicker value={selectedDate} onChange={setSelectedDate} label="انتخاب تاریخ" />
                </div>
                <Button 
                    onClick={handleManualRefresh} 
                    disabled={isRefreshing}
                    className="w-full md:w-auto bg-metro-blue hover:bg-metro-cobalt"
                >
                    <Icons.Refresh className={`w-4 h-4 ml-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    بروزرسانی
                </Button>
            </div>

            <div className="grid gap-2 animate-in slide-in-from-bottom-2 duration-500">
                {isLoading && <div className="text-center py-8 text-gray-500 dark:text-gray-400">در حال دریافت اطلاعات...</div>}
                
                {farms.map(farm => {
                    const farmStats = statistics.filter(s => 
                        s.farmId === farm.id && 
                        normalizeDate(s.date) === normalizedSelectedDate
                    );
                    const hasStats = farmStats.length > 0;
                    const isExpanded = expandedFarmId === farm.id;

                    return (
                        <div key={farm.id} className="group shadow-sm">
                            <div 
                                onClick={() => toggleFarm(farm.id)}
                                className={`p-4 flex items-center justify-between cursor-pointer transition-colors border-l-4 min-h-[80px] ${
                                    hasStats 
                                        ? 'bg-white dark:bg-gray-800 border-metro-green hover:bg-green-50 dark:hover:bg-gray-700' 
                                        : 'bg-white dark:bg-gray-800 border-metro-red hover:bg-red-50 dark:hover:bg-gray-700'
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 text-white shadow-md ${hasStats ? 'bg-metro-green' : 'bg-metro-red'}`}>
                                        <Icons.Home className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-gray-800 dark:text-white text-lg">{farm.name}</h4>
                                        <span className={`text-xs font-bold ${hasStats ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {hasStats ? 'آمار ثبت شده' : 'عدم ثبت'}
                                        </span>
                                    </div>
                                </div>
                                {!hasStats && (
                                    <Button 
                                        size="sm" 
                                        variant="danger" 
                                        onClick={(e) => handleSendAlert(farm.id, farm.name, e)}
                                        isLoading={alertLoading === farm.id}
                                    >
                                        هشدار
                                    </Button>
                                )}
                            </div>

                            {isExpanded && hasStats && (
                                <div className="bg-[#f0f0f0] dark:bg-black/20 p-2 animate-in slide-in-from-top-1">
                                    {farmStats.map(stat => (
                                        <div key={stat.id} className="bg-white dark:bg-gray-700 p-3 mb-1 flex justify-between items-center shadow-sm">
                                            <span className="font-bold text-metro-blue dark:text-blue-300">{products.find(p => p.id === stat.productId)?.name}</span>
                                            <div className="flex gap-4 text-sm">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[10px] text-gray-400">تولید</span>
                                                    <span className="text-green-600 dark:text-green-400 font-bold">+{toPersianDigits(stat.production)}</span>
                                                </div>
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[10px] text-gray-400">فروش</span>
                                                    <span className="text-red-600 dark:text-red-400 font-bold">-{toPersianDigits(stat.sales || 0)}</span>
                                                </div>
                                                {farm.type !== FarmType.MOTEFEREGHE && (
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[10px] text-gray-400">موجودی</span>
                                                        <span className="text-orange-600 dark:text-orange-400 font-bold">{toPersianDigits(stat.currentInventory)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
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

    const filteredInvoices = invoices
        .filter(i => (selectedFarmId === 'all' || i.farmId === selectedFarmId))
        .sort((a, b) => b.date.localeCompare(a.date));

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchInvoices();
        setTimeout(() => setIsRefreshing(false), 500);
        addToast('لیست بروزرسانی شد', 'info');
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
             <div className="bg-white dark:bg-gray-800 p-4 shadow-sm border-l-4 border-metro-orange flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-bold mb-1 text-gray-700 dark:text-gray-300">فیلتر فارم</label>
                    <select 
                        className="w-full p-2.5 border-2 border-gray-300 bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-bold outline-none focus:border-metro-orange"
                        value={selectedFarmId}
                        onChange={(e) => setSelectedFarmId(e.target.value)}
                    >
                        <option value="all">همه فارم‌ها</option>
                        {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                </div>
                <Button onClick={handleRefresh} disabled={isRefreshing} className="bg-metro-orange h-[42px] px-6">
                    <Icons.Refresh className={`w-4 h-4 ml-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    بروزرسانی
                </Button>
            </div>

            <div className="bg-white dark:bg-gray-800 p-0 shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right border-collapse">
                        <thead className="bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            <tr>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">تاریخ</th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-center">کد حواله</th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">فارم</th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">کارتن</th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">وزن</th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">وضعیت</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                            {filteredInvoices.map(i => (
                                <tr key={i.id} className="hover:bg-blue-50 dark:hover:bg-gray-700/50 transition-colors text-gray-800 dark:text-gray-200">
                                    <td className="px-4 py-3 font-bold whitespace-nowrap">{toPersianDigits(i.date)}</td>
                                    <td className="px-4 py-3 text-center dir-ltr" dir="ltr">
                                        {renderInvoiceNumber(i.invoiceNumber)}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">{farms.find(f => f.id === i.farmId)?.name}</td>
                                    <td className="px-4 py-3">{toPersianDigits(i.totalCartons)}</td>
                                    <td className="px-4 py-3 font-bold">{toPersianDigits(i.totalWeight)}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col gap-1">
                                            <span className={`px-2 py-0.5 text-xs font-bold text-white w-fit ${i.isYesterday ? 'bg-metro-orange' : 'bg-metro-green'}`}>
                                                {i.isYesterday ? 'دیروز' : 'امروز'}
                                            </span>
                                            {i.updatedAt && (
                                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">(ویرایش شده)</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
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
            <MetroTile title="آمار فارم‌ها" icon={Icons.BarChart} color="bg-metro-blue" size="wide" onClick={() => onNavigate('farm-stats')} />
            <MetroTile title="حواله‌های فروش" icon={Icons.FileText} color="bg-metro-orange" size="wide" onClick={() => onNavigate('invoices')} />
            <MetroTile title="گزارشات جامع" icon={Icons.FileText} color="bg-metro-green" size="medium" onClick={() => onNavigate('reports')} />
        </div>
    );
};

const SalesDashboard: React.FC = () => {
    const [currentView, setCurrentView] = useState('dashboard');
    const getTitle = () => {
        if(currentView === 'farm-stats') return 'پایش آمار';
        if(currentView === 'invoices') return 'حواله‌ها';
        if(currentView === 'reports') return 'گزارشات'; // Updated to match screenshot header
        return 'داشبورد فروش';
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
