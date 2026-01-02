import React, { useState, useMemo, useEffect } from 'react';
import { useStatisticsStore, DailyStatistic } from '../../store/statisticsStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useFarmStore } from '../../store/farmStore';
import { useAuthStore } from '../../store/authStore';
import { UserRole, Invoice } from '../../types';
import { Icons } from '../common/Icons';
import { useConfirm } from '../../hooks/useConfirm';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { useToastStore } from '../../store/toastStore';
import { toPersianDigits, getTodayJalali, normalizeDate, isDateInRange, formatJalali } from '../../utils/dateUtils';
import { compareProducts } from '../../utils/sortUtils';
import JalaliDatePicker from '../common/JalaliDatePicker';
import PersianNumberInput from '../common/PersianNumberInput';
import PlateInput from '../common/PlateInput';
// Removed virtualization imports for better layout reliability
// import { FixedSizeList as List } from 'react-window';
// import AutoSizer from 'react-virtualized-auto-sizer';

// Unified Record Card for Statistics
const StatRecordCard = ({ stat, getProductName, canEdit, onEdit, onDelete }: { stat: DailyStatistic, getProductName: (id: string) => string, canEdit: (c: number, r?: string) => boolean, onEdit: (s: DailyStatistic) => void, onDelete: (s: DailyStatistic) => void }) => {
    const isAdminCreated = stat.creatorRole === UserRole.ADMIN;
    const isEdited = stat.updatedAt && stat.updatedAt > stat.createdAt + 2000;
    const prodName = getProductName(stat.productId);

    return (
        <div className={`bg-white dark:bg-gray-800 p-4 rounded-xl border-2 ${isAdminCreated ? 'border-purple-200 dark:border-purple-900/30 bg-purple-50/30' : 'border-gray-100 dark:border-gray-700'} relative shadow-sm`}>
            <div className="flex justify-between items-center mb-3">
                <div className="flex gap-2 items-center">
                    <span className="text-[10px] font-black bg-blue-50 dark:bg-blue-900/20 text-blue-600 px-2 py-1 rounded-md">
                        {toPersianDigits(stat.date)}
                    </span>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{prodName}</span>
                    {isAdminCreated && <span className="text-[9px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">ثبت مدیر</span>}
                </div>
                <div className="flex gap-2">
                    {canEdit(stat.createdAt, stat.creatorRole) ? (
                        <>
                            <button onClick={() => onEdit(stat)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Icons.Edit className="w-4 h-4" /></button>
                            <button onClick={() => onDelete(stat)} className="p-1.5 bg-red-50 text-red-600 rounded-lg"><Icons.Trash className="w-4 h-4" /></button>
                        </>
                    ) : (
                        <Icons.Lock className="w-4 h-4 text-gray-300" />
                    )}
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg">
                    <span className="block text-[9px] text-gray-400">تولید</span>
                    <span className="font-black text-sm">{toPersianDigits(stat.production)}</span>
                </div>
                <div className="bg-red-50 dark:bg-red-900/10 p-2 rounded-lg">
                    <span className="block text-[9px] text-red-300">فروش</span>
                    <span className="font-black text-sm text-red-600">{toPersianDigits(stat.sales)}</span>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/10 p-2 rounded-lg">
                    <span className="block text-[9px] text-blue-300">موجودی</span>
                    <span className="font-black text-sm text-blue-700">{toPersianDigits(stat.currentInventory)}</span>
                </div>
            </div>

            <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center text-[9px] text-gray-400">
                <span>مسئول ثبت: {stat.creatorName || 'ناشناس'}</span>
                {isEdited && <span className="text-orange-500 font-bold">● ویرایش شده</span>}
            </div>
        </div>
    );
};

// Unified Record Card for Invoices
const InvoiceRecordCard = ({ inv, getProductName, canEdit, onEdit, onDelete }: { inv: Invoice, getProductName: (id: string) => string, canEdit: (c: number, r?: string) => boolean, onEdit: (i: Invoice) => void, onDelete: (i: Invoice) => void }) => {
    const prodName = getProductName(inv.productId || '');
    const isAdminCreated = inv.creatorRole === UserRole.ADMIN;
    const isEdited = inv.updatedAt && inv.updatedAt > inv.createdAt + 2000;

    return (
        <div className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border-2 ${isAdminCreated ? 'border-purple-200 bg-purple-50/30' : 'border-gray-100 dark:border-gray-700'} relative`}>
            <div className="flex justify-between items-start mb-3">
                <div>
                    <span className="text-[10px] font-black text-metro-orange block mb-1">حواله {toPersianDigits(inv.invoiceNumber)}</span>
                    <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm">{prodName}</h4>
                    {isAdminCreated && <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold mt-1 inline-block">ثبت توسط مدیر</span>}
                    {isEdited && <span className="text-[9px] text-orange-500 font-bold mr-1"> (ویرایش شده)</span>}
                </div>
                <div className="flex gap-2">
                    {canEdit(inv.createdAt, inv.creatorRole) ? (
                        <>
                            <button onClick={() => onEdit(inv)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Icons.Edit className="w-4 h-4" /></button>
                            <button onClick={() => onDelete(inv)} className="p-1.5 bg-red-50 text-red-600 rounded-lg"><Icons.Trash className="w-4 h-4" /></button>
                        </>
                    ) : (
                        <Icons.Lock className="w-4 h-4 text-gray-300" />
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-gray-500 mb-3 bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg">
                <span className="font-bold">{toPersianDigits(inv.date)}</span>
                {inv.plateNumber && <span className="font-mono border-r pr-2 border-gray-300" dir="ltr">{inv.plateNumber}</span>}
                <span className="flex-1 text-left">{inv.creatorName}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-gray-950/20 p-2 rounded-xl text-center border border-gray-100 dark:border-gray-800">
                    <span className="block text-[10px] text-gray-400 font-bold">کارتن</span>
                    <span className="font-black text-lg">{toPersianDigits(inv.totalCartons)}</span>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/20 p-2 rounded-xl text-center border border-blue-100 dark:border-blue-900/20">
                    <span className="block text-[10px] text-blue-400 font-bold">وزن</span>
                    <span className="font-black text-lg text-blue-600">{toPersianDigits(inv.totalWeight)}</span>
                </div>
            </div>
        </div>
    );
};

const RecentRecords: React.FC = () => {
    const { statistics, fetchStatistics, deleteStatistic, updateStatistic, isLoading: statsLoading } = useStatisticsStore();
    const { invoices, fetchInvoices, deleteInvoice, updateInvoice, isLoading: invLoading } = useInvoiceStore();
    const { user } = useAuthStore();
    const { fetchFarms, products, getProductById, farms } = useFarmStore();
    const { addToast } = useToastStore();
    const { confirm } = useConfirm();

    useEffect(() => {
        // Ensure ALL required data is fetched, especially farms/products
        fetchFarms();
        fetchStatistics();
        fetchInvoices();
    }, [fetchStatistics, fetchInvoices, fetchFarms]);

    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [showEditStatModal, setShowEditStatModal] = useState(false);
    const [showEditInvoiceModal, setShowEditInvoiceModal] = useState(false);

    // Default to last 7 days
    const defaultStartDate = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return formatJalali(d);
    }, []);

    const [startDate, setStartDate] = useState(defaultStartDate);
    const [endDate, setEndDate] = useState(getTodayJalali());
    const [activeTab, setActiveTab] = useState<'stats' | 'invoices'>('stats');

    // Role-based logic
    const isAdmin = user?.role === UserRole.ADMIN;
    const isRegistration = user?.role === UserRole.REGISTRATION;

    // Get assigned farm IDs
    const assignedFarmIds = useMemo(() =>
        (user?.assignedFarms || []).map(f => f.id)
        , [user?.assignedFarms]);

    // Available farms for filtering (Admin sees all, others see assigned)
    const availableFarms = isAdmin ? farms : (user?.assignedFarms || []);

    // Farm ID Selection
    const [selectedFarmId, setSelectedFarmId] = useState<string>('all');

    // Update selected farm if assigned farms change
    useEffect(() => {
        if (!isAdmin && assignedFarmIds.length > 0 && selectedFarmId === 'all') {
            setSelectedFarmId(assignedFarmIds[0]);
        }
    }, [assignedFarmIds, isAdmin, selectedFarmId]);

    const [statValues, setStatValues] = useState({ prod: '', prev: '', prodKg: '', prevKg: '' });
    const [invoiceValues, setInvoiceValues] = useState({
        invoiceNumber: '',
        cartons: '',
        weight: '',
        driverName: '',
        driverPhone: '',
        description: '',
        plateNumber: ''
    });

    const filteredStats = useMemo(() => {
        const start = normalizeDate(startDate);
        const end = normalizeDate(endDate);

        return statistics.filter(s => {
            // 1. Date Range Filter
            if (!isDateInRange(s.date, start, end)) return false;

            // 2. Farm Filter
            if (selectedFarmId !== 'all') {
                if (s.farmId !== selectedFarmId) return false;
            } else {
                // If 'all' is selected, Admin sees all, Sales/Reg see assigned
                if (!isAdmin && !assignedFarmIds.includes(s.farmId)) return false;
            }

            // 3. Creator Filter: Only Registration workers are restricted to their own entries
            // NOTE: We check s.createdBy (UUID) against user.id (UUID)
            if (isRegistration && s.createdBy !== user?.id) {
                return false;
            }

            return true;
        }).sort((a, b) => {
            // Sort by date desc, then by product priority
            if (a.date !== b.date) return b.date.localeCompare(a.date);
            const pA = products.find(p => p.id === a.productId) || { name: '' };
            const pB = products.find(p => p.id === b.productId) || { name: '' };
            return compareProducts(pA, pB);
        });
    }, [statistics, selectedFarmId, assignedFarmIds, startDate, endDate, isAdmin, isRegistration, user?.id, products]);

    const getProductName = (id: string) => products.find(p => p.id === id)?.name || 'محصول نامشخص';
    const isLiquid = (pid: string) => getProductName(pid).includes('مایع');

    const canEdit = (createdAt: number, creatorRole?: string) => {
        if (isAdmin) return true;
        if (creatorRole === UserRole.ADMIN) return false;
        const FIVE_HOURS_IN_MS = 5 * 60 * 60 * 1000;
        const now = Date.now();
        return (now - createdAt) < FIVE_HOURS_IN_MS;
    };

    const filteredInvoices = useMemo(() => {
        const start = normalizeDate(startDate);
        const end = normalizeDate(endDate);

        return invoices.filter(i => {
            // 1. Date Range Filter
            if (!isDateInRange(i.date, start, end)) return false;

            // 2. Farm Filter
            if (selectedFarmId !== 'all') {
                if (i.farmId !== selectedFarmId) return false;
            } else {
                if (!isAdmin && !assignedFarmIds.includes(i.farmId)) return false;
            }

            // 3. Creator Filter
            if (isRegistration && i.createdBy !== user?.id) return false;

            return true;
        }).sort((a, b) => {
            // Sort by created_at desc (newest first)
            return b.createdAt - a.createdAt;
        });
    }, [invoices, selectedFarmId, assignedFarmIds, startDate, endDate, isAdmin, isRegistration, user?.id]);

    const handleDeleteStat = async (stat: DailyStatistic) => {
        const confirmed = await confirm({
            title: 'حذف آمار',
            message: `آیا از حذف آمار ${getProductName(stat.productId)} اطمینان دارید؟`,
            confirmText: 'بله، حذف کن',
            type: 'danger'
        });
        if (confirmed) {
            const isOffline = !navigator.onLine;
            const result = await deleteStatistic(stat.id);
            if (result.success) {
                if (isOffline) {
                    addToast('درخواست حذف در صف آفلاین ذخیره شد', 'warning');
                } else {
                    addToast('رکورد حذف شد', 'success');
                }
            } else {
                addToast('خطا در حذف', 'error');
            }
        }
    };

    const [targetStat, setTargetStat] = useState<DailyStatistic | null>(null);

    const onEditStatClick = (stat: DailyStatistic) => {
        setTargetStat(stat);
        const fmt = (v: any) => (v === undefined || v === null) ? '' : String(v);
        setStatValues({
            prod: fmt(stat.production),
            prev: fmt(stat.previousBalance),
            prodKg: fmt(stat.productionKg),
            prevKg: fmt(stat.previousBalanceKg)
        });
        setShowEditStatModal(true);
    }

    const saveStatChanges = async () => {
        if (!targetStat) return;
        const prod = Number(statValues.prod);
        const prev = Number(statValues.prev);
        const prodKg = Number(statValues.prodKg);
        const prevKg = Number(statValues.prevKg);

        const result = await updateStatistic(targetStat.id, {
            production: prod,
            previousBalance: prev,
            currentInventory: prev + prod - (targetStat.sales || 0),
            productionKg: prodKg,
            previousBalanceKg: prevKg,
            currentInventoryKg: prevKg + prodKg - (targetStat.salesKg || 0)
        });

        if (result.success) {
            setShowEditStatModal(false);
            setTargetStat(null);
            addToast('آمار بروزرسانی شد', 'success');
        } else {
            addToast(result.error || 'خطا در بروزرسانی', 'error');
        }
    };

    const handleDeleteInvoice = async (inv: Invoice) => {
        const confirmed = await confirm({
            title: 'حذف حواله',
            message: `آیا از حذف حواله شماره ${inv.invoiceNumber} اطمینان دارید؟`,
            confirmText: 'حذف',
            type: 'danger'
        });
        if (confirmed) {
            const result = await deleteInvoice(inv.id);
            if (result.success) addToast('حواله حذف شد', 'success');
            else addToast('خطا در حذف', 'error');
        }
    };

    const handleEditInvoice = (inv: Invoice) => {
        setSelectedInvoice(inv);
        const fmt = (v: any) => (v === undefined || v === null) ? '' : String(v);
        setInvoiceValues({
            invoiceNumber: inv.invoiceNumber,
            cartons: fmt(inv.totalCartons),
            weight: fmt(inv.totalWeight),
            driverName: inv.driverName || '',
            driverPhone: inv.driverPhone || '',
            description: inv.description || '',
            plateNumber: inv.plateNumber || ''
        });
        setShowEditInvoiceModal(true);
    };

    const saveInvoiceChanges = async () => {
        if (!selectedInvoice) return;

        const result = await updateInvoice(selectedInvoice.id, {
            invoiceNumber: invoiceValues.invoiceNumber,
            totalCartons: Number(invoiceValues.cartons),
            totalWeight: Number(invoiceValues.weight),
            driverName: invoiceValues.driverName,
            plateNumber: invoiceValues.plateNumber,
            driverPhone: invoiceValues.driverPhone,
            description: invoiceValues.description
        });

        if (result.success) {
            setShowEditInvoiceModal(false);
            setSelectedInvoice(null);
            addToast('حواله ویرایش شد', 'success');
        } else {
            addToast(result.error || 'خطا در ویرایش', 'error');
        }
    };

    const inputClasses = "w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl text-center font-black text-xl bg-white dark:bg-gray-700 dark:text-white focus:border-metro-blue outline-none transition-all";

    const invoiceItemData = useMemo(() => ({
        invoices: filteredInvoices,
        getProductById,
        isAdmin,
        canEdit,
        handleEditInvoice,
        handleDeleteInvoice
    }), [filteredInvoices, getProductById, isAdmin]);

    const sortedProductIds = useMemo(() => {
        const ids = Array.from(new Set(filteredStats.map(s => s.productId)));
        return ids.sort((a, b) => {
            const pA = products.find(p => p.id === a) || { name: '' };
            const pB = products.find(p => p.id === b) || { name: '' };
            return compareProducts(pA, pB);
        });
    }, [filteredStats, products]);

    return (
        <div className="pb-24 h-full flex flex-col">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-4 sticky top-0 z-20">
                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl mb-4">
                    <button onClick={() => setActiveTab('stats')} className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'stats' ? 'bg-white dark:bg-gray-600 text-metro-blue shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
                        <Icons.BarChart className="w-4 h-4" /> آمار تولید
                    </button>
                    <button onClick={() => setActiveTab('invoices')} className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'invoices' ? 'bg-white dark:bg-gray-600 text-metro-orange shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
                        <Icons.FileText className="w-4 h-4" /> حواله‌ها
                    </button>
                </div>
                <div className="flex gap-2 mb-4">
                    <div className="flex-1"><JalaliDatePicker value={startDate} onChange={setStartDate} label="از تاریخ" /></div>
                    <div className="flex-1"><JalaliDatePicker value={endDate} onChange={setEndDate} label="تا تاریخ" /></div>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
                    {availableFarms.length > 1 && (
                        <button
                            onClick={() => setSelectedFarmId('all')}
                            className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all border-2 ${selectedFarmId === 'all'
                                ? 'bg-metro-blue text-white border-metro-blue'
                                : 'bg-gray-50 dark:bg-gray-700 text-gray-500 border-transparent hover:border-gray-200'
                                }`}
                        >
                            همه فارم‌ها
                        </button>
                    )}
                    {availableFarms.map(f => (
                        <button
                            key={f.id}
                            onClick={() => setSelectedFarmId(f.id)}
                            className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all border-2 ${selectedFarmId === f.id
                                ? 'bg-metro-blue text-white border-metro-blue'
                                : 'bg-gray-50 dark:bg-gray-700 text-gray-500 border-transparent hover:border-gray-200'
                                }`}
                        >
                            {f.name}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 px-1">
                {activeTab === 'stats' ? (
                    <div className="space-y-3 pb-20">
                        {statsLoading ? (
                            <div className="flex flex-col items-center justify-center p-20 text-gray-400 font-bold">
                                <Icons.Refresh className="w-10 h-10 mb-4 animate-spin opacity-20" />
                                در حال بارگذاری آمار...
                            </div>
                        ) : filteredStats.length === 0 ? (
                            <div className="text-center py-20 text-gray-400 font-bold flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-700 mt-4">
                                <Icons.BarChart className="w-16 h-16 mb-2 opacity-20" />
                                هیچ آماری یافت نشد
                            </div>
                        ) : (
                            filteredStats.map(stat => (
                                <StatRecordCard
                                    key={stat.id}
                                    stat={stat}
                                    getProductName={getProductName}
                                    canEdit={canEdit}
                                    onEdit={onEditStatClick}
                                    onDelete={handleDeleteStat}
                                />
                            ))
                        )}
                    </div>
                ) : (
                    <div className="space-y-4 pb-20">
                        {invLoading ? (
                            <div className="flex flex-col items-center justify-center p-20 text-gray-400 font-bold">
                                <Icons.Refresh className="w-10 h-10 mb-4 animate-spin opacity-20" />
                                در حال بارگذاری حواله‌ها...
                            </div>
                        ) : filteredInvoices.length === 0 ? (
                            <div className="text-center py-20 text-gray-400 font-bold flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-700 mt-4">
                                <Icons.FileText className="w-16 h-16 mb-2 opacity-20" />
                                هیچ حواله‌ای یافت نشد
                            </div>
                        ) : (
                            filteredInvoices.map(inv => (
                                <InvoiceRecordCard
                                    key={inv.id}
                                    inv={inv}
                                    getProductName={getProductName}
                                    canEdit={canEdit}
                                    onEdit={handleEditInvoice}
                                    onDelete={handleDeleteInvoice}
                                />
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            {showEditStatModal && targetStat && (
                <Modal isOpen={true} onClose={() => setShowEditStatModal(false)} title="ویرایش آمار">
                    <div className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-xs font-bold mb-1">تولید</label><PersianNumberInput className={inputClasses} value={statValues.prod} onChange={v => setStatValues({ ...statValues, prod: v })} /></div>
                            <div><label className="block text-xs font-bold mb-1">موجودی قبل</label><PersianNumberInput className={inputClasses} value={statValues.prev} onChange={v => setStatValues({ ...statValues, prev: v })} /></div>
                        </div>
                        {isLiquid(targetStat.productId) && (
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold mb-1 text-blue-600">وزن تولید</label><PersianNumberInput inputMode="decimal" className={inputClasses} value={statValues.prodKg} onChange={v => setStatValues({ ...statValues, prodKg: v })} /></div>
                                <div><label className="block text-xs font-bold mb-1 text-blue-600">وزن قبل</label><PersianNumberInput inputMode="decimal" className={inputClasses} value={statValues.prevKg} onChange={v => setStatValues({ ...statValues, prevKg: v })} /></div>
                            </div>
                        )}
                        <div className="flex justify-end gap-3 pt-4">
                            <Button variant="secondary" onClick={() => setShowEditStatModal(false)}>انصراف</Button>
                            <Button onClick={saveStatChanges}>ذخیره تغییرات</Button>
                        </div>
                    </div>
                </Modal>
            )}

            {showEditInvoiceModal && selectedInvoice && (
                <Modal isOpen={true} onClose={() => setShowEditInvoiceModal(false)} title="ویرایش حواله">
                    <div className="space-y-4 pt-2 overflow-y-auto max-h-[60vh]">
                        <div><label className="block text-xs font-bold mb-1">شماره حواله</label><PersianNumberInput className={inputClasses} value={invoiceValues.invoiceNumber} onChange={v => setInvoiceValues({ ...invoiceValues, invoiceNumber: v })} /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-xs font-bold mb-1">کارتن</label><PersianNumberInput className={inputClasses} value={invoiceValues.cartons} onChange={v => setInvoiceValues({ ...invoiceValues, cartons: v })} /></div>
                            <div><label className="block text-xs font-bold mb-1">وزن (Kg)</label><PersianNumberInput inputMode="decimal" className={inputClasses} value={invoiceValues.weight} onChange={v => setInvoiceValues({ ...invoiceValues, weight: v })} /></div>
                        </div>
                        <div><label className="block text-xs font-bold mb-1">راننده</label><input type="text" className="w-full p-3 border-2 rounded-xl dark:bg-gray-700 dark:text-white" value={invoiceValues.driverName} onChange={e => setInvoiceValues({ ...invoiceValues, driverName: e.target.value })} /></div>
                        <div><label className="block text-xs font-bold mb-1">پلاک</label><PlateInput value={invoiceValues.plateNumber} onChange={v => setInvoiceValues({ ...invoiceValues, plateNumber: v })} /></div>
                        <div className="flex justify-end gap-3 pt-4">
                            <Button variant="secondary" onClick={() => setShowEditInvoiceModal(false)}>انصراف</Button>
                            <Button onClick={saveInvoiceChanges}>ذخیره</Button>
                        </div>
                    </div>
                </Modal>
            )}
            {/* TECHNICAL DEBUG INFO - FOR TROUBLESHOOTING */}
            <div className="mt-12 p-4 bg-gray-100 dark:bg-gray-800 rounded-xl text-[10px] font-mono opacity-50 space-y-1">
                <p>--- DEBUG INFO ---</p>
                <p>User: {user?.fullName} ({user?.role})</p>
                <p>User ID: {user?.id}</p>
                <p>Assigned Farms: {assignedFarmIds.length} ({assignedFarmIds.join(', ')})</p>
                <p>Selected Farm: {selectedFarmId}</p>
                <p>Date Range: {startDate} to {endDate}</p>
                <p>Stats in Store: {statistics.length}</p>
                <p>Invoices in Store: {invoices.length}</p>
                <p>Products Loaded: {products.length}</p>
                <p>Loaded Filters: {filteredStats.length} Stats / {filteredInvoices.length} Invoices</p>
                {statistics.length > 0 && !filteredStats.length && (
                    <p className="text-red-500 font-bold">WARN: Records exist in store but are filtered out. Check date/creator/farm matching.</p>
                )}
            </div>
        </div>
    );
};

export default RecentRecords;
