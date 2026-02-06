import React, { useState, useMemo, useEffect } from 'react';
import { useStatisticsStore, DailyStatistic } from '../../store/statisticsStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useFarmStore } from '../../store/farmStore';
import { useAuthStore } from '../../store/authStore';
import { UserRole, Invoice, FarmType } from '../../types';
import { useSyncStore, SyncItem } from '../../store/syncStore';
import { Icons } from '../common/Icons';
import { useConfirm } from '../../hooks/useConfirm';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { useToastStore } from '../../store/toastStore';
import { toPersianDigits, getTodayJalali, normalizeDate, isDateInRange, formatJalali } from '../../utils/dateUtils';
import { formatPlateNumber } from '../../utils/formatUtils';
import { compareProducts } from '../../utils/sortUtils';
import JalaliDatePicker from '../common/JalaliDatePicker';
import PersianNumberInput from '../common/PersianNumberInput';
import PlateInput from '../common/PlateInput';
// Removed virtualization imports for better layout reliability
// import { FixedSizeList as List } from 'react-window';
// import AutoSizer from 'react-virtualized-auto-sizer';

// Unified Record Card for Statistics
const StatRecordCard = ({ stat, getProductName, canEdit, onEdit, onDelete, farmType }: { stat: DailyStatistic, getProductName: (id: string) => string, canEdit: (c: number, r?: string) => boolean, onEdit: (s: DailyStatistic) => void, onDelete: (s: DailyStatistic) => void, farmType?: FarmType }) => {
    const isAdminCreated = stat.creatorRole === UserRole.ADMIN;
    const isEdited = stat.updatedAt && stat.updatedAt > stat.createdAt + 2000;
    const prodName = getProductName(stat.productId);
    const isPending = stat.isPending;
    const isOffline = stat.isOffline;

    return (
        <div className={`bg-white dark:bg-gray-800 p-4 rounded-xl border-2 transition-all ${isOffline ? 'border-orange-300 bg-orange-50/20' : isPending ? 'border-blue-300 bg-blue-50/20 animate-pulse' : isAdminCreated ? 'border-purple-200 dark:border-purple-900/30 bg-purple-50/30' : 'border-gray-100 dark:border-gray-700'} relative shadow-sm`}>
            <div className="flex justify-between items-center mb-3">
                <div className="flex gap-2 lg:gap-4 items-center">
                    <span className={`text-[10px] lg:text-xs font-black px-2 py-1 lg:px-3 lg:py-1.5 rounded-md lg:rounded-lg ${isOffline ? 'bg-orange-100 text-orange-700' : isPending ? 'bg-blue-100 text-blue-700' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'}`}>
                        {toPersianDigits(stat.date)}
                    </span>
                    <div className="flex flex-col">
                        <span className="text-xs lg:text-lg font-bold text-gray-700 dark:text-gray-300">{prodName}</span>
                        {isPending && (
                            <span className="flex items-center gap-1 text-[9px] font-black text-blue-500 animate-bounce">
                                <Icons.Refresh className="w-2.5 h-2.5 animate-spin" />
                                در حال ارسال...
                            </span>
                        )}
                        {isOffline && (
                            <span className="flex items-center gap-1 text-[9px] font-black text-orange-600">
                                <Icons.Clock className="w-2.5 h-2.5" />
                                در صف ارسال (آفلاین)
                            </span>
                        )}
                    </div>
                    {isAdminCreated && <span className="text-[9px] lg:text-xs font-bold bg-purple-100 text-purple-700 px-2 py-0.5 lg:px-3 lg:py-1 rounded-full">ثبت مدیر</span>}
                </div>
                <div className="flex gap-2">
                    {!isPending && !isOffline && (canEdit(stat.createdAt, stat.creatorRole) ? (
                        <>
                            <button onClick={() => onEdit(stat)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Icons.Edit className="w-4 h-4" /></button>
                            <button onClick={() => onDelete(stat)} className="p-1.5 bg-red-50 text-red-600 rounded-lg"><Icons.Trash className="w-4 h-4" /></button>
                        </>
                    ) : (
                        <Icons.Lock className="w-4 h-4 text-gray-300" />
                    ))}
                </div>
            </div>

            {farmType === FarmType.MORVARIDI ? (
                <div className="grid grid-cols-5 gap-1.5 text-center">
                    <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                        <span className="block text-[8px] lg:text-[10px] text-gray-400 font-bold mb-1">قبلی</span>
                        <span className="font-black text-xs lg:text-xl">{toPersianDigits(stat.previousBalance)}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/10">
                        <span className="block text-[8px] lg:text-[10px] text-emerald-400 font-bold mb-1">تولید</span>
                        <span className="font-black text-xs lg:text-xl text-emerald-600">{toPersianDigits(stat.production)}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/10">
                        <span className="block text-[8px] lg:text-[10px] text-purple-400 font-bold mb-1">جدا</span>
                        <span className="font-black text-xs lg:text-xl text-purple-600">{toPersianDigits(stat.separationAmount || 0)}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/10">
                        <span className="block text-[8px] lg:text-[10px] text-red-300 font-bold mb-1 font-bold">فروش</span>
                        <span className="font-black text-xs lg:text-xl text-red-600">{toPersianDigits(stat.sales)}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800">
                        <span className="block text-[8px] lg:text-[10px] text-blue-400 font-bold mb-1">مانده</span>
                        <span className="font-black text-xs lg:text-xl text-blue-700 dark:text-blue-300">{toPersianDigits(stat.currentInventory)}</span>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className={`p-2 lg:p-4 rounded-lg lg:rounded-2xl ${isOffline ? 'bg-white/50 border border-orange-100' : isPending ? 'bg-white/50 border border-blue-100' : 'bg-gray-50 dark:bg-gray-900/50'}`}>
                        <span className="block text-[9px] lg:text-xs text-gray-400 font-bold mb-1">تولید</span>
                        <span className="font-black text-sm lg:text-2xl">{toPersianDigits(stat.production)}</span>
                    </div>
                    <div className={`p-2 lg:p-4 rounded-lg lg:rounded-2xl ${isOffline ? 'bg-orange-100/20' : isPending ? 'bg-blue-100/20' : 'bg-red-50 dark:bg-red-900/10'}`}>
                        <span className="block text-[9px] lg:text-xs text-red-300 font-bold mb-1">فروش</span>
                        <span className={`font-black text-sm lg:text-2xl ${isOffline ? 'text-orange-600' : isPending ? 'text-blue-600' : 'text-red-600'}`}>{toPersianDigits(stat.sales)}</span>
                    </div>
                    <div className={`p-2 lg:p-4 rounded-lg lg:rounded-2xl ${isOffline ? 'bg-orange-100/10' : isPending ? 'bg-blue-100/10' : 'bg-blue-50 dark:bg-blue-900/10'}`}>
                        <span className="block text-[9px] lg:text-xs text-blue-300 font-bold mb-1">موجودی</span>
                        <span className="font-black text-sm lg:text-2xl text-black dark:text-white">{toPersianDigits(stat.currentInventory)}</span>
                    </div>
                </div>
            )}

            <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center text-[9px] lg:text-xs text-gray-400 font-bold">
                <span>مسئول ثبت: {stat.creatorName || 'ناشناس'}</span>
                {isEdited && !isPending && !isOffline && <span className="text-orange-500 font-black">● ویرایش شده</span>}
            </div>
        </div>
    );
};

// Unified Record Card for Invoices
const InvoiceRecordCard = ({ inv, getProductName, canEdit, onEdit, onDelete, onAddItem }: { inv: Invoice, getProductName: (id: string) => string, canEdit: (c: number, r?: string) => boolean, onEdit: (i: Invoice) => void, onDelete: (i: Invoice) => void, onAddItem?: (i: Invoice) => void }) => {
    const prodName = getProductName(inv.productId || '');
    const isAdminCreated = inv.creatorRole === UserRole.ADMIN;
    const isEdited = inv.updatedAt && inv.updatedAt > inv.createdAt + 2000;
    const isPending = inv.isPending;
    const isOffline = inv.isOffline;

    return (
        <div className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border-2 transition-all ${isOffline ? 'border-orange-300 bg-orange-50/20' : isPending ? 'border-blue-300 bg-blue-50/20 animate-pulse' : isAdminCreated ? 'border-purple-200 bg-purple-50/30' : 'border-gray-100 dark:border-gray-700'} relative`}>
            <div className="flex justify-between items-start mb-3">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] lg:text-xs font-black text-metro-orange block">حواله {toPersianDigits(inv.invoiceNumber)}</span>
                        {isPending && (
                            <span className="flex items-center gap-1 text-[9px] font-black text-blue-500 animate-bounce">
                                <Icons.Refresh className="w-2.5 h-2.5 animate-spin" />
                                در حال ارسال...
                            </span>
                        )}
                        {isOffline && (
                            <span className="flex items-center gap-1 text-[9px] font-black text-orange-600">
                                <Icons.Clock className="w-2.5 h-2.5" />
                                در صف ارسال (آفلاین)
                            </span>
                        )}
                    </div>
                    <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm lg:text-lg">{prodName}</h4>
                    {isAdminCreated && <span className="text-[9px] lg:text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 lg:px-3 lg:py-1 rounded font-bold mt-1 inline-block">ثبت توسط مدیر</span>}
                    {isEdited && <span className="text-[9px] lg:text-xs text-orange-500 font-bold mr-1"> (ویرایش شده)</span>}
                </div>
                <div className="flex gap-2">
                    {!isPending && !isOffline && (canEdit(inv.createdAt, inv.creatorRole) ? (
                        <>
                            {onAddItem && (
                                <button onClick={() => onAddItem(inv)} className="p-1.5 bg-green-50 text-green-600 rounded-lg" title="افزودن محصول دیگر به این حواله">
                                    <Icons.Plus className="w-4 h-4" />
                                </button>
                            )}
                            <button onClick={() => onEdit(inv)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Icons.Edit className="w-4 h-4" /></button>
                            <button onClick={() => onDelete(inv)} className="p-1.5 bg-red-50 text-red-600 rounded-lg"><Icons.Trash className="w-4 h-4" /></button>
                        </>
                    ) : (
                        <Icons.Lock className="w-4 h-4 text-gray-300" />
                    ))}
                </div>
            </div>

            <div className={`flex items-center gap-2 text-[10px] lg:text-xs text-gray-500 mb-3 p-2 lg:p-3 rounded-lg lg:rounded-xl ${isOffline ? 'bg-orange-100/30' : isPending ? 'bg-blue-100/30' : 'bg-gray-50 dark:bg-gray-900/50'}`}>
                <span className="font-black bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-sm">{toPersianDigits(inv.date)}</span>
                {inv.plateNumber && <span className="font-mono border-r pr-2 border-gray-300 lg:text-sm" dir="ltr">{formatPlateNumber(inv.plateNumber)}</span>}
                <span className="flex-1 text-left font-bold">{inv.creatorName}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className={`p-2 lg:p-4 rounded-xl lg:rounded-3xl text-center border ${isOffline ? 'bg-white/50 border-orange-100' : isPending ? 'bg-white/50 border-blue-100' : 'bg-gray-50 dark:bg-gray-950/20 border-gray-100 dark:border-gray-800'}`}>
                    <span className="block text-[10px] lg:text-xs text-gray-400 font-black">کارتن</span>
                    <span className="font-black text-lg lg:text-2xl">{toPersianDigits(inv.totalCartons)}</span>
                </div>
                <div className={`p-2 lg:p-4 rounded-xl lg:rounded-3xl text-center border ${isOffline ? 'bg-orange-100/20 border-orange-200' : isPending ? 'bg-blue-100/20 border-blue-200' : 'bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/20'}`}>
                    <span className="block text-[10px] lg:text-xs text-blue-400 font-black">وزن</span>
                    <span className="font-black text-lg lg:text-2xl text-blue-600">{toPersianDigits(inv.totalWeight)}</span>
                </div>
            </div>
        </div>
    );
};

const RecentRecords: React.FC = () => {
    const { statistics, fetchStatistics, deleteStatistic, updateStatistic, isLoading: statsLoading, statistics: allStats } = useStatisticsStore();
    const { invoices, fetchInvoices, deleteInvoice, updateInvoice, bulkAddInvoices, validateUnique, isLoading: invLoading } = useInvoiceStore();
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

    // Add Item Modal State
    const [showAddItemModal, setShowAddItemModal] = useState(false);
    const [addItemInvoice, setAddItemInvoice] = useState<Invoice | null>(null);
    const [addItemProductId, setAddItemProductId] = useState<string>('');
    const [addItemCartons, setAddItemCartons] = useState<string>('');
    const [addItemWeight, setAddItemWeight] = useState<string>('');
    const [addItemLoading, setAddItemLoading] = useState(false);

    // Default to Today only
    const defaultStartDate = useMemo(() => getTodayJalali(), []);

    const [selectedDate, setSelectedDate] = useState(getTodayJalali());
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


    const [invoiceValues, setInvoiceValues] = useState({
        invoiceNumber: '',
        cartons: '',
        weight: '',
        driverName: '',
        driverPhone: '',
        description: '',
        plateNumber: '',
        productId: ''
    });

    // Added separation to stats state
    const [statValues, setStatValues] = useState({ prod: '', prev: '', prodKg: '', prevKg: '', separation: '' });

    const filteredStats = useMemo(() => {
        const normalized = normalizeDate(selectedDate);
        const { queue } = useSyncStore.getState();

        // 1. Base results from store
        const baseStats = statistics.filter(s => {
            if (normalizeDate(s.date) !== normalized) return false;
            if (selectedFarmId !== 'all') {
                if (s.farmId !== selectedFarmId) return false;
            } else {
                if (!isAdmin && !assignedFarmIds.includes(s.farmId)) return false;
            }
            if (isRegistration && s.createdBy !== user?.id) return false;
            return true;
        });

        // 2. Add queued statistics
        const queuedStats: DailyStatistic[] = queue
            .filter((item: SyncItem) => item.type === 'STAT')
            .map((item: SyncItem) => ({
                ...item.payload,
                id: item.id,
                createdAt: item.timestamp,
                isPending: false,
                isOffline: true,
                creatorName: user?.fullName || 'شما',
                creatorRole: user?.role
            }))
            .filter((s: DailyStatistic) => {
                if (normalizeDate(s.date) !== normalized) return false;
                if (selectedFarmId !== 'all') {
                    if (s.farmId !== selectedFarmId) return false;
                } else {
                    if (!isAdmin && !assignedFarmIds.includes(s.farmId)) return false;
                }
                return true;
            });

        // 3. Merge and deduplicate
        const merged = [...baseStats];
        queuedStats.forEach(queued => {
            const isDuplicate = baseStats.some(base =>
                base.farmId === queued.farmId &&
                normalizeDate(base.date) === normalizeDate(queued.date) &&
                base.productId === queued.productId
            );
            if (!isDuplicate) merged.push(queued);
        });

        return merged.sort((a, b) => {
            if (a.date !== b.date) return b.date.localeCompare(a.date);
            const pA = products.find(p => p.id === a.productId) || { name: '' };
            const pB = products.find(p => p.id === b.productId) || { name: '' };
            return compareProducts(pA, pB);
        });
    }, [statistics, selectedFarmId, assignedFarmIds, selectedDate, isAdmin, isRegistration, user?.id, user?.fullName, user?.role, products]);

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
        const normalized = normalizeDate(selectedDate);
        const { queue } = useSyncStore.getState();

        // 1. Get real invoices from store
        const baseInvoices = invoices.filter(i => {
            if (normalizeDate(i.date) !== normalized) return false;
            if (selectedFarmId !== 'all') {
                if (i.farmId !== selectedFarmId) return false;
            } else {
                if (!isAdmin && !assignedFarmIds.includes(i.farmId)) return false;
            }
            if (isRegistration && i.createdBy !== user?.id) return false;
            return true;
        });

        // 2. Get queued invoices from SyncStore
        const queuedInvoices: Invoice[] = queue
            .filter((item: SyncItem) => item.type === 'INVOICE')
            .map((item: SyncItem) => ({
                ...item.payload,
                id: item.id,
                createdAt: item.timestamp,
                isPending: false,
                isOffline: true,
                creatorName: user?.fullName || 'شما',
                creatorRole: user?.role
            }))
            .filter((i: Invoice) => {
                if (normalizeDate(i.date) !== normalized) return false;
                if (selectedFarmId !== 'all') {
                    if (i.farmId !== selectedFarmId) return false;
                } else {
                    if (!isAdmin && !assignedFarmIds.includes(i.farmId)) return false;
                }
                return true;
            });

        // 3. Merge and deduplicate (by invoiceNumber for same product)
        const merged = [...baseInvoices];
        queuedInvoices.forEach(queued => {
            const isDuplicate = baseInvoices.some(base =>
                base.invoiceNumber === queued.invoiceNumber &&
                base.productId === queued.productId
            );
            if (!isDuplicate) merged.push(queued);
        });

        return merged.sort((a, b) => b.createdAt - a.createdAt);
    }, [invoices, selectedFarmId, assignedFarmIds, selectedDate, isAdmin, isRegistration, user?.id, user?.fullName, user?.role]);

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

        const farm = farms.find(f => f.id === stat.farmId);
        const isMotefereghe = farm?.type === FarmType.MOTEFEREGHE;

        // If Motefereghe, "prod" input represents "Declared Stock" (Current Inventory)
        // If Morvaridi, "prod" input represents actual Production
        const prodVal = isMotefereghe ? stat.currentInventory : stat.production;
        const prodKgVal = isMotefereghe ? stat.currentInventoryKg : stat.productionKg;

        setStatValues({
            prod: fmt(prodVal),
            prev: fmt(stat.previousBalance),
            prodKg: fmt(prodKgVal),
            prevKg: fmt(stat.previousBalanceKg),
            separation: fmt(stat.separationAmount) // Load separation amount
        });
        setShowEditStatModal(true);
    }

    const saveStatChanges = async () => {
        if (!targetStat) return;

        const farm = farms.find(f => f.id === targetStat.farmId);
        const isMotefereghe = farm?.type === FarmType.MOTEFEREGHE;

        const inputVal = Number(statValues.prod);
        const inputValKg = Number(statValues.prodKg);
        const prev = Number(statValues.prev);
        const prevKg = Number(statValues.prevKg);
        const separationInput = Number(statValues.separation); // Parse Separation

        let finalProduction = inputVal;
        let finalProductionKg = inputValKg;
        let finalPrevious = prev;
        let finalPreviousKg = prevKg;
        let finalCurrent = 0;
        let finalCurrentKg = 0;

        if (isMotefereghe) {
            // Logic for Motefereghe: Input is "Declared Stock" (Current Inventory)
            // Production = Declared + Sales
            // Previous = 0
            finalPrevious = 0;
            finalPreviousKg = 0;

            finalCurrent = inputVal;
            finalCurrentKg = inputValKg;

            finalProduction = inputVal + (targetStat.sales || 0);
            finalProductionKg = inputValKg + (targetStat.salesKg || 0);
        } else {
            // Logic for Morvaridi: Standard
            finalProduction = inputVal;
            finalProductionKg = inputValKg;
            finalPrevious = prev;
            finalPreviousKg = prevKg;

            finalCurrent = prev + inputVal - (targetStat.sales || 0);
            finalCurrentKg = prevKg + inputValKg - (targetStat.salesKg || 0);
        }

        const result = await updateStatistic(targetStat.id, {
            production: finalProduction,
            previousBalance: finalPrevious,
            currentInventory: finalCurrent,
            productionKg: finalProductionKg,
            previousBalanceKg: finalPreviousKg,
            currentInventoryKg: finalCurrentKg,
            separationAmount: separationInput // Include in update
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
            plateNumber: inv.plateNumber || '',
            productId: inv.productId || ''
        });
        setShowEditInvoiceModal(true);
    };

    const saveInvoiceChanges = async () => {
        if (!selectedInvoice) return;

        // 1. Uniqueness Validation
        // Only if number changed OR product changed (complex check handled by backend usually, but we check number collision first)
        if (invoiceValues.invoiceNumber !== selectedInvoice.invoiceNumber) {
            const validation = await validateUnique(invoiceValues.invoiceNumber, selectedInvoice.id);
            if (!validation.isValid) {
                addToast(validation.error || 'شماره حواله تکراری است', 'error');
                return;
            }
        }

        // 2. Inventory Validation
        // Calculate: Available = CurrentInventory + OldInvoiceQty (Credit back)
        // Check: NewQty <= Available

        // Find correct stat record for the *NEW* product (in case product changed)
        // If product changed, we check stock of NEW product.
        // If product same, we credit back old qty to Same product.

        const targetProductId = invoiceValues.productId;
        const normalizedDate = normalizeDate(selectedInvoice.date);

        // Find stat for target product
        const statRecord = allStats.find(s =>
            s.farmId === selectedInvoice.farmId &&
            normalizeDate(s.date) === normalizedDate &&
            s.productId === targetProductId
        );

        if (statRecord) {
            let availableStock = statRecord.currentInventory;

            // If product didn't change, we effectively "have" the old quantity too (it's currently deducted, so we add it back to available)
            if (targetProductId === selectedInvoice.productId) {
                availableStock += (selectedInvoice.totalCartons || 0);
            }

            const newQty = Number(invoiceValues.cartons);
            if (newQty > availableStock) {
                addToast(`موجودی کافی نیست. حداکثر قابل ثبت: ${availableStock}`, 'error');
                return;
            }
        } else {
            // If no stat record exists for this product found, assume 0 stock? Or allow if unrestricted?
            // Usually implies 0 stock.
            addToast('آمار تولید برای این محصول و تاریخ یافت نشد.', 'error');
            // optional: return; // block or warn? Blocking is safer.
            return;
        }

        const result = await updateInvoice(selectedInvoice.id, {
            invoiceNumber: invoiceValues.invoiceNumber,
            totalCartons: Number(invoiceValues.cartons),
            totalWeight: Number(invoiceValues.weight),
            driverName: invoiceValues.driverName,
            plateNumber: invoiceValues.plateNumber,
            driverPhone: invoiceValues.driverPhone,
            description: invoiceValues.description,
            productId: invoiceValues.productId
        });

        if (result.success) {
            setShowEditInvoiceModal(false);
            setSelectedInvoice(null);
            addToast('حواله ویرایش شد', 'success');
        } else {
            addToast(result.error || 'خطا در ویرایش', 'error');
        }
    };

    // Add Item to existing invoice
    const handleAddItemClick = (inv: Invoice) => {
        setAddItemInvoice(inv);
        setAddItemProductId('');
        setAddItemCartons('');
        setAddItemWeight('');
        setShowAddItemModal(true);
    };

    const handleAddItemProductToggle = (pid: string) => {
        if (addItemProductId === pid) {
            setAddItemProductId('');
            setAddItemCartons('');
            setAddItemWeight('');
        } else {
            setAddItemProductId(pid);
            setAddItemCartons('');
            setAddItemWeight('');
        }
    };

    const saveAddItem = async () => {
        if (!addItemInvoice || !addItemProductId) {
            addToast('لطفا یک محصول انتخاب کنید', 'warning');
            return;
        }

        const cartons = Number(addItemCartons);
        const weight = Number(addItemWeight);

        if (!cartons || cartons <= 0) {
            addToast('تعداد کارتن را وارد کنید', 'error');
            return;
        }
        if (!weight || weight <= 0) {
            addToast('وزن را وارد کنید', 'error');
            return;
        }

        // Check if product already exists for this invoice number
        const existingProduct = invoices.find(i =>
            i.invoiceNumber === addItemInvoice.invoiceNumber &&
            i.productId === addItemProductId &&
            i.id !== addItemInvoice.id
        );
        if (existingProduct) {
            addToast('این محصول قبلاً برای این حواله ثبت شده است', 'error');
            return;
        }

        // Check inventory
        const normalizedDate = normalizeDate(addItemInvoice.date);
        const statRecord = allStats.find(s =>
            s.farmId === addItemInvoice.farmId &&
            normalizeDate(s.date) === normalizedDate &&
            s.productId === addItemProductId
        );

        if (statRecord && statRecord.currentInventory < cartons) {
            addToast(`موجودی کافی نیست. موجود: ${statRecord.currentInventory}`, 'error');
            return;
        }

        setAddItemLoading(true);

        // Validate uniqueness (exclude current invoice family)
        const validation = await validateUnique(addItemInvoice.invoiceNumber, addItemInvoice.id);
        if (!validation.isValid) {
            setAddItemLoading(false);
            addToast(validation.error || 'خطا در اعتبارسنجی', 'error');
            return;
        }

        // Create new invoice with same number but new product
        const result = await bulkAddInvoices([{
            farmId: addItemInvoice.farmId,
            date: addItemInvoice.date,
            invoiceNumber: addItemInvoice.invoiceNumber,
            totalCartons: cartons,
            totalWeight: weight,
            productId: addItemProductId,
            driverName: addItemInvoice.driverName || '',
            driverPhone: addItemInvoice.driverPhone || '',
            plateNumber: addItemInvoice.plateNumber || '',
            description: addItemInvoice.description || '',
            isYesterday: addItemInvoice.isYesterday || false
        }]);

        setAddItemLoading(false);

        if (result.success) {
            setShowAddItemModal(false);
            setAddItemInvoice(null);
            addToast('محصول جدید به حواله اضافه شد', 'success');
            fetchInvoices();
        } else {
            addToast(result.error || 'خطا در ثبت', 'error');
        }
    };

    const inputClasses = "w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl text-center font-black text-xl bg-white dark:bg-gray-700 dark:text-white focus:border-metro-blue outline-none transition-all";

    const invoiceItemData = useMemo(() => ({
        invoices: filteredInvoices,
        getProductById,
        isAdmin,
        canEdit,
        handleEditInvoice,
        handleDeleteInvoice,
        handleAddItemClick
    }), [filteredInvoices, getProductById, isAdmin, handleAddItemClick]);

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
            <div className={`p-4 rounded-2xl shadow-sm border mb-4 sticky top-0 z-20 transition-all duration-500 ${activeTab === 'stats'
                ? 'bg-orange-50/80 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900/30 shadow-orange-500/5'
                : 'bg-blue-50/80 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30 shadow-blue-500/5'
                } backdrop-blur-md`}>
                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl mb-4">
                    <button onClick={() => setActiveTab('stats')} className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'stats' ? 'bg-white dark:bg-gray-600 text-metro-blue shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
                        <Icons.BarChart className="w-4 h-4" /> آمار تولید
                    </button>
                    <button onClick={() => setActiveTab('invoices')} className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'invoices' ? 'bg-white dark:bg-gray-600 text-metro-orange shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
                        <Icons.FileText className="w-4 h-4" /> حواله‌ها
                    </button>
                </div>
                <div className="flex justify-center mb-4">
                    <div className="w-full max-w-xs"><JalaliDatePicker value={selectedDate} onChange={setSelectedDate} label="انتخاب تاریخ" /></div>
                </div>

                {availableFarms.length > 1 && (
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
                )}
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
                                    farmType={farms.find(f => f.id === stat.farmId)?.type}
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
                                    onAddItem={handleAddItemClick}
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
                        {(() => {
                            const farm = farms.find(f => f.id === targetStat.farmId);
                            const isMotefereghe = farm?.type === FarmType.MOTEFEREGHE;

                            return (
                                <>
                                    <div className={`grid gap-4 ${isMotefereghe ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                        {!isMotefereghe && (
                                            <div><label className="block text-xs font-bold mb-1">موجودی قبل</label><PersianNumberInput className={inputClasses} value={statValues.prev} onChange={v => setStatValues({ ...statValues, prev: v })} /></div>
                                        )}
                                        <div>
                                            <label className="block text-xs font-bold mb-1">{isMotefereghe ? 'موجودی اعلامی' : 'تولید'}</label>
                                            <PersianNumberInput className={inputClasses} value={statValues.prod} onChange={v => setStatValues({ ...statValues, prod: v })} />
                                        </div>
                                    </div>
                                    {isLiquid(targetStat.productId) && (
                                        <div className={`grid gap-4 ${isMotefereghe ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                            {!isMotefereghe && (
                                                <div><label className="block text-xs font-bold mb-1 text-blue-600">وزن قبل</label><PersianNumberInput inputMode="decimal" className={inputClasses} value={statValues.prevKg} onChange={v => setStatValues({ ...statValues, prevKg: v })} /></div>
                                            )}
                                            <div>
                                                <label className="block text-xs font-bold mb-1 text-blue-600">{isMotefereghe ? 'وزن اعلامی' : 'وزن تولید'}</label>
                                                <PersianNumberInput inputMode="decimal" className={inputClasses} value={statValues.prodKg} onChange={v => setStatValues({ ...statValues, prodKg: v })} />
                                            </div>
                                        </div>
                                    )}

                                    {!isMotefereghe && (
                                        <div className="pt-2 border-t border-gray-100 dark:border-gray-700 mt-2">
                                            <label className="block text-xs font-bold mb-1 text-purple-600">جداسازی (حدودی)</label>
                                            <PersianNumberInput className={`${inputClasses} border-purple-200 dark:border-purple-900/30`} value={statValues.separation} onChange={v => setStatValues({ ...statValues, separation: v })} />
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                        <div className="flex justify-end gap-3 pt-4">
                            <Button variant="secondary" onClick={() => setShowEditStatModal(false)}>انصراف</Button>
                            <Button onClick={saveStatChanges}>ذخیره تغییرات</Button>
                        </div>
                    </div>
                </Modal>
            )
            }

            {
                showEditInvoiceModal && selectedInvoice && (
                    <Modal isOpen={true} onClose={() => setShowEditInvoiceModal(false)} title="ویرایش حواله">
                        <div className="space-y-4 pt-2 overflow-y-auto max-h-[60vh]">
                            <div><label className="block text-xs font-bold mb-1">شماره حواله</label><PersianNumberInput className={inputClasses} value={invoiceValues.invoiceNumber} onChange={v => setInvoiceValues({ ...invoiceValues, invoiceNumber: v })} /></div>

                            {/* Product Selector */}
                            <div>
                                <label className="block text-xs font-bold mb-1">محصول</label>
                                <select
                                    className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 dark:text-white font-bold outline-none focus:border-metro-blue"
                                    value={invoiceValues.productId}
                                    onChange={e => setInvoiceValues({ ...invoiceValues, productId: e.target.value })}
                                >
                                    {sortedProductIds.map(pid => {
                                        const p = products.find(prod => prod.id === pid);
                                        return <option key={pid} value={pid}>{p?.name || 'نامشخص'}</option>
                                    })}
                                    {/* Include current product if not in list (e.g. deleted/hidden) */}
                                    {!sortedProductIds.includes(invoiceValues.productId) && (
                                        <option value={invoiceValues.productId}>{getProductName(invoiceValues.productId)}</option>
                                    )}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold mb-1">کارتن</label><PersianNumberInput className={inputClasses} value={invoiceValues.cartons} onChange={v => setInvoiceValues({ ...invoiceValues, cartons: v })} /></div>
                                <div><label className="block text-xs font-bold mb-1">وزن (Kg)</label><PersianNumberInput inputMode="decimal" className={inputClasses} value={invoiceValues.weight} onChange={v => setInvoiceValues({ ...invoiceValues, weight: v })} /></div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold mb-1">راننده</label><input type="text" className="w-full p-3 border-2 rounded-xl border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white" value={invoiceValues.driverName} onChange={e => setInvoiceValues({ ...invoiceValues, driverName: e.target.value })} /></div>
                                <div>
                                    <label className="block text-xs font-bold mb-1">شماره تماس</label>
                                    <input
                                        type="tel"
                                        className="w-full p-3 border-2 rounded-xl border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-left font-mono"
                                        value={invoiceValues.driverPhone}
                                        onChange={e => setInvoiceValues({ ...invoiceValues, driverPhone: e.target.value })}
                                        placeholder="09..."
                                    />
                                </div>
                            </div>

                            <div><label className="block text-xs font-bold mb-1">پلاک</label><PlateInput value={invoiceValues.plateNumber} onChange={v => setInvoiceValues({ ...invoiceValues, plateNumber: v })} /></div>
                            <div><label className="block text-xs font-bold mb-1">توضیحات</label><textarea className="w-full p-3 border-2 rounded-xl border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white h-24 resize-none" value={invoiceValues.description} onChange={e => setInvoiceValues({ ...invoiceValues, description: e.target.value })} placeholder="توضیحات تکمیلی..." /></div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700 mt-4">
                                <Button variant="secondary" onClick={() => setShowEditInvoiceModal(false)}>انصراف</Button>
                                <Button onClick={saveInvoiceChanges}>ذخیره</Button>
                            </div>
                        </div>
                    </Modal>
                )
            }

            {/* Add Item Modal */}
            {
                showAddItemModal && addItemInvoice && (
                    <Modal isOpen={true} onClose={() => setShowAddItemModal(false)} title={`افزودن محصول به حواله ${toPersianDigits(addItemInvoice.invoiceNumber)}`}>
                        <div className="space-y-4 pt-2">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl">
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                    <span className="font-bold">محصولات موجود برای این فارم:</span>
                                </p>
                            </div>

                            {/* Product Selection */}
                            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                                {addItemInvoice.farmId && (() => {
                                    const farm = farms.find(f => f.id === addItemInvoice.farmId);
                                    const farmProductIds = farm?.productIds || [];
                                    return farmProductIds.map(pid => {
                                        const p = products.find(prod => prod.id === pid);
                                        if (!p) return null;
                                        const isSelected = addItemProductId === pid;
                                        // Check if already added for this invoice
                                        const alreadyAdded = invoices.some(i =>
                                            i.invoiceNumber === addItemInvoice.invoiceNumber &&
                                            i.productId === pid &&
                                            i.id !== addItemInvoice.id
                                        );

                                        return (
                                            <button
                                                key={pid}
                                                type="button"
                                                disabled={alreadyAdded}
                                                onClick={() => handleAddItemProductToggle(pid)}
                                                className={`p-3 rounded-xl text-sm font-bold transition-all ${isSelected
                                                    ? 'bg-metro-green text-white shadow-lg'
                                                    : alreadyAdded
                                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                        : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                                                    }`}
                                            >
                                                {p.name} {alreadyAdded && '(ثبت شده)'}
                                            </button>
                                        );
                                    });
                                })()}
                            </div>

                            {addItemProductId && (
                                <div className="grid grid-cols-2 gap-4 animate-fade-in">
                                    <div>
                                        <label className="block text-xs font-bold mb-1">تعداد (کارتن)</label>
                                        <PersianNumberInput
                                            className={inputClasses}
                                            value={addItemCartons}
                                            onChange={setAddItemCartons}
                                            placeholder=""
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold mb-1">وزن (کیلوگرم)</label>
                                        <PersianNumberInput
                                            inputMode="decimal"
                                            className={inputClasses}
                                            value={addItemWeight}
                                            onChange={setAddItemWeight}
                                            placeholder=""
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4">
                                <Button variant="secondary" onClick={() => setShowAddItemModal(false)}>انصراف</Button>
                                <Button onClick={saveAddItem} isLoading={addItemLoading} disabled={!addItemProductId || !addItemCartons || !addItemWeight}>
                                    افزودن به حواله
                                </Button>
                            </div>
                        </div>
                    </Modal>
                )
            }
            {/* TECHNICAL DEBUG INFO - FOR TROUBLESHOOTING */}
            {
                isAdmin && (
                    <div className="mt-12 p-4 bg-gray-100 dark:bg-gray-800 rounded-xl text-[10px] font-mono opacity-50 space-y-1">
                        <p>--- DEBUG INFO ---</p>
                        <p>User: {user?.fullName} ({user?.role})</p>
                        <p>User ID: {user?.id}</p>
                        <p>Assigned Farms: {assignedFarmIds.length} ({assignedFarmIds.join(', ')})</p>
                        <p>Selected Farm: {selectedFarmId}</p>
                        <p>Selected Date: {selectedDate}</p>
                        <p>Stats in Store: {statistics.length}</p>
                        <p>Invoices in Store: {invoices.length}</p>
                        <p>Products Loaded: {products.length}</p>
                        <p>Loaded Filters: {filteredStats.length} Stats / {filteredInvoices.length} Invoices</p>
                        {statistics.length > 0 && !filteredStats.length && (
                            <p className="text-red-500 font-bold">WARN: Records exist in store but are filtered out. Check date/creator/farm matching.</p>
                        )}
                    </div>
                )
            }
        </div >
    );
};

export default RecentRecords;
