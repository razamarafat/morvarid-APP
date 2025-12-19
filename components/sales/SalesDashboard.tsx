import React, { useState } from 'react';
import DashboardLayout from '../layout/DashboardLayout';
import { Icons } from '../common/Icons';
import Reports from '../admin/Reports';
import { useStatisticsStore } from '../../store/statisticsStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useFarmStore } from '../../store/farmStore';
import { useToastStore } from '../../store/toastStore';
import { getTodayJalali } from '../../utils/dateUtils';
import Button from '../common/Button';

const FarmStatistics = () => {
    const { statistics } = useStatisticsStore();
    const { farms, products } = useFarmStore();
    const { addToast } = useToastStore();
    const today = getTodayJalali();
    
    const [selectedFarmId, setSelectedFarmId] = useState<string>('all');

    const handleSendAlert = (farmName: string) => {
        // Simulation of sending notification
        addToast(`هشدار عدم ثبت آمار برای فارم "${farmName}" به مسئول مربوطه ارسال شد.`, 'success');
    };

    const filteredFarms = selectedFarmId === 'all' ? farms : farms.filter(f => f.id === selectedFarmId);

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-[24px] shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                        <Icons.BarChart className="w-5 h-5 text-blue-500" />
                        وضعیت آمار روزانه ({today})
                    </h3>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <span className="text-sm font-medium dark:text-gray-300 whitespace-nowrap">انتخاب فارم:</span>
                        <select 
                            className="w-full md:w-64 p-2 border rounded-xl bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            value={selectedFarmId}
                            onChange={(e) => setSelectedFarmId(e.target.value)}
                        >
                            <option value="all">همه فارم‌ها</option>
                            {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid gap-4">
                    {filteredFarms.map(farm => {
                        // Check if this farm has stats for today
                        const farmStats = statistics.filter(s => s.farmId === farm.id && s.date === today);
                        const hasStatsToday = farmStats.length > 0;
                        
                        return (
                            <div key={farm.id} className="bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
                                <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${hasStatsToday ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
                                        <h4 className="font-bold text-gray-800 dark:text-white">{farm.name}</h4>
                                    </div>
                                    {!hasStatsToday && (
                                        <Button size="sm" variant="danger" onClick={() => handleSendAlert(farm.name)}>
                                            <Icons.Bell className="w-4 h-4 ml-2" />
                                            ارسال هشدار
                                        </Button>
                                    )}
                                </div>
                                
                                {hasStatsToday ? (
                                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {farmStats.map(stat => (
                                            <div key={stat.id} className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                                                <h5 className="font-bold text-sm text-gray-600 dark:text-gray-300 mb-2 flex flex-wrap items-center">
                                                    {products.find(p => p.id === stat.productId)?.name}
                                                    <span className="text-[10px] text-gray-400 mr-2 font-normal">
                                                        {products.find(p => p.id === stat.productId)?.description}
                                                    </span>
                                                </h5>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div className="text-gray-500">مانده قبل: {stat.previousBalance || 0}</div>
                                                    <div>تولید: <span className="font-bold text-green-600">{stat.production}</span></div>
                                                    {stat.sales && <div>فروش: <span className="font-bold text-red-600">{stat.sales}</span></div>}
                                                    {stat.currentInventory && <div className="col-span-2 mt-1 pt-1 border-t dark:border-gray-700">موجودی: <span className="font-bold text-blue-600">{stat.currentInventory}</span></div>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-gray-400 text-sm">
                                        هنوز آماری برای امروز ثبت نشده است.
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Detailed Stats Table */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-[24px] shadow-sm overflow-hidden">
                <h3 className="font-bold text-lg mb-4 dark:text-white">جزئیات آمار ثبت شده</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                                <th className="px-6 py-3">فارم</th>
                                <th className="px-6 py-3">محصول</th>
                                <th className="px-6 py-3">مانده قبل</th>
                                <th className="px-6 py-3">تولید</th>
                                <th className="px-6 py-3">فروش</th>
                                <th className="px-6 py-3">موجودی</th>
                            </tr>
                        </thead>
                        <tbody>
                            {statistics
                                .filter(s => (selectedFarmId === 'all' || s.farmId === selectedFarmId))
                                .sort((a, b) => b.date.localeCompare(a.date))
                                .slice(0, 20) // Show last 20
                                .map(s => (
                                <tr key={s.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="px-6 py-4 font-bold">{farms.find(f => f.id === s.farmId)?.name}</td>
                                    <td className="px-6 py-4">{products.find(p => p.id === s.productId)?.name}</td>
                                    <td className="px-6 py-4">{s.previousBalance || 0}</td>
                                    <td className="px-6 py-4 font-bold text-green-600">{s.production}</td>
                                    <td className="px-6 py-4 text-red-600">{s.sales || 0}</td>
                                    <td className="px-6 py-4 font-bold text-blue-600">{s.currentInventory || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const InvoiceList = () => {
    const { invoices } = useInvoiceStore();
    const { farms } = useFarmStore();
    const { addToast } = useToastStore();
    const [selectedFarmId, setSelectedFarmId] = useState<string>('all');

    const filteredInvoices = invoices
        .filter(i => (selectedFarmId === 'all' || i.farmId === selectedFarmId))
        .sort((a, b) => b.date.localeCompare(a.date));
        
    const handleAlert = () => {
        addToast('هشدار ثبت حواله برای فارم‌های فاقد فعالیت ارسال شد', 'success');
    }

    return (
        <div className="space-y-6">
             <div className="bg-white dark:bg-gray-800 p-6 rounded-[24px] shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                    <Icons.FileText className="w-5 h-5 text-blue-500" />
                    حواله‌های فروش
                </h3>
                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto items-center">
                    <Button size="sm" variant="danger" onClick={handleAlert} className="w-full md:w-auto">ارسال هشدار کلی</Button>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <span className="text-sm font-medium dark:text-gray-300 whitespace-nowrap">انتخاب فارم:</span>
                        <select 
                            className="p-2 border rounded-xl bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 flex-1 dark:text-white"
                            value={selectedFarmId}
                            onChange={(e) => setSelectedFarmId(e.target.value)}
                        >
                            <option value="all">همه فارم‌ها</option>
                            {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-[24px] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-200">
                            <tr>
                                <th className="px-6 py-3">تاریخ</th>
                                <th className="px-6 py-3">شماره حواله</th>
                                <th className="px-6 py-3">فارم</th>
                                <th className="px-6 py-3">کارتن</th>
                                <th className="px-6 py-3">وزن</th>
                                <th className="px-6 py-3">راننده</th>
                                <th className="px-6 py-3">وضعیت</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredInvoices.map(i => (
                                <tr key={i.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="px-6 py-4">{i.date}</td>
                                    <td className="px-6 py-4 font-mono font-bold text-blue-600">{i.invoiceNumber}</td>
                                    <td className="px-6 py-4">{farms.find(f => f.id === i.farmId)?.name}</td>
                                    <td className="px-6 py-4">{i.totalCartons}</td>
                                    <td className="px-6 py-4">{i.totalWeight}</td>
                                    <td className="px-6 py-4 text-xs">{i.driverName || '-'}</td>
                                    <td className="px-6 py-4">
                                        {i.isYesterday ? (
                                            <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full border border-yellow-200">دیروزی</span>
                                        ) : (
                                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full border border-green-200">عادی</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                             {filteredInvoices.length === 0 && <tr><td colSpan={7} className="text-center py-8">حواله‌ای یافت نشد</td></tr>}
                        </tbody>
                    </table>
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
            case 'drivers': return (
                <div className="flex flex-col items-center justify-center h-96 bg-white dark:bg-gray-800 rounded-[32px] shadow-sm p-8 text-center border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <div className="bg-blue-50 dark:bg-gray-700 p-6 rounded-full mb-6">
                        <Icons.User className="w-16 h-16 text-blue-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">پنل رانندگان (آزمایشی)</h3>
                    <p className="text-gray-500 max-w-md">این ماژول در نسخه 1.1.0 برای مدیریت ناوگان و ثبت پلاک‌ها فعال خواهد شد.</p>
                </div>
            );
            case 'reports': return <Reports />;
            default: return <DashboardHome onNavigate={setCurrentView} />;
        }
    };
    
    const getTitle = () => {
        switch(currentView){
            case 'farm-stats': return 'پایش آمار فارم‌ها';
            case 'invoices': return 'پایش حواله‌های فروش';
            case 'drivers': return 'مدیریت رانندگان';
            case 'reports': return 'گزارشات جامع اکسل';
            default: return 'داشبورد فروش';
        }
    }

    return (
        <DashboardLayout title={getTitle()} onNavigate={setCurrentView}>
            {renderContent()}
        </DashboardLayout>
    );
};

const DashboardHome: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
    const cards = [
        { title: 'آمار فارم‌ها', icon: Icons.BarChart, view: 'farm-stats', desc: 'مشاهده تولید و موجودی روزانه' },
        { title: 'حواله‌های فروش', icon: Icons.FileText, view: 'invoices', desc: 'لیست حواله‌های بارگیری شده' },
        { title: 'گزارشات جامع', icon: Icons.FileText, view: 'reports', desc: 'خروجی اکسل از تمام داده‌ها' },
        { title: