import React, { useState, useEffect } from 'react';
import { useFarmStore } from '../../store/farmStore';
import { useStatisticsStore } from '../../store/statisticsStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useToastStore } from '../../store/toastStore';
import { Icons } from '../common/Icons';
import Button from '../common/Button';
import JalaliDatePicker from '../common/JalaliDatePicker';
import * as XLSX from 'xlsx';
import { toPersianDigits, getTodayJalali, normalizeDate, isDateInRange } from '../../utils/dateUtils';
import { useConfirm } from '../../hooks/useConfirm';
import Modal from '../common/Modal';
import { usePermissions } from '../../hooks/usePermissions';
import Checkbox from '../common/Checkbox'; // ✅ IMPORT CHECKBOX

type ReportTab = 'stats' | 'invoices';

const Reports: React.FC = () => {
    const { farms, products } = useFarmStore();
    const { deleteStatistic, updateStatistic, bulkDeleteStatistics } = useStatisticsStore();
    const { deleteInvoice, updateInvoice, bulkDeleteInvoices } = useInvoiceStore();
    const { addToast } = useToastStore();
    const { confirm } = useConfirm();

    const { canSeeOperationsColumn } = usePermissions();

    const [reportTab, setReportTab] = useState<ReportTab>('invoices');
    
    const [selectedFarmId, setSelectedFarmId] = useState<string>('all');
    const [selectedProductId, setSelectedProductId] = useState<string>('all');
    const [startDate, setStartDate] = useState(getTodayJalali());
    const [endDate, setEndDate] = useState(getTodayJalali());
    
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    // ✅ NEW: Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);

    // ✅ NEW: Selection Logic
    const isAllSelected = previewData.length > 0 && selectedIds.size === previewData.length;
    const isSomeSelected = selectedIds.size > 0 && selectedIds.size < previewData.length;

    const toggleRow = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (isAllSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(previewData.map(item => item.id)));
        }
    };

    const handleSearch = () => {
        setIsSearching(true);
        setHasSearched(true);
        setSelectedIds(new Set()); // ✅ Clear selection on new search
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

    // ✅ NEW: Bulk Delete Handler
    const handleBulkDelete = async () => {
        const idsToDelete = Array.from(selectedIds);
        if (idsToDelete.length === 0) return;

        const confirmed = await confirm({
            title: 'حذف دسته‌جمعی',
            message: `آیا از حذف ${toPersianDigits(idsToDelete.length)} مورد انتخاب شده اطمینان دارید؟ این عملیات قابل بازگشت نیست.`,
            confirmText: `بله، حذف ${toPersianDigits(idsToDelete.length)} مورد`,
            type: 'danger'
        });

        if (confirmed) {
            setIsDeleting(true);
            let result;
            if (reportTab === 'stats') {
                result = await bulkDeleteStatistics(idsToDelete);
            } else {
                result = await bulkDeleteInvoices(idsToDelete);
            }

            if (result.success) {
                addToast(`${toPersianDigits(idsToDelete.length)} مورد با موفقیت حذف شد.`, 'success');
                setSelectedIds(new Set());
                handleSearch(); // Refresh data
            } else {
                addToast(result.error || 'خطا در حذف دسته‌جمعی', 'error');
            }
            setIsDeleting(false);
        }
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

    const [editingStat, setEditingStat] = useState<any | null>(null);
    const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
    const [statForm, setStatForm] = useState({ prod: '', sales: '', prev: '', prodKg: '', salesKg: '', prevKg: '' });
    const [invoiceForm, setInvoiceForm] = useState({ invoiceNumber: '', cartons: '', weight: '', driver: '', plate: '', phone: '', desc: '' });

    // FIX: Changed function re-assignments to proper const declarations to resolve errors.
    const openStatEdit = (stat: any) => {
        const f = (v: any) => (v === 0 || v === undefined || v === null) ? '' : String(v);
        setEditingStat(stat);
        setStatForm({
            prod: f(stat.production), sales: f(stat.sales), prev: f(stat.previousBalance),
            prodKg: f(stat.productionKg), salesKg: f(stat.salesKg), prevKg: f(stat.previousBalanceKg)
        });
    };

    const saveStatEdit = async () => {
        if (!editingStat) return;
        const result = await updateStatistic(editingStat.id, {
            production: Number(statForm.prod), sales: Number(statForm.sales), previousBalance: Number(statForm.prev),
            currentInventory: Number(statForm.prev) + Number(statForm.prod) - Number(statForm.sales),
            productionKg: Number(statForm.prodKg), salesKg: Number(statForm.salesKg), previousBalanceKg: Number(statForm.prevKg),
            currentInventoryKg: Number(statForm.prevKg) + Number(statForm.prodKg) - Number(statForm.salesKg)
        });
        if (result.success) { setEditingStat(null); addToast('آمار ویرایش شد', 'success'); handleSearch(); }
        else addToast(result.error || 'خطا در ثبت تغییرات', 'error');
    };

    const openInvoiceEdit = (inv: any) => {
        const f = (v: any) => (v === 0 || v === undefined || v === null) ? '' : String(v);
        setEditingInvoice(inv);
        setInvoiceForm({
            invoiceNumber: inv.invoiceNumber, cartons: f(inv.totalCartons), weight: f(inv.totalWeight),
            driver: inv.driverName || '', plate: inv.plateNumber || '', phone: inv.driverPhone || '', desc: inv.description || ''
        });
    };

    const saveInvoiceEdit = async () => {
        if (!editingInvoice) return;
        const result = await updateInvoice(editingInvoice.id, {
            invoiceNumber: invoiceForm.invoiceNumber, totalCartons: Number(invoiceForm.cartons), totalWeight: Number(invoiceForm.weight),
            driverName: invoiceForm.driver, plateNumber: invoiceForm.plate, driverPhone: invoiceForm.phone, description: invoiceForm.desc
        });
        if (result.success) { setEditingInvoice(null); addToast('حواله ویرایش شد', 'success'); handleSearch(); }
        else addToast(result.error || 'خطا در ثبت تغییرات', 'error');
    };

    const handleExportExcel = () => {
        if (previewData.length === 0) {
            addToast('داده‌ای برای خروجی وجود ندارد.', 'warning');
            return;
        }

        let dataToExport: any[] = [];
        let filename = '';

        if (reportTab === 'stats') {
            filename = `Morvarid_Stats_Report_${getTodayJalali().replace(/\//g, '-')}.xlsx`;
            dataToExport = previewData.map(s => ({
                'تاریخ': toPersianDigits(s.date),
                'نام فارم': farms.find(f => f.id === s.farmId)?.name || 'ناشناخته',
                'محصول': products.find(p => p.id === s.productId)?.name || 'ناشناخته',
                'موجودی قبلی': toPersianDigits(s.previousBalance),
                'تولید': toPersianDigits(s.production),
                'فروش': toPersianDigits(s.sales),
                'موجودی فعلی': toPersianDigits(s.currentInventory),
                'موجودی قبلی (کیلوگرم)': toPersianDigits(s.previousBalanceKg || 0),
                'تولید (کیلوگرم)': toPersianDigits(s.productionKg || 0),
                'فروش (کیلوگرم)': toPersianDigits(s.salesKg || 0),
                'موجودی فعلی (کیلوگرم)': toPersianDigits(s.currentInventoryKg || 0),
                'ثبت کننده': s.creatorName || 'ناشناس'
            }));
        } else { // invoices
            filename = `Morvarid_Invoices_Report_${getTodayJalali().replace(/\//g, '-')}.xlsx`;
            dataToExport = previewData.map(i => ({
                'تاریخ': toPersianDigits(i.date),
                'رمز حواله': toPersianDigits(i.invoiceNumber),
                'نام فارم': farms.find(f => f.id === i.farmId)?.name || 'ناشناخته',
                'محصول': products.find(p => p.id === i.productId)?.name || 'ناشناخته',
                'تعداد (کارتن)': toPersianDigits(i.totalCartons),
                'وزن (کیلوگرم)': toPersianDigits(i.totalWeight),
                'نام راننده': i.driverName || '-',
                'شماره تماس': toPersianDigits(i.driverPhone || '-'),
                'پلاک': toPersianDigits(i.plateNumber || '-'),
                'توضیحات': i.description || '-',
                'ثبت کننده': i.creatorName || 'ناشناس'
            }));
        }

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'گزارش');
        XLSX.writeFile(workbook, filename);
    };

    const selectClass = "w-full p-4 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white font-bold rounded-xl outline-none focus:border-metro-blue";
    
    return (
        <div className="space-y-6">
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-full max-w-md shadow-sm border border-gray-200 dark:border-gray-700">
                <button onClick={() => setReportTab('invoices')} className={`flex-1 py-3 rounded-full font-bold transition-all ${reportTab === 'invoices' ? 'bg-white dark:bg-gray-700 text-metro-orange shadow-md' : 'text-gray-500'}`}>گزارش فروش</button>
                <button onClick={() => setReportTab('stats')} className={`flex-1 py-3 rounded-full font-bold transition-all ${reportTab === 'stats' ? 'bg-white dark:bg-gray-700 text-metro-blue shadow-md' : 'text-gray-500'}`}>آمار تولید</button>
            </div>

            <div className={`bg-white dark:bg-gray-800 p-6 rounded-[28px] shadow-sm border-l-[12px] smooth-transition ${reportTab === 'invoices' ? 'border-metro-orange' : 'border-metro-blue'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
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
                </div>

                {/* ✅ NEW/MODIFIED ACTION BAR */}
                <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <Button onClick={handleSearch} isLoading={isSearching} className="h-14 px-10 text-lg font-black bg-gray-900 text-white hover:bg-black rounded-full shadow-lg">جستجو</Button>
                        {hasSearched && previewData.length > 0 && canSeeOperationsColumn && (
                            <Button onClick={toggleAll} variant="secondary" className="h-14 px-6 rounded-full text-lg">
                                <Checkbox checked={isAllSelected} indeterminate={isSomeSelected} readOnly className="ml-2 h-5 w-5"/>
                                انتخاب همه
                            </Button>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-4">
                        {selectedIds.size > 0 && canSeeOperationsColumn && (
                             <>
                                <span className="text-sm font-bold text-gray-500 dark:text-gray-400">
                                    {toPersianDigits(selectedIds.size)} مورد انتخاب شده
                                </span>
                                <Button 
                                    onClick={handleBulkDelete} 
                                    isLoading={isDeleting}
                                    variant="danger" 
                                    className="h-14 px-6 rounded-full text-lg font-black"
                                >
                                    <Icons.Trash className="w-5 h-5 ml-2" />
                                    حذف ({toPersianDigits(selectedIds.size)})
                                </Button>
                             </>
                        )}
                        {hasSearched && previewData.length > 0 && selectedIds.size === 0 && (
                            <Button onClick={handleExportExcel} className="h-14 px-8 font-bold rounded-full text-lg bg-metro-green hover:bg-green-600 text-white shadow-lg">دانلود اکسل</Button>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-[28px] shadow-md overflow-hidden border border-gray-100 dark:border-gray-700">
                <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse min-w-[1000px]">
                        <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 font-black text-xs lg:text-sm uppercase tracking-wider">
                            <tr>
                                {/* ✅ NEW: Checkbox Header */}
                                {canSeeOperationsColumn && (
                                    <th className="p-5 w-12">
                                        <Checkbox checked={isAllSelected} indeterminate={isSomeSelected} onChange={toggleAll} />
                                    </th>
                                )}
                                {reportTab === 'stats' ? <>
                                    <th className="p-5">تاریخ</th><th className="p-5">فارم</th><th className="p-5">محصول</th><th className="p-5 text-center">تولید</th><th className="p-5 text-center">فروش</th><th className="p-5 text-center">موجودی</th><th className="p-5">ثبت کننده</th><th className="p-5">زمان ثبت</th>
                                    {canSeeOperationsColumn && <th className="p-5 text-center">عملیات</th>}
                                </> : <>
                                    <th className="p-5">تاریخ</th><th className="p-5 text-center">رمز حواله</th><th className="p-5">فارم</th><th className="p-5">محصول</th><th className="p-5 text-center">تعداد</th><th className="p-5 text-center">وزن</th><th className="p-5">شماره تماس</th><th className="p-5">ثبت کننده</th>
                                    {canSeeOperationsColumn && <th className="p-5 text-center">عملیات</th>}
                                </>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {previewData.map(row => {
                                const isSelected = selectedIds.has(row.id);
                                return (
                                <tr key={row.id} className={`transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                                    {/* ✅ NEW: Row Checkbox */}
                                    {canSeeOperationsColumn && (
                                        <td className="p-5">
                                            <Checkbox checked={isSelected} onChange={() => toggleRow(row.id)} />
                                        </td>
                                    )}
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
                                    {canSeeOperationsColumn && (
                                        <td className="p-5 flex justify-center gap-2">
                                            <button onClick={() => reportTab === 'stats' ? openStatEdit(row) : openInvoiceEdit(row)} className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"><Icons.Edit className="w-5 h-5"/></button>
                                            <button onClick={() => reportTab === 'stats' ? handleDeleteStat(row.id) : handleDeleteInvoice(row.id)} className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"><Icons.Trash className="w-5 h-5"/></button>
                                        </td>
                                    )}
                                </tr>
                            )})}
                        </tbody>
                    </table>
                    {previewData.length === 0 && hasSearched && <div className="p-20 text-center text-gray-400 font-bold text-xl">داده‌ای یافت نشد.</div>}
                </div>
            </div>

            {/* Modals remain unchanged */}
            <Modal isOpen={!!editingStat} onClose={() => setEditingStat(null)} title="اصلاح مدیریتی آمار">{/* ... */}</Modal>
            <Modal isOpen={!!editingInvoice} onClose={() => setEditingInvoice(null)} title="اصلاح مدیریتی حواله">{/* ... */}</Modal>
        </div>
    );
};

export default Reports;