
import React, { useState, useMemo } from 'react';
import { useStatisticsStore, DailyStatistic } from '../../store/statisticsStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useFarmStore } from '../../store/farmStore';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../types';
import { Icons } from '../common/Icons';
import { useConfirm } from '../../hooks/useConfirm';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { useToastStore } from '../../store/toastStore';
import { toPersianDigits, getTodayJalali, normalizeDate } from '../../utils/dateUtils';
import { Invoice } from '../../types';
import { AnimatePresence, motion } from 'framer-motion';

interface StatCardProps {
    stat: DailyStatistic;
    getProductName: (id: string) => string;
    getProductUnit: (id: string) => string;
    isEditable: boolean; // ✅ Changed to a simple boolean
    onEdit: (stat: DailyStatistic) => void;
    onDelete: (id: string) => void;
}

const StatCard: React.FC<StatCardProps> = ({ stat, getProductName, getProductUnit, isEditable, onEdit, onDelete }) => (
    <div className="bg-white dark:bg-gray-800 rounded-[24px] shadow-sm border border-gray-200 dark:border-gray-700 p-6 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
        <div className="flex justify-between items-start mb-4">
            <div>
                <h4 className="font-black text-xl text-gray-800 dark:text-gray-100">{getProductName(stat.productId)}</h4>
                <span className="text-xs text-gray-400 font-bold bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{getProductUnit(stat.productId)}</span>
            </div>
            
            <div className="flex gap-2">
                {/* ✅ PERMISSION CHECK */}
                {isEditable ? (
                    <>
                        <button onClick={() => onEdit(stat)} className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                            <Icons.Edit className="w-5 h-5" />
                        </button>
                        <button onClick={() => onDelete(stat.id)} className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                            <Icons.Trash className="w-5 h-5" />
                        </button>
                    </>
                ) : (
                    <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-full" title="فقط مدیر میتواند ویرایش کند">
                         <Icons.Lock className="w-5 h-5 text-gray-300" />
                    </div>
                )}
            </div>
        </div>

        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4">
            <div className="flex flex-col items-center flex-1 border-l border-gray-200 dark:border-gray-700">
                <span className="text-xs font-bold text-gray-500 mb-1">تولید</span>
                <span className="text-2xl font-black text-green-600">+{toPersianDigits(stat.production)}</span>
                {(stat.productionKg || 0) > 0 && <span className="text-[10px] text-gray-400 font-mono">({stat.productionKg} Kg)</span>}
            </div>
            <div className="flex flex-col items-center flex-1 border-l border-gray-200 dark:border-gray-700">
                <span className="text-xs font-bold text-gray-500 mb-1">فروش</span>
                <span className="text-xl font-black text-red-500">-{toPersianDigits(stat.sales || 0)}</span>
            </div>
            <div className="flex flex-col items-center flex-1">
                <span className="text-xs font-bold text-gray-500 mb-1">موجودی</span>
                <span className="text-2xl font-black text-metro-blue">{toPersianDigits(stat.currentInventory)}</span>
            </div>
        </div>
        
        {stat.updatedAt && (
            <div className="absolute bottom-2 left-4 text-[10px] text-amber-600 font-bold bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                ویرایش شده
            </div>
        )}
    </div>
);

interface InvoiceCardProps {
    inv: Invoice;
    getProductName: (id: string) => string;
    isEditable: boolean; // ✅ Changed to a simple boolean
    onEdit: (inv: Invoice) => void;
    onDelete: (id: string) => void;
}

const InvoiceCard: React.FC<InvoiceCardProps> = ({ inv, getProductName, isEditable, onEdit, onDelete }) => (
    <div className="bg-white dark:bg-gray-800 rounded-[24px] shadow-sm border-l-[6px] border-metro-orange p-6 relative group hover:shadow-xl transition-all duration-300">
        <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
                <div className="bg-orange-100 dark:bg-orange-900/20 p-2.5 rounded-full text-orange-600">
                    <Icons.FileText className="w-6 h-6" />
                </div>
                <div>
                    <span className="block text-xs font-bold text-gray-400">رمز حواله</span>
                    <span className="font-mono text-2xl font-black tracking-widest text-gray-800 dark:text-gray-100">{toPersianDigits(inv.invoiceNumber)}</span>
                </div>
            </div>
            
            <div className="flex gap-2">
                {/* ✅ PERMISSION CHECK */}
                {isEditable ? (
                    <>
                        <button onClick={() => onEdit(inv)} className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                            <Icons.Edit className="w-5 h-5" />
                        </button>
                        <button onClick={() => onDelete(inv.id)} className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                            <Icons.Trash className="w-5 h-5" />
                        </button>
                    </>
                ) : (
                    <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-full" title="فقط مدیر میتواند ویرایش کند">
                        <Icons.Lock className="w-5 h-5 text-gray-300" />
                    </div>
                )}
            </div>
        </div>

        <div className="mb-5">
            <h4 className="font-bold text-lg text-gray-700 dark:text-gray-200">{getProductName(inv.productId || '')}</h4>
            {inv.driverName && <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                <Icons.User className="w-4 h-4" /> {inv.driverName} 
                <span className="w-1 h-1 bg-gray-300 rounded-full mx-1"></span> 
                {toPersianDigits(inv.plateNumber || '-')}
            </p>}
        </div>

        <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-100 dark:bg-gray-700/50 rounded-2xl p-3 text-center">
                <span className="block text-[10px] font-bold text-gray-500 mb-1">تعداد</span>
                <span className="font-black text-xl text-gray-800 dark:text-white">{toPersianDigits(inv.totalCartons)}</span>
            </div>
            <div className="flex-1 bg-gray-100 dark:bg-gray-700/50 rounded-2xl p-3 text-center">
                <span className="block text-[10px] font-bold text-gray-500 mb-1">وزن (Kg)</span>
                <span className="font-black text-xl text-metro-blue">{toPersianDigits(inv.totalWeight)}</span>
            </div>
        </div>
    </div>
);

const RecentRecords: React.FC = () => {
    const { statistics, deleteStatistic, updateStatistic } = useStatisticsStore();
    const { invoices, deleteInvoice, updateInvoice } = useInvoiceStore();
    const { user } = useAuthStore();
    const { products, getProductById } = useFarmStore();
    const { confirm } = useConfirm();
    const { addToast } = useToastStore();
    
    const [activeTab, setActiveTab] = useState<'stats' | 'invoices'>('stats');
    const [expandedHistoryDates, setExpandedHistoryDates] = useState<string[]>([]);

    const [editStat, setEditStat] = useState<DailyStatistic | null>(null);
    const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
    
    const [statValues, setStatValues] = useState({ prod: '', sales: '', prev: '', prodKg: '', salesKg: '', prevKg: '' });
    const [invoiceValues, setInvoiceValues] = useState({ 
        invoiceNumber: '',
        cartons: '', 
        weight: '',
        driverName: '',
        plateNumber: '',
        driverPhone: ''
    });

    const farmId = user?.assignedFarms?.[0]?.id;
    const today = normalizeDate(getTodayJalali());

    // ✅ PERMISSION CHECK: Centralized check for admin role
    const isAdmin = user?.role === UserRole.ADMIN;

    const getProductName = (id: string) => products.find(p => p.id === id)?.name || 'محصول حذف شده';
    const getProductUnit = (id: string) => products.find(p => p.id === id)?.unit === 'CARTON' ? 'کارتن' : 'واحد';

    const { todayStats, historyStatsGrouped } = useMemo(() => {
        const farmStats = statistics.filter(s => s.farmId === farmId);
        const todayRecs = farmStats.filter(s => s.date === today).sort((a,b) => b.createdAt - a.createdAt);
        const historyRecs = farmStats.filter(s => s.date !== today).sort((a,b) => b.date.localeCompare(a.date));

        const grouped: Record<string, DailyStatistic[]> = {};
        historyRecs.forEach(rec => {
            if (!grouped[rec.date]) grouped[rec.date] = [];
            grouped[rec.date].push(rec);
        });

        return { todayStats: todayRecs, historyStatsGrouped: grouped };
    }, [statistics, farmId, today]);

    const { todayInvoices, historyInvoicesGrouped } = useMemo(() => {
        const farmInvoices = invoices.filter(i => i.farmId === farmId);
        const todayRecs = farmInvoices.filter(i => i.date === today).sort((a,b) => b.createdAt - a.createdAt);
        const historyRecs = farmInvoices.filter(i => i.date !== today).sort((a,b) => b.date.localeCompare(a.date));

        const grouped: Record<string, Invoice[]> = {};
        historyRecs.forEach(rec => {
            if (!grouped[rec.date]) grouped[rec.date] = [];
            grouped[rec.date].push(rec);
        });

        return { todayInvoices: todayRecs, historyInvoicesGrouped: grouped };
    }, [invoices, farmId, today]);

    const toggleHistoryDate = (date: string) => {
        setExpandedHistoryDates(prev => 
            prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
        );
    };

    const handleDeleteStat = async (id: string) => {
        const yes = await confirm({ title: 'حذف آمار', message: 'آیا از حذف دائمی این رکورد اطمینان دارید؟', type: 'danger' });
        if(yes) {
            const result = await deleteStatistic(id);
            if (!result.success) {
                addToast(result.error || 'خطا در حذف', 'error');
            } else {
                addToast('رکورد با موفقیت حذف شد', 'success');
            }
        }
    };

    const handleDeleteInv = async (id: string) => {
        const yes = await confirm({ title: 'حذف حواله', message: 'آیا از حذف دائمی این حواله اطمینان دارید؟', type: 'danger' });
        if(yes) {
            const result = await deleteInvoice(id);
            if (!result.success) {
                addToast(result.error || 'خطا در حذف', 'error');
            } else {
                addToast('حواله با موفقیت حذف شد', 'success');
            }
        }
    };

    const handleEditStatOpen = (stat: DailyStatistic) => {
        const fmt = (v: any) => (v === 0 || v === undefined || v === null) ? '' : String(v);
        setEditStat(stat);
        setStatValues({ 
            prod: fmt(stat.production), 
            sales: fmt(stat.sales),
            prev: fmt(stat.previousBalance),
            prodKg: fmt(stat.productionKg),
            salesKg: fmt(stat.salesKg),
            prevKg: fmt(stat.previousBalanceKg)
        });
    };

    const handleSaveStat = async () => {
        if (!editStat) return;
        const yes = await confirm({ title: 'ویرایش آمار', message: 'آیا از ذخیره تغییرات اطمینان دارید؟', type: 'info' });
        if (!yes) return;

        const prod = Number(statValues.prod);
        const sales = Number(statValues.sales);
        const prev = Number(statValues.prev);
        const prodKg = Number(statValues.prodKg);
        const salesKg = Number(statValues.salesKg);
        const prevKg = Number(statValues.prevKg);

        const newInventory = prev + prod - sales;
        const newInventoryKg = prevKg + prodKg - salesKg;

        const result = await updateStatistic(editStat.id, {
            production: prod,
            sales: sales,
            previousBalance: prev,
            currentInventory: newInventory,
            productionKg: prodKg,
            salesKg: salesKg,
            previousBalanceKg: prevKg,
            currentInventoryKg: newInventoryKg
        });

        if (result.success) {
            setEditStat(null);
            addToast('آمار با موفقیت ویرایش شد', 'success');
        } else {
            addToast('خطا در ویرایش: ' + result.error, 'error');
        }
    };

    const handleEditInvoiceOpen = (inv: Invoice) => {
        const fmt = (v: any) => (v === 0 || v === undefined || v === null) ? '' : String(v);
        setEditInvoice(inv);
        setInvoiceValues({ 
            invoiceNumber: inv.invoiceNumber,
            cartons: fmt(inv.totalCartons), 
            weight: fmt(inv.totalWeight),
            driverName: inv.driverName || '',
            plateNumber: inv.plateNumber || '',
            driverPhone: inv.driverPhone || ''
        });
    };

    const handleSaveInvoice = async () => {
        if (!editInvoice) return;
        
        if (!/^(17|18)\d{8}$/.test(invoiceValues.invoiceNumber)) {
            addToast('فرمت رمز حواله صحیح نیست (باید ۱۰ رقم و شروع با ۱۷ یا ۱۸ باشد)', 'error');
            return;
        }

        const yes = await confirm({ title: 'ویرایش حواله', message: 'آیا از ذخیره تغییرات اطمینان دارید؟', type: 'info' });
        if (!yes) return;

        const result = await updateInvoice(editInvoice.id, {
            invoiceNumber: invoiceValues.invoiceNumber,
            totalCartons: Number(invoiceValues.cartons),
            totalWeight: Number(invoiceValues.weight),
            driverName: invoiceValues.driverName,
            plateNumber: invoiceValues.plateNumber,
            driverPhone: invoiceValues.driverPhone
        });

        if (result.success) {
            setEditInvoice(null);
            addToast('حواله با موفقیت ویرایش شد', 'success');
        } else {
            addToast('خطا در ویرایش: ' + result.error, 'error');
        }
    };

    const productHasKg = editStat ? getProductById(editStat.productId)?.hasKilogramUnit : false;

    return (
        <div className="pb-24">
            <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-full mb-8 mx-auto max-w-md sticky top-6 z-20 shadow-md border border-gray-200 dark:border-gray-700">
                <button 
                    onClick={() => setActiveTab('stats')}
                    className={`flex-1 py-3 rounded-full text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'stats' 
                        ? 'bg-white dark:bg-gray-700 text-metro-blue shadow-sm scale-100' 
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50'
                    }`}
                >
                    <Icons.BarChart className="w-5 h-5" />
                    آمار تولید
                </button>
                <button 
                    onClick={() => setActiveTab('invoices')}
                    className={`flex-1 py-3 rounded-full text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'invoices' 
                        ? 'bg-white dark:bg-gray-700 text-metro-orange shadow-sm scale-100' 
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50'
                    }`}
                >
                    <Icons.FileText className="w-5 h-5" />
                    حواله‌های فروش
                </button>
            </div>

            <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-300 px-2">
                <div className="space-y-4">
                    <div className="flex items-center gap-3 px-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                        <h3 className="font-black text-2xl text-gray-800 dark:text-white">امروز ({toPersianDigits(today)})</h3>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        {activeTab === 'stats' ? (
                            todayStats.length > 0 ? todayStats.map(stat => (
                                <StatCard key={stat.id} stat={stat} getProductName={getProductName} getProductUnit={getProductUnit} isEditable={isAdmin} onEdit={handleEditStatOpen} onDelete={handleDeleteStat} />
                            )) : <div className="col-span-full p-10 text-center text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-[24px] border-2 border-dashed border-gray-200 dark:border-gray-700">هنوز آماری برای امروز ثبت نشده است.</div>
                        ) : (
                            todayInvoices.length > 0 ? todayInvoices.map(inv => (
                                <InvoiceCard key={inv.id} inv={inv} getProductName={getProductName} isEditable={isAdmin} onEdit={handleEditInvoiceOpen} onDelete={handleDeleteInv} />
                            )) : <div className="col-span-full p-10 text-center text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-[24px] border-2 border-dashed border-gray-200 dark:border-gray-700">هنوز حواله‌ای برای امروز ثبت نشده است.</div>
                        )}
                    </div>
                </div>

                <div className="space-y-6 pt-8 border-t border-dashed border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 px-2 opacity-70">
                        <Icons.Refresh className="w-6 h-6" />
                        <h3 className="font-bold text-xl text-gray-600 dark:text-gray-300">سوابق روزهای گذشته</h3>
                    </div>
                    <div className="space-y-4">
                        {activeTab === 'stats' ? (
                            Object.entries(historyStatsGrouped).map(([date, items]) => {
                                const typedItems = items as DailyStatistic[];
                                return (
                                <div key={date} className="bg-white dark:bg-gray-800 rounded-[24px] overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
                                    <button onClick={() => toggleHistoryDate(date)} className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                        <span className="font-black text-lg text-gray-700 dark:text-gray-200">{toPersianDigits(date)}</span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm bg-gray-100 dark:bg-gray-700 text-gray-500 px-3 py-1 rounded-full font-bold">{toPersianDigits(typedItems.length)} رکورد</span>
                                            <Icons.ChevronDown className={`w-5 h-5 transition-transform ${expandedHistoryDates.includes(date) ? 'rotate-180' : ''}`} />
                                        </div>
                                    </button>
                                    <AnimatePresence>{expandedHistoryDates.includes(date) && (
                                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                            <div className="p-5 bg-gray-50 dark:bg-gray-900/30 grid gap-4 md:grid-cols-2 border-t border-gray-100 dark:border-gray-700">
                                                {typedItems.map(stat => <StatCard key={stat.id} stat={stat} getProductName={getProductName} getProductUnit={getProductUnit} isEditable={isAdmin} onEdit={handleEditStatOpen} onDelete={handleDeleteStat} />)}
                                            </div>
                                        </motion.div>
                                    )}</AnimatePresence>
                                </div>
                            )})
                        ) : (
                            Object.entries(historyInvoicesGrouped).map(([date, items]) => {
                                const typedItems = items as Invoice[];
                                return (
                                <div key={date} className="bg-white dark:bg-gray-800 rounded-[24px] overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
                                    <button onClick={() => toggleHistoryDate(date)} className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                        <span className="font-black text-lg text-gray-700 dark:text-gray-200">{toPersianDigits(date)}</span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm bg-gray-100 dark:bg-gray-700 text-gray-500 px-3 py-1 rounded-full font-bold">{toPersianDigits(typedItems.length)} حواله</span>
                                            <Icons.ChevronDown className={`w-5 h-5 transition-transform ${expandedHistoryDates.includes(date) ? 'rotate-180' : ''}`} />
                                        </div>
                                    </button>
                                    <AnimatePresence>{expandedHistoryDates.includes(date) && (
                                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                            <div className="p-5 bg-gray-50 dark:bg-gray-900/30 grid gap-4 md:grid-cols-2 border-t border-gray-100 dark:border-gray-700">
                                                {typedItems.map(inv => <InvoiceCard key={inv.id} inv={inv} getProductName={getProductName} isEditable={isAdmin} onEdit={handleEditInvoiceOpen} onDelete={handleDeleteInv} />)}
                                            </div>
                                        </motion.div>
                                    )}</AnimatePresence>
                                </div>
                            )})
                        )}
                    </div>
                </div>
            </div>

            <Modal isOpen={!!editStat} onClose={() => setEditStat(null)} title="ویرایش آمار">
                <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1 custom-scrollbar">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl text-sm font-bold text-blue-800 dark:text-blue-300 leading-relaxed border border-blue-100 dark:border-blue-800">
                        توجه: با تغییر مقادیر تولید یا فروش، موجودی نهایی به صورت خودکار محاسبه می‌شود.
                    </div>
                    
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
                        <h4 className="text-sm font-black text-metro-orange flex items-center gap-2 mb-4"><Icons.BarChart className="w-5 h-5"/> تعداد (کارتن/دبه)</h4>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-bold mb-2 dark:text-gray-300">تولید</label>
                                <input type="number" className="w-full p-4 border-2 border-gray-200 rounded-xl text-center font-black text-2xl bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:border-green-500 outline-none transition-colors" value={statValues.prod} onChange={(e) => setStatValues({ ...statValues, prod: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-2 dark:text-gray-300">فروش</label>
                                <input type="number" className="w-full p-4 border-2 border-gray-200 rounded-xl text-center font-black text-2xl bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:border-red-500 outline-none transition-colors" value={statValues.sales} onChange={(e) => setStatValues({ ...statValues, sales: e.target.value })} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-2 dark:text-gray-300">مانده قبل (اصلاح دستی)</label>
                            <input type="number" className="w-full p-3 border rounded-xl text-center font-bold bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white text-lg" value={statValues.prev} onChange={(e) => setStatValues({ ...statValues, prev: e.target.value })} />
                        </div>
                    </div>

                    {(productHasKg || Number(statValues.prodKg) > 0) && (
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
                            <h4 className="text-sm font-black text-metro-blue flex items-center gap-2 mb-4"><Icons.HardDrive className="w-5 h-5"/> وزن (کیلوگرم)</h4>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-bold mb-2 dark:text-gray-300">تولید (Kg)</label>
                                    <input type="number" step="0.1" className="w-full p-4 border-2 border-gray-200 rounded-xl text-center font-black text-2xl bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:border-green-500 outline-none transition-colors" value={statValues.prodKg} onChange={(e) => setStatValues({ ...statValues, prodKg: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-2 dark:text-gray-300">فروش (Kg)</label>
                                    <input type="number" step="0.1" className="w-full p-4 border-2 border-gray-200 rounded-xl text-center font-black text-2xl bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:border-red-500 outline-none transition-colors" value={statValues.salesKg} onChange={(e) => setStatValues({ ...statValues, salesKg: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-2 dark:text-gray-300">مانده قبل (Kg)</label>
                                <input type="number" step="0.1" className="w-full p-3 border rounded-xl text-center font-bold bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white text-lg" value={statValues.prevKg} onChange={(e) => setStatValues({ ...statValues, prevKg: e.target.value })} />
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                        <Button variant="secondary" onClick={() => setEditStat(null)}>انصراف</Button>
                        <Button onClick={handleSaveStat}>ذخیره تغییرات</Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={!!editInvoice} onClose={() => setEditInvoice(null)} title="ویرایش کامل حواله">
                 <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1 custom-scrollbar">
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-2xl border border-orange-200 dark:border-orange-800">
                        <label className="block text-xs font-bold mb-2 text-orange-800 dark:text-orange-300">رمز حواله (اصلاحیه)</label>
                        <input 
                            type="text" 
                            dir="ltr"
                            maxLength={10}
                            className="w-full p-4 border-2 border-orange-300 rounded-xl text-center font-black text-3xl tracking-[0.2em] bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:border-metro-orange outline-none transition-colors"
                            value={invoiceValues.invoiceNumber}
                            onChange={(e) => setInvoiceValues({ ...invoiceValues, invoiceNumber: e.target.value })}
                            placeholder=""
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-2 dark:text-gray-300">تعداد کارتن</label>
                            <input type="number" className="w-full p-4 border-2 border-gray-200 rounded-xl text-center font-black text-2xl bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:border-metro-orange outline-none transition-colors" value={invoiceValues.cartons} onChange={(e) => setInvoiceValues({ ...invoiceValues, cartons: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-2 dark:text-gray-300">وزن (کیلوگرم)</label>
                            <input type="number" className="w-full p-4 border-2 border-gray-200 rounded-xl text-center font-black text-2xl bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:border-metro-orange outline-none transition-colors" value={invoiceValues.weight} onChange={(e) => setInvoiceValues({ ...invoiceValues, weight: e.target.value })} />
                        </div>
                    </div>
                    
                    <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                        <label className="block text-xs font-bold mb-2 dark:text-gray-300">نام راننده</label>
                        <input type="text" className="w-full p-3 border rounded-xl text-right bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white font-bold text-lg" value={invoiceValues.driverName} onChange={(e) => setInvoiceValues({ ...invoiceValues, driverName: e.target.value })} placeholder="نام راننده" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-2 dark:text-gray-300">شماره تماس</label>
                            <input type="text" dir="ltr" className="w-full p-3 border rounded-xl text-center bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono text-lg" value={invoiceValues.driverPhone} onChange={(e) => setInvoiceValues({ ...invoiceValues, driverPhone: e.target.value })} placeholder="" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-2 dark:text-gray-300">پلاک خودرو</label>
                            <input type="text" className="w-full p-3 border rounded-xl text-center bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white font-bold text-lg" value={invoiceValues.plateNumber} onChange={(e) => setInvoiceValues({ ...invoiceValues, plateNumber: e.target.value })} placeholder="" />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                        <Button variant="secondary" onClick={() => setEditInvoice(null)}>انصراف</Button>
                        <Button onClick={handleSaveInvoice}>ذخیره تغییرات</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default RecentRecords;
