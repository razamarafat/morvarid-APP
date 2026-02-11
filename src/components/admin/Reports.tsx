import React, { useState, useEffect, useCallback } from 'react';
import { useFarmStore } from '../../store/farmStore';
import { useStatisticsStore } from '../../store/statisticsStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useToastStore } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../types';
import { toPersianDigits, getTodayJalali, normalizeDate, isDateInRange } from '../../utils/dateUtils';
import { formatPlateNumber, formatPlateNumberForExcel } from '../../utils/formatUtils';
import { compareProducts, compareFarms } from '../../utils/sortUtils';
import { useConfirm } from '../../hooks/useConfirm';
import Modal from '../common/Modal';
import Button from '../common/Button';
import PersianNumberInput from '../common/PersianNumberInput';
import PlateInput from '../common/PlateInput';
import { exportTableToExcel } from '../../utils/excel';

// Enterprise Sub-components
import ReportsFilterBar from './reports/ReportsFilterBar';
import StatsTable from './reports/StatsTable';
import InvoicesTable from './reports/InvoicesTable';
import ReportsCreateForm from './reports/ReportsCreateForm';

type ReportTab = 'stats' | 'invoices' | 'create';
type CreateSubTab = 'stats' | 'invoice';

const Reports: React.FC = () => {
    // --- STORES ---
    const { farms, products, getProductById } = useFarmStore();
    const { statistics, deleteStatistic, updateStatistic, addStatistic, fetchStatistics } = useStatisticsStore();
    const { invoices, deleteInvoice, updateInvoice, addInvoice, fetchInvoices } = useInvoiceStore();
    const { addToast } = useToastStore();
    const { confirm } = useConfirm();
    const { user: currentUser } = useAuthStore();

    const isAdmin = currentUser?.role === UserRole.ADMIN;

    // --- STATE ---
    const [reportTab, setReportTab] = useState<ReportTab>('invoices');
    const [createSubTab, setCreateSubTab] = useState<CreateSubTab>('stats');

    // Search & Filter State
    const [selectedFarmId, setSelectedFarmId] = useState<string>('all');
    const [selectedProductId, setSelectedProductId] = useState<string>('all');
    const [startDate, setStartDate] = useState(getTodayJalali());
    const [endDate, setEndDate] = useState(getTodayJalali());
    const [searchTerm, setSearchTerm] = useState('');

    const [previewData, setPreviewData] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Edit State
    const [editingStat, setEditingStat] = useState<any | null>(null);
    const [editingInvoice, setEditingInvoice] = useState<any | null>(null);

    const [statForm, setStatForm] = useState({ prod: '', sales: '', prev: '', prodKg: '', salesKg: '', prevKg: '' });
    const [invoiceForm, setInvoiceForm] = useState({ invoiceNumber: '', cartons: '', weight: '', driver: '', plate: '', phone: '', desc: '' });

    // Create State
    const [createFarmId, setCreateFarmId] = useState('');
    const [createProductId, setCreateProductId] = useState('');
    const [createDate, setCreateDate] = useState(getTodayJalali());
    const [createStat, setCreateStat] = useState({ prod: '', prodKg: '', prev: '', prevKg: '' });
    const [createInvoice, setCreateInvoice] = useState({ invoiceNumber: '', cartons: '', weight: '', driver: '', plate: '', phone: '', desc: '' });

    // --- LOGIC: SEARCH ---
    const handleSearch = useCallback(() => {
        if (reportTab === 'create') return;

        setIsSearching(true);
        const start = normalizeDate(startDate);
        const end = normalizeDate(endDate);
        const term = searchTerm.trim().toLowerCase();

        // Use a small timeout to allow UI to show loading state
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
            } else if (reportTab === 'invoices') {
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

            // --- SORT LOGIC ---
            data.sort((a, b) => {
                const farmA = farms.find(f => f.id === a.farmId);
                const farmB = farms.find(f => f.id === b.farmId);
                if (farmA && farmB) {
                    const farmDiff = compareFarms(farmA, farmB);
                    if (farmDiff !== 0) return farmDiff;
                }

                const prodA = getProductById(a.productId);
                const prodB = getProductById(b.productId);
                if (prodA && prodB) {
                    const prodDiff = compareProducts(prodA, prodB);
                    if (prodDiff !== 0) return prodDiff;
                }

                if (a.date !== b.date) return b.date.localeCompare(a.date);
                return 0;
            });

            setPreviewData(data);
            setIsSearching(false);
        }, 50);
    }, [reportTab, startDate, endDate, searchTerm, selectedFarmId, selectedProductId, statistics, invoices, farms, getProductById]);

    // Initial load
    useEffect(() => {
        handleSearch();
    }, [handleSearch]);

    // --- LOGIC: EXPORT ---
    const handleExportExcel = async () => {
        let exportData = [];
        if (reportTab === 'stats') {
            exportData = previewData.map(s => {
                const farm = farms.find(f => f.id === s.farmId);
                const prod = products.find(p => p.id === s.productId);
                return {
                    'تاریخ': s.date,
                    'فارم': farm?.name,
                    'محصول': prod?.name,
                    'تولید (کارتن)': s.production,
                    'تولید (Kg)': s.productionKg,
                    'موجودی': s.currentInventory,
                    'ثبت کننده': s.creatorName,
                    'زمان ثبت': new Date(s.createdAt).toLocaleTimeString('fa-IR')
                };
            });
        } else {
            exportData = previewData.map(i => {
                const farm = farms.find(f => f.id === i.farmId);
                const prod = products.find(p => p.id === i.productId);
                return {
                    'تاریخ': i.date,
                    'شماره حواله': i.invoiceNumber,
                    'فارم': farm?.name,
                    'محصول': prod?.name,
                    'کارتن': i.totalCartons,
                    'وزن': i.totalWeight,
                    'راننده': i.driverName,
                    'شماره تماس': i.driverPhone,
                    'پلاک': formatPlateNumberForExcel(i.plateNumber),
                    'ثبت کننده': i.creatorName
                };
            });
        }
        if (await exportTableToExcel(exportData, `Morvarid_Report_${reportTab}_${getTodayJalali()}`)) {
            addToast('خروجی اکسل با موفقیت دانلود شد', 'success');
        } else {
            addToast('داده‌ای برای خروجی وجود ندارد', 'warning');
        }
    };

    // --- LOGIC: ACTIONS ---
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

    // --- LOGIC: EDITS ---
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

    // --- LOGIC: CREATES ---
    const handleSubmitCreate = async () => {
        if (!createFarmId || !createProductId) {
            addToast('لطفاً فارم و محصول را انتخاب کنید.', 'warning');
            return;
        }

        const yes = await confirm({
            title: createSubTab === 'stats' ? 'ثبت آمار توسط مدیر' : 'ثبت حواله توسط مدیر',
            message: 'آیا از صحت اطلاعات وارد شده اطمینان دارید؟',
            type: 'info'
        });

        if (!yes) return;

        if (createSubTab === 'stats') {
            const result = await addStatistic({
                farmId: createFarmId,
                date: normalizeDate(createDate),
                productId: createProductId,
                production: Number(createStat.prod) || 0,
                productionKg: Number(createStat.prodKg) || 0,
                previousBalance: Number(createStat.prev) || 0,
                previousBalanceKg: Number(createStat.prevKg) || 0,
                sales: 0,
                salesKg: 0,
                currentInventory: (Number(createStat.prev) || 0) + (Number(createStat.prod) || 0),
                currentInventoryKg: (Number(createStat.prevKg) || 0) + (Number(createStat.prodKg) || 0)
            });
            if (result.success) {
                addToast('آمار با موفقیت ثبت شد.', 'success');
                setCreateStat({ prod: '', prodKg: '', prev: '', prevKg: '' });
                fetchStatistics();
            } else {
                addToast(result.error || 'خطا در ثبت آمار', 'error');
            }
        } else {
            if (!createInvoice.invoiceNumber) {
                addToast('شماره حواله الزامی است.', 'warning');
                return;
            }
            const result = await addInvoice({
                farmId: createFarmId,
                date: normalizeDate(createDate),
                productId: createProductId,
                invoiceNumber: createInvoice.invoiceNumber,
                totalCartons: Number(createInvoice.cartons) || 0,
                totalWeight: Number(createInvoice.weight) || 0,
                driverName: createInvoice.driver,
                driverPhone: createInvoice.phone,
                plateNumber: createInvoice.plate,
                description: createInvoice.desc,
                isYesterday: false
            });
            if (result.success) {
                addToast('حواله با موفقیت ثبت شد.', 'success');
                setCreateInvoice({ invoiceNumber: '', cartons: '', weight: '', driver: '', plate: '', phone: '', desc: '' });
                fetchInvoices();
            } else {
                addToast(result.error || 'خطا در ثبت حواله', 'error');
            }
        }
    };

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto pb-20">
            {/* Top Navigation */}
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl max-w-2xl shadow-sm border border-gray-200 dark:border-gray-700 mx-auto md:mx-0">
                <button
                    onClick={() => setReportTab('invoices')}
                    className={`flex-1 py-3 px-6 rounded-xl font-bold transition-all ${reportTab === 'invoices' ? 'bg-white dark:bg-gray-700 text-metro-orange shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    گزارش فروش
                </button>
                <button
                    onClick={() => setReportTab('stats')}
                    className={`flex-1 py-3 px-6 rounded-xl font-bold transition-all ${reportTab === 'stats' ? 'bg-white dark:bg-gray-700 text-metro-blue shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    آمار تولید
                </button>
                {isAdmin && (
                    <button
                        onClick={() => setReportTab('create')}
                        className={`flex-1 py-3 px-6 rounded-xl font-bold transition-all ${reportTab === 'create' ? 'bg-white dark:bg-gray-700 text-purple-600 shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        پنل مدیریت
                    </button>
                )}
            </div>

            {reportTab === 'create' && isAdmin ? (
                <ReportsCreateForm
                    subTab={createSubTab}
                    onSubTabChange={setCreateSubTab}
                    farms={farms}
                    products={products}
                    createFarmId={createFarmId}
                    onFarmChange={setCreateFarmId}
                    createProductId={createProductId}
                    onProductChange={setCreateProductId}
                    createDate={createDate}
                    onDateChange={setCreateDate}
                    statForm={createStat}
                    onStatFormChange={u => setCreateStat(s => ({ ...s, ...u }))}
                    invoiceForm={createInvoice}
                    onInvoiceFormChange={u => setCreateInvoice(s => ({ ...s, ...u }))}
                    onSubmit={handleSubmitCreate}
                />
            ) : (
                <>
                    <ReportsFilterBar
                        reportTab={reportTab as 'stats' | 'invoices'}
                        onTabChange={t => setReportTab(t)}
                        farms={farms}
                        products={products}
                        selectedFarmId={selectedFarmId}
                        onFarmChange={setSelectedFarmId}
                        selectedProductId={selectedProductId}
                        onProductChange={setSelectedProductId}
                        startDate={startDate}
                        onStartDateChange={setStartDate}
                        endDate={endDate}
                        onEndDateChange={setEndDate}
                        searchTerm={searchTerm}
                        onSearchTermChange={setSearchTerm}
                        onRefresh={handleSearch}
                        onExport={handleExportExcel}
                        isSearching={isSearching}
                    />

                    {reportTab === 'stats' ? (
                        <StatsTable
                            data={previewData}
                            isSearching={isSearching}
                            isAdmin={isAdmin}
                            farms={farms}
                            products={products}
                            getProductById={getProductById}
                            onEdit={openStatEdit}
                            onDelete={handleDeleteStat}
                        />
                    ) : (
                        <InvoicesTable
                            data={previewData}
                            isSearching={isSearching}
                            isAdmin={isAdmin}
                            farms={farms}
                            getProductById={getProductById}
                            onEdit={openInvoiceEdit}
                            onDelete={handleDeleteInvoice}
                        />
                    )}
                </>
            )}

            {/* --- MODALS --- */}
            <Modal isOpen={!!editingStat} onClose={() => setEditingStat(null)} title="اصلاح مدیریتی آمار">
                <div className="grid grid-cols-2 gap-4 p-6">
                    <PersianNumberInput label="تولید (کارتن)" value={statForm.prod} onChange={v => setStatForm(s => ({ ...s, prod: v }))} />
                    <PersianNumberInput label="تولید (Kg)" value={statForm.prodKg} onChange={v => setStatForm(s => ({ ...s, prodKg: v }))} />
                    <PersianNumberInput label="مانده قبلی (کارتن)" value={statForm.prev} onChange={v => setStatForm(s => ({ ...s, prev: v }))} />
                    <PersianNumberInput label="مانده قبلی (Kg)" value={statForm.prevKg} onChange={v => setStatForm(s => ({ ...s, prevKg: v }))} />
                    <div className="col-span-2 mt-6 flex gap-3">
                        <Button onClick={saveStatEdit} variant="primary" className="flex-1 h-12 rounded-xl font-bold">ذخیره تغییرات</Button>
                        <Button onClick={() => setEditingStat(null)} variant="secondary" className="px-6 h-12 rounded-xl font-bold">انصراف</Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={!!editingInvoice} onClose={() => setEditingInvoice(null)} title="ویرایش حواله (مدیریت)">
                <div className="grid grid-cols-2 gap-4 p-6">
                    <PersianNumberInput label="شماره حواله" value={invoiceForm.invoiceNumber} onChange={v => setInvoiceForm(s => ({ ...s, invoiceNumber: v }))} />
                    <PersianNumberInput label="کارتن" value={invoiceForm.cartons} onChange={v => setInvoiceForm(s => ({ ...s, cartons: v }))} />
                    <PersianNumberInput label="وزن" value={invoiceForm.weight} onChange={v => setInvoiceForm(s => ({ ...s, weight: v }))} />
                    <div className="w-full">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1 px-1">نام راننده</label>
                        <input type="text" className="w-full h-12 px-4 border rounded-xl dark:bg-gray-900" value={invoiceForm.driver} onChange={e => setInvoiceForm(s => ({ ...s, driver: e.target.value }))} />
                    </div>
                    <PersianNumberInput label="شماره تماس" value={invoiceForm.phone} onChange={v => setInvoiceForm(s => ({ ...s, phone: v }))} />
                    <PlateInput label="پلاک" value={invoiceForm.plate} onChange={(v: string) => setInvoiceForm(s => ({ ...s, plate: v }))} />
                    <div className="col-span-2">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1 px-1">توضیحات</label>
                        <textarea className="w-full p-3 border rounded-xl dark:bg-gray-900" value={invoiceForm.desc} onChange={e => setInvoiceForm(s => ({ ...s, desc: e.target.value }))} />
                    </div>
                    <div className="col-span-2 mt-6 flex gap-3">
                        <Button onClick={saveInvoiceEdit} variant="primary" className="flex-1 h-12 rounded-xl font-bold">ذخیره تغییرات</Button>
                        <Button onClick={() => setEditingInvoice(null)} variant="secondary" className="px-6 h-12 rounded-xl font-bold">انصراف</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Reports;
