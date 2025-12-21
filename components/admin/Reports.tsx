
import React, { useState, useEffect, useMemo } from 'react';
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
import { useConfirm } from '../../hooks/useConfirm';
import Modal from '../common/Modal';
import { supabase } from '../../lib/supabase';

type ReportTab = 'stats' | 'invoices' | 'users';

const Reports: React.FC = () => {
    const { user } = useAuthStore();
    const { farms, products } = useFarmStore();
    const { statistics } = useStatisticsStore();
    const { invoices } = useInvoiceStore();
    const { users } = useUserStore();
    const { addToast } = useToastStore();
    const { confirm } = useConfirm();

    const isAdmin = user?.role === UserRole.ADMIN;
    
    const [reportTab, setReportTab] = useState<ReportTab>('invoices');
    
    // Filters
    const [selectedFarmId, setSelectedFarmId] = useState<string>('all');
    const [selectedProductId, setSelectedProductId] = useState<string>('all');
    const [startDate, setStartDate] = useState(getTodayJalali());
    const [endDate, setEndDate] = useState(getTodayJalali());
    
    // Data for preview
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    // --- User Detail Modal State ---
    const [selectedUserForReport, setSelectedUserForReport] = useState<any>(null);
    const [userLogs, setUserLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

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

        // Allow UI to update before blocking calculation
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
                // For users, we don't filter by date range for the list, 
                // but we will filter logs by date when clicked.
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
        }, 100);
    };

    const handleExportExcel = async () => {
        if (previewData.length === 0) return;

        const yes = await confirm({ 
            title: 'خروجی اکسل', 
            message: `آیا می‌خواهید ${toPersianDigits(previewData.length)} رکورد را دانلود کنید؟`, 
            confirmText: 'دانلود', 
            type: 'info' 
        });
        
        if (!yes) return;

        try {
            const wb = XLSX.utils.book_new();
            wb.Workbook = { Views: [{ RTL: true }] }; 
            let wsData: any[] = [];
            let fileName = '';

            if (reportTab === 'stats') {
                fileName = `Production_${new Date().toISOString().slice(0,10)}`;
                wsData = previewData.map(s => ({
                    'تاریخ': s.date,
                    'فارم': farms.find(f => f.id === s.farmId)?.name || '-',
                    'محصول': products.find(p => p.id === s.productId)?.name || '-',
                    'تولید': s.production,
                    'فروش': s.sales,
                    'موجودی': s.currentInventory,
                    'کاربر': s.creatorName || '-'
                }));
            } else if (reportTab === 'invoices') {
                fileName = `Sales_${new Date().toISOString().slice(0,10)}`;
                wsData = previewData.map(i => ({
                    'کد حواله': i.invoiceNumber,
                    'تاریخ': i.date,
                    'فارم': farms.find(f => f.id === i.farmId)?.name || '-',
                    'تعداد': i.totalCartons,
                    'وزن': i.totalWeight,
                    'راننده': i.driverName || '-',
                    'پلاک': i.plateNumber || '-'
                }));
            }

            const ws = XLSX.utils.json_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, 'Data');
            XLSX.writeFile(wb, `${fileName}.xlsx`);
            addToast('فایل اکسل دانلود شد.', 'success');
        } catch (error) {
            addToast('خطا در ایجاد فایل اکسل', 'error');
        }
    };

    // --- REAL User Logs Fetching ---
    const handleUserClick = async (userRow: any) => {
        if (reportTab !== 'users') return;
        
        setSelectedUserForReport(userRow);
        setLoadingLogs(true);
        setUserLogs([]);

        // Fetch logs for the selected user
        try {
            const { data, error } = await supabase
                .from('system_logs')
                .select('*')
                .eq('user_id', userRow.id)
                .order('timestamp', { ascending: false })
                .limit(100); // Limit to last 100 actions

            if (error) throw error;
            
            if (data) {
                // Pre-process logs to handle text-fallback details
                const cleanLogs = data.map((l: any) => {
                    let msg = l.message;
                    if (msg && msg.includes('[TECH_DETAILS]:')) {
                        msg = msg.split('[TECH_DETAILS]:')[0].trim().replace(/ \| $/, '');
                    }
                    return { ...l, message: msg };
                });
                setUserLogs(cleanLogs);
            }
        } catch (e: any) {
            console.error("Failed to fetch user logs", e);
            addToast('خطا در دریافت لاگ‌های کاربر: ' + e.message, 'error');
        } finally {
            setLoadingLogs(false);
        }
    };

    const formatLogCategory = (cat: string) => {
        switch(cat) {
            case 'auth': return { text: 'ورود/خروج', color: 'bg-blue-100 text-blue-800' };
            case 'database': return { text: 'ثبت داده', color: 'bg-green-100 text-green-800' };
            case 'error': return { text: 'خطا', color: 'bg-red-100 text-red-800' };
            case 'user_action': return { text: 'عملیات', color: 'bg-purple-100 text-purple-800' };
            default: return { text: 'سیستمی', color: 'bg-gray-100 text-gray-800' };
        }
    };

    const selectClass = "w-full p-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white font-bold outline-none focus:border-metro-blue rounded-none lg:text-base";

    return (
        <div className="space-y-6">
            {/* Tabs */}
            <div className="flex bg-gray-200 dark:bg-gray-800 border-b-4 border-metro-dark overflow-hidden">
                <button onClick={() => setReportTab('invoices')} className={`flex-1 py-4 font-black transition-all ${reportTab === 'invoices' ? 'bg-metro-orange text-white' : 'text-gray-500 hover:bg-gray-300'}`}>گزارش فروش</button>
                <button onClick={() => setReportTab('stats')} className={`flex-1 py-4 font-black transition-all ${reportTab === 'stats' ? 'bg-metro-blue text-white' : 'text-gray-500 hover:bg-gray-300'}`}>آمار تولید</button>
                {isAdmin && <button onClick={() => setReportTab('users')} className={`flex-1 py-4 font-black transition-all ${reportTab === 'users' ? 'bg-metro-purple text-white' : 'text-gray-500 hover:bg-gray-300'}`}>عملکرد کاربران</button>}
            </div>

            {/* Filters */}
            <div className={`bg-white dark:bg-gray-800 p-6 border-l-[8px] shadow-sm ${reportTab === 'users' ? 'border-metro-purple' : reportTab === 'invoices' ? 'border-metro-orange' : 'border-metro-blue'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                    {reportTab !== 'users' ? (
                        <>
                            <div><label className="text-xs font-bold text-gray-500 mb-1 block">فارم</label><select value={selectedFarmId} onChange={(e) => setSelectedFarmId(e.target.value)} className={selectClass}><option value="all">همه</option>{farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
                            <div><label className="text-xs font-bold text-gray-500 mb-1 block">محصول</label><select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} className={selectClass}><option value="all">همه</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                            <div><JalaliDatePicker value={startDate} onChange={setStartDate} label="از" /></div>
                            <div><JalaliDatePicker value={endDate} onChange={setEndDate} label="تا" /></div>
                        </>
                    ) : (
                        <div className="col-span-4 text-center py-2 text-gray-500 font-bold">
                            برای مشاهده گزارش دقیق فعالیت‌ها (زمان ورود، ثبت، خروج)، روی نام کاربر در لیست کلیک کنید.
                        </div>
                    )}
                    
                    <div className="col-span-full flex justify-end gap-3 mt-2">
                        <Button onClick={handleSearch} isLoading={isSearching} className="h-12 px-10 text-lg font-black bg-metro-dark hover:bg-black">جستجو</Button>
                        {hasSearched && previewData.length > 0 && <Button onClick={handleExportExcel} variant="secondary" className="h-12 px-6 font-bold">دانلود اکسل</Button>}
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white dark:bg-gray-800 shadow-lg min-h-[400px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                        <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 text-sm font-black">
                            <tr>
                                {reportTab === 'stats' && <><th className="p-4">تاریخ</th><th className="p-4">فارم</th><th className="p-4">محصول</th><th className="p-4 text-center">تولید</th><th className="p-4 text-center">فروش</th><th className="p-4 text-center">موجودی</th><th className="p-4">کاربر</th></>}
                                {reportTab === 'invoices' && <><th className="p-4 text-center">حواله</th><th className="p-4">تاریخ</th><th className="p-4">فارم</th><th className="p-4">تعداد</th><th className="p-4">وزن</th><th className="p-4">راننده</th><th className="p-4">وضعیت</th></>}
                                {reportTab === 'users' && <><th className="p-4">نام کامل</th><th className="p-4">نام کاربری</th><th className="p-4 text-center">نقش</th><th className="p-4 text-center">وضعیت</th><th className="p-4 text-center">عملیات</th></>}
                            </tr>
                        </thead>
                        <tbody>
                            {previewData.map((row, idx) => (
                                <tr key={idx} 
                                    onClick={() => handleUserClick(row)}
                                    className={`border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${reportTab === 'users' ? 'cursor-pointer' : ''}`}
                                >
                                    {reportTab === 'stats' && <>
                                        <td className="p-4 font-mono">{toPersianDigits(row.date)}</td>
                                        <td className="p-4">{farms.find(f => f.id === row.farmId)?.name}</td>
                                        <td className="p-4">{products.find(p => p.id === row.productId)?.name}</td>
                                        <td className="p-4 text-center text-green-600 font-bold">{toPersianDigits(row.production)}</td>
                                        <td className="p-4 text-center text-red-500 font-bold">{toPersianDigits(row.sales)}</td>
                                        <td className="p-4 text-center font-black">{toPersianDigits(row.currentInventory)}</td>
                                        <td className="p-4 text-xs">{row.creatorName}</td>
                                    </>}
                                    {reportTab === 'invoices' && <>
                                        <td className="p-4 text-center font-black tracking-widest">{toPersianDigits(row.invoiceNumber)}</td>
                                        <td className="p-4 font-mono">{toPersianDigits(row.date)}</td>
                                        <td className="p-4">{farms.find(f => f.id === row.farmId)?.name}</td>
                                        <td className="p-4 font-bold">{toPersianDigits(row.totalCartons)}</td>
                                        <td className="p-4 text-blue-600 font-bold">{toPersianDigits(row.totalWeight)}</td>
                                        <td className="p-4 text-sm">{row.driverName}</td>
                                        <td className="p-4 text-sm font-bold">{row.isYesterday ? 'دیروزی' : 'عادی'}</td>
                                    </>}
                                    {reportTab === 'users' && <>
                                        <td className="p-4 font-bold text-lg">{row.fullName}</td>
                                        <td className="p-4 font-mono">{row.username}</td>
                                        <td className="p-4 text-center"><span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold">{row.role}</span></td>
                                        <td className="p-4 text-center"><span className={`px-2 py-1 rounded text-xs text-white ${row.isActive ? 'bg-green-500' : 'bg-red-500'}`}>{row.isActive ? 'فعال' : 'غیرفعال'}</span></td>
                                        <td className="p-4 text-center"><Icons.FileText className="w-5 h-5 mx-auto text-purple-500 opacity-70" /></td>
                                    </>}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {previewData.length === 0 && <div className="p-10 text-center text-gray-400 font-bold">داده‌ای برای نمایش وجود ندارد.</div>}
                </div>
            </div>

            {/* Modal for User Logs */}
            <Modal
                isOpen={!!selectedUserForReport}
                onClose={() => setSelectedUserForReport(null)}
                title={`ریـز عملکرد کاربر: ${selectedUserForReport?.fullName || ''}`}
            >
                <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm text-gray-500 mb-2">
                        <span>۱۰۰ فعالیت اخیر کاربر در سیستم</span>
                        <Button size="sm" variant="ghost" onClick={() => handleUserClick(selectedUserForReport)}>
                            <Icons.Refresh className={`w-4 h-4 ${loadingLogs ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                    
                    {loadingLogs ? (
                        <div className="flex justify-center items-center h-40">
                            <Icons.Refresh className="w-10 h-10 animate-spin text-metro-purple" />
                        </div>
                    ) : (
                        <div className="max-h-[500px] overflow-y-auto custom-scrollbar border rounded-none shadow-inner bg-gray-50 dark:bg-gray-900">
                            <table className="w-full text-right text-sm">
                                <thead className="bg-gray-200 dark:bg-gray-800 font-bold sticky top-0 text-gray-700 dark:text-gray-300">
                                    <tr>
                                        <th className="p-3">زمان</th>
                                        <th className="p-3">نوع</th>
                                        <th className="p-3">توضیحات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {userLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="p-8 text-center text-gray-400">هیچ فعالیتی یافت نشد.</td>
                                        </tr>
                                    ) : (
                                        userLogs.map((log) => {
                                            const cat = formatLogCategory(log.category);
                                            return (
                                                <tr key={log.id} className="hover:bg-white dark:hover:bg-gray-800 transition-colors">
                                                    <td className="p-3 font-mono text-xs text-gray-500 dir-ltr border-l dark:border-gray-700">
                                                        {new Date(log.timestamp).toLocaleTimeString('fa-IR')}
                                                        <br/>
                                                        <span className="opacity-70">{new Date(log.timestamp).toLocaleDateString('fa-IR')}</span>
                                                    </td>
                                                    <td className="p-3 border-l dark:border-gray-700 w-24 text-center">
                                                        <span className={`text-[10px] px-2 py-1 rounded font-bold whitespace-nowrap block ${cat.color}`}>
                                                            {cat.text}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 font-medium text-gray-800 dark:text-gray-200">
                                                        {log.message}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <div className="flex justify-end pt-4 border-t dark:border-gray-700">
                        <Button onClick={() => setSelectedUserForReport(null)}>بستن</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Reports;
