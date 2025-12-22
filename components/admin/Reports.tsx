
import React, { useState, useEffect } from 'react';
import { useFarmStore } from '../../store/farmStore';
import { useStatisticsStore } from '../../store/statisticsStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useToastStore } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../types';
import { Icons } from '../common/Icons';
import Button from '../common/Button';
import JalaliDatePicker from '../common/JalaliDatePicker';
import * as XLSX from 'xlsx';
import { toPersianDigits, getTodayJalali, normalizeDate, isDateInRange } from '../../utils/dateUtils';
import { useConfirm } from '../../hooks/useConfirm';
import Modal from '../common/Modal';

type ReportTab = 'stats' | 'invoices';

// Duplicate sort logic here for Excel export consistency
const sortProducts = (products: any[], aId: string, bId: string) => {
    const pA = products.find(p => p.id === aId);
    const pB = products.find(p => p.id === bId);
    if (!pA || !pB) return 0;

    const getScore = (name: string) => {
        if (name.includes('مایع')) return 6; // Last
        if (name.includes('دوزرده')) return 5;
        if (name.includes('نوکی')) return 4;
        if (name.includes('کودی')) return 3;
        // Printi comes before Simple
        if (name.includes('پرینتی')) return 1;
        return 2; // Simple/Others
    };

    const scoreA = getScore(pA.name);
    const scoreB = getScore(pB.name);

    return scoreA - scoreB;
};

const Reports: React.FC = () => {
    const { farms, products } = useFarmStore();
    const { statistics, deleteStatistic, updateStatistic } = useStatisticsStore();
    const { invoices, deleteInvoice, updateInvoice } = useInvoiceStore();
    const { addToast } = useToastStore();
    const { confirm } = useConfirm();
    const { user } = useAuthStore();

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

    // Edit State
    const [editingStat, setEditingStat] = useState<any | null>(null);
    const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
    const [statForm, setStatForm] = useState({ prod: 0, sales: 0, prev: 0 });
    const [invoiceForm, setInvoiceForm] = useState({ 
        invoiceNumber: '',
        cartons: 0, 
        weight: 0, 
        driver: '', 
        plate: '', 
        phone: '', 
        desc: '' 
    });

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
                // Apply Sort
                data.sort((a, b) => {
                    const dateDiff = b.date.localeCompare(a.date);
                    if (dateDiff !== 0) return dateDiff;
                    return sortProducts(products, a.productId, b.productId);
                });
            } else if (reportTab === 'invoices') {
                data = invoices.filter(i => {
                    const farmMatch = selectedFarmId === 'all' || i.farmId === selectedFarmId;
                    const productMatch = selectedProductId === 'all' || i.productId === selectedProductId;
                    const dateMatch = isDateInRange(i.date, normalizedStart, normalizedEnd);
                    return farmMatch && productMatch && dateMatch;
                });
                data.sort((a, b) => {
                    const dateDiff = b.date.localeCompare(a.date);
                    if (dateDiff !== 0) return dateDiff;
                    return sortProducts(products, a.productId || '', b.productId || '');
                });
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

    // --- Admin Operations ---

    const handleDeleteStat = async (id: string) => {
        const yes = await confirm({ title: 'حذف آمار', message: 'مدیر گرامی، آیا از حذف این رکورد اطمینان دارید؟', type: 'danger' });
        if (yes) {
            await deleteStatistic(id);
            addToast('رکورد با موفقیت حذف شد', 'success');
            handleSearch(); // Refresh list
        }
    };

    const handleDeleteInvoice = async (id: string) => {
        const yes = await confirm({ title: 'حذف حواله', message: 'مدیر گرامی، آیا از حذف این حواله اطمینان دارید؟', type: 'danger' });
        if (yes) {
            await deleteInvoice(id);
            addToast('حواله با موفقیت حذف شد', 'success');
            handleSearch(); // Refresh list
        }
    };

    const openStatEdit = (stat: any) => {
        setEditingStat(stat);
        setStatForm({ prod: stat.production, sales: stat.sales || 0, prev: stat.previousBalance || 0 });
    };

    const saveStatEdit = async () => {
        if (!editingStat) return;
        const yes = await confirm({ title: 'ویرایش آمار', message: 'آیا تغییرات ذخیره شود؟ موجودی انبار بازنشانی خواهد شد.', type: 'info' });
        if (yes) {
            const newInv = Number(statForm.prev) + Number(statForm.prod) - Number(statForm.sales);
            await updateStatistic(editingStat.id, {
                production: Number(statForm.prod),
                sales: Number(statForm.sales),
                previousBalance: Number(statForm.prev),
                currentInventory: newInv
            });
            setEditingStat(null);
            addToast('آمار با موفقیت ویرایش شد', 'success');
            handleSearch(); // Refresh list
        }
    };

    const openInvoiceEdit = (inv: any) => {
        setEditingInvoice(inv);
        setInvoiceForm({
            invoiceNumber: inv.invoiceNumber,
            cartons: inv.totalCartons,
            weight: inv.totalWeight,
            driver: inv.driverName || '',
            plate: inv.plateNumber || '',
            phone: inv.driverPhone || '',
            desc: inv.description || ''
        });
    };

    const saveInvoiceEdit = async () => {
        if (!editingInvoice) return;
        const yes = await confirm({ title: 'ویرایش حواله', message: 'آیا تغییرات ذخیره شود؟', type: 'info' });
        if (yes) {
            await updateInvoice(editingInvoice.id, {
                invoiceNumber: invoiceForm.invoiceNumber,
                totalCartons: Number(invoiceForm.cartons),
                totalWeight: Number(invoiceForm.weight),
                driverName: invoiceForm.driver,
                plateNumber: invoiceForm.plate,
                driverPhone: invoiceForm.phone,
                description: invoiceForm.desc
            });
            setEditingInvoice(null);
            addToast('حواله با موفقیت ویرایش شد', 'success');
            handleSearch(); // Refresh list
        }
    };

    // ------------------------

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
                    'مسئول ثبت': s.creatorName || '-',
                    'ساعت ثبت': new Date(s.createdAt).toLocaleTimeString('fa-IR'),
                }));
            } else if (reportTab === 'invoices') {
                fileName = `Sales_${new Date().toISOString().slice(0,10)}`;
                wsData = previewData.map(i => ({
                    'تاریخ': i.date || '',
                    'رمز حواله': i.invoiceNumber || '',
                    'نام فارم': farms.find(f => f.id === i.farmId)?.name || '-',
                    'نام محصول': products.find(p => p.id === i.productId)?.name || '-',
                    'تعداد (کارتن)': i.totalCartons || 0,
                    'وزن (Kg)': i.totalWeight || 0,
                    'راننده': i.driverName || '',
                    'شماره تماس': i.driverPhone || '',
                    'پلاک': i.plateNumber || '',
                    'مسئول ثبت': i.creatorName || '-',
                    'ساعت ثبت': new Date(i.createdAt).toLocaleTimeString('fa-IR'),
                    'توضیحات': i.description || ''
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

    const selectClass = "w-full p-4 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white font-bold outline-none focus:border-metro-blue rounded-xl text-base lg:text-lg transition-colors";

    return (
        <div className="space-y-6">
            {/* Tabs */}
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-full mb-6 max-w-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <button 
                    onClick={() => setReportTab('invoices')} 
                    className={`flex-1 py-3 rounded-full font-bold transition-all text-sm lg:text-lg flex items-center justify-center gap-2 ${reportTab === 'invoices' ? 'bg-white dark:bg-gray-700 text-metro-orange shadow-sm scale-100' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700/50'}`}
                >
                    <Icons.FileText className="w-5 h-5" />
                    گزارش فروش
                </button>
                <button 
                    onClick={() => setReportTab('stats')} 
                    className={`flex-1 py-3 rounded-full font-bold transition-all text-sm lg:text-lg flex items-center justify-center gap-2 ${reportTab === 'stats' ? 'bg-white dark:bg-gray-700 text-metro-blue shadow-sm scale-100' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700/50'}`}
                >
                    <Icons.BarChart className="w-5 h-5" />
                    آمار تولید
                </button>
            </div>

            {/* Filters */}
            <div className={`bg-white dark:bg-gray-800 p-6 lg:p-8 rounded-[24px] shadow-sm border-l-[12px] ${reportTab === 'invoices' ? 'border-metro-orange' : 'border-metro-blue'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                    <div>
                        <label className="text-sm lg:text-lg font-bold text-gray-500 mb-2 block px-1">فارم</label>
                        <select value={selectedFarmId} onChange={(e) => setSelectedFarmId(e.target.value)} className={selectClass}>
                            <option value="all">همه</option>
                            {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-sm lg:text-lg font-bold text-gray-500 mb-2 block px-1">محصول</label>
                        <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} className={selectClass}>
                            <option value="all">همه</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div><JalaliDatePicker value={startDate} onChange={setStartDate} label="از تاریخ" /></div>
                    <div><JalaliDatePicker value={endDate} onChange={setEndDate} label="تا تاریخ" /></div>
                    
                    <div className="col-span-full flex justify-end gap-3 mt-4">
                        <Button onClick={handleSearch} isLoading={isSearching} className="h-14 px-10 text-lg font-black bg-gray-900 text-white hover:bg-black rounded-full shadow-lg">جستجو</Button>
                        {hasSearched && previewData.length > 0 && <Button onClick={handleExportExcel} variant="secondary" className="h-14 px-8 font-bold rounded-full text-lg">دانلود اکسل</Button>}
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white dark:bg-gray-800 shadow-md min-h-[400px] rounded-[24px] overflow-hidden border border-gray-100 dark:border-gray-700">
                <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse min-w-[900px]">
                        <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 text-base lg:text-lg font-black">
                            <tr>
                                {reportTab === 'stats' && <><th className="p-5">تاریخ</th><th className="p-5">فارم</th><th className="p-5">محصول</th><th className="p-5 text-center">تولید</th><th className="p-5 text-center">فروش</th><th className="p-5 text-center">موجودی</th><th className="p-5">مسئول ثبت</th><th className="p-5">ساعت</th>{isAdmin && <th className="p-5 text-center">عملیات</th>}</>}
                                {reportTab === 'invoices' && <><th className="p-5 text-center">رمز حواله</th><th className="p-5 text-center">تاریخ</th><th className="p-5">فارم</th><th className="p-5">تعداد</th><th className="p-5">وزن</th><th className="p-5">راننده</th><th className="p-5">وضعیت</th><th className="p-5">مسئول ثبت</th><th className="p-5">ساعت</th>{isAdmin && <th className="p-5 text-center">عملیات</th>}</>}
                            </tr>
                        </thead>
                        <tbody>
                            {previewData.map((row, idx) => (
                                <tr key={idx} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    {reportTab === 'stats' && <>
                                        <td className="p-5 font-mono text-base lg:text-lg">{toPersianDigits(row.date)}</td>
                                        <td className="p-5 font-bold text-base lg:text-lg">{farms.find(f => f.id === row.farmId)?.name}</td>
                                        <td className="p-5 text-base lg:text-lg">{products.find(p => p.id === row.productId)?.name}</td>
                                        <td className="p-5 text-center text-green-600 font-black text-lg lg:text-2xl">{toPersianDigits(row.production)}</td>
                                        <td className="p-5 text-center text-red-500 font-black text-lg lg:text-2xl">{toPersianDigits(row.sales)}</td>
                                        <td className="p-5 text-center font-black text-lg lg:text-2xl">{toPersianDigits(row.currentInventory)}</td>
                                        <td className="p-5 text-sm lg:text-base font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap">{row.creatorName}</td>
                                        <td className="p-5 text-sm lg:text-base font-mono font-bold whitespace-nowrap text-gray-600 dark:text-gray-400">{new Date(row.createdAt).toLocaleTimeString('fa-IR')}</td>
                                        {isAdmin && (
                                            <td className="p-5 flex justify-center gap-2">
                                                <button onClick={() => openStatEdit(row)} className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"><Icons.Edit className="w-5 h-5"/></button>
                                                <button onClick={() => handleDeleteStat(row.id)} className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"><Icons.Trash className="w-5 h-5"/></button>
                                            </td>
                                        )}
                                    </>}
                                    {reportTab === 'invoices' && <>
                                        <td className="p-5 text-center font-black tracking-widest text-lg lg:text-2xl">{toPersianDigits(row.invoiceNumber)}</td>
                                        <td className="p-5 font-mono text-center font-bold text-base lg:text-lg">{toPersianDigits(row.date)}</td>
                                        <td className="p-5 font-bold text-base lg:text-lg">{farms.find(f => f.id === row.farmId)?.name}</td>
                                        <td className="p-5 font-bold text-lg lg:text-2xl">{toPersianDigits(row.totalCartons)}</td>
                                        <td className="p-5 text-blue-600 font-black text-lg lg:text-2xl">{toPersianDigits(row.totalWeight)}</td>
                                        <td className="p-5 text-base lg:text-lg">{row.driverName}</td>
                                        <td className="p-5 text-base lg:text-lg font-bold">{row.updatedAt ? 'ویرایش شده' : 'عادی'}</td>
                                        <td className="p-5 text-sm lg:text-base font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap">{row.creatorName}</td>
                                        <td className="p-5 text-sm lg:text-base font-mono font-bold whitespace-nowrap text-gray-600 dark:text-gray-400">{new Date(row.createdAt).toLocaleTimeString('fa-IR')}</td>
                                        {isAdmin && (
                                            <td className="p-5 flex justify-center gap-2">
                                                <button onClick={() => openInvoiceEdit(row)} className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"><Icons.Edit className="w-5 h-5"/></button>
                                                <button onClick={() => handleDeleteInvoice(row.id)} className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"><Icons.Trash className="w-5 h-5"/></button>
                                            </td>
                                        )}
                                    </>}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {previewData.length === 0 && <div className="p-12 text-center text-gray-400 font-bold text-xl">داده‌ای برای نمایش وجود ندارد.</div>}
                </div>
            </div>

            {/* --- Modals for Admin --- */}
            
            {/* Stat Edit Modal */}
            <Modal isOpen={!!editingStat} onClose={() => setEditingStat(null)} title="ویرایش آمار (مدیریت)">
                <div className="space-y-6">
                     <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl text-sm font-bold text-purple-800 dark:text-purple-300 border border-purple-100 dark:border-purple-800">
                         شما در حال ویرایش با دسترسی مدیر هستید.
                     </div>
                     <div className="grid grid-cols-2 gap-4 lg:gap-6">
                         <div>
                             <label className="text-sm lg:text-lg font-bold block mb-2 px-1">تولید</label>
                             <input type="number" value={statForm.prod} onChange={e => setStatForm({...statForm, prod: Number(e.target.value)})} className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-center font-black lg:text-2xl outline-none focus:border-green-500" />
                         </div>
                         <div>
                             <label className="text-sm lg:text-lg font-bold block mb-2 px-1">فروش</label>
                             <input type="number" value={statForm.sales} onChange={e => setStatForm({...statForm, sales: Number(e.target.value)})} className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-center font-black lg:text-2xl outline-none focus:border-red-500" />
                         </div>
                     </div>
                     <div>
                         <label className="text-sm lg:text-lg font-bold block mb-2 px-1">مانده قبل (اصلاح دستی)</label>
                         <input type="number" value={statForm.prev} onChange={e => setStatForm({...statForm, prev: Number(e.target.value)})} className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-center font-bold lg:text-2xl" />
                     </div>
                     <div className="flex justify-end gap-2 mt-8">
                         <Button variant="secondary" onClick={() => setEditingStat(null)} className="lg:h-12 lg:px-6">لغو</Button>
                         <Button onClick={saveStatEdit} className="lg:h-12 lg:px-6">ذخیره تغییرات</Button>
                     </div>
                </div>
            </Modal>

             {/* Invoice Edit Modal */}
             <Modal isOpen={!!editingInvoice} onClose={() => setEditingInvoice(null)} title="ویرایش حواله (مدیریت)">
                <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1 custom-scrollbar">
                     <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl text-sm font-bold text-purple-800 dark:text-purple-300 border border-purple-100 dark:border-purple-800">
                         ویرایش حواله باعث بروزرسانی خودکار موجودی انبار در تاریخ مربوطه خواهد شد.
                     </div>
                     
                     <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-200 dark:border-orange-800">
                        <label className="block text-sm lg:text-lg font-bold mb-2 text-orange-800 dark:text-orange-300">شماره حواله (اصلاحیه)</label>
                        <input 
                            type="text" 
                            dir="ltr"
                            maxLength={10}
                            className="w-full p-4 border-2 border-orange-300 rounded-xl text-center font-black text-2xl lg:text-4xl tracking-[0.2em] bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:border-metro-orange outline-none"
                            value={invoiceForm.invoiceNumber}
                            onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
                            placeholder=""
                        />
                    </div>

                     <div className="grid grid-cols-2 gap-4 lg:gap-6">
                         <div>
                             <label className="text-sm lg:text-lg font-bold block mb-2 px-1">تعداد کارتن</label>
                             <input type="number" value={invoiceForm.cartons} onChange={e => setInvoiceForm({...invoiceForm, cartons: Number(e.target.value)})} className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-center font-black lg:text-2xl outline-none focus:border-metro-orange" />
                         </div>
                         <div>
                             <label className="text-sm lg:text-lg font-bold block mb-2 px-1">وزن (Kg)</label>
                             <input type="number" value={invoiceForm.weight} onChange={e => setInvoiceForm({...invoiceForm, weight: Number(e.target.value)})} className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-center font-black lg:text-2xl outline-none focus:border-metro-orange" />
                         </div>
                     </div>
                     <div>
                         <label className="text-sm lg:text-lg font-bold block mb-2 px-1">نام راننده</label>
                         <input type="text" value={invoiceForm.driver} onChange={e => setInvoiceForm({...invoiceForm, driver: e.target.value})} className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-lg lg:text-xl outline-none focus:border-metro-purple" />
                     </div>
                     <div className="grid grid-cols-2 gap-4 lg:gap-6">
                         <div>
                             <label className="text-sm lg:text-lg font-bold block mb-2 px-1">پلاک</label>
                             <input type="text" value={invoiceForm.plate} onChange={e => setInvoiceForm({...invoiceForm, plate: e.target.value})} className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-center text-lg lg:text-xl outline-none focus:border-metro-purple" />
                         </div>
                         <div>
                             <label className="text-sm lg:text-lg font-bold block mb-2 px-1">موبایل</label>
                             <input type="text" value={invoiceForm.phone} onChange={e => setInvoiceForm({...invoiceForm, phone: e.target.value})} className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-center text-lg lg:text-xl outline-none focus:border-metro-purple" />
                         </div>
                     </div>
                     <div>
                         <label className="text-sm lg:text-lg font-bold block mb-2 px-1">توضیحات</label>
                         <textarea value={invoiceForm.desc} onChange={e => setInvoiceForm({...invoiceForm, desc: e.target.value})} className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 h-24 lg:h-32 text-lg lg:text-xl outline-none focus:border-metro-purple" />
                     </div>
                     <div className="flex justify-end gap-2 mt-6">
                         <Button variant="secondary" onClick={() => setEditingInvoice(null)} className="lg:h-12 lg:px-6">لغو</Button>
                         <Button onClick={saveInvoiceEdit} className="lg:h-12 lg:px-6">ذخیره تغییرات</Button>
                     </div>
                </div>
            </Modal>
        </div>
    );
};

export default Reports;
    