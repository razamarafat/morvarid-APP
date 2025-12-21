
import React, { useState, useEffect } from 'react';
import { useFarmStore } from '../../store/farmStore';
import { useStatisticsStore } from '../../store/statisticsStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useUserStore } from '../../store/userStore';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { Icons } from '../common/Icons';
import Button from '../common/Button';
import JalaliDatePicker from '../common/JalaliDatePicker';
import * as XLSX from 'xlsx';
import { toPersianDigits, getTodayJalali, normalizeDate, isDateInRange } from '../../utils/dateUtils';
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
    
    // Default tab
    const initialTab: ReportTab = 'invoices';

    const [reportTab, setReportTab] = useState<ReportTab>(initialTab);
    
    // Filters
    const [selectedFarmId, setSelectedFarmId] = useState<string>('all');
    const [selectedProductId, setSelectedProductId] = useState<string>('all');
    const [startDate, setStartDate] = useState(getTodayJalali());
    const [endDate, setEndDate] = useState(getTodayJalali());
    
    // Data for preview
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        setHasSearched(false);
        setPreviewData([]);
        setSelectedFarmId('all');
        setSelectedProductId('all');
        setStartDate(getTodayJalali());
        setEndDate(getTodayJalali());
    }, [reportTab]);

    const handleSearch = () => {
        setIsSearching(true);
        setHasSearched(true);
        
        const normalizedStart = normalizeDate(startDate);
        const normalizedEnd = normalizeDate(endDate);

        setTimeout(() => {
            let data: any[] = [];

            if (reportTab === 'stats') {
                data = statistics.filter(s => {
                    const farmMatch = selectedFarmId === 'all' || s.farmId === selectedFarmId;
                    const productMatch = selectedProductId === 'all' || s.productId === selectedProductId;
                    const dateMatch = isDateInRange(s.date, normalizedStart, normalizedEnd);
                    return farmMatch && productMatch && dateMatch;
                });
            } else if (reportTab === 'invoices') {
                data = invoices.filter(i => {
                    const farmMatch = selectedFarmId === 'all' || i.farmId === selectedFarmId;
                    const productMatch = selectedProductId === 'all' || i.productId === selectedProductId;
                    const dateMatch = isDateInRange(i.date, normalizedStart, normalizedEnd);
                    return farmMatch && productMatch && dateMatch;
                });
            } else if (reportTab === 'users' && isAdmin) {
                data = users;
            }

            if (reportTab !== 'users') {
                data.sort((a, b) => b.date.localeCompare(a.date));
            }

            setPreviewData(data);
            setIsSearching(false);
            
            if (data.length === 0) {
                addToast('داده‌ای با این مشخصات یافت نشد.', 'warning');
            } else {
                addToast(`${toPersianDigits(data.length)} رکورد پیدا شد.`, 'success');
            }
        }, 300);
    };

    const handleExportExcel = () => {
        if (previewData.length === 0) {
            addToast('داده‌ای برای خروجی وجود ندارد.', 'warning');
            return;
        }

        try {
            const wb = XLSX.utils.book_new();
            wb.Workbook = { Views: [{ RTL: true }] }; 
            let wsData: any[] = [];
            let fileName = '';

            if (reportTab === 'stats') {
                fileName = `Production_Report_${new Date().toISOString().slice(0,10)}`;
                wsData = previewData.map(s => ({
                    'تاریخ': s.date,
                    'نام فارم': farms.find(f => f.id === s.farmId)?.name || 'ناشناس',
                    'محصول': products.find(p => p.id === s.productId)?.name || 'ناشناس',
                    'مانده قبلی': s.previousBalance,
                    'تولید': s.production,
                    'فروش': s.sales,
                    'موجودی نهایی': s.currentInventory,
                    'ثبت کننده': s.creatorName || '-'
                }));
            } else if (reportTab === 'invoices') {
                fileName = `Sales_Invoices_${new Date().toISOString().slice(0,10)}`;
                wsData = previewData.map(i => ({
                    'رمز حواله': i.invoiceNumber,
                    'تاریخ': i.date,
                    'نام فارم': farms.find(f => f.id === i.farmId)?.name || 'ناشناس',
                    'محصول': products.find(p => p.id === i.productId)?.name || 'ناشناس',
                    'تعداد': i.totalCartons,
                    'وزن': i.totalWeight,
                    'نام راننده': i.driverName || '-',
                    'شماره پلاک': i.plateNumber || '-',
                    'شماره تماس': i.driverPhone || '-',
                    'وضعیت': i.isYesterday ? 'دیروزی' : 'امروز',
                    'توضیحات': i.description || '-'
                }));
            } else if (reportTab === 'users' && isAdmin) {
                fileName = `Users_List_${new Date().toISOString().slice(0,10)}`;
                wsData = previewData.map(u => ({
                    'نام کامل': u.fullName,
                    'نام کاربری': u.username,
                    'نقش': u.role,
                    'وضعیت': u.isActive ? 'فعال' : 'غیرفعال',
                    'شماره تماس': u.phoneNumber || '-',
                    'تاریخ عضویت': u.createdAt ? new Date(u.createdAt).toLocaleDateString('fa-IR') : '-'
                }));
            }

            const ws = XLSX.utils.json_to_sheet(wsData);
            const wscols = Object.keys(wsData[0] || {}).map(() => ({ wch: 20 }));
            ws['!cols'] = wscols;

            XLSX.utils.book_append_sheet(wb, ws, 'Report Data');
            XLSX.writeFile(wb, `${fileName}.xlsx`);
            addToast('فایل اکسل دانلود شد.', 'success');
        } catch (error) {
            console.error(error);
            addToast('خطا در ایجاد فایل اکسل', 'error');
        }
    };

    const selectClass = "w-full p-2.5 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white font-bold outline-none focus:border-metro-blue rounded-lg";

    return (
        <div className="space-y-6">
            {/* Tabs */}
            <div className="flex bg-gray-200 dark:bg-gray-800 p-1 shadow-inner border-b-4 border-metro-dark rounded-t-lg overflow-hidden">
                <button 
                    onClick={() => setReportTab('invoices')}
                    className={`flex-1 py-4 font-black text-sm transition-all flex items-center justify-center gap-2 ${reportTab === 'invoices' ? 'bg-metro-orange text-white shadow-lg' : 'text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-700'}`}
                >
                    <Icons.FileText className="w-5 h-5" />
                    گزارش حواله فروش
                </button>
                <button 
                    onClick={() => setReportTab('stats')}
                    className={`flex-1 py-4 font-black text-sm transition-all flex items-center justify-center gap-2 ${reportTab === 'stats' ? 'bg-metro-blue text-white shadow-lg' : 'text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-700'}`}
                >
                    <Icons.BarChart className="w-5 h-5" />
                    گزارش آمار تولید
                </button>
                {isAdmin && (
                    <button 
                        onClick={() => setReportTab('users')}
                        className={`flex-1 py-4 font-black text-sm transition-all flex items-center justify-center gap-2 ${reportTab === 'users' ? 'bg-metro-purple text-white shadow-lg' : 'text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-700'}`}
                    >
                        <Icons.Users className="w-5 h-5" />
                        گزارش عملکرد کاربران
                    </button>
                )}
            </div>

            {/* Filters Section */}
            <div className={`bg-white dark:bg-gray-800 p-6 border-l-8 shadow-md rounded-b-lg ${reportTab === 'users' ? 'border-metro-purple' : reportTab === 'invoices' ? 'border-metro-orange' : 'border-metro-blue'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    {reportTab !== 'users' ? (
                        <>
                            <div className="w-full">
                                <label className="text-xs font-bold text-gray-500 mb-1 block">انتخاب فارم</label>
                                <select value={selectedFarmId} onChange={(e) => setSelectedFarmId(e.target.value)} className={selectClass}>
                                    <option value="all">همه فارم‌ها</option>
                                    {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                            </div>
                            <div className="w-full">
                                <label className="text-xs font-bold text-gray-500 mb-1 block">انتخاب محصول</label>
                                <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} className={selectClass}>
                                    <option value="all">همه محصولات</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div className="w-full">
                                <JalaliDatePicker value={startDate} onChange={setStartDate} label="از تاریخ" />
                            </div>
                            <div className="w-full">
                                <JalaliDatePicker value={endDate} onChange={setEndDate} label="تا تاریخ" />
                            </div>
                        </>
                    ) : (
                        <div className="col-span-1 md:col-span-2 lg:col-span-4">
                            <p className="text-sm font-bold text-gray-600 dark:text-gray-400">
                                گزارش کامل تمامی کاربران سیستم، شامل نقش‌ها و وضعیت فعالیت.
                            </p>
                        </div>
                    )}

                    <div className="flex gap-2 w-full col-span-1 md:col-span-2 lg:col-span-4 mt-4 justify-end">
                        <Button 
                            onClick={handleSearch} 
                            isLoading={isSearching} 
                            className={`h-[46px] px-12 font-black text-lg ${reportTab === 'users' ? 'bg-metro-purple hover:bg-metro-darkPurple' : reportTab === 'invoices' ? 'bg-metro-orange hover:bg-amber-600' : 'bg-metro-blue hover:bg-metro-cobalt'}`}
                        >
                            <Icons.Search className="ml-2 w-5 h-5" />
                            جستجو
                        </Button>

                        {hasSearched && previewData.length > 0 && (
                            <Button 
                                onClick={handleExportExcel} 
                                variant="secondary" 
                                className="h-[46px] border-green-600 text-green-600 hover:bg-green-50 font-black px-8"
                            >
                                <Icons.FileText className="ml-2 w-5 h-5" />
                                خروجی اکسل
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Preview Section */}
            <div className="bg-white dark:bg-gray-800 shadow-xl overflow-hidden min-h-[400px] border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700 flex justify-between items-center">
                    <h3 className="font-black text-gray-700 dark:text-gray-200 flex items-center gap-2">
                        <Icons.Eye className={`w-5 h-5 ${reportTab === 'users' ? 'text-metro-purple' : reportTab === 'invoices' ? 'text-metro-orange' : 'text-metro-blue'}`} />
                        پیش‌نمایش داده‌ها
                    </h3>
                    {hasSearched && (
                        <span className="text-xs bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded font-bold">
                            {toPersianDigits(previewData.length)} رکورد
                        </span>
                    )}
                </div>

                {!hasSearched ? (
                    <div className="flex flex-col items-center justify-center py-24 opacity-40">
                        <Icons.Search className="w-24 h-24 mb-4 text-gray-300" />
                        <p className="font-bold text-xl text-gray-500">برای مشاهده گزارش، دکمه جستجو را بزنید.</p>
                    </div>
                ) : isSearching ? (
                    <div className="flex flex-col items-center justify-center py-24">
                        <div className="w-12 h-12 border-4 border-metro-blue border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="font-bold text-gray-500">در حال دریافت اطلاعات...</p>
                    </div>
                ) : previewData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-red-500 opacity-80">
                        <Icons.AlertCircle className="w-16 h-16 mb-4" />
                        <p className="font-bold text-lg">هیچ داده‌ای یافت نشد.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
                        <table className="w-full text-right border-collapse">
                            <thead className="bg-gray-100 dark:bg-gray-900 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    {reportTab === 'stats' && (
                                        <>
                                            <th className="p-4 border-b dark:border-gray-700 text-xs font-black whitespace-nowrap">تاریخ</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-xs font-black whitespace-nowrap">فارم</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-xs font-black whitespace-nowrap">محصول</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-xs font-black text-center">تولید</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-xs font-black text-center">فروش</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-xs font-black text-center">موجودی</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-xs font-black text-center">کاربر</th>
                                        </>
                                    )}
                                    {reportTab === 'invoices' && (
                                        <>
                                            <th className="p-4 border-b dark:border-gray-700 text-xs font-black whitespace-nowrap text-center">حواله</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-xs font-black whitespace-nowrap">تاریخ</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-xs font-black whitespace-nowrap">فارم</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-xs font-black whitespace-nowrap">محصول</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-xs font-black text-center">تعداد</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-xs font-black text-center">وزن</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-xs font-black whitespace-nowrap">راننده</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-xs font-black text-center">پلاک</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-xs font-black text-center">تماس</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-xs font-black text-center">وضعیت</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-xs font-black">توضیحات</th>
                                        </>
                                    )}
                                    {reportTab === 'users' && (
                                        <>
                                            <th className="p-4 border-b dark:border-gray-700 text-xs font-black whitespace-nowrap">نام کامل</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-xs font-black text-center">نقش</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-xs font-black text-center">نام کاربری</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-xs font-black text-center">وضعیت</th>
                                            <th className="p-4 border-b dark:border-gray-700 text-xs font-black whitespace-nowrap">عضویت</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {previewData.map((row, idx) => (
                                    <tr key={idx} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        {reportTab === 'stats' && (
                                            <>
                                                <td className="p-4 font-mono text-xs">{toPersianDigits(row.date)}</td>
                                                <td className="p-4 font-bold text-xs">{farms.find(f => f.id === row.farmId)?.name}</td>
                                                <td className="p-4 text-xs">{products.find(p => p.id === row.productId)?.name}</td>
                                                <td className="p-4 text-center font-bold text-green-600">+{toPersianDigits(row.production)}</td>
                                                <td className="p-4 text-center font-bold text-red-600">-{toPersianDigits(row.sales || 0)}</td>
                                                <td className="p-4 text-center font-bold text-metro-blue">{toPersianDigits(row.currentInventory)}</td>
                                                <td className="p-4 text-center text-xs text-gray-400">{row.creatorName || '-'}</td>
                                            </>
                                        )}
                                        {reportTab === 'invoices' && (
                                            <>
                                                <td className="p-4 font-black text-metro-orange text-center">{toPersianDigits(row.invoiceNumber)}</td>
                                                <td className="p-4 font-mono text-xs whitespace-nowrap">{toPersianDigits(row.date)}</td>
                                                <td className="p-4 font-bold text-xs whitespace-nowrap">{farms.find(f => f.id === row.farmId)?.name}</td>
                                                <td className="p-4 text-xs whitespace-nowrap">{products.find(p => p.id === row.productId)?.name}</td>
                                                <td className="p-4 text-center font-bold">{toPersianDigits(row.totalCartons)}</td>
                                                <td className="p-4 text-center font-bold">{toPersianDigits(row.totalWeight)}</td>
                                                <td className="p-4 text-xs">{row.driverName || '-'}</td>
                                                <td className="p-4 text-center text-xs font-mono">{toPersianDigits(row.plateNumber || '-')}</td>
                                                <td className="p-4 text-center text-xs font-mono">{toPersianDigits(row.driverPhone || '-')}</td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] text-white font-black ${row.isYesterday ? 'bg-metro-orange' : 'bg-metro-green'}`}>
                                                        {row.isYesterday ? 'دیروزی' : 'امروز'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-[10px] text-gray-500 max-w-[200px] truncate">{row.description || '-'}</td>
                                            </>
                                        )}
                                        {reportTab === 'users' && (
                                            <>
                                                <td className="p-4 font-bold text-sm">{row.fullName}</td>
                                                <td className="p-4 text-center">
                                                    <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded font-black">
                                                        {row.role}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-mono text-xs text-center">{row.username}</td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] text-white font-black ${row.isActive ? 'bg-metro-green' : 'bg-metro-red'}`}>
                                                        {row.isActive ? 'فعال' : 'غیرفعال'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-xs font-mono">
                                                    {row.createdAt ? toPersianDigits(new Date(row.createdAt).toLocaleDateString('fa-IR')) : '-'}
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
