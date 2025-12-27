
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
import { toPersianDigits, getTodayJalali, normalizeDate, isDateInRange } from '../../utils/dateUtils';
import { compareProducts, compareFarms } from '../../utils/sortUtils';
import { useConfirm } from '../../hooks/useConfirm';
import Modal from '../common/Modal';
import { useDebounce } from '../../hooks/useDebounce';
import PersianNumberInput from '../common/PersianNumberInput';
import PlateInput from '../common/PlateInput';

type ReportTab = 'stats' | 'invoices' | 'create';
type CreateSubTab = 'stats' | 'invoice';

const Reports: React.FC = () => {
    const { farms, products, getProductById } = useFarmStore();
    const { statistics, deleteStatistic, updateStatistic, addStatistic, fetchStatistics } = useStatisticsStore();
    const { invoices, deleteInvoice, updateInvoice, addInvoice, fetchInvoices } = useInvoiceStore();
    const { addToast } = useToastStore();
    const { confirm } = useConfirm();
    const { user: currentUser } = useAuthStore();

    const isAdmin = currentUser?.role === UserRole.ADMIN;

    const [reportTab, setReportTab] = useState<ReportTab>('invoices');
    const [createSubTab, setCreateSubTab] = useState<CreateSubTab>('stats');
    
    // Search & Filter State
    const [selectedFarmId, setSelectedFarmId] = useState<string>('all');
    const [selectedProductId, setSelectedProductId] = useState<string>('all');
    const [startDate, setStartDate] = useState(getTodayJalali());
    const [endDate, setEndDate] = useState(getTodayJalali());
    const [searchTerm, setSearchTerm] = useState('');
    
    const debouncedSearchTerm = useDebounce(searchTerm, 500);

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

    useEffect(() => {
        if (reportTab !== 'create') {
            handleSearch();
        }
    }, [debouncedSearchTerm, selectedFarmId, selectedProductId, startDate, endDate, reportTab, statistics, invoices]);

    const handleSearch = () => {
        setIsSearching(true);
        const start = normalizeDate(startDate);
        const end = normalizeDate(endDate);
        const term = debouncedSearchTerm.toLowerCase();

        setTimeout(() => {
            let data: any[] = [];
            
            // --- FILTER LOGIC ---
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

            // --- SORT LOGIC (TASK 1 & 2) ---
            // 1. Farm Name ASC
            // 2. Product Rank ASC
            // 3. Date DESC
            data.sort((a, b) => {
                const farmA = farms.find(f => f.id === a.farmId);
                const farmB = farms.find(f => f.id === b.farmId);
                
                // Compare Farms
                if (farmA && farmB) {
                    const farmDiff = compareFarms(farmA, farmB);
                    if (farmDiff !== 0) return farmDiff;
                }

                // Compare Products
                const prodA = getProductById(a.productId);
                const prodB = getProductById(b.productId);
                if (prodA && prodB) {
                    const prodDiff = compareProducts(prodA, prodB);
                    if (prodDiff !== 0) return prodDiff;
                }

                // Compare Date (Newest first)
                if (a.date !== b.date) {
                    return b.date.localeCompare(a.date);
                }

                return 0;
            });

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

    const handleCreateStat = async () => {
        if (!createFarmId || !createProductId) {
            addToast('لطفاً فارم و محصول را انتخاب کنید.', 'warning');
            return;
        }
        if (!createStat.prod && !createStat.prev) {
            addToast('لطفاً مقادیر تولید یا موجودی را وارد کنید.', 'warning');
            return;
        }

        const yes = await confirm({ title: 'ثبت آمار توسط مدیر', message: 'آیا اطمینان دارید؟', type: 'info' });
        if (yes) {
            const result = await addStatistic({
                farmId: createFarmId,
                date: normalizeDate(createDate),
                productId: createProductId,
                production: Number(createStat.prod) || 0,
                productionKg: Number(createStat.prodKg) || 0,
                previousBalance: Number(createStat.prev) || 0,
                previousBalanceKg: Number(createStat.prevKg) || 0,
                sales: 0, salesKg: 0, 
                currentInventory: (Number(createStat.prev) || 0) + (Number(createStat.prod) || 0),
                currentInventoryKg: (Number(createStat.prevKg) || 0) + (Number(createStat.prodKg) || 0)
            });

            if (result.success) {
                await fetchStatistics(); // Force update
                addToast('آمار با موفقیت توسط مدیر ثبت شد.', 'success');
                setCreateStat({ prod: '', prodKg: '', prev: '', prevKg: '' });
            } else {
                addToast(result.error || 'خطا', 'error');
            }
        }
    };

    const handleCreateInvoice = async () => {
        if (!createFarmId || !createProductId || !createInvoice.invoiceNumber) {
            addToast('لطفاً اطلاعات الزامی را تکمیل کنید.', 'warning');
            return;
        }

        const yes = await confirm({ title: 'ثبت حواله توسط مدیر', message: 'آیا اطمینان دارید؟', type: 'info' });
        if (yes) {
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
                await fetchInvoices(); // Force update
                addToast('حواله با موفقیت توسط مدیر ثبت شد.', 'success');
                setCreateInvoice({ invoiceNumber: '', cartons: '', weight: '', driver: '', plate: '', phone: '', desc: '' });
            } else {
                addToast(result.error || 'خطا', 'error');
            }
        }
    };

    const formatPlateVisual = (plate: string) => {
        if (!plate || !plate.includes('-')) return plate || '-';
        const parts = plate.split('-');
        if (parts.length === 4) return `${toPersianDigits(parts[3])} - ${toPersianDigits(parts[2])} ${parts[1]} ${toPersianDigits(parts[0])}`;
        return plate;
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
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-full max-w-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                <button onClick={() => setReportTab('invoices')} className={`flex-1 py-3 rounded-full font-bold transition-all ${reportTab === 'invoices' ? 'bg-white dark:bg-gray-700 text-metro-orange shadow-md' : 'text-gray-500'}`}>گزارش فروش</button>
                <button onClick={() => setReportTab('stats')} className={`flex-1 py-3 rounded-full font-bold transition-all ${reportTab === 'stats' ? 'bg-white dark:bg-gray-700 text-metro-blue shadow-md' : 'text-gray-500'}`}>آمار تولید</button>
                {isAdmin && <button onClick={() => setReportTab('create')} className={`flex-1 py-3 rounded-full font-bold transition-all ${reportTab === 'create' ? 'bg-white dark:bg-gray-700 text-purple-600 shadow-md' : 'text-gray-500'}`}>ایجاد آمار و حواله</button>}
            </div>

            {reportTab === 'create' && isAdmin ? (
                <div className="space-y-6">
                    <div className="flex justify-center gap-4">
                        <button onClick={() => setCreateSubTab('stats')} className={`px-6 py-2 rounded-xl font-bold transition-colors ${createSubTab === 'stats' ? 'bg-metro-blue text-white' : 'bg-gray-200 text-gray-600'}`}>ثبت آمار</button>
                        <button onClick={() => setCreateSubTab('invoice')} className={`px-6 py-2 rounded-xl font-bold transition-colors ${createSubTab === 'invoice' ? 'bg-metro-orange text-white' : 'bg-gray-200 text-gray-600'}`}>ثبت حواله</button>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                            <div>
                                <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">انتخاب فارم</label>
                                <select value={createFarmId} onChange={e => setCreateFarmId(e.target.value)} className="w-full p-3 border rounded-xl bg-white text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600">
                                    <option value="">انتخاب کنید</option>
                                    {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">انتخاب محصول</label>
                                <select value={createProductId} onChange={e => setCreateProductId(e.target.value)} className="w-full p-3 border rounded-xl bg-white text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600">
                                    <option value="">انتخاب کنید</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <JalaliDatePicker value={createDate} onChange={setCreateDate} label="تاریخ ثبت" />
                            </div>
                        </div>

                        {createSubTab === 'stats' ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-sm font-bold mb-1 text-gray-700 dark:text-gray-300">تولید (کارتن)</label><PersianNumberInput className="w-full p-3 border rounded-xl bg-white text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600" value={createStat.prod} onChange={v => setCreateStat({...createStat, prod: v})} /></div>
                                    <div><label className="block text-sm font-bold mb-1 text-gray-700 dark:text-gray-300">موجودی قبل (کارتن)</label><PersianNumberInput className="w-full p-3 border rounded-xl bg-white text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600" value={createStat.prev} onChange={v => setCreateStat({...createStat, prev: v})} /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-sm font-bold mb-1 text-gray-700 dark:text-gray-300">تولید (Kg)</label><PersianNumberInput className="w-full p-3 border rounded-xl bg-white text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600" value={createStat.prodKg} onChange={v => setCreateStat({...createStat, prodKg: v})} /></div>
                                    <div><label className="block text-sm font-bold mb-1 text-gray-700 dark:text-gray-300">موجودی قبل (Kg)</label><PersianNumberInput className="w-full p-3 border rounded-xl bg-white text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600" value={createStat.prevKg} onChange={v => setCreateStat({...createStat, prevKg: v})} /></div>
                                </div>
                                <Button onClick={handleCreateStat} className="w-full mt-4">ثبت آمار توسط مدیر</Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div><label className="block text-sm font-bold mb-1 text-gray-700 dark:text-gray-300">شماره حواله</label><PersianNumberInput className="w-full p-3 border rounded-xl bg-white text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600" value={createInvoice.invoiceNumber} onChange={v => setCreateInvoice({...createInvoice, invoiceNumber: v})} /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-sm font-bold mb-1 text-gray-700 dark:text-gray-300">تعداد کارتن</label><PersianNumberInput className="w-full p-3 border rounded-xl bg-white text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600" value={createInvoice.cartons} onChange={v => setCreateInvoice({...createInvoice, cartons: v})} /></div>
                                    <div><label className="block text-sm font-bold mb-1 text-gray-700 dark:text-gray-300">وزن (Kg)</label><PersianNumberInput className="w-full p-3 border rounded-xl bg-white text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600" value={createInvoice.weight} onChange={v => setCreateInvoice({...createInvoice, weight: v})} /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-sm font-bold mb-1 text-gray-700 dark:text-gray-300">نام راننده</label><input className="w-full p-3 border rounded-xl bg-white text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600" value={createInvoice.driver} onChange={e => setCreateInvoice({...createInvoice, driver: e.target.value})} /></div>
                                    <div><label className="block text-sm font-bold mb-1 text-gray-700 dark:text-gray-300">شماره تماس</label><PersianNumberInput className="w-full p-3 border rounded-xl bg-white text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600" value={createInvoice.phone} onChange={v => setCreateInvoice({...createInvoice, phone: v})} /></div>
                                </div>
                                
                                {/* PLATE INPUT ADDED HERE */}
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-gray-700 dark:text-gray-300">شماره پلاک</label>
                                    <PlateInput 
                                        value={createInvoice.plate} 
                                        onChange={v => setCreateInvoice({...createInvoice, plate: v})} 
                                    />
                                </div>

                                <div><label className="block text-sm font-bold mb-1 text-gray-700 dark:text-gray-300">توضیحات</label><input className="w-full p-3 border rounded-xl bg-white text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600" value={createInvoice.desc} onChange={e => setCreateInvoice({...createInvoice, desc: e.target.value})} /></div>
                                <Button onClick={handleCreateInvoice} className="w-full mt-4 bg-metro-orange hover:bg-orange-600">ثبت حواله توسط مدیر</Button>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    <div className={`bg-white dark:bg-gray-800 p-6 rounded-[28px] shadow-sm border-l-[12px] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end ${reportTab === 'invoices' ? 'border-metro-orange' : 'border-metro-blue'}`}>
                        {/* Filters */}
                        <div className="lg:col-span-4 mb-2">
                            <input type="text" placeholder="جستجو..." className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white text-gray-900 dark:bg-gray-900 dark:text-white font-bold outline-none focus:border-metro-blue transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <div><select value={selectedFarmId} onChange={e => setSelectedFarmId(e.target.value)} className="w-full p-4 border-2 border-gray-200 rounded-xl bg-white text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600"><option value="all">همه فارم‌ها</option>{farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
                        <div><select value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} className="w-full p-4 border-2 border-gray-200 rounded-xl bg-white text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600"><option value="all">همه محصولات</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                        <div><JalaliDatePicker value={startDate} onChange={setStartDate} label="از تاریخ" /></div>
                        <div><JalaliDatePicker value={endDate} onChange={setEndDate} label="تا تاریخ" /></div>
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
                                    {isSearching ? <tr><td colSpan={10} className="text-center py-20 text-gray-400">در حال جستجو...</td></tr> : previewData.length === 0 ? <tr><td colSpan={10} className="text-center py-20 text-gray-400 font-bold">رکوردی یافت نشد</td></tr> : (
                                        previewData.map(row => {
                                            const prod = getProductById(row.productId);
                                            const isEdited = row.updatedAt && row.updatedAt > row.createdAt + 2000;
                                            const isAdminCreated = row.creatorRole === UserRole.ADMIN;
                                            const displayTime = (!isAdminCreated || isAdmin) ? new Date(isEdited ? row.updatedAt : row.createdAt).toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'}) : '---';
                                            
                                            return (
                                            <tr key={row.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${isAdminCreated ? 'bg-purple-50/50 dark:bg-purple-900/10' : ''}`}>
                                                {reportTab === 'stats' ? <>
                                                    <td className="p-5 font-mono font-bold text-lg text-gray-800 dark:text-white">{toPersianDigits(row.date)}</td>
                                                    <td className="p-5 font-bold text-gray-800 dark:text-white">{farms.find(f => f.id === row.farmId)?.name}</td>
                                                    <td className="p-5 text-sm text-gray-500 font-bold">{prod?.name}</td>
                                                    <td className="p-5 text-center">{renderDualCell(row.production || 0, row.productionKg || 0, 'text-green-600', isEdited)}</td>
                                                    <td className="p-5 text-center">{renderDualCell(row.sales || 0, row.salesKg || 0, 'text-red-500', false)}</td>
                                                    <td className="p-5 text-center">{renderDualCell(row.currentInventory || 0, row.currentInventoryKg || 0, 'text-metro-blue', isEdited)}</td>
                                                    <td className="p-5">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-2 py-0.5 rounded-md font-bold text-xs ${isAdminCreated ? 'bg-purple-200 text-purple-800' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                                                                    {isAdminCreated ? 'ثبت توسط مدیر' : (row.creatorName || 'ناشناس')}
                                                                </span>
                                                                <div className="flex flex-col">
                                                                    <span className="font-mono text-[10px] opacity-60 text-gray-500 dark:text-gray-400">{toPersianDigits(displayTime)}</span>
                                                                    {isEdited && <span className="text-[9px] text-orange-500 font-bold">(ویرایش شده)</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </> : <>
                                                    <td className="p-5 font-mono font-bold text-lg text-gray-800 dark:text-white">{toPersianDigits(row.date)}</td>
                                                    <td className="p-5 text-center font-black text-xl lg:text-2xl tracking-widest text-metro-orange">{toPersianDigits(row.invoiceNumber)}</td>
                                                    <td className="p-5 font-bold text-gray-800 dark:text-white">{farms.find(f => f.id === row.farmId)?.name}</td>
                                                    <td className="p-5 font-bold text-gray-600 dark:text-gray-300">{prod?.name || '-'}</td>
                                                    <td className={`p-5 text-center font-black text-xl lg:text-2xl text-gray-800 dark:text-white ${isEdited ? 'bg-yellow-50 dark:bg-yellow-900/10 rounded' : ''}`}>{toPersianDigits(row.totalCartons || 0)}</td>
                                                    <td className={`p-5 text-center text-blue-600 font-black text-xl lg:text-2xl ${isEdited ? 'bg-yellow-50 dark:bg-yellow-900/10 rounded' : ''}`}>{toPersianDigits(row.totalWeight || 0)}</td>
                                                    <td className="p-5 font-mono font-bold text-sm text-gray-600 dark:text-gray-400">{toPersianDigits(row.driverPhone || '-')}</td>
                                                    <td className="p-5 font-bold text-gray-700 dark:text-gray-300">{row.driverName || '-'}</td>
                                                    <td className="p-5 font-mono text-sm text-gray-600 dark:text-gray-400">{formatPlateVisual(row.plateNumber || '') || '-'}</td>
                                                    <td className="p-5">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-2 py-0.5 rounded-md font-bold text-xs ${isAdminCreated ? 'bg-purple-200 text-purple-800' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                                                                    {isAdminCreated ? 'ثبت توسط مدیر' : (row.creatorName || 'ناشناس')}
                                                                </span>
                                                                <div className="flex flex-col">
                                                                    <span className="font-mono text-[10px] opacity-60 text-gray-500 dark:text-gray-400">{toPersianDigits(displayTime)}</span>
                                                                    {isEdited && <span className="text-[9px] text-orange-500 font-bold">(ویرایش شده)</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </>}
                                                {isAdmin && <td className="p-5 flex justify-center gap-2">
                                                    <button onClick={() => reportTab === 'stats' ? openStatEdit(row) : openInvoiceEdit(row)} className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"><Icons.Edit className="w-5 h-5"/></button>
                                                    <button onClick={() => reportTab === 'stats' ? handleDeleteStat(row.id) : handleDeleteInvoice(row.id)} className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full hover:bg-red-100 transition-colors"><Icons.Trash className="w-5 h-5"/></button>
                                                </td>}
                                            </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
            
            <Modal isOpen={!!editingStat} onClose={() => setEditingStat(null)} title="اصلاح مدیریتی آمار">
                <div className="space-y-6">
                     <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl text-sm font-bold text-purple-800 dark:text-purple-300 border border-purple-100 dark:border-purple-800">
                         شما در حال ویرایش با دسترسی مدیر هستید.
                     </div>
                     <div className="grid grid-cols-2 gap-4 lg:gap-6">
                         <div><label className="text-sm font-bold block mb-2 text-gray-700 dark:text-gray-300">تولید</label><input type="number" value={statForm.prod} onChange={e => setStatForm({...statForm, prod: e.target.value})} className="w-full p-3 border rounded-xl bg-white text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600" /></div>
                         <div><label className="text-sm font-bold block mb-2 text-gray-700 dark:text-gray-300">فروش</label><input type="number" value={statForm.sales} onChange={e => setStatForm({...statForm, sales: e.target.value})} className="w-full p-3 border rounded-xl bg-white text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600" /></div>
                     </div>
                     <div className="flex justify-end gap-2 mt-8">
                         <Button variant="secondary" onClick={() => setEditingStat(null)}>لغو</Button>
                         <Button onClick={saveStatEdit}>ذخیره</Button>
                     </div>
                </div>
            </Modal>

             <Modal isOpen={!!editingInvoice} onClose={() => setEditingInvoice(null)} title="ویرایش حواله (مدیریت)">
                <div className="space-y-6">
                     <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl text-sm font-bold text-purple-800 dark:text-purple-300">
                         ویرایش حواله باعث بروزرسانی خودکار موجودی انبار خواهد شد.
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                         <div><label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">تعداد کارتن</label><input type="number" value={invoiceForm.cartons} onChange={e => setInvoiceForm({...invoiceForm, cartons: e.target.value})} className="w-full p-3 border rounded-xl bg-white text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600" /></div>
                         <div><label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">وزن (Kg)</label><input type="number" value={invoiceForm.weight} onChange={e => setInvoiceForm({...invoiceForm, weight: e.target.value})} className="w-full p-3 border rounded-xl bg-white text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600" /></div>
                     </div>
                     <div className="flex justify-end gap-2 mt-6">
                         <Button variant="secondary" onClick={() => setEditingInvoice(null)}>لغو</Button>
                         <Button onClick={saveInvoiceEdit}>ذخیره</Button>
                     </div>
                </div>
            </Modal>
        </div>
    );
};

export default Reports;
