
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
import { toPersianDigits, getTodayJalali, normalizeDate, isDateInRange, toEnglishDigits } from '../../utils/dateUtils';
import { useConfirm } from '../../hooks/useConfirm';
import Modal from '../common/Modal';
import { useDebounce } from '../../hooks/useDebounce';

type ReportTab = 'stats' | 'invoices';

const Reports: React.FC = () => {
    const { farms, products, getProductById } = useFarmStore();
    const { statistics, deleteStatistic, updateStatistic } = useStatisticsStore();
    const { invoices, deleteInvoice, updateInvoice } = useInvoiceStore();
    const { addToast } = useToastStore();
    const { confirm } = useConfirm();
    const { user: currentUser } = useAuthStore();

    const isAdmin = currentUser?.role === UserRole.ADMIN;

    const [reportTab, setReportTab] = useState<ReportTab>('invoices');
    
    const [selectedFarmId, setSelectedFarmId] = useState<string>('all');
    const [selectedProductId, setSelectedProductId] = useState<string>('all');
    const [startDate, setStartDate] = useState(getTodayJalali());
    const [endDate, setEndDate] = useState(getTodayJalali());
    const [searchTerm, setSearchTerm] = useState('');
    
    const debouncedSearchTerm = useDebounce(searchTerm, 500);

    const [previewData, setPreviewData] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const [editingStat, setEditingStat] = useState<any | null>(null);
    const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
    
    const [statForm, setStatForm] = useState({ prod: '', sales: '', prev: '', prodKg: '', salesKg: '', prevKg: '' });
    const [invoiceForm, setInvoiceForm] = useState({ invoiceNumber: '', cartons: '', weight: '', driver: '', plate: '', phone: '', desc: '' });

    useEffect(() => {
        handleSearch();
    }, [debouncedSearchTerm, selectedFarmId, selectedProductId, startDate, endDate, reportTab]);

    const handleSearch = () => {
        setIsSearching(true);
        const start = normalizeDate(startDate);
        const end = normalizeDate(endDate);
        const term = debouncedSearchTerm.toLowerCase();

        setTimeout(() => {
            let data: any[] = [];
            if (reportTab === 'stats') {
                data = statistics.filter(s => {
                    const farmMatch = selectedFarmId === 'all' || s.farmId === selectedFarmId;
                    const prodMatch = selectedProductId === 'all' || s.productId === selectedProductId;
                    const dateMatch = isDateInRange(s.date, start, end);
                    const searchMatch = !term || (s.creatorName?.toLowerCase().includes(term));
                    return farmMatch && prodMatch && dateMatch && searchMatch;
                });
            } else {
                data = invoices.filter(i => {
                    const farmMatch = selectedFarmId === 'all' || i.farmId === selectedFarmId;
                    const prodMatch = selectedProductId === 'all' || i.productId === selectedProductId;
                    const dateMatch = isDateInRange(i.date, start, end);
                    const searchMatch = !term || 
                        (i.invoiceNumber.includes(term)) || 
                        (i.driverName?.toLowerCase().includes(term)) || 
                        (i.plateNumber?.includes(term));
                    
                    return farmMatch && prodMatch && dateMatch && searchMatch;
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
        const f = (v: any) => (v === undefined || v === null) ? '' : String(v);
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
        const f = (v: any) => (v === undefined || v === null) ? '' : String(v);
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

    // Helper for visual display in Table
    const formatPlateVisual = (plate: string) => {
        if (!plate || !plate.includes('-')) return plate || '-';
        const parts = plate.split('-');
        if (parts.length === 4) {
            // Visual: IranCode - 3digits Letter 2digits
            return `${toPersianDigits(parts[3])} - ${toPersianDigits(parts[2])} ${parts[1]} ${toPersianDigits(parts[0])}`;
        }
        return plate;
    };

    // Helper for Excel Export (Reverses order for spreadsheet logic if needed, or keeps it standard string)
    // Excel usually handles RTL better if we just pass the string as is or pre-formatted.
    // The user requested "Exactly like the table", so we use the same visual format logic.
    const formatPlateForExcel = (plate: string) => {
        if (!plate || !plate.includes('-')) return plate || '-';
        const parts = plate.split('-');
        if (parts.length === 4) {
             // For Excel, we might need LTR char embedding if mixed
             // But simpler is usually better: Iran - 3dig Let 2dig
             return `${parts[3]} - ${parts[2]} ${parts[1]} ${parts[0]}`;
        }
        return plate;
    };

    const getDualValueString = (units: number, weight: number) => {
        const parts = [];
        if (units > 0) parts.push(`${units}`);
        if (weight > 0) parts.push(`${weight} Kg`);
        if (parts.length === 0) return '0';
        return parts.join(' / ');
    };

    const handleExportExcel = () => {
        if (previewData.length === 0) return;
        
        // Right alignment for ALL cells
        const commonStyle = { 
            font: { name: "Vazir", sz: 12 }, 
            alignment: { horizontal: "right", vertical: "center", wrapText: true } 
        };
        const headerStyle = { 
            font: { name: "Vazir", sz: 12, bold: true }, 
            alignment: { horizontal: "right", vertical: "center" },
            fill: { fgColor: { rgb: "E0E0E0" } } 
        };
        
        const cell = (v: any, style: any = commonStyle) => ({ v: v, s: style });

        let wsData: any[] = [];
        let headers: any[] = [];
        
        if (reportTab === 'stats') {
            headers = ['تاریخ', 'فارم', 'محصول', 'تولید', 'فروش', 'موجودی', 'مسئول ثبت', 'زمان ثبت/ویرایش'];
            const headerRow = headers.map(h => cell(h, headerStyle));
            
            const rows = previewData.map(item => {
                const prod = getProductById(item.productId);
                const displayTime = new Date(item.updatedAt || item.createdAt).toLocaleTimeString('fa-IR');
                const timeLabel = item.updatedAt ? `${displayTime} (ویرایش شده)` : displayTime;

                return [
                    cell(item.date),
                    cell(farms.find(f => f.id === item.farmId)?.name || '-'),
                    cell(prod?.name || '-'),
                    cell(getDualValueString(item.production || 0, item.productionKg || 0)),
                    cell(getDualValueString(item.sales || 0, item.salesKg || 0)),
                    cell(getDualValueString(item.currentInventory || 0, item.currentInventoryKg || 0)),
                    cell(item.creatorName || '-'),
                    cell(timeLabel)
                ];
            });
            wsData = [headerRow, ...rows];
        } else {
            headers = ['تاریخ', 'رمز حواله', 'فارم', 'نوع محصول', 'تعداد', 'وزن', 'شماره تماس', 'راننده', 'پلاک', 'مسئول ثبت', 'زمان ثبت/ویرایش'];
            const headerRow = headers.map(h => cell(h, headerStyle));
            const rows = previewData.map(item => {
                const displayTime = new Date(item.updatedAt || item.createdAt).toLocaleTimeString('fa-IR');
                const timeLabel = item.updatedAt ? `${displayTime} (ویرایش شده)` : displayTime;

                return [
                    cell(item.date),
                    cell(item.invoiceNumber),
                    cell(farms.find(f => f.id === item.farmId)?.name || '-'),
                    cell(products.find(p => p.id === item.productId)?.name || '-'),
                    cell(item.totalCartons || 0),
                    cell(item.totalWeight || 0),
                    cell(item.driverPhone || '-'),
                    cell(item.driverName || '-'),
                    cell(formatPlateForExcel(item.plateNumber || '')),
                    cell(item.creatorName || '-'),
                    cell(timeLabel)
                ];
            });
            wsData = [headerRow, ...rows];
        }

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!dir'] = 'rtl';
        
        // Auto-calculate column widths based on content
        const wscols = headers.map((h, i) => {
            // Start with header length
            let maxLen = h.length; 
            // Check all rows for this column
            wsData.slice(1).forEach(row => {
                const val = row[i]?.v ? String(row[i].v) : '';
                if (val.length > maxLen) maxLen = val.length;
            });
            return { wch: maxLen + 5 }; // Add padding
        });
        
        ws['!cols'] = wscols;

        const wb = XLSX.utils.book_new();
        wb.Workbook = { Views: [{ RTL: true }] };
        XLSX.utils.book_append_sheet(wb, ws, "گزارش");
        XLSX.writeFile(wb, `Morvarid_Report_${reportTab}_${getTodayJalali().replace(/\//g, '-')}.xlsx`);
    };

    const renderDualCell = (units: number, weight: number, colorClass: string, isEdited: boolean) => {
        const hasUnits = units > 0;
        const hasWeight = weight > 0;
        return (
            <div className={`flex flex-col items-center justify-center font-black text-lg ${colorClass} ${isEdited ? 'bg-yellow-50 dark:bg-yellow-900/10 p-1 rounded' : ''}`}>
                {hasUnits && <span>{toPersianDigits(units)} <small className="text-xs text-gray-400">کارتن</small></span>}
                {hasWeight && <span>{toPersianDigits(weight)} <small className="text-xs text-gray-400">Kg</small></span>}
                {!hasUnits && !hasWeight && <span className="text-gray-300">0</span>}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-full max-w-md shadow-sm border border-gray-200 dark:border-gray-700">
                <button onClick={() => setReportTab('invoices')} className={`flex-1 py-3 rounded-full font-bold transition-all ${reportTab === 'invoices' ? 'bg-white dark:bg-gray-700 text-metro-orange shadow-md' : 'text-gray-500'}`}>گزارش فروش</button>
                <button onClick={() => setReportTab('stats')} className={`flex-1 py-3 rounded-full font-bold transition-all ${reportTab === 'stats' ? 'bg-white dark:bg-gray-700 text-metro-blue shadow-md' : 'text-gray-500'}`}>آمار تولید</button>
            </div>

            <div className={`bg-white dark:bg-gray-800 p-6 rounded-[28px] shadow-sm border-l-[12px] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end ${reportTab === 'invoices' ? 'border-metro-orange' : 'border-metro-blue'}`}>
                <div className="lg:col-span-4 mb-2">
                    <input 
                        type="text" 
                        placeholder="جستجو (شماره حواله، راننده، پلاک...)" 
                        className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 dark:text-white font-bold outline-none focus:border-metro-blue transition-all"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div>
                    <label className="text-sm font-bold text-gray-400 mb-2 block px-1">فارم</label>
                    <select value={selectedFarmId} onChange={e => setSelectedFarmId(e.target.value)} className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 dark:text-white font-bold outline-none focus:border-metro-blue">
                        <option value="all">همه فارم‌های فعال</option>
                        {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-sm font-bold text-gray-400 mb-2 block px-1">محصول</label>
                    <select value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 dark:text-white font-bold outline-none focus:border-metro-blue">
                        <option value="all">همه محصولات</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                <div><JalaliDatePicker value={startDate} onChange={setStartDate} label="از تاریخ" /></div>
                <div><JalaliDatePicker value={endDate} onChange={setEndDate} label="تا تاریخ" /></div>
                <div className="lg:col-span-4 flex justify-end gap-3 mt-4">
                    {previewData.length > 0 && <Button onClick={handleExportExcel} className="h-14 px-8 font-bold rounded-full text-lg bg-metro-green hover:bg-green-600 text-white shadow-lg">دانلود اکسل</Button>}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-[28px] shadow-md overflow-hidden border border-gray-100 dark:border-gray-700 relative">
                <div className="overflow-x-auto max-h-[600px] custom-scrollbar relative">
                    <table className="w-full text-right border-collapse min-w-[1200px]">
                        <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 font-black text-xs lg:text-sm uppercase tracking-wider sticky top-0 z-10 shadow-md">
                            <tr>
                                {reportTab === 'stats' ? <>
                                    <th className="p-5">تاریخ</th><th className="p-5">فارم</th><th className="p-5">محصول</th><th className="p-5 text-center">تولید</th><th className="p-5 text-center">فروش</th><th className="p-5 text-center">موجودی</th><th className="p-5">اطلاعات ثبت</th>{isAdmin && <th className="p-5 text-center">عملیات</th>}
                                </> : <>
                                    <th className="p-5">تاریخ</th><th className="p-5 text-center">رمز حواله</th><th className="p-5">فارم</th><th className="p-5">نوع محصول</th><th className="p-5 text-center">تعداد</th><th className="p-5 text-center">وزن</th><th className="p-5">شماره تماس</th><th className="p-5">راننده</th><th className="p-5">پلاک</th><th className="p-5">اطلاعات ثبت</th>{isAdmin && <th className="p-5 text-center">عملیات</th>}
                                </>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {isSearching ? (
                                <tr><td colSpan={10} className="text-center py-20 text-gray-400">در حال جستجو...</td></tr>
                            ) : previewData.length === 0 ? (
                                <tr><td colSpan={10} className="text-center py-20 text-gray-400 font-bold">رکوردی یافت نشد</td></tr>
                            ) : (
                                previewData.map(row => {
                                    const prod = getProductById(row.productId);
                                    const isEdited = !!row.updatedAt;
                                    const displayTime = new Date(isEdited ? row.updatedAt : row.createdAt).toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'});
                                    
                                    return (
                                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        {reportTab === 'stats' ? <>
                                            <td className="p-5 font-mono font-bold text-lg">{toPersianDigits(row.date)}</td>
                                            <td className="p-5 font-bold text-gray-800 dark:text-white">{farms.find(f => f.id === row.farmId)?.name}</td>
                                            <td className="p-5 text-sm text-gray-500 font-bold">{prod?.name}</td>
                                            <td className="p-5 text-center">
                                                {renderDualCell(row.production || 0, row.productionKg || 0, 'text-green-600', isEdited)}
                                            </td>
                                            <td className="p-5 text-center">
                                                {renderDualCell(row.sales || 0, row.salesKg || 0, 'text-red-500', false)}
                                            </td>
                                            <td className="p-5 text-center">
                                                {renderDualCell(row.currentInventory || 0, row.currentInventoryKg || 0, 'text-metro-blue', isEdited)}
                                            </td>
                                            <td className="p-5">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-md font-bold text-xs">{row.creatorName || 'ناشناس'}</span>
                                                        <div className="flex flex-col">
                                                            <span className="font-mono text-[10px] opacity-60">{toPersianDigits(displayTime)}</span>
                                                            {isEdited && <span className="text-[9px] text-orange-500 font-bold">(ویرایش شده)</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </> : <>
                                            <td className="p-5 font-mono font-bold text-lg">{toPersianDigits(row.date)}</td>
                                            <td className="p-5 text-center font-black text-xl lg:text-2xl tracking-widest text-metro-orange">{toPersianDigits(row.invoiceNumber)}</td>
                                            <td className="p-5 font-bold text-gray-800 dark:text-white">{farms.find(f => f.id === row.farmId)?.name}</td>
                                            <td className="p-5 font-bold text-gray-600 dark:text-gray-300">{prod?.name || '-'}</td>
                                            <td className={`p-5 text-center font-black text-xl lg:text-2xl ${isEdited ? 'bg-yellow-50 dark:bg-yellow-900/10 rounded' : ''}`}>{toPersianDigits(row.totalCartons || 0)}</td>
                                            <td className={`p-5 text-center text-blue-600 font-black text-xl lg:text-2xl ${isEdited ? 'bg-yellow-50 dark:bg-yellow-900/10 rounded' : ''}`}>{toPersianDigits(row.totalWeight || 0)}</td>
                                            <td className="p-5 font-mono font-bold text-sm">{toPersianDigits(row.driverPhone || '-')}</td>
                                            <td className="p-5 font-bold">{row.driverName || '-'}</td>
                                            <td className="p-5 font-mono text-sm">{formatPlateVisual(row.plateNumber || '') || '-'}</td>
                                            <td className="p-5">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-md font-bold text-xs">{row.creatorName || 'ناشناس'}</span>
                                                        <div className="flex flex-col">
                                                            <span className="font-mono text-[10px] opacity-60">{toPersianDigits(displayTime)}</span>
                                                            {isEdited && <span className="text-[9px] text-orange-500 font-bold">(ویرایش شده)</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </>}
                                        {isAdmin && <td className="p-5 flex justify-center gap-2">
                                            <button onClick={() => reportTab === 'stats' ? openStatEdit(row) : openInvoiceEdit(row)} className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"><Icons.Edit className="w-5 h-5"/></button>
                                            <button onClick={() => reportTab === 'stats' ? handleDeleteStat(row.id) : handleDeleteInvoice(row.id)} className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"><Icons.Trash className="w-5 h-5"/></button>
                                        </td>}
                                    </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {/* ... Modals ... */}
            <Modal isOpen={!!editingStat} onClose={() => setEditingStat(null)} title="اصلاح مدیریتی آمار">
                <div className="space-y-6">
                     <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl text-sm font-bold text-purple-800 dark:text-purple-300 border border-purple-100 dark:border-purple-800">
                         شما در حال ویرایش با دسترسی مدیر هستید. هیچ محدودیت زمانی اعمال نمی‌شود.
                     </div>
                     <div className="grid grid-cols-2 gap-4 lg:gap-6">
                         <div>
                             <label className="text-sm lg:text-lg font-bold block mb-2 px-1">تولید</label>
                             <input type="number" value={statForm.prod} onChange={e => setStatForm({...statForm, prod: Number(e.target.value) as any})} className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-center font-black lg:text-2xl outline-none focus:border-green-500" />
                         </div>
                         <div>
                             <label className="text-sm lg:text-lg font-bold block mb-2 px-1">فروش</label>
                             <input type="number" value={statForm.sales} onChange={e => setStatForm({...statForm, sales: Number(e.target.value) as any})} className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-center font-black lg:text-2xl outline-none focus:border-red-500" />
                         </div>
                     </div>
                     <div>
                         <label className="text-sm lg:text-lg font-bold block mb-2 px-1">مانده قبل (اصلاح دستی)</label>
                         <input type="number" value={statForm.prev} onChange={e => setStatForm({...statForm, prev: Number(e.target.value) as any})} className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-center font-bold lg:text-2xl" />
                     </div>
                     <div className="flex justify-end gap-2 mt-8">
                         <Button variant="secondary" onClick={() => setEditingStat(null)} className="lg:h-12 lg:px-6">لغو</Button>
                         <Button onClick={saveStatEdit} className="lg:h-12 lg:px-6">ذخیره تغییرات</Button>
                     </div>
                </div>
            </Modal>

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
                             <input type="number" value={invoiceForm.cartons} onChange={e => setInvoiceForm({...invoiceForm, cartons: Number(e.target.value) as any})} className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-center font-black lg:text-2xl outline-none focus:border-metro-orange" />
                         </div>
                         <div>
                             <label className="text-sm lg:text-lg font-bold block mb-2 px-1">وزن (Kg)</label>
                             <input type="number" value={invoiceForm.weight} onChange={e => setInvoiceForm({...invoiceForm, weight: Number(e.target.value) as any})} className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-center font-black lg:text-2xl outline-none focus:border-metro-orange" />
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
