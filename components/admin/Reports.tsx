
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

const Reports: React.FC = () => {
    const { farms, products, getProductById } = useFarmStore();
    const { deleteStatistic, updateStatistic } = useStatisticsStore();
    const { deleteInvoice, updateInvoice } = useInvoiceStore();
    const { addToast } = useToastStore();
    const { confirm } = useConfirm();
    const { user: currentUser } = useAuthStore();

    const isAdmin = currentUser?.role === UserRole.ADMIN;

    const [reportTab, setReportTab] = useState<ReportTab>('invoices');
    
    const [selectedFarmId, setSelectedFarmId] = useState<string>('all');
    const [selectedProductId, setSelectedProductId] = useState<string>('all');
    const [startDate, setStartDate] = useState(getTodayJalali());
    const [endDate, setEndDate] = useState(getTodayJalali());
    
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const [editingStat, setEditingStat] = useState<any | null>(null);
    const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
    
    const [statForm, setStatForm] = useState({ prod: '', sales: '', prev: '', prodKg: '', salesKg: '', prevKg: '' });
    const [invoiceForm, setInvoiceForm] = useState({ invoiceNumber: '', cartons: '', weight: '', driver: '', plate: '', phone: '', desc: '' });

    const handleSearch = () => {
        setIsSearching(true);
        setHasSearched(true);
        setSelectedIds([]);
        const start = normalizeDate(startDate);
        const end = normalizeDate(endDate);

        setTimeout(() => {
            let data: any[] = [];
            if (reportTab === 'stats') {
                data = useStatisticsStore.getState().statistics.filter(s => {
                    const farmMatch = selectedFarmId === 'all' || s.farmId === selectedFarmId;
                    const prodMatch = selectedProductId === 'all' || s.productId === selectedProductId;
                    return farmMatch && prodMatch && isDateInRange(s.date, start, end);
                });
            } else {
                data = useInvoiceStore.getState().invoices.filter(i => {
                    const farmMatch = selectedFarmId === 'all' || i.farmId === selectedFarmId;
                    const prodMatch = selectedProductId === 'all' || i.productId === selectedProductId;
                    return farmMatch && prodMatch && isDateInRange(i.date, start, end);
                });
            }
            setPreviewData(data);
            setIsSearching(false);
        }, 100);
    };

    const handleDeleteStat = async (id: string) => {
        const yes = await confirm({ title: 'حذف آمار', message: 'مدیر گرامی، آیا از حذف دائمی این رکورد اطمینان دارید؟', type: 'danger' });
        if (yes) {
            const result = await deleteStatistic(id);
            if (result.success) { addToast('رکورد حذف شد', 'success'); handleSearch(); }
            else addToast(result.error || 'خطا در حذف', 'error');
        }
    };

    const handleDeleteInvoice = async (id: string) => {
        const yes = await confirm({ title: 'حذف حواله', message: 'مدیر گرامی، آیا از حذف دائمی این حواله اطمینان دارید؟', type: 'danger' });
        if (yes) {
            const result = await deleteInvoice(id);
            if (result.success) { addToast('حواله حذف شد', 'success'); handleSearch(); }
            else addToast(result.error || 'خطا در حذف', 'error');
        }
    };

    const openStatEdit = (stat: any) => {
        const f = (v: any) => (v === 0 || v === undefined || v === null) ? '' : String(v);
        setEditingStat(stat);
        setStatForm({
            prod: f(stat.production),
            sales: f(stat.sales),
            prev: f(stat.previousBalance),
            prodKg: f(stat.productionKg),
            salesKg: f(stat.salesKg),
            prevKg: f(stat.previousBalanceKg)
        });
    };

    const saveStatEdit = async () => {
        if (!editingStat) return;
        const result = await updateStatistic(editingStat.id, {
            production: Number(statForm.prod),
            sales: Number(statForm.sales),
            previousBalance: Number(statForm.prev),
            currentInventory: Number(statForm.prev) + Number(statForm.prod) - Number(statForm.sales),
            productionKg: Number(statForm.prodKg),
            salesKg: Number(statForm.salesKg),
            previousBalanceKg: Number(statForm.prevKg),
            currentInventoryKg: Number(statForm.prevKg) + Number(statForm.prodKg) - Number(statForm.salesKg)
        });
        if (result.success) { setEditingStat(null); addToast('آمار ویرایش شد', 'success'); handleSearch(); }
        else addToast(result.error || 'خطا در ثبت تغییرات', 'error');
    };

    const openInvoiceEdit = (inv: any) => {
        const f = (v: any) => (v === 0 || v === undefined || v === null) ? '' : String(v);
        setEditingInvoice(inv);
        setInvoiceForm({
            invoiceNumber: inv.invoiceNumber,
            cartons: f(inv.totalCartons),
            weight: f(inv.totalWeight),
            driver: inv.driverName || '',
            plate: inv.plateNumber || '',
            phone: inv.driverPhone || '',
            desc: inv.description || ''
        });
    };

    const saveInvoiceEdit = async () => {
        if (!editingInvoice) return;
        const result = await updateInvoice(editingInvoice.id, {
            invoiceNumber: invoiceForm.invoiceNumber,
            totalCartons: Number(invoiceForm.cartons),
            totalWeight: Number(invoiceForm.weight),
            driverName: invoiceForm.driver,
            plateNumber: invoiceForm.plate,
            driverPhone: invoiceForm.phone,
            description: invoiceForm.desc
        });
        if (result.success) { setEditingInvoice(null); addToast('حواله ویرایش شد', 'success'); handleSearch(); }
        else addToast(result.error || 'خطا در ثبت تغییرات', 'error');
    };

    const handleExportExcel = () => {
        if (previewData.length === 0) return;
        const wb = XLSX.utils.book_new();
        
        let wsData: any[] = [];
        let colOrder: string[] = [];

        if (reportTab === 'stats') {
            colOrder = ['تاریخ', 'فارم', 'محصول', 'تولید', 'فروش', 'موجودی', 'مسئول ثبت', 'ساعت ثبت'];
            wsData = previewData.map(item => ({
                'تاریخ': item.date,
                'فارم': farms.find(f => f.id === item.farmId)?.name || '-',
                'محصول': products.find(p => p.id === item.productId)?.name || '-',
                'تولید': item.production || 0,
                'فروش': item.sales || 0,
                'موجودی': item.currentInventory || 0,
                'مسئول ثبت': item.creatorName || '-',
                'ساعت ثبت': new Date(item.createdAt).toLocaleTimeString('fa-IR')
            }));
        } else {
            colOrder = ['تاریخ', 'رمز حواله', 'فارم', 'نوع محصول', 'تعداد', 'وزن', 'شماره تماس', 'راننده', 'پلاک', 'مسئول ثبت', 'ساعت ثبت'];
            wsData = previewData.map(item => ({
                'تاریخ': item.date,
                'رمز حواله': item.invoiceNumber || '-',
                'فارم': farms.find(f => f.id === item.farmId)?.name || '-',
                'نوع محصول': products.find(p => p.id === item.productId)?.name || '-',
                'تعداد': item.totalCartons || 0,
                'وزن': item.totalWeight || 0,
                'شماره تماس': item.driverPhone || '-',
                'راننده': item.driverName || '-',
                'پلاک': item.plateNumber || '-',
                'مسئول ثبت': item.creatorName || '-',
                'ساعت ثبت': new Date(item.createdAt).toLocaleTimeString('fa-IR')
            }));
        }

        const ws = XLSX.utils.json_to_sheet(wsData, { header: colOrder });
        
        // --- FORCE RTL EXCEL EXPORT ---
        // The '!views' property is the canonical way to set sheet properties like RTL.
        // The key 'rtl' MUST be lowercase for the library to recognize it.
        ws['!views'] = [{ rtl: true }];
        
        // '!dir' is a secondary, less-supported property but included for redundancy.
        ws['!dir'] = 'rtl';

        const colWidths = colOrder.map(key => {
            const maxLen = Math.max(
                key.length,
                ...wsData.map(row => String(row[key] || '').length)
            );
            return { wch: maxLen + 6 }; 
        });
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, "گزارش");
        XLSX.writeFile(wb, `Morvarid_Report_${reportTab}_${getTodayJalali().replace(/\//g, '-')}.xlsx`);
    };

    const selectClass = "w-full p-4 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white font-bold rounded-xl outline-none focus:border-metro-blue";

    return (
        <div className="space-y-6">
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-full max-w-md shadow-sm border border-gray-200 dark:border-gray-700">
                <button onClick={() => setReportTab('invoices')} className={`flex-1 py-3 rounded-full font-bold transition-all ${reportTab === 'invoices' ? 'bg-white dark:bg-gray-700 text-metro-orange shadow-md' : 'text-gray-500'}`}>گزارش فروش</button>
                <button onClick={() => setReportTab('stats')} className={`flex-1 py-3 rounded-full font-bold transition-all ${reportTab === 'stats' ? 'bg-white dark:bg-gray-700 text-metro-blue shadow-md' : 'text-gray-500'}`}>آمار تولید</button>
            </div>

            <div className={`bg-white dark:bg-gray-800 p-6 rounded-[28px] shadow-sm border-l-[12px] smooth-transition grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end ${reportTab === 'invoices' ? 'border-metro-orange' : 'border-metro-blue'}`}>
                <div>
                    <label className="text-sm font-bold text-gray-400 mb-2 block px-1">فارم</label>
                    <select value={selectedFarmId} onChange={e => setSelectedFarmId(e.target.value)} className={selectClass}>
                        <option value="all">همه فارم‌ها</option>
                        {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-sm font-bold text-gray-400 mb-2 block px-1">محصول</label>
                    <select value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} className={selectClass}>
                        <option value="all">همه محصولات</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                <div><JalaliDatePicker value={startDate} onChange={setStartDate} label="از تاریخ" /></div>
                <div><JalaliDatePicker value={endDate} onChange={setEndDate} label="تا تاریخ" /></div>
                <div className="lg:col-span-4 flex justify-end gap-3 mt-4">
                    <Button onClick={handleSearch} isLoading={isSearching} className="h-14 px-10 text-lg font-black bg-gray-900 text-white hover:bg-black rounded-full shadow-lg">جستجو</Button>
                    {hasSearched && previewData.length > 0 && <Button onClick={handleExportExcel} className="h-14 px-8 font-bold rounded-full text-lg bg-metro-green hover:bg-green-600 text-white shadow-lg">دانلود اکسل</Button>}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-[28px] shadow-md overflow-hidden border border-gray-100 dark:border-gray-700">
                <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse min-w-[1000px]">
                        <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 font-black text-xs lg:text-sm uppercase tracking-wider">
                            <tr>
                                {reportTab === 'stats' ? <>
                                    <th className="p-5">تاریخ</th><th className="p-5">فارم</th><th className="p-5">محصول</th><th className="p-5 text-center">تولید</th><th className="p-5 text-center">فروش</th><th className="p-5 text-center">موجودی</th><th className="p-5">ثبت کننده</th><th className="p-5">زمان ثبت</th><th className="p-5 text-center">عملیات</th>
                                </> : <>
                                    <th className="p-5">تاریخ</th><th className="p-5 text-center">رمز حواله</th><th className="p-5">فارم</th><th className="p-5">محصول</th><th className="p-5 text-center">تعداد</th><th className="p-5 text-center">وزن</th><th className="p-5">شماره تماس</th><th className="p-5">ثبت کننده</th><th className="p-5 text-center">عملیات</th>
                                </>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {previewData.map(row => (
                                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    {reportTab === 'stats' ? <>
                                        <td className="p-5 font-mono font-bold text-lg">{toPersianDigits(row.date)}</td>
                                        <td className="p-5 font-bold text-gray-800 dark:text-white">{farms.find(f => f.id === row.farmId)?.name}</td>
                                        <td className="p-5 text-sm text-gray-500 font-bold">{products.find(p => p.id === row.productId)?.name}</td>
                                        <td className="p-5 text-center text-green-600 font-black text-xl lg:text-2xl">+{toPersianDigits(row.production)}</td>
                                        <td className="p-5 text-center text-red-500 font-black text-xl lg:text-2xl">-{toPersianDigits(row.sales)}</td>
                                        <td className="p-5 text-center font-black text-xl lg:text-2xl text-metro-blue">{toPersianDigits(row.currentInventory)}</td>
                                        <td className="p-5"><span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg font-bold text-sm">{row.creatorName || 'ناشناس'}</span></td>
                                        <td className="p-5 font-mono text-sm opacity-60">{new Date(row.createdAt).toLocaleTimeString('fa-IR')}</td>
                                    </> : <>
                                        <td className="p-5 font-mono font-bold text-lg">{toPersianDigits(row.date)}</td>
                                        <td className="p-5 text-center font-black text-xl lg:text-2xl tracking-widest text-metro-orange">{toPersianDigits(row.invoiceNumber)}</td>
                                        <td className="p-5 font-bold text-gray-800 dark:text-white">{farms.find(f => f.id === row.farmId)?.name}</td>
                                        <td className="p-5 text-sm text-gray-500 font-bold">{products.find(p => p.id === row.productId)?.name}</td>
                                        <td className="p-5 text-center font-black text-xl lg:text-2xl">{toPersianDigits(row.totalCartons)}</td>
                                        <td className="p-5 text-center text-blue-600 font-black text-xl lg:text-2xl">{toPersianDigits(row.totalWeight)}</td>
                                        <td className="p-5 font-mono font-bold text-sm">{toPersianDigits(row.driverPhone || '-')}</td>
                                        <td className="p-5"><span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg font-bold text-sm">{row.creatorName || 'ناشناس'}</span></td>
                                    </>}
                                    <td className="p-5 flex justify-center gap-2">
                                        <button onClick={() => reportTab === 'stats' ? openStatEdit(row) : openInvoiceEdit(row)} className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"><Icons.Edit className="w-5 h-5"/></button>
                                        <button onClick={() => reportTab === 'stats' ? handleDeleteStat(row.id) : handleDeleteInvoice(row.id)} className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"><Icons.Trash className="w-5 h-5"/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {previewData.length === 0 && hasSearched && <div className="p-20 text-center text-gray-400 font-bold text-xl">داده‌ای یافت نشد.</div>}
                </div>
            </div>

            <Modal isOpen={!!editingStat} onClose={() => setEditingStat(null)} title="اصلاح مدیریتی آمار">
                <div className="space-y-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-sm font-bold text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                        دسترسی مدیر: تغییرات باعث بازنشانی موجودی انبار می‌شود.
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-xs font-bold mb-2 block mr-1">تولید (تعداد)</label><input type="number" value={statForm.prod} onChange={e => setStatForm({...statForm, prod: e.target.value})} className="w-full p-4 bg-gray-50 dark:bg-gray-700 rounded-xl text-center font-black text-2xl outline-none border-none focus:ring-2 focus:ring-metro-blue"/></div>
                        <div><label className="text-xs font-bold mb-2 block mr-1">فروش (تعداد)</label><input type="number" value={statForm.sales} onChange={e => setStatForm({...statForm, sales: e.target.value})} className="w-full p-4 bg-gray-50 dark:bg-gray-700 rounded-xl text-center font-black text-2xl outline-none border-none focus:ring-2 focus:ring-metro-blue"/></div>
                    </div>
                    <div><label className="text-xs font-bold mb-2 block mr-1">مانده قبل (اصلاح دستی)</label><input type="number" value={statForm.prev} onChange={e => setStatForm({...statForm, prev: e.target.value})} className="w-full p-4 bg-gray-100 dark:bg-gray-900 rounded-xl text-center font-bold text-xl outline-none border-none focus:ring-2 focus:ring-metro-blue"/></div>
                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-700"><Button variant="secondary" onClick={() => setEditingStat(null)}>انصراف</Button><Button onClick={saveStatEdit}>ذخیره تغییرات مدیریت</Button></div>
                </div>
            </Modal>

            <Modal isOpen={!!editingInvoice} onClose={() => setEditingInvoice(null)} title="اصلاح مدیریتی حواله">
                <div className="space-y-6">
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-200 dark:border-orange-800 text-sm font-bold text-orange-800 dark:text-orange-300">
                        دسترسی مدیر: اصلاح حواله باعث تغییر در آمار فروش فارم می‌شود.
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl"><label className="block text-sm font-bold mb-2 text-gray-500">رمز حواله</label><input type="text" value={invoiceForm.invoiceNumber} onChange={e => setInvoiceForm({...invoiceForm, invoiceNumber: e.target.value})} className="w-full p-3 bg-white dark:bg-gray-800 border-2 border-orange-300 rounded-lg text-center font-black text-3xl tracking-widest outline-none"/></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-xs font-bold mb-2 block mr-1">تعداد (کارتن)</label><input type="number" value={invoiceForm.cartons} onChange={e => setInvoiceForm({...invoiceForm, cartons: e.target.value})} className="w-full p-4 bg-gray-50 dark:bg-gray-700 rounded-xl text-center font-black text-2xl outline-none border-none focus:ring-2 focus:ring-metro-orange"/></div>
                        <div><label className="text-xs font-bold mb-2 block mr-1">وزن (Kg)</label><input type="number" value={invoiceForm.weight} onChange={e => setInvoiceForm({...invoiceForm, weight: e.target.value})} className="w-full p-4 bg-gray-50 dark:bg-gray-700 rounded-xl text-center font-black text-2xl outline-none border-none focus:ring-2 focus:ring-metro-orange"/></div>
                    </div>
                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-700"><Button variant="secondary" onClick={() => setEditingInvoice(null)}>انصراف</Button><Button onClick={saveInvoiceEdit}>ذخیره اصلاحیه مدیریت</Button></div>
                </div>
            </Modal>
        </div>
    );
};

export default Reports;
