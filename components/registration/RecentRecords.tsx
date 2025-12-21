import React, { useState, useMemo } from 'react';
import { useStatisticsStore, DailyStatistic } from '../../store/statisticsStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useFarmStore } from '../../store/farmStore';
import { useAuthStore } from '../../store/authStore';
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
    isEditable: (createdAt?: number) => boolean;
    onEdit: (stat: DailyStatistic) => void;
    onDelete: (id: string) => void;
}

const StatCard: React.FC<StatCardProps> = ({ stat, getProductName, getProductUnit, isEditable, onEdit, onDelete }) => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 relative overflow-hidden group hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-4">
            <div>
                <h4 className="font-black text-lg md:text-xl text-gray-800 dark:text-gray-100">{getProductName(stat.productId)}</h4>
                <span className="text-xs text-gray-400 font-bold">{getProductUnit(stat.productId)}</span>
            </div>
            
            <div className="flex gap-2">
                {isEditable(stat.createdAt) ? (
                    <>
                        <button onClick={() => onEdit(stat)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                            <Icons.Edit className="w-5 h-5" />
                        </button>
                        <button onClick={() => onDelete(stat.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                            <Icons.Trash className="w-5 h-5" />
                        </button>
                    </>
                ) : (
                    <Icons.Lock className="w-5 h-5 text-gray-300" />
                )}
            </div>
        </div>

        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3">
            <div className="flex flex-col items-center flex-1 border-l border-gray-200 dark:border-gray-700">
                <span className="text-xs font-bold text-gray-500 mb-1">تولید</span>
                <span className="text-2xl font-black text-green-600">+{toPersianDigits(stat.production)}</span>
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
            <div className="absolute bottom-1 left-3 text-[10px] text-amber-600 font-bold bg-amber-50 px-2 rounded-full">
                ویرایش شده
            </div>
        )}
    </div>
);

interface InvoiceCardProps {
    inv: Invoice;
    getProductName: (id: string) => string;
    isEditable: (createdAt?: number) => boolean;
    onEdit: (inv: Invoice) => void;
    onDelete: (id: string) => void;
}

const InvoiceCard: React.FC<InvoiceCardProps> = ({ inv, getProductName, isEditable, onEdit, onDelete }) => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border-r-4 border-metro-orange p-5 relative group hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
                <div className="bg-orange-100 dark:bg-orange-900/20 p-2 rounded-full text-orange-600">
                    <Icons.FileText className="w-6 h-6" />
                </div>
                <div>
                    <span className="block text-xs font-bold text-gray-400">شماره حواله</span>
                    <span className="font-mono text-xl font-black tracking-widest text-gray-800 dark:text-gray-100">{toPersianDigits(inv.invoiceNumber)}</span>
                </div>
            </div>
            
            <div className="flex gap-2">
                {isEditable(inv.createdAt) ? (
                    <>
                        <button onClick={() => onEdit(inv)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                            <Icons.Edit className="w-5 h-5" />
                        </button>
                        <button onClick={() => onDelete(inv.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                            <Icons.Trash className="w-5 h-5" />
                        </button>
                    </>
                ) : (
                    <Icons.Lock className="w-5 h-5 text-gray-300" />
                )}
            </div>
        </div>

        <div className="mb-4">
                <h4 className="font-bold text-lg text-gray-700 dark:text-gray-200">{getProductName(inv.productId || '')}</h4>
                {inv.driverName && <p className="text-sm text-gray-500 mt-1">راننده: {inv.driverName} | پلاک: {toPersianDigits(inv.plateNumber || '-')}</p>}
        </div>

        <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-2 text-center">
                <span className="block text-[10px] font-bold text-gray-500">تعداد</span>
                <span className="font-black text-xl text-gray-800 dark:text-white">{toPersianDigits(inv.totalCartons)}</span>
            </div>
            <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-2 text-center">
                <span className="block text-[10px] font-bold text-gray-500">وزن (Kg)</span>
                <span className="font-black text-xl text-metro-blue">{toPersianDigits(inv.totalWeight)}</span>
            </div>
        </div>
    </div>
);

const RecentRecords: React.FC = () => {
    const { statistics, deleteStatistic, updateStatistic } = useStatisticsStore();
    const { invoices, deleteInvoice, updateInvoice } = useInvoiceStore();
    const { user } = useAuthStore();
    const { products } = useFarmStore();
    const { confirm } = useConfirm();
    const { addToast } = useToastStore();
    
    // View State
    const [activeTab, setActiveTab] = useState<'stats' | 'invoices'>('stats');
    const [expandedHistoryDates, setExpandedHistoryDates] = useState<string[]>([]);

    // Edit States
    const [editStat, setEditStat] = useState<DailyStatistic | null>(null);
    const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
    
    // Values for Edit
    const [statValues, setStatValues] = useState({ prod: 0, sales: 0, prev: 0 });
    const [invoiceValues, setInvoiceValues] = useState({ 
        cartons: 0, 
        weight: 0,
        driverName: '',
        plateNumber: '',
        driverPhone: ''
    });

    const farmId = user?.assignedFarms?.[0]?.id;
    const today = normalizeDate(getTodayJalali());

    // --- Data Processing ---
    const getProductName = (id: string) => products.find(p => p.id === id)?.name || 'محصول حذف شده';
    const getProductUnit = (id: string) => products.find(p => p.id === id)?.unit === 'CARTON' ? 'کارتن' : 'واحد';

    const isEditable = (createdAt?: number) => {
        if (!createdAt) return false;
        const now = Date.now();
        const diff = now - createdAt;
        return diff < 5 * 60 * 60 * 1000; // 5 Hours
    };

    // Filter and Sort Data
    const { todayStats, historyStatsGrouped } = useMemo<{
        todayStats: DailyStatistic[];
        historyStatsGrouped: Record<string, DailyStatistic[]>;
    }>(() => {
        const farmStats = statistics.filter(s => s.farmId === farmId);
        const todayRecs = farmStats.filter(s => s.date === today).sort((a,b) => b.createdAt - a.createdAt);
        const historyRecs = farmStats.filter(s => s.date !== today).sort((a,b) => b.date.localeCompare(a.date));

        // Group history by date
        const grouped: Record<string, DailyStatistic[]> = {};
        historyRecs.forEach(rec => {
            if (!grouped[rec.date]) grouped[rec.date] = [];
            grouped[rec.date].push(rec);
        });

        return { todayStats: todayRecs, historyStatsGrouped: grouped };
    }, [statistics, farmId, today]);

    const { todayInvoices, historyInvoicesGrouped } = useMemo<{
        todayInvoices: Invoice[];
        historyInvoicesGrouped: Record<string, Invoice[]>;
    }>(() => {
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

    // --- Handlers ---

    const toggleHistoryDate = (date: string) => {
        setExpandedHistoryDates(prev => 
            prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
        );
    };

    const handleDeleteStat = async (id: string) => {
        const yes = await confirm({ title: 'حذف آمار', message: 'آیا از حذف این رکورد اطمینان دارید؟', type: 'danger' });
        if(yes) deleteStatistic(id);
    };

    const handleDeleteInv = async (id: string) => {
        const yes = await confirm({ title: 'حذف حواله', message: 'آیا از حذف این حواله اطمینان دارید؟', type: 'danger' });
        if(yes) deleteInvoice(id);
    };

    const handleEditStatOpen = (stat: DailyStatistic) => {
        setEditStat(stat);
        setStatValues({ 
            prod: stat.production, 
            sales: stat.sales || 0,
            prev: stat.previousBalance || 0 
        });
    };

    const handleSaveStat = () => {
        if (!editStat) return;
        const newInventory = statValues.prev + statValues.prod - statValues.sales;
        updateStatistic(editStat.id, {
            production: statValues.prod,
            sales: statValues.sales,
            previousBalance: statValues.prev,
            currentInventory: newInventory
        });
        setEditStat(null);
        addToast('آمار با موفقیت ویرایش شد', 'success');
    };

    const handleEditInvoiceOpen = (inv: Invoice) => {
        setEditInvoice(inv);
        setInvoiceValues({ 
            cartons: inv.totalCartons, 
            weight: inv.totalWeight,
            driverName: inv.driverName || '',
            plateNumber: inv.plateNumber || '',
            driverPhone: inv.driverPhone || ''
        });
    };

    const handleSaveInvoice = () => {
        if (!editInvoice) return;
        updateInvoice(editInvoice.id, {
            totalCartons: invoiceValues.cartons,
            totalWeight: invoiceValues.weight,
            driverName: invoiceValues.driverName,
            plateNumber: invoiceValues.plateNumber,
            driverPhone: invoiceValues.driverPhone
        });
        setEditInvoice(null);
        addToast('حواله با موفقیت ویرایش شد', 'success');
    };

    return (
        <div className="pb-24">
            {/* --- Custom Tab Switcher --- */}
            <div className="flex p-1 bg-gray-200 dark:bg-gray-700 rounded-xl mb-6 mx-auto max-w-lg sticky top-0 z-20 shadow-lg">
                <button 
                    onClick={() => setActiveTab('stats')}
                    className={`flex-1 py-3 rounded-lg text-sm font-black transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'stats' 
                        ? 'bg-white dark:bg-gray-800 text-metro-blue shadow-md scale-[1.02]' 
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                >
                    <Icons.BarChart className="w-5 h-5" />
                    آمار تولید
                </button>
                <button 
                    onClick={() => setActiveTab('invoices')}
                    className={`flex-1 py-3 rounded-lg text-sm font-black transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'invoices' 
                        ? 'bg-white dark:bg-gray-800 text-metro-orange shadow-md scale-[1.02]' 
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                >
                    <Icons.FileText className="w-5 h-5" />
                    حواله‌های فروش
                </button>
            </div>

            <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-300">
                
                {/* --- Section: TODAY --- */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        <h3 className="font-black text-xl text-gray-800 dark:text-white">امروز ({toPersianDigits(today)})</h3>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        {activeTab === 'stats' ? (
                            todayStats.length > 0 ? (
                                todayStats.map(stat => (
                                    <StatCard 
                                        key={stat.id} 
                                        stat={stat} 
                                        getProductName={getProductName}
                                        getProductUnit={getProductUnit}
                                        isEditable={isEditable}
                                        onEdit={handleEditStatOpen}
                                        onDelete={handleDeleteStat}
                                    />
                                ))
                            ) : (
                                <div className="col-span-full p-8 text-center text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                                    هنوز آماری برای امروز ثبت نشده است.
                                </div>
                            )
                        ) : (
                            todayInvoices.length > 0 ? (
                                todayInvoices.map(inv => (
                                    <InvoiceCard 
                                        key={inv.id} 
                                        inv={inv} 
                                        getProductName={getProductName}
                                        isEditable={isEditable}
                                        onEdit={handleEditInvoiceOpen}
                                        onDelete={handleDeleteInv}
                                    />
                                ))
                            ) : (
                                <div className="col-span-full p-8 text-center text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                                    هنوز حواله‌ای برای امروز ثبت نشده است.
                                </div>
                            )
                        )}
                    </div>
                </div>

                {/* --- Section: HISTORY --- */}
                <div className="space-y-4 pt-4 border-t-2 border-dashed border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 px-2 opacity-70">
                        <Icons.Refresh className="w-5 h-5" />
                        <h3 className="font-bold text-lg text-gray-600 dark:text-gray-300">روزهای گذشته</h3>
                    </div>

                    <div className="space-y-2">
                        {activeTab === 'stats' ? (
                            Object.entries(historyStatsGrouped).length === 0 ? (
                                <p className="text-center text-gray-400 text-sm py-4">سابقه‌ای یافت نشد.</p>
                            ) : (
                                Object.entries(historyStatsGrouped).map(([date, items]) => {
                                    const stats = items as DailyStatistic[];
                                    return (
                                        <div key={date} className="bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden">
                                            <button 
                                                onClick={() => toggleHistoryDate(date)}
                                                className="w-full flex items-center justify-between p-4 hover:bg-white dark:hover:bg-gray-700 transition-colors"
                                            >
                                                <span className="font-black text-gray-700 dark:text-gray-200">{toPersianDigits(date)}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-bold bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-gray-600 dark:text-gray-300">
                                                        {toPersianDigits(stats.length)} مورد
                                                    </span>
                                                    <Icons.ChevronDown className={`w-5 h-5 transition-transform ${expandedHistoryDates.includes(date) ? 'rotate-180' : ''}`} />
                                                </div>
                                            </button>
                                            <AnimatePresence>
                                                {expandedHistoryDates.includes(date) && (
                                                    <motion.div 
                                                        initial={{ height: 0 }} 
                                                        animate={{ height: 'auto' }} 
                                                        exit={{ height: 0 }} 
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="p-4 grid gap-4 md:grid-cols-2 border-t border-gray-200 dark:border-gray-700">
                                                            {stats.map(stat => (
                                                                <StatCard 
                                                                    key={stat.id} 
                                                                    stat={stat} 
                                                                    getProductName={getProductName}
                                                                    getProductUnit={getProductUnit}
                                                                    isEditable={isEditable}
                                                                    onEdit={handleEditStatOpen}
                                                                    onDelete={handleDeleteStat}
                                                                />
                                                            ))}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })
                            )
                        ) : (
                             Object.entries(historyInvoicesGrouped).length === 0 ? (
                                <p className="text-center text-gray-400 text-sm py-4">سابقه‌ای یافت نشد.</p>
                            ) : (
                                Object.entries(historyInvoicesGrouped).map(([date, items]) => {
                                    const invs = items as Invoice[];
                                    return (
                                        <div key={date} className="bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden">
                                            <button 
                                                onClick={() => toggleHistoryDate(date)}
                                                className="w-full flex items-center justify-between p-4 hover:bg-white dark:hover:bg-gray-700 transition-colors"
                                            >
                                                <span className="font-black text-gray-700 dark:text-gray-200">{toPersianDigits(date)}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-bold bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-gray-600 dark:text-gray-300">
                                                        {toPersianDigits(invs.length)} حواله
                                                    </span>
                                                    <Icons.ChevronDown className={`w-5 h-5 transition-transform ${expandedHistoryDates.includes(date) ? 'rotate-180' : ''}`} />
                                                </div>
                                            </button>
                                            <AnimatePresence>
                                                {expandedHistoryDates.includes(date) && (
                                                    <motion.div 
                                                        initial={{ height: 0 }} 
                                                        animate={{ height: 'auto' }} 
                                                        exit={{ height: 0 }} 
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="p-4 grid gap-4 md:grid-cols-2 border-t border-gray-200 dark:border-gray-700">
                                                            {invs.map(inv => (
                                                                <InvoiceCard 
                                                                    key={inv.id} 
                                                                    inv={inv} 
                                                                    getProductName={getProductName}
                                                                    isEditable={isEditable}
                                                                    onEdit={handleEditInvoiceOpen}
                                                                    onDelete={handleDeleteInv}
                                                                />
                                                            ))}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })
                            )
                        )}
                    </div>
                </div>
            </div>

            {/* Edit Stat Modal */}
            <Modal isOpen={!!editStat} onClose={() => setEditStat(null)} title="ویرایش آمار">
                <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-xs font-bold text-blue-800 dark:text-blue-300 mb-4 leading-loose">
                        توجه: با تغییر مقادیر تولید یا فروش، موجودی نهایی به صورت خودکار محاسبه می‌شود.
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-2 dark:text-gray-300">تولید (کارتن/دبه)</label>
                            <input 
                                type="number" 
                                className="w-full p-3 border-2 border-gray-200 rounded-xl text-center font-black text-xl bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:border-green-500 outline-none"
                                value={statValues.prod}
                                onChange={(e) => setStatValues({ ...statValues, prod: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-2 dark:text-gray-300">فروش</label>
                            <input 
                                type="number" 
                                className="w-full p-3 border-2 border-gray-200 rounded-xl text-center font-black text-xl bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:border-red-500 outline-none"
                                value={statValues.sales}
                                onChange={(e) => setStatValues({ ...statValues, sales: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-2 dark:text-gray-300">مانده قبل (اصلاح دستی)</label>
                        <input 
                            type="number" 
                            className="w-full p-3 border rounded-xl text-center font-bold bg-gray-50 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                            value={statValues.prev}
                            onChange={(e) => setStatValues({ ...statValues, prev: Number(e.target.value) })}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700 mt-2">
                        <Button variant="secondary" onClick={() => setEditStat(null)}>انصراف</Button>
                        <Button onClick={handleSaveStat}>ذخیره تغییرات</Button>
                    </div>
                </div>
            </Modal>

            {/* Edit Invoice Modal */}
            <Modal isOpen={!!editInvoice} onClose={() => setEditInvoice(null)} title="ویرایش کامل حواله">
                 <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-2 dark:text-gray-300">تعداد کارتن</label>
                            <input 
                                type="number" 
                                className="w-full p-3 border-2 border-gray-200 rounded-xl text-center font-black text-xl bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:border-metro-orange outline-none"
                                value={invoiceValues.cartons}
                                onChange={(e) => setInvoiceValues({ ...invoiceValues, cartons: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-2 dark:text-gray-300">وزن (کیلوگرم)</label>
                            <input 
                                type="number" 
                                className="w-full p-3 border-2 border-gray-200 rounded-xl text-center font-black text-xl bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:border-metro-orange outline-none"
                                value={invoiceValues.weight}
                                onChange={(e) => setInvoiceValues({ ...invoiceValues, weight: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                    
                    <div className="border-t border-gray-100 dark:border-gray-700 pt-4 mt-2">
                        <label className="block text-xs font-bold mb-2 dark:text-gray-300">نام راننده</label>
                        <input 
                            type="text" 
                            className="w-full p-3 border rounded-xl text-right bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white font-bold"
                            value={invoiceValues.driverName}
                            onChange={(e) => setInvoiceValues({ ...invoiceValues, driverName: e.target.value })}
                            placeholder="نام راننده"
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-2 dark:text-gray-300">شماره تماس</label>
                            <input 
                                type="text" 
                                dir="ltr"
                                className="w-full p-3 border rounded-xl text-center bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono"
                                value={invoiceValues.driverPhone}
                                onChange={(e) => setInvoiceValues({ ...invoiceValues, driverPhone: e.target.value })}
                                placeholder="09..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-2 dark:text-gray-300">پلاک خودرو</label>
                            <input 
                                type="text" 
                                className="w-full p-3 border rounded-xl text-center bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white font-bold"
                                value={invoiceValues.plateNumber}
                                onChange={(e) => setInvoiceValues({ ...invoiceValues, plateNumber: e.target.value })}
                                placeholder="پلاک"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700 mt-2">
                        <Button variant="secondary" onClick={() => setEditInvoice(null)}>انصراف</Button>
                        <Button onClick={handleSaveInvoice}>ذخیره تغییرات</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default RecentRecords;