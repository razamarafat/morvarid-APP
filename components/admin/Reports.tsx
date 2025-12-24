
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
    // Destructure statistics directly so component re-renders when they change
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
                // Use the reactive 'statistics' variable from the hook
                data = statistics.filter(s => {
                    const farmMatch = selectedFarmId === 'all' || s.farmId === selectedFarmId;
                    const prodMatch = selectedProductId === 'all' || s.productId === selectedProductId;
                    return farmMatch && prodMatch && isDateInRange(s.date, start, end);
                });
            } else {
                // Use the reactive 'invoices' variable from the hook
                data = invoices.filter(i => {
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

    const formatPlateForExcel = (plate: string) => {
        if (!plate || !plate.includes('-')) return plate;
        const parts = plate.split('-');
        if (parts.length === 4) {
            // LOGICAL STRING FORMAT: (Iran) - (3Digits) (Letter) (2Digits)
            // Example: 60 - 169 M 39
            // When Sheet Direction is RTL, this will render with 60 on the Right.
            return `${parts[3]} - ${parts[2]} ${parts[1]} ${parts[0]}`;
        }
        return plate;
    };

    // Helper to detect liquid/weight-based records robustly
    const isStatLiquid = (stat: any, prod?: any) => {
        if (prod?.name?.includes('مایع')) return true;
        if (prod?.hasKilogramUnit) return true;
        // Fallback: If production unit is 0 but weight > 0, treat as liquid/weight-based
        if ((stat.production === 0 || stat.production === undefined) && (stat.productionKg > 0)) return true;
        return false;
    };

    const handleExportExcel = () => {
        if (previewData.length === 0) return;
        
        // --- UNIVERSAL STYLE: Font 18, Bold, Right Aligned ---
        // Setting Koodak font and Bold for ALL cells
        const commonStyle = {
            font: { name: "Koodak", sz: 18, bold: true },
            alignment: { horizontal: "right", vertical: "center", wrapText: true } 
        };

        // --- INVOICE SPECIFIC STYLE: Red Text + Universal Style ---
        const invoiceStyle = {
            font: { name: "Koodak", sz: 18, bold: true, color: { rgb: "FF0000" } },
            alignment: { horizontal: "right", vertical: "center", wrapText: true }
        };

        // --- HEADER STYLE: Grey Bg + Universal Style ---
        const headerStyle = {
            font: { name: "Koodak", sz: 18, bold: true },
            alignment: { horizontal: "right", vertical: "center", wrapText: true },
            fill: { fgColor: { rgb: "E0E0E0" } }
        };

        let wsData: any[] = [];
        let headers: string[] = [];

        // Helper to wrap value in style object
        const cell = (v: any, style: any = commonStyle) => ({ v: v, s: style });

        if (reportTab === 'stats') {
            headers = ['تاریخ', 'فارم', 'محصول', 'تولید', 'فروش', 'موجودی', 'مسئول ثبت', 'ساعت ثبت', 'آخرین ویرایش'];
            // Wrap headers
            const headerRow = headers.map(h => cell(h, headerStyle));
            
            const rows = previewData.map(item => {
                const prod = getProductById(item.productId);
                const isLiquid = isStatLiquid(item, prod);
                
                return [
                    cell(item.date),
                    cell(farms.find(f => f.id === item.farmId)?.name || '-'),
                    cell(prod?.name || '-'),
                    cell(isLiquid ? `${item.productionKg || 0} Kg` : item.production || 0),
                    cell(isLiquid ? `${item.salesKg || 0} Kg` : item.sales || 0),
                    cell(isLiquid ? `${item.currentInventoryKg || 0} Kg` : item.currentInventory || 0),
                    cell(item.creatorName || '-'),
                    cell(new Date(item.createdAt).toLocaleTimeString('fa-IR')),
                    cell(item.updatedAt ? new Date(item.updatedAt).toLocaleString('fa-IR') : '-')
                ];
            });
            wsData = [headerRow, ...rows];

        } else {
            headers = ['تاریخ', 'رمز حواله', 'فارم', 'نوع محصول', 'تعداد', 'وزن', 'شماره تماس', 'راننده', 'پلاک', 'مسئول ثبت', 'ساعت ثبت', 'آخرین ویرایش'];
            // Wrap headers
            const headerRow = headers.map(h => cell(h, headerStyle));

            const rows = previewData.map(item => {
                return [
                    cell(item.date),
                    cell(item.invoiceNumber, invoiceStyle), // Apply Red Style
                    cell(farms.find(f => f.id === item.farmId)?.name || '-'),
                    cell(products.find(p => p.id === item.productId)?.name || '-'),
                    cell(item.totalCartons || 0),
                    cell(item.totalWeight || 0),
                    cell(item.driverPhone || '-'),
                    cell(item.driverName || '-'),
                    cell(formatPlateForExcel(item.plateNumber)), // Apply Plate Logic
                    cell(item.creatorName || '-'),
                    cell(new Date(item.createdAt).toLocaleTimeString('fa-IR')),
                    cell(item.updatedAt ? new Date(item.updatedAt).toLocaleString('fa-IR') : '-')
                ];
            });
            wsData = [headerRow, ...rows];
        }

        // Create Sheet directly from Object Data
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // --- GLOBAL RTL SETTINGS ---
        // CRITICAL: Set Worksheet Direction to RTL.
        // This ensures the plate logic (which puts numbers first) renders right-to-left.
        ws['!dir'] = 'rtl';
        ws['!views'] = [{ rightToLeft: true }];
        
        // --- COLUMN WIDTHS (Optimized for Font 18) ---
        // Increased base width for larger font
        const colWidths = headers.map((header, i) => {
            // Tighter packing for Driver and Product
            if (header === 'نوع محصول' || header === 'راننده' || header === 'فارم') {
                 return { wch: 30 }; 
            }
            if (header === 'پلاک') return { wch: 35 };
            if (header === 'رمز حواله') return { wch: 25 };
            
            // Default wide width for Font 18
            return { wch: 25 }; 
        });
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        wb.Workbook = { Views: [{ RTL: true }] };

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
                        <option value="all">همه فارم‌های فعال</option>
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
                    <table className="w-full text-right border-collapse min-w-[1200px]">
                        <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 font-black text-xs lg:text-sm uppercase tracking-wider">
                            <tr>
                                {reportTab === 'stats' ? <>
                                    <th className="p-5">تاریخ</th><th className="p-5">فارم</th><th className="p-5">محصول</th><th className="p-5 text-center">تولید</th><th className="p-5 text-center">فروش</th><th className="p-5 text-center">موجودی</th><th className="p-5">اطلاعات ثبت</th>{isAdmin && <th className="p-5 text-center">عملیات</th>}
                                </> : <>
                                    <th className="p-5">تاریخ</th><th className="p-5 text-center">رمز حواله</th><th className="p-5">فارم</th><th className="p-5">نوع محصول</th><th className="p-5 text-center">تعداد</th><th className="p-5 text-center">وزن</th><th className="p-5">شماره تماس</th><th className="p-5">راننده</th><th className="p-5">پلاک</th><th className="p-5">اطلاعات ثبت</th>{isAdmin && <th className="p-5 text-center">عملیات</th>}
                                </>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {previewData.map(row => {
                                const prod = getProductById(row.productId);
                                // Improved liquid detection fallback
                                const isLiquid = isStatLiquid(row, prod);

                                return (
                                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    {reportTab === 'stats' ? <>
                                        <td className="p-5 font-mono font-bold text-lg">{toPersianDigits(row.date)}</td>
                                        <td className="p-5 font-bold text-gray-800 dark:text-white">{farms.find(f => f.id === row.farmId)?.name}</td>
                                        <td className="p-5 text-sm text-gray-500 font-bold">{prod?.name}</td>
                                        <td className="p-5 text-center font-black text-xl lg:text-2xl">
                                            {isLiquid ? <span className="text-blue-600">{toPersianDigits(row.productionKg || 0)} <small className="text-[10px]">Kg</small></span> : <span className="text-green-600">+{toPersianDigits(row.production || 0)}</span>}
                                        </td>
                                        <td className="p-5 text-center font-black text-xl lg:text-2xl text-red-500">
                                            -{toPersianDigits(isLiquid ? (row.salesKg || 0) : (row.sales || 0))}
                                        </td>
                                        <td className="p-5 text-center font-black text-xl lg:text-2xl text-metro-blue">
                                            {toPersianDigits(isLiquid ? (row.currentInventoryKg || 0) : (row.currentInventory || 0))}
                                        </td>
                                        <td className="p-5">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-md font-bold text-xs">{row.creatorName || 'ناشناس'}</span>
                                                    <span className="font-mono text-[10px] opacity-60">{new Date(row.createdAt).toLocaleTimeString('fa-IR')}</span>
                                                </div>
                                                {row.updatedAt && (
                                                    <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold">
                                                        ویرایش: {new Date(row.updatedAt).toLocaleTimeString('fa-IR')}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </> : <>
                                        <td className="p-5 font-mono font-bold text-lg">{toPersianDigits(row.date)}</td>
                                        <td className="p-5 text-center font-black text-xl lg:text-2xl tracking-widest text-metro-orange">{toPersianDigits(row.invoiceNumber)}</td>
                                        <td className="p-5 font-bold text-gray-800 dark:text-white">{farms.find(f => f.id === row.farmId)?.name}</td>
                                        <td className="p-5 font-bold text-gray-600 dark:text-gray-300">{prod?.name || '-'}</td>
                                        <td className="p-5 text-center font-black text-xl lg:text-2xl">{toPersianDigits(row.totalCartons || 0)}</td>
                                        <td className="p-5 text-center text-blue-600 font-black text-xl lg:text-2xl">{toPersianDigits(row.totalWeight || 0)}</td>
                                        <td className="p-5 font-mono font-bold text-sm">{toPersianDigits(row.driverPhone || '-')}</td>
                                        <td className="p-5 font-bold">{row.driverName || '-'}</td>
                                        <td className="p-5 font-mono text-sm">{formatPlateForExcel(row.plateNumber) || '-'}</td>
                                        <td className="p-5">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-md font-bold text-xs">{row.creatorName || 'ناشناس'}</span>
                                                    <span className="font-mono text-[10px] opacity-60">{new Date(row.createdAt).toLocaleTimeString('fa-IR')}</span>
                                                </div>
                                                {row.updatedAt && (
                                                    <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold">
                                                        ویرایش: {new Date(row.updatedAt).toLocaleTimeString('fa-IR')}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </>}
                                    {isAdmin && <td className="p-5 flex justify-center gap-2">
                                        <button onClick={() => reportTab === 'stats' ? openStatEdit(row) : openInvoiceEdit(row)} className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"><Icons.Edit className="w-5 h-5"/></button>
                                        <button onClick={() => reportTab === 'stats' ? handleDeleteStat(row.id) : handleDeleteInvoice(row.id)} className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"><Icons.Trash className="w-5 h-5"/></button>
                                    </td>}
                                </tr>
                            )})}
                        </tbody>
                    </table>
                    {previewData.length === 0 && hasSearched && <div className="p-20 text-center text-gray-400 font-bold text-xl">داده‌ای یافت نشد.</div>}
                </div>
            </div>
            
            <Modal isOpen={!!editingStat} onClose={() => setEditingStat(null)} title="اصلاح مدیریتی آمار">
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-xs font-bold mb-2 block mr-1 dark:text-gray-300">تولید (تعداد)</label><input type="number" value={statForm.prod} onChange={e => setStatForm({...statForm, prod: e.target.value})} className="w-full p-4 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl text-center font-black text-2xl outline-none border-none focus:ring-2 focus:ring-metro-blue"/></div>
                        <div><label className="text-xs font-bold mb-2 block mr-1 dark:text-gray-300">فروش (تعداد)</label><input type="number" value={statForm.sales} onChange={e => setStatForm({...statForm, sales: e.target.value})} className="w-full p-4 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl text-center font-black text-2xl outline-none border-none focus:ring-2 focus:ring-metro-blue"/></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 border-t pt-4 border-dashed border-gray-300 dark:border-gray-600">
                        <div><label className="text-xs font-bold mb-2 block mr-1 dark:text-gray-300">تولید (Kg)</label><input type="number" step="0.1" value={statForm.prodKg} onChange={e => setStatForm({...statForm, prodKg: e.target.value})} className="w-full p-4 bg-blue-50/50 dark:bg-blue-900/10 dark:text-white rounded-xl text-center font-black text-2xl outline-none border-none focus:ring-2 focus:ring-blue-500"/></div>
                        <div><label className="text-xs font-bold mb-2 block mr-1 dark:text-gray-300">فروش (Kg)</label><input type="number" step="0.1" value={statForm.salesKg} onChange={e => setStatForm({...statForm, salesKg: e.target.value})} className="w-full p-4 bg-blue-50/50 dark:bg-blue-900/10 dark:text-white rounded-xl text-center font-black text-2xl outline-none border-none focus:ring-2 focus:ring-blue-500"/></div>
                    </div>
                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-700"><Button variant="secondary" onClick={() => setEditingStat(null)}>انصراف</Button><Button onClick={saveStatEdit}>ذخیره تغییرات مدیریت</Button></div>
                </div>
            </Modal>

            <Modal isOpen={!!editingInvoice} onClose={() => setEditingInvoice(null)} title="اصلاح مدیریتی حواله">
                <div className="space-y-6">
                    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl"><label className="block text-sm font-bold mb-2 text-gray-500 dark:text-gray-400">رمز حواله</label><input type="text" value={invoiceForm.invoiceNumber} onChange={e => setInvoiceForm({...invoiceForm, invoiceNumber: e.target.value})} className="w-full p-3 bg-white dark:bg-gray-800 dark:text-white border-2 border-orange-300 rounded-lg text-center font-black text-3xl tracking-widest outline-none"/></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-xs font-bold mb-2 block mr-1 dark:text-gray-300">تعداد</label><input type="number" value={invoiceForm.cartons} onChange={e => setInvoiceForm({...invoiceForm, cartons: e.target.value})} className="w-full p-4 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl text-center font-black text-2xl outline-none border-none focus:ring-2 focus:ring-metro-orange"/></div>
                        <div><label className="text-xs font-bold mb-2 block mr-1 dark:text-gray-300">وزن (Kg)</label><input type="number" step="0.1" value={invoiceForm.weight} onChange={e => setInvoiceForm({...invoiceForm, weight: e.target.value})} className="w-full p-4 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl text-center font-black text-2xl outline-none border-none focus:ring-2 focus:ring-metro-orange"/></div>
                    </div>
                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-700"><Button variant="secondary" onClick={() => setEditingInvoice(null)}>انصراف</Button><Button onClick={saveInvoiceEdit}>ذخیره اصلاحیه مدیریت</Button></div>
                </div>
            </Modal>
        </div>
    );
};

export default Reports;
