
import React, { useState, useEffect } from 'react';
import { useFarmStore } from '../../store/farmStore';
import { useStatisticsStore } from '../../store/statisticsStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useUserStore } from '../../store/userStore';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { Icons } from '../common/Icons';
import Button from '../common/Button';
import * as XLSX from 'xlsx';
import { toPersianDigits } from '../../utils/dateUtils';
import { UserRole } from '../../types';

type ReportTab = 'stats' | 'invoices' | 'users';

const Reports: React.FC = () => {
    const { user } = useAuthStore();
    const { farms, products } = useFarmStore();
    const { statistics } = useStatisticsStore();
    const { invoices } = useInvoiceStore();
    const { users } = useUserStore();
    const { addToast } = useToastStore();

    const isAdmin = user?.role === UserRole.ADMIN;
    const [reportTab, setReportTab] = useState<ReportTab>(isAdmin ? 'users' : 'stats');
    
    // Filters
    const [selectedFarmId, setSelectedFarmId] = useState<string>('all');
    const [selectedProductId, setSelectedProductId] = useState<string>('all');
    
    // Results & State
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    // Reset results when tab changes
    useEffect(() => {
        setHasSearched(false);
        setPreviewData([]);
    }, [reportTab]);

    const handleSearch = () => {
        setIsSearching(true);
        setHasSearched(true);
        
        // شبیه‌سازی لودینگ برای تجربه کاربری بهتر
        setTimeout(() => {
            let results: any[] = [];

            if (reportTab === 'stats') {
                results = statistics.filter(s => {
                    const farmMatch = selectedFarmId === 'all' || s.farmId === selectedFarmId;
                    const productMatch = selectedProductId === 'all' || s.productId === selectedProductId;
                    return farmMatch && productMatch;
                });
            } else if (reportTab === 'invoices') {
                results = invoices.filter(i => {
                    const farmMatch = selectedFarmId === 'all' || i.farmId === selectedFarmId;
                    const productMatch = selectedProductId === 'all' || i.productId === selectedProductId;
                    return farmMatch && productMatch;
                });
            } else if (reportTab === 'users' && isAdmin) {
                results = users;
            }

            setPreviewData(results);
            setIsSearching(false);
            if (results.length === 0) {
                addToast('هیچ رکوردی یافت نشد.', 'warning');
            }
        }, 350);
    };

    const handleExportExcel = () => {
        if (previewData.length === 0) return;

        try {
            const wb = XLSX.utils.book_new();
            wb.Workbook = { Views: [{ RTL: true }] };
            let wsData: any[] = [];
            let fileName = '';

            if (reportTab === 'stats') {
                fileName = `آمار_تولید_${new Date().getTime()}`;
                wsData = previewData.map(s => ({
                    'تاریخ': s.date,
                    'نام فارم': farms.find(f => f.id === s.farmId)?.name || 'ناشناس',
                    'محصول': products.find(p => p.id === s.productId)?.name || 'ناشناس',
                    'مانده قبلی': s.previousBalance,
                    'تولید': s.production,
                    'فروش': s.sales,
                    'موجودی نهایی': s.currentInventory,
                    'ثبت کننده': s.creatorName
                }));
            } else if (reportTab === 'invoices') {
                fileName = `حواله‌های_فروش_${new Date().getTime()}`;
                wsData = previewData.map(i => ({
                    'تاریخ': i.date,
                    'شماره حواله': i.invoiceNumber,
                    'نام فارم': farms.find(f => f.id === i.farmId)?.name || 'ناشناس',
                    'محصول': products.find(p => p.id === i.productId)?.name || 'ناشناس',
                    'تعداد کارتن': i.totalCartons,
                    'وزن (کیلو)': i.totalWeight,
                    'راننده': i.driverName || '-',
                    'پلاک': i.plateNumber || '-',
                    'دیروزی': i.isYesterday ? 'بله' : 'خیر'
                }));
            } else if (reportTab === 'users') {
                fileName = `عملکرد_کاربران_${new Date().getTime()}`;
                wsData = previewData.map(u => ({
                    'نام کامل': u.fullName,
                    'نام کاربری': u.username,
                    'نقش': u.role,
                    'وضعیت': u.isActive ? 'فعال' : 'غیرفعال',
                    'تاریخ ایجاد': u.createdAt ? new Date(u.createdAt).toLocaleDateString('fa-IR') : '-'
                }));
            }

            const ws = XLSX.utils.json_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, 'Data');
            XLSX.writeFile(wb, `${fileName}.xlsx`);
            addToast('فایل اکسل با موفقیت دانلود شد.', 'success');
        } catch (e) {
            addToast('خطا در تولید فایل اکسل', 'error');
        }
    };

    const filterItemClass = "flex flex-col gap-1 flex-1 min-w-[180px]";
    const selectClass = "w-full p-2.5 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white font-bold outline-none focus:border-metro-blue transition-colors";

    return (
        <div className="space-y-6">
            {/* Header Tabs with Role Enforcement */}
            <div className="flex bg-gray-200 dark:bg-gray-800 p-1 border-b-4 border-metro-dark shadow-inner">
                {isAdmin ? (
                    <div className="flex-1 py-4 font-black text-lg bg-metro-purple text-white shadow-lg flex items-center justify-center gap-2">
                        <Icons.Users className="w-6 h-6" />
                        گزارش جامع عملکرد کاربران (مخصوص مدیریت)
                    </div>
                ) : (
                    <>
                        <button 
                            onClick={() => setReportTab('stats')}
                            className={`flex-1 py-4 font-black text-sm transition-all flex items-center justify-center gap-2 ${reportTab === 'stats' ? 'bg-metro-blue text-white shadow-lg' : 'text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-700'}`}
                        >
                            <Icons.BarChart className="w-5 h-5" />
                            گزارش آمار تولید
                        </button>
                        <button 
                            onClick={() => setReportTab('invoices')}
                            className={`flex-1 py-4 font-black text-sm transition-all flex items-center justify-center gap-2 ${reportTab === 'invoices' ? 'bg-metro-orange text-white shadow-lg' : 'text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-700'}`}
                        >
                            <Icons.FileText className="w-5 h-5" />
                            گزارش حواله فروش
                        </button>
                    </>
                )}
            </div>

            {/* Filters */}
            <div className={`bg-white dark:bg-gray-800 p-6 border-l-8 shadow-md transition-all ${isAdmin ? 'border-metro-purple' : 'border-metro-blue'}`}>
                <div className="flex flex-wrap items-end gap-4">
                    {!isAdmin && (
                        <>
                            <div className={filterItemClass}>
                                <label className="text-xs font-black text-gray-400">فارم (پیش‌فرض: همه)</label>
                                <select value={selectedFarmId} onChange={(e) => setSelectedFarmId(e.target.value)} className={selectClass}>
                                    <option value="all">همه فارم‌ها</option>
                                    {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                            </div>
                            <div className={filterItemClass}>
                                <label className="text-xs font-black text-gray-400">محصول (پیش‌فرض: همه)</label>
                                <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} className={selectClass}>
                                    <option value="all">همه محصولات</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                        </>
                    )}
                    
                    {isAdmin && (
                        <div className="flex-1 text-gray-600 dark:text-gray-400 font-bold">
                            گزارش کامل وضعیت کاربران سیستم جهت نظارت و پایش امنیتی.
                        </div>
                    )}

                    <div className="flex gap-2 w-full md:w-auto">
                        <Button onClick={handleSearch} isLoading={isSearching} className={`h-[48px] px-8 flex-1 md:flex-none ${isAdmin ? 'bg-metro-purple' : 'bg-metro-dark'}`}>
                            <Icons.Search className="ml-2 w-5 h-5" />
                            جستجو
                        </Button>

                        {hasSearched && previewData.length > 0 && (
                            <Button onClick={handleExportExcel} variant="secondary" className="h-[48px] border-green-600 text-green-600 hover:bg-green-50">
                                <Icons.FileText className="ml-2 w-5 h-5" />
                                خروجی اکسل
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Preview Section */}
            <div className="bg-white dark:bg-gray-800 shadow-2xl min-h-[400px] border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700 flex justify-between items-center">
                    <h3 className="font-black text-gray-700 dark:text-gray-200 flex items-center gap-2 uppercase tracking-tighter">
                        <Icons.Eye className={`w-5 h-5 ${isAdmin ? 'text-metro-purple' : 'text-metro-blue'}`} />
                        Preview Area
                    </h3>
                    {hasSearched && (
                        <span className="text-xs bg-metro-dark text-white px-3 py-1 font-bold">
                            تعداد رکورد: {toPersianDigits(previewData.length)}
                        </span>
                    )}
                </div>

                {!hasSearched ? (
                    <div className="flex flex-col items-center justify-center py-24 opacity-20">
                        <Icons.Search className="w-20 h-20 mb-4" />
                        <p className="font-black text-xl">لطفاً پارامترها را انتخاب کرده و دکمه جستجو را بزنید.</p>
                    </div>
                ) : isSearching ? (
                    <div className="flex flex-col items-center justify-center py-24">
                        <Icons.Refresh className="w-12 h-12 animate-spin text-metro-blue mb-4" />
                        <p className="font-bold">در حال استخراج داده از سرور...</p>
                    </div>
                ) : previewData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-red-500">
                        <Icons.AlertCircle className="w-16 h-16 mb-4" />
                        <p className="font-black text-lg">نتیجه‌ای یافت نشد.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto max-h-[550px] custom-scrollbar">
                        <table className="w-full text-right border-collapse">
                            <thead className="bg-gray-100 dark:bg-gray-900 sticky top-0 z-10 shadow-sm font-black">
                                <tr>
                                    {reportTab === 'stats' && (
                                        <>
                                            <th className="p-4 border-b dark:border-gray-700 text-sm">تاریخ</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-sm">فارم</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-sm">محصول</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-sm text-center">تولید</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-sm text-center">فروش</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-sm text-center">موجودی</th>
                                        </>
                                    )}
                                    {reportTab === 'invoices' && (
                                        <>
                                            <th className="p-4 border-b dark:border-gray-700 text-sm">تاریخ</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-sm text-center">حواله</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-sm">فارم</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-sm text-center">کارتن</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-sm text-center">وزن</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-sm">راننده</th>
                                        </>
                                    )}
                                    {reportTab === 'users' && (
                                        <>
                                            <th className="p-4 border-b dark:border-gray-700 text-sm">نام کامل</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-sm">نقش</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-sm">کاربری</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-sm">وضعیت</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {previewData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        {reportTab === 'stats' && (
                                            <>
                                                <td className="p-4 font-mono text-xs">{toPersianDigits(row.date)}</td>
                                                <td className="p-4 font-bold">{farms.find(f => f.id === row.farmId)?.name}</td>
                                                <td className="p-4 text-xs">{products.find(p => p.id === row.productId)?.name}</td>
                                                <td className="p-4 text-center font-black text-green-600">+{toPersianDigits(row.production)}</td>
                                                <td className="p-4 text-center font-black text-red-600">-{toPersianDigits(row.sales || 0)}</td>
                                                <td className="p-4 text-center font-black text-metro-blue">{toPersianDigits(row.currentInventory)}</td>
                                            </>
                                        )}
                                        {reportTab === 'invoices' && (
                                            <>
                                                <td className="p-4 font-mono text-xs">{toPersianDigits(row.date)}</td>
                                                <td className="p-4 font-black text-center">{toPersianDigits(row.invoiceNumber)}</td>
                                                <td className="p-4">{farms.find(f => f.id === row.farmId)?.name}</td>
                                                <td className="p-4 text-center font-bold">{toPersianDigits(row.totalCartons)}</td>
                                                <td className="p-4 text-center font-bold">{toPersianDigits(row.totalWeight)}</td>
                                                <td className="p-4 text-xs font-bold">{row.driverName || '-'}</td>
                                            </>
                                        )}
                                        {reportTab === 'users' && (
                                            <>
                                                <td className="p-4 font-black">{row.fullName}</td>
                                                <td className="p-4 text-xs font-bold">{row.role}</td>
                                                <td className="p-4 font-mono text-xs">{row.username}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-0.5 text-[10px] font-black text-white ${row.isActive ? 'bg-metro-green' : 'bg-metro-red'}`}>
                                                        {row.isActive ? 'فعال' : 'غیرفعال'}
                                                    </span>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Reports;
