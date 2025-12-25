
import React, { useState, useMemo } from 'react';
import { FixedSizeList as List, areEqual } from 'react-window';
import { useStatisticsStore, DailyStatistic } from '../../store/statisticsStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useFarmStore } from '../../store/farmStore';
import { useAuthStore } from '../../store/authStore';
import { UserRole, FarmType } from '../../types';
import { Icons } from '../common/Icons';
import { useConfirm } from '../../hooks/useConfirm';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { useToastStore } from '../../store/toastStore';
import { toPersianDigits, getTodayJalali, normalizeDate, isDateInRange } from '../../utils/dateUtils';
import { Invoice } from '../../types';
import { SkeletonCard } from '../common/Skeleton';
import JalaliDatePicker from '../common/JalaliDatePicker';
import { useElementSize } from '../../hooks/useElementSize';

const PERSIAN_LETTERS = [
    'الف', 'ب', 'پ', 'ت', 'ث', 'ج', 'چ', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'ژ', 
    'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ک', 'گ', 'ل', 'م', 'ن', 'و', 'ه', 'ی'
];

interface StatCardProps {
    stat: DailyStatistic;
    getProductName: (id: string) => string;
    getProductUnit: (id: string) => string;
    isEditable: (createdAt?: number) => boolean;
    onEdit: (stat: DailyStatistic) => void;
    onDelete: (id: string) => void;
    isMotefereghe: boolean;
}

// OPTIMIZATION: Memoized StatCard
const StatCard = React.memo<StatCardProps>(({ stat, getProductName, getProductUnit, isEditable, onEdit, onDelete, isMotefereghe }) => {
    const isLiquid = getProductName(stat.productId).includes('مایع');
    const canEdit = isEditable(stat.createdAt);
    const isEdited = stat.updatedAt && (stat.updatedAt - stat.createdAt > 60000);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-[16px] shadow-sm border border-gray-200 dark:border-gray-700 p-3 md:p-4 relative overflow-hidden group hover:shadow-md transition-all duration-300 h-full flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
                <div className="overflow-hidden">
                    <h4 className="font-bold text-base text-gray-800 dark:text-gray-100 truncate">{getProductName(stat.productId)}</h4>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-400 font-bold bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{getProductUnit(stat.productId)}</span>
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-gray-700/50 px-2 py-0.5 rounded-full">
                            {toPersianDigits(stat.date)}
                        </span>
                    </div>
                </div>
                
                <div className="flex gap-1 shrink-0">
                    {canEdit ? (
                        <>
                            <button onClick={() => onEdit(stat)} className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                                <Icons.Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => onDelete(stat.id)} className="p-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                                <Icons.Trash className="w-4 h-4" />
                            </button>
                        </>
                    ) : (
                        <div className="p-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg" title="زمان ویرایش تمام شده">
                             <Icons.Lock className="w-4 h-4 text-gray-300" />
                        </div>
                    )}
                </div>
            </div>

            <div className={`grid gap-2 bg-gray-50 dark:bg-gray-900/50 rounded-xl p-2 items-center text-center ${!isMotefereghe ? 'grid-cols-4' : 'grid-cols-3'}`}>
                {!isMotefereghe && (
                    <div className="flex flex-col items-center justify-center border-l border-gray-200 dark:border-gray-700">
                        <span className="text-[9px] font-bold text-gray-400 mb-0.5">قبل</span>
                        <span className="text-sm font-black text-gray-600 dark:text-gray-300">{toPersianDigits(stat.previousBalance)}</span>
                    </div>
                )}

                <div className="flex flex-col items-center justify-center border-l border-gray-200 dark:border-gray-700">
                    <span className="text-[9px] font-bold text-gray-500 mb-0.5">تولید</span>
                    <span className="text-sm font-black text-green-600">+{toPersianDigits(stat.production)}</span>
                </div>

                <div className="flex flex-col items-center justify-center border-l border-gray-200 dark:border-gray-700">
                    <span className="text-[9px] font-bold text-gray-500 mb-0.5">فروش</span>
                    <span className="text-sm font-black text-red-500">-{toPersianDigits(isLiquid ? (stat.salesKg || 0) : (stat.sales || 0))}</span>
                </div>

                <div className="flex flex-col items-center justify-center">
                    <span className="text-[9px] font-bold text-gray-500 mb-0.5">مانده</span>
                    <span className="text-sm font-black text-metro-blue">{toPersianDigits(isLiquid ? (stat.currentInventoryKg || 0) : (stat.currentInventory || 0))}</span>
                </div>
            </div>

            {isEdited && (
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-1">
                    <span className="text-[9px] font-bold text-orange-500">ویرایش شده در {new Date(stat.updatedAt!).toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'})}</span>
                    <Icons.Edit className="w-3 h-3 text-orange-400" />
                </div>
            )}
        </div>
    );
});

interface InvoiceCardProps {
    inv: Invoice;
    getProductName: (id: string) => string;
    isEditable: (createdAt?: number) => boolean;
    onEdit: (inv: Invoice) => void;
    onDelete: (id: string) => void;
}

// OPTIMIZATION: Memoized InvoiceCard
const InvoiceCard = React.memo<InvoiceCardProps>(({ inv, getProductName, isEditable, onEdit, onDelete }) => {
    const isLiquid = getProductName(inv.productId || '').includes('مایع');
    const canEdit = isEditable(inv.createdAt);
    const isEdited = inv.updatedAt && (inv.updatedAt - inv.createdAt > 60000);

    const formatPlate = (plate?: string) => {
        if (!plate || !plate.includes('-')) return plate || '-';
        const parts = plate.split('-');
        if (parts.length === 4) {
            return `${parts[0]} ${parts[1]} ${parts[2]} - ${parts[3]}`;
        }
        return plate;
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-[16px] shadow-sm border-l-[4px] border-metro-orange p-3 md:p-4 relative group hover:shadow-md transition-all duration-300 h-full flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
                <div className="flex flex-col">
                    <span className="block text-[10px] font-bold text-gray-400">رمز حواله</span>
                    <span className="font-mono text-lg font-black tracking-widest text-gray-800 dark:text-gray-100">{toPersianDigits(inv.invoiceNumber)}</span>
                </div>
                
                <div className="flex gap-1">
                    {canEdit ? (
                        <>
                            <button onClick={() => onEdit(inv)} className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                                <Icons.Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => onDelete(inv.id)} className="p-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                                <Icons.Trash className="w-4 h-4" />
                            </button>
                        </>
                    ) : (
                        <div className="p-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg" title="زمان ویرایش تمام شده">
                            <Icons.Lock className="w-4 h-4 text-gray-300" />
                        </div>
                    )}
                </div>
            </div>

            <div className="mb-2">
                <h4 className="font-bold text-sm text-gray-700 dark:text-gray-200 truncate">{getProductName(inv.productId || '')}</h4>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-gray-700/50 px-2 py-0.5 rounded-full">{toPersianDigits(inv.date)}</span>
                    {inv.plateNumber && <span className="text-[10px] font-mono text-gray-400">{formatPlate(inv.plateNumber)}</span>}
                </div>
            </div>

            <div className="flex items-center gap-2 mt-auto">
                <div className={`flex-1 rounded-lg p-2 text-center bg-gray-50 dark:bg-gray-700/50 border dark:border-gray-600`}>
                    <span className="block text-[9px] font-bold text-gray-500 dark:text-gray-400">کارتن</span>
                    <span className="font-black text-sm text-gray-800 dark:text-white">{toPersianDigits(inv.totalCartons || 0)}</span>
                </div>
                <div className={`flex-1 rounded-lg p-2 text-center bg-gray-50 dark:bg-gray-700/50 border dark:border-gray-600 ${isLiquid ? 'ring-1 ring-blue-500/20' : ''}`}>
                    <span className={`block text-[9px] font-bold ${isLiquid ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400'}`}>وزن</span>
                    <span className={`font-black text-sm ${isLiquid ? 'text-blue-700 dark:text-blue-400' : 'text-metro-blue'}`}>{toPersianDigits(inv.totalWeight)}</span>
                </div>
            </div>

            {isEdited && (
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-1">
                    <span className="text-[9px] font-bold text-orange-500">ویرایش شده در {new Date(inv.updatedAt!).toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'})}</span>
                    <Icons.Edit className="w-3 h-3 text-orange-400" />
                </div>
            )}
        </div>
    );
});

// OPTIMIZATION: Memoized Row component for React-Window to prevent re-renders of all rows on scroll/update
const Row = React.memo(({ index, style, data }: any) => {
    const { items, itemsPerRow, type, getProductName, products, isEditable, handleEditStatOpen, handleDeleteRecord, isMotefereghe, handleEditInvoiceOpen } = data;
    const fromIndex = index * itemsPerRow;
    const toIndex = Math.min(fromIndex + itemsPerRow, items.length);
    const rowItems = items.slice(fromIndex, toIndex);

    return (
        <div style={style} className="flex gap-4 px-2">
            {rowItems.map((item: any) => (
                <div key={item.id} className="flex-1 min-w-0 h-full">
                    {type === 'stats' ? (
                        <StatCard 
                            stat={item} 
                            getProductName={getProductName} 
                            getProductUnit={(id)=>products.find((p:any)=>p.id===id)?.unit==='CARTON'?'کارتن':'واحد'} 
                            isEditable={isEditable} 
                            onEdit={handleEditStatOpen} 
                            onDelete={(id)=>handleDeleteRecord(id, 'stat')} 
                            isMotefereghe={isMotefereghe} 
                        />
                    ) : (
                        <InvoiceCard 
                            inv={item} 
                            getProductName={getProductName} 
                            isEditable={isEditable} 
                            onEdit={handleEditInvoiceOpen} 
                            onDelete={(id)=>handleDeleteRecord(id, 'invoice')} 
                        />
                    )}
                </div>
            ))}
            {rowItems.length < itemsPerRow && Array.from({ length: itemsPerRow - rowItems.length }).map((_, i) => (
                <div key={`spacer-${i}`} className="flex-1 invisible" />
            ))}
        </div>
    );
}, areEqual);

const RecentRecords: React.FC = () => {
    const { statistics, deleteStatistic, updateStatistic, isLoading: statsLoading } = useStatisticsStore();
    const { invoices, deleteInvoice, updateInvoice, isLoading: invLoading } = useInvoiceStore();
    const { user } = useAuthStore();
    const { products } = useFarmStore();
    const { addToast } = useToastStore();
    const { confirm } = useConfirm();
    
    // Replacement for AutoSizer
    const { ref: sizerRef, width, height } = useElementSize();

    const [activeTab, setActiveTab] = useState<'stats' | 'invoices'>('stats');
    const [editStat, setEditStat] = useState<DailyStatistic | null>(null);
    const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
    
    const [startDate, setStartDate] = useState(getTodayJalali());
    const [endDate, setEndDate] = useState(getTodayJalali());
    const [searchTerm, setSearchTerm] = useState('');
    const [filterProduct, setFilterProduct] = useState<string>('all');
    const [showFilters, setShowFilters] = useState(false);

    const [statValues, setStatValues] = useState({ prod: '', prev: '', prodKg: '', prevKg: '' });
    const [invoiceValues, setInvoiceValues] = useState({ 
        invoiceNumber: '',
        cartons: '', 
        weight: '',
        driverName: '',
        driverPhone: '',
        description: ''
    });
    
    const [plateParts, setPlateParts] = useState({ part1: '', letter: '', part3: '', part4: '' });

    const farmId = user?.assignedFarms?.[0]?.id;
    const farmType = user?.assignedFarms?.[0]?.type;
    const isMotefereghe = farmType === FarmType.MOTEFEREGHE;
    
    const allowedProductIds = user?.assignedFarms?.[0]?.productIds || [];

    const getProductName = (id: string) => products.find(p => p.id === id)?.name || 'محصول حذف شده';
    const isLiquid = (pid: string) => getProductName(pid).includes('مایع');

    const isEditable = (createdAt?: number) => {
        if (user?.role === UserRole.ADMIN) return true; 
        if (!createdAt) return true; 
        const now = Date.now();
        const diff = now - createdAt;
        return diff < 18000000; 
    };

    const handleClearFilters = () => {
        const today = getTodayJalali();
        setStartDate(today);
        setEndDate(today);
        setSearchTerm('');
        setFilterProduct('all');
    };

    const { filteredStats, filteredInvoices } = useMemo(() => {
        const start = normalizeDate(startDate);
        const end = normalizeDate(endDate);
        const term = searchTerm.toLowerCase().trim();

        const farmStats = statistics.filter(s => {
            if (s.farmId !== farmId) return false;
            if (isMotefereghe && !allowedProductIds.includes(s.productId)) return false;
            if (!isDateInRange(s.date, start, end)) return false;
            if (filterProduct !== 'all' && s.productId !== filterProduct) return false;
            if (term) {
                const prodName = getProductName(s.productId).toLowerCase();
                return prodName.includes(term);
            }
            return true;
        });

        const farmInvoices = invoices.filter(i => {
            if (i.farmId !== farmId) return false;
            if (isMotefereghe && i.productId && !allowedProductIds.includes(i.productId)) return false;
            if (!isDateInRange(i.date, start, end)) return false;
            if (filterProduct !== 'all' && i.productId !== filterProduct) return false;
            if (term) {
                const prodName = getProductName(i.productId || '').toLowerCase();
                const invNum = i.invoiceNumber.toLowerCase();
                const driver = (i.driverName || '').toLowerCase();
                const plate = (i.plateNumber || '').toLowerCase();
                return prodName.includes(term) || invNum.includes(term) || driver.includes(term) || plate.includes(term);
            }
            return true;
        });

        return { 
            filteredStats: farmStats.sort((a,b) => b.createdAt - a.createdAt), 
            filteredInvoices: farmInvoices.sort((a,b) => b.createdAt - a.createdAt) 
        };
    }, [statistics, invoices, farmId, startDate, endDate, searchTerm, filterProduct, products, isMotefereghe, allowedProductIds]);

    const handleEditStatOpen = (stat: DailyStatistic) => {
        const fmt = (v: any) => (v === undefined || v === null) ? '' : String(v);
        setEditStat(stat);
        setStatValues({ 
            prod: fmt(stat.production), 
            prev: fmt(stat.previousBalance),
            prodKg: fmt(stat.productionKg),
            prevKg: fmt(stat.previousBalanceKg)
        });
    };

    const handleCancelStat = () => {
        setEditStat(null);
        setStatValues({ prod: '', prev: '', prodKg: '', prevKg: '' });
    };

    const handleSaveStat = async () => {
        if (!editStat) return;
        const prod = Number(statValues.prod);
        const prev = isMotefereghe ? 0 : Number(statValues.prev); 
        const prodKg = Number(statValues.prodKg);
        const prevKg = isMotefereghe ? 0 : Number(statValues.prevKg); 

        const result = await updateStatistic(editStat.id, {
            production: prod,
            previousBalance: prev,
            currentInventory: prev + prod - (editStat.sales || 0),
            productionKg: prodKg,
            previousBalanceKg: prevKg,
            currentInventoryKg: prevKg + prodKg - (editStat.salesKg || 0)
        });

        if (result.success) { 
            setEditStat(null); 
            if (result.error && result.error.includes('آفلاین')) {
                addToast('ویرایش در صف آفلاین ذخیره شد', 'info');
            } else {
                addToast('آمار ویرایش شد', 'success'); 
            }
        }
        else addToast('خطا در ویرایش: ' + result.error, 'error');
    };

    const handleEditInvoiceOpen = (inv: Invoice) => {
        const fmt = (v: any) => (v === undefined || v === null) ? '' : String(v);
        setEditInvoice(inv);
        setInvoiceValues({ 
            invoiceNumber: inv.invoiceNumber,
            cartons: fmt(inv.totalCartons), 
            weight: fmt(inv.totalWeight),
            driverName: inv.driverName || '',
            driverPhone: inv.driverPhone || '',
            description: inv.description || ''
        });

        if (inv.plateNumber && inv.plateNumber.includes('-')) {
            const parts = inv.plateNumber.split('-');
            if (parts.length === 4) setPlateParts({ part1: parts[0], letter: parts[1], part3: parts[2], part4: parts[3] });
        } else {
            setPlateParts({ part1: '', letter: '', part3: '', part4: '' });
        }
    };

    const handleCancelInvoice = () => {
        setEditInvoice(null);
        setInvoiceValues({ 
            invoiceNumber: '',
            cartons: '', 
            weight: '',
            driverName: '',
            driverPhone: '',
            description: ''
        });
        setPlateParts({ part1: '', letter: '', part3: '', part4: '' });
    };

    const handleSaveInvoice = async () => {
        if (!editInvoice) return;
        const { part1, letter, part3, part4 } = plateParts;
        const finalPlate = (part1 && letter && part3 && part4) ? `${part1}-${letter}-${part3}-${part4}` : editInvoice.plateNumber;

        const result = await updateInvoice(editInvoice.id, {
            invoiceNumber: invoiceValues.invoiceNumber,
            totalCartons: Number(invoiceValues.cartons),
            totalWeight: Number(invoiceValues.weight),
            driverName: invoiceValues.driverName,
            plateNumber: finalPlate,
            driverPhone: invoiceValues.driverPhone,
            description: invoiceValues.description
        });

        if (result.success) { 
            setEditInvoice(null); 
            if (result.error && result.error.includes('آفلاین')) {
                addToast('ویرایش حواله در صف آفلاین ذخیره شد', 'info');
            } else {
                addToast('حواله ویرایش شد', 'success'); 
            }
        }
        else addToast('خطا در ویرایش: ' + result.error, 'error');
    };

    const handleDeleteRecord = async (id: string, type: 'stat' | 'invoice') => {
        const confirmed = await confirm({
            title: 'حذف رکورد',
            message: 'آیا از حذف این مورد اطمینان دارید؟',
            confirmText: 'بله، حذف کن',
            cancelText: 'انصراف',
            type: 'danger'
        });

        if (confirmed) {
            let result;
            if (type === 'stat') {
                result = await deleteStatistic(id);
            } else {
                result = await deleteInvoice(id);
            }

            if (result.success) {
                if (result.error && result.error.includes('آفلاین')) {
                    addToast('دستور حذف در صف آفلاین قرار گرفت', 'info');
                } else {
                    addToast('رکورد با موفقیت حذف شد', 'success');
                }
            } else {
                addToast(result.error || 'خطا در حذف', 'error');
            }
        }
    };

    const getItemsPerRow = (width: number) => {
        return width >= 768 ? 2 : 1; 
    };

    const inputClasses = "w-full p-4 border-2 rounded-xl text-center font-black text-2xl bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:border-metro-blue outline-none transition-all";

    return (
        <div className="pb-24 h-full flex flex-col">
            <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-full mb-4 mx-auto max-w-md w-full sticky top-0 z-20 shadow-md border border-gray-200 dark:border-gray-700">
                <button onClick={() => setActiveTab('stats')} className={`flex-1 py-3 rounded-full text-base font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'stats' ? 'bg-white dark:bg-gray-700 text-metro-blue shadow-sm' : 'text-gray-500'}`}>
                    <Icons.BarChart className="w-5 h-5" /> آمار تولید
                </button>
                <button onClick={() => setActiveTab('invoices')} className={`flex-1 py-3 rounded-full text-base font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'invoices' ? 'bg-white dark:bg-gray-700 text-metro-orange shadow-sm' : 'text-gray-500'}`}>
                    <Icons.FileText className="w-5 h-5" /> حواله‌ها
                </button>
            </div>

            <div className="max-w-4xl mx-auto w-full px-2 flex-1 flex flex-col">
                <div className="space-y-4 flex-1 flex flex-col">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center">
                            <h3 className="font-black text-lg text-gray-800 dark:text-white shrink-0 flex items-center gap-2">
                                <span className="text-sm font-bold text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-lg">
                                    {toPersianDigits(activeTab === 'stats' ? filteredStats.length : filteredInvoices.length)}
                                </span>
                            </h3>
                            <button onClick={() => setShowFilters(!showFilters)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 flex items-center gap-2 text-xs font-bold">
                                {showFilters ? 'بستن فیلترها' : 'فیلتر پیشرفته'} <Icons.Search className="w-4 h-4" />
                            </button>
                        </div>

                        <div className={`flex flex-col gap-3 transition-all overflow-hidden ${showFilters ? 'max-h-[500px] opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'}`}>
                            <div className="flex flex-col gap-3">
                                <div className="w-full relative">
                                    <Icons.Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input 
                                        type="text" 
                                        placeholder="جستجو..." 
                                        className="w-full p-3 pl-10 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-metro-blue"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-2 w-full">
                                    <div className="flex-1">
                                        <JalaliDatePicker value={startDate} onChange={setStartDate} label="از تاریخ" />
                                    </div>
                                    <div className="flex-1">
                                        <JalaliDatePicker value={endDate} onChange={setEndDate} label="تا تاریخ" />
                                    </div>
                                </div>
                                <button onClick={handleClearFilters} className="w-full h-10 bg-red-50 text-red-500 rounded-xl font-bold text-sm">پاکسازی</button>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex-1 min-h-[500px]" ref={sizerRef}>
                        {(statsLoading || invLoading) ? (
                            <div className="grid gap-4 md:grid-cols-2">
                                <SkeletonCard />
                                <SkeletonCard />
                            </div>
                        ) : activeTab === 'stats' ? (
                            filteredStats.length > 0 && width > 0 && height > 0 ? (
                                <List
                                    height={height}
                                    itemCount={Math.ceil(filteredStats.length / getItemsPerRow(width))}
                                    itemSize={220} 
                                    width={width}
                                    itemData={{ 
                                        items: filteredStats, 
                                        itemsPerRow: getItemsPerRow(width), 
                                        type: 'stats',
                                        getProductName,
                                        products,
                                        isEditable,
                                        handleEditStatOpen,
                                        handleDeleteRecord,
                                        isMotefereghe
                                    }}
                                    className="custom-scrollbar !overflow-y-auto"
                                >
                                    {Row}
                                </List>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-64 text-center text-gray-400">
                                    <Icons.BarChart className="w-12 h-12 mb-2 opacity-20" />
                                    <span className="font-bold text-sm">آمار تولیدی یافت نشد</span>
                                </div>
                            )
                        ) : (
                            filteredInvoices.length > 0 && width > 0 && height > 0 ? (
                                <List
                                    height={height}
                                    itemCount={Math.ceil(filteredInvoices.length / getItemsPerRow(width))}
                                    itemSize={180} 
                                    width={width}
                                    itemData={{ 
                                        items: filteredInvoices, 
                                        itemsPerRow: getItemsPerRow(width), 
                                        type: 'invoices',
                                        getProductName,
                                        isEditable,
                                        handleEditInvoiceOpen,
                                        handleDeleteRecord
                                    }}
                                    className="custom-scrollbar !overflow-y-auto"
                                >
                                    {Row}
                                </List>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-64 text-center text-gray-400">
                                    <Icons.FileText className="w-12 h-12 mb-2 opacity-20" />
                                    <span className="font-bold text-sm">حواله‌ای یافت نشد</span>
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>
            
            {/* Modals are conditionally rendered to keep DOM light */}
            {!!editStat && (
                <Modal isOpen={true} onClose={handleCancelStat} title="ویرایش آمار روزانه">
                    <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1">
                        <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border-2 border-blue-100 dark:border-blue-900 flex flex-col gap-2 shadow-sm">
                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">اطلاعات تعداد (کارتن)</span>
                            <div className={`grid gap-4 ${isMotefereghe ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                <div>
                                    <label className="block text-sm font-black mb-1 opacity-60 dark:text-gray-300">{isMotefereghe ? 'موجودی اعلامی' : 'تولید'}</label>
                                    <input type="tel" inputMode="numeric" className={inputClasses} value={statValues.prod} onChange={(e) => setStatValues({ ...statValues, prod: e.target.value })} />
                                </div>
                                {!isMotefereghe && (
                                    <div>
                                        <label className="block text-sm font-black mb-1 opacity-60 dark:text-gray-300">موجودی قبل</label>
                                        <input type="tel" inputMode="numeric" className={inputClasses} value={statValues.prev} onChange={(e) => setStatValues({ ...statValues, prev: e.target.value })} />
                                    </div>
                                )}
                            </div>
                        </div>
                        {isLiquid(editStat.productId) && (
                            <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border-2 border-indigo-100 dark:border-indigo-900 flex flex-col gap-2 shadow-sm">
                                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">اطلاعات وزن (کیلوگرم)</span>
                                <div className={`grid gap-4 ${isMotefereghe ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                    <div><label className="block text-sm font-black mb-1 opacity-60 dark:text-gray-300">{isMotefereghe ? 'موجودی اعلامی (Kg)' : 'تولید (Kg)'}</label><input type="tel" inputMode="decimal" className={inputClasses} value={statValues.prodKg} onChange={(e) => setStatValues({ ...statValues, prodKg: e.target.value })} /></div>
                                    {!isMotefereghe && (
                                        <div><label className="block text-sm font-black mb-1 opacity-60 dark:text-gray-300">موجودی قبل (Kg)</label><input type="tel" inputMode="decimal" className={inputClasses} value={statValues.prevKg} onChange={(e) => setStatValues({ ...statValues, prevKg: e.target.value })} /></div>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700"><Button variant="secondary" onClick={handleCancelStat}>انصراف</Button><Button onClick={handleSaveStat}>بروزرسانی آمار</Button></div>
                    </div>
                </Modal>
            )}

            {!!editInvoice && (
                <Modal isOpen={true} onClose={handleCancelInvoice} title="ویرایش حواله خروج">
                    <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1 custom-scrollbar">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-orange-200 dark:border-orange-800">
                            <label className="block text-sm font-bold mb-2 text-orange-700 dark:text-orange-400">رمز حواله</label>
                            <input type="tel" readOnly className="w-full p-4 border-2 border-gray-200 rounded-xl text-center font-black text-3xl tracking-widest bg-gray-100 dark:bg-gray-800 text-gray-500 cursor-not-allowed outline-none" value={invoiceValues.invoiceNumber} />
                            <p className="text-[10px] text-red-500 mt-1 text-center">رمز حواله قابل ویرایش نیست.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm font-bold mb-2 dark:text-gray-300">تعداد کارتن</label><input type="tel" inputMode="numeric" className={inputClasses} value={invoiceValues.cartons} onChange={(e) => setInvoiceValues({ ...invoiceValues, cartons: e.target.value })} /></div>
                            <div><label className="block text-sm font-bold mb-2 text-blue-600 dark:text-blue-400">وزن واقعی (Kg)</label><input type="tel" inputMode="decimal" className={`${inputClasses} border-blue-100 dark:border-blue-900`} value={invoiceValues.weight} onChange={(e) => setInvoiceValues({ ...invoiceValues, weight: e.target.value })} /></div>
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700"><Button variant="secondary" onClick={handleCancelInvoice}>انصراف</Button><Button onClick={handleSaveInvoice}>ثبت تغییرات</Button></div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default RecentRecords;
