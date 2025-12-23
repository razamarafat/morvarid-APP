
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
}

const StatCard: React.FC<StatCardProps> = ({ stat, getProductName, getProductUnit, isEditable, onEdit, onDelete }) => {
    const isLiquid = getProductName(stat.productId).includes('مایع');
    
    return (
        <div className="bg-white dark:bg-gray-800 rounded-[24px] shadow-sm border border-gray-200 dark:border-gray-700 p-6 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h4 className="font-black text-xl text-gray-800 dark:text-gray-100">{getProductName(stat.productId)}</h4>
                    <span className="text-xs text-gray-400 font-bold bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{getProductUnit(stat.productId)}</span>
                </div>
                
                <div className="flex gap-2">
                    {isEditable(stat.createdAt) ? (
                        <>
                            <button onClick={() => onEdit(stat)} className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                                <Icons.Edit className="w-5 h-5" />
                            </button>
                            <button onClick={() => onDelete(stat.id)} className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                                <Icons.Trash className="w-5 h-5" />
                            </button>
                        </>
                    ) : (
                        <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-full" title="زمان ویرایش تمام شده">
                             <Icons.Lock className="w-5 h-5 text-gray-300" />
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4">
                <div className="flex flex-col items-center flex-1 border-l border-gray-200 dark:border-gray-700">
                    <span className="text-xs font-bold text-gray-500 mb-1">تولید</span>
                    {isLiquid ? (
                        <div className="flex flex-col items-center">
                            {stat.production > 0 && <span className="text-lg font-black text-green-600">+{toPersianDigits(stat.production)} <small className="text-[10px]">Crt</small></span>}
                            {stat.productionKg ? <span className="text-lg font-black text-metro-blue">{toPersianDigits(stat.productionKg)} <small className="text-[10px]">Kg</small></span> : null}
                        </div>
                    ) : (
                        <span className="text-2xl font-black text-green-600">+{toPersianDigits(stat.production)}</span>
                    )}
                </div>
                <div className="flex flex-col items-center flex-1 border-l border-gray-200 dark:border-gray-700">
                    <span className="text-xs font-bold text-gray-500 mb-1">فروش</span>
                    <span className="text-xl font-black text-red-500">-{toPersianDigits(isLiquid ? (stat.salesKg || 0) : (stat.sales || 0))}</span>
                </div>
                <div className="flex flex-col items-center flex-1">
                    <span className="text-xs font-bold text-gray-500 mb-1">موجودی</span>
                    <span className="text-2xl font-black text-metro-blue">{toPersianDigits(isLiquid ? (stat.currentInventoryKg || 0) : (stat.currentInventory || 0))}</span>
                </div>
            </div>
            
            {stat.updatedAt && (
                <div className="absolute bottom-2 left-4 text-[10px] text-amber-600 font-bold bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                    ویرایش شده
                </div>
            )}
        </div>
    );
};

interface InvoiceCardProps {
    inv: Invoice;
    getProductName: (id: string) => string;
    isEditable: (createdAt?: number) => boolean;
    onEdit: (inv: Invoice) => void;
    onDelete: (id: string) => void;
}

const InvoiceCard: React.FC<InvoiceCardProps> = ({ inv, getProductName, isEditable, onEdit, onDelete }) => {
    const isLiquid = getProductName(inv.productId || '').includes('مایع');

    return (
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
                    {isEditable(inv.createdAt) ? (
                        <>
                            <button onClick={() => onEdit(inv)} className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                                <Icons.Edit className="w-5 h-5" />
                            </button>
                            <button onClick={() => onDelete(inv.id)} className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                                <Icons.Trash className="w-5 h-5" />
                            </button>
                        </>
                    ) : (
                        <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-full" title="زمان ویرایش تمام شده">
                            <Icons.Lock className="w-5 h-5 text-gray-300" />
                        </div>
                    )}
                </div>
            </div>

            <div className="mb-5">
                <h4 className="font-bold text-lg text-gray-700 dark:text-gray-200">{getProductName(inv.productId || '')}</h4>
                <div className="flex flex-col gap-1 mt-2">
                    {inv.driverName && <p className="text-sm text-gray-500 flex items-center gap-2">
                        <Icons.User className="w-4 h-4" /> {inv.driverName} 
                    </p>}
                    {inv.plateNumber && <p className="text-xs font-mono text-gray-400 flex items-center gap-2">
                        <Icons.HardDrive className="w-4 h-4" /> {toPersianDigits(inv.plateNumber)}
                    </p>}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className={`flex-1 rounded-2xl p-3 text-center bg-white border`}>
                    <span className="block text-[10px] font-bold text-gray-500 mb-1">تعداد</span>
                    <span className="font-black text-xl text-gray-800 dark:text-white">{toPersianDigits(inv.totalCartons || 0)}</span>
                </div>
                <div className={`flex-1 rounded-2xl p-3 text-center bg-white border ${isLiquid ? 'ring-2 ring-blue-500/20' : ''}`}>
                    <span className={`block text-[10px] font-bold mb-1 ${isLiquid ? 'text-blue-600' : 'text-gray-500'}`}>وزن (Kg)</span>
                    <span className={`font-black text-xl ${isLiquid ? 'text-blue-700 dark:text-blue-400' : 'text-metro-blue'}`}>{toPersianDigits(inv.totalWeight)}</span>
                </div>
            </div>
        </div>
    );
};

const RecentRecords: React.FC = () => {
    const { statistics, deleteStatistic, updateStatistic } = useStatisticsStore();
    const { invoices, deleteInvoice, updateInvoice } = useInvoiceStore();
    const { user } = useAuthStore();
    const { products, getProductById } = useFarmStore();
    const { confirm } = useConfirm();
    const { addToast } = useToastStore();
    
    const [activeTab, setActiveTab] = useState<'stats' | 'invoices'>('stats');
    const [editStat, setEditStat] = useState<DailyStatistic | null>(null);
    const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
    
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
    const [showLetterPicker, setShowLetterPicker] = useState(false);

    const farmId = user?.assignedFarms?.[0]?.id;
    const today = normalizeDate(getTodayJalali());

    const getProductName = (id: string) => products.find(p => p.id === id)?.name || 'محصول حذف شده';
    const isLiquid = (pid: string) => getProductName(pid).includes('مایع');

    const isEditable = (createdAt?: number) => {
        if (user?.role === UserRole.ADMIN) return true; 
        if (!createdAt) return true; 
        const now = Date.now();
        const diff = now - createdAt;
        return diff < 18000000; // 5 Hours
    };

    const { todayStats, todayInvoices } = useMemo(() => {
        const farmStats = statistics.filter(s => s.farmId === farmId && s.date === today);
        const farmInvoices = invoices.filter(i => i.farmId === farmId && i.date === today);
        return { 
            todayStats: farmStats.sort((a,b) => b.createdAt - a.createdAt), 
            todayInvoices: farmInvoices.sort((a,b) => b.createdAt - a.createdAt) 
        };
    }, [statistics, invoices, farmId, today]);

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

    const handleSaveStat = async () => {
        if (!editStat) return;
        const prod = Number(statValues.prod);
        const prev = Number(statValues.prev);
        const prodKg = Number(statValues.prodKg);
        const prevKg = Number(statValues.prevKg);

        const result = await updateStatistic(editStat.id, {
            production: prod,
            previousBalance: prev,
            currentInventory: prev + prod - (editStat.sales || 0),
            productionKg: prodKg,
            previousBalanceKg: prevKg,
            currentInventoryKg: prevKg + prodKg - (editStat.salesKg || 0)
        });

        if (result.success) { setEditStat(null); addToast('آمار ویرایش شد', 'success'); }
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

        if (result.success) { setEditInvoice(null); addToast('حواله ویرایش شد', 'success'); }
        else addToast('خطا در ویرایش: ' + result.error, 'error');
    };

    const inputClasses = "w-full p-4 border-2 rounded-xl text-center font-black text-2xl bg-white focus:border-metro-blue outline-none transition-all";

    return (
        <div className="pb-24">
            <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-full mb-8 mx-auto max-w-md sticky top-6 z-20 shadow-md border border-gray-200 dark:border-gray-700">
                <button onClick={() => setActiveTab('stats')} className={`flex-1 py-3 rounded-full text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'stats' ? 'bg-white dark:bg-gray-700 text-metro-blue shadow-sm' : 'text-gray-500'}`}>
                    <Icons.BarChart className="w-5 h-5" /> آمار تولید
                </button>
                <button onClick={() => setActiveTab('invoices')} className={`flex-1 py-3 rounded-full text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'invoices' ? 'bg-white dark:bg-gray-700 text-metro-orange shadow-sm' : 'text-gray-500'}`}>
                    <Icons.FileText className="w-5 h-5" /> حواله‌ها
                </button>
            </div>

            <div className="max-w-4xl mx-auto space-y-10 px-2">
                <div className="space-y-4">
                    <h3 className="font-black text-2xl px-2 text-gray-800 dark:text-white">امروز ({toPersianDigits(today)})</h3>
                    <div className="grid gap-6 md:grid-cols-2">
                        {activeTab === 'stats' ? (
                            todayStats.length > 0 ? todayStats.map(stat => <StatCard key={stat.id} stat={stat} getProductName={getProductName} getProductUnit={(id)=>products.find(p=>p.id===id)?.unit==='CARTON'?'کارتن':'واحد'} isEditable={isEditable} onEdit={handleEditStatOpen} onDelete={(id)=>deleteStatistic(id)} />) : <div className="col-span-full p-10 text-center text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-[24px]">هنوز آماری ثبت نشده است.</div>
                        ) : (
                            todayInvoices.length > 0 ? todayInvoices.map(inv => <InvoiceCard key={inv.id} inv={inv} getProductName={getProductName} isEditable={isEditable} onEdit={handleEditInvoiceOpen} onDelete={(id)=>deleteInvoice(id)} />) : <div className="col-span-full p-10 text-center text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-[24px]">هنوز حواله‌ای ثبت نشده است.</div>
                        )}
                    </div>
                </div>
            </div>

            <Modal isOpen={!!editStat} onClose={() => setEditStat(null)} title="ویرایش آمار روزانه">
                <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1">
                    <div className="p-4 bg-white rounded-2xl border-2 border-blue-100 flex flex-col gap-2 shadow-sm">
                        <span className="text-xs font-bold text-blue-600">اطلاعات تعداد (کارتن)</span>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-[10px] font-black mb-1 opacity-60">تولید (تعداد)</label><input type="tel" inputMode="numeric" className={inputClasses} value={statValues.prod} onChange={(e) => setStatValues({ ...statValues, prod: e.target.value })} /></div>
                            <div><label className="block text-[10px] font-black mb-1 opacity-60">موجودی قبل (تعداد)</label><input type="tel" inputMode="numeric" className={inputClasses} value={statValues.prev} onChange={(e) => setStatValues({ ...statValues, prev: e.target.value })} /></div>
                        </div>
                    </div>
                    {editStat && isLiquid(editStat.productId) && (
                        <div className="p-4 bg-white rounded-2xl border-2 border-indigo-100 flex flex-col gap-2 shadow-sm">
                            <span className="text-xs font-bold text-indigo-600">اطلاعات وزن (کیلوگرم)</span>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-black mb-1 opacity-60">تولید (Kg)</label><input type="tel" inputMode="decimal" className={inputClasses} value={statValues.prodKg} onChange={(e) => setStatValues({ ...statValues, prodKg: e.target.value })} /></div>
                                <div><label className="block text-[10px] font-black mb-1 opacity-60">موجودی قبل (Kg)</label><input type="tel" inputMode="decimal" className={inputClasses} value={statValues.prevKg} onChange={(e) => setStatValues({ ...statValues, prevKg: e.target.value })} /></div>
                            </div>
                        </div>
                    )}
                    <p className="text-[10px] text-gray-400 text-center">توجه: مقدار فروش به صورت خودکار بر اساس حواله‌ها محاسبه می‌شود.</p>
                    <div className="flex justify-end gap-3 pt-4 border-t"><Button variant="secondary" onClick={() => setEditStat(null)}>انصراف</Button><Button onClick={handleSaveStat}>بروزرسانی آمار</Button></div>
                </div>
            </Modal>

            <Modal isOpen={!!editInvoice} onClose={() => setEditInvoice(null)} title="ویرایش حواله خروج">
                <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1 custom-scrollbar">
                    <div className="bg-white p-4 rounded-2xl border border-orange-200">
                        <label className="block text-xs font-bold mb-2 text-orange-700">رمز حواله</label>
                        <input type="tel" inputMode="numeric" dir="ltr" className="w-full p-4 border-2 border-orange-100 rounded-xl text-center font-black text-3xl tracking-widest bg-white focus:border-metro-orange outline-none" value={invoiceValues.invoiceNumber} onChange={(e) => setInvoiceValues({ ...invoiceValues, invoiceNumber: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-xs font-bold mb-2">تعداد کارتن</label><input type="tel" inputMode="numeric" className={inputClasses} value={invoiceValues.cartons} onChange={(e) => setInvoiceValues({ ...invoiceValues, cartons: e.target.value })} /></div>
                        <div><label className="block text-xs font-bold mb-2 text-blue-600">وزن واقعی (Kg)</label><input type="tel" inputMode="decimal" className={`${inputClasses} border-blue-100`} value={invoiceValues.weight} onChange={(e) => setInvoiceValues({ ...invoiceValues, weight: e.target.value })} /></div>
                    </div>
                    <div className="space-y-4 pt-4 border-t">
                        <h4 className="font-bold text-gray-400 text-sm">مشخصات راننده و پلاک</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-xs font-bold mb-1">نام راننده</label><input type="text" className="w-full p-4 bg-white border-2 border-gray-100 rounded-xl font-bold" value={invoiceValues.driverName} onChange={(e) => setInvoiceValues({ ...invoiceValues, driverName: e.target.value })} /></div>
                            <div><label className="block text-xs font-bold mb-1">شماره تماس</label><input type="tel" inputMode="numeric" dir="ltr" className="w-full p-4 bg-white border-2 border-gray-100 rounded-xl text-center font-mono font-bold" value={invoiceValues.driverPhone} onChange={(e) => setInvoiceValues({ ...invoiceValues, driverPhone: e.target.value })} /></div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-2 text-gray-500">شماره پلاک</label>
                            <div className="flex flex-row gap-2 items-center" dir="ltr">
                                <input type="tel" maxLength={2} value={plateParts.part1} onChange={e => setPlateParts(p => ({...p, part1: e.target.value.replace(/\D/g, '')}))} className="w-14 h-16 border-2 rounded-xl text-center font-black text-xl bg-white focus:border-metro-blue outline-none" placeholder="11" />
                                <div className="relative">
                                    <button type="button" onClick={() => setShowLetterPicker(!showLetterPicker)} className="w-16 h-16 border-2 rounded-xl font-black text-xl bg-white text-blue-600 border-blue-100 flex items-center justify-center">{plateParts.letter || 'حرف'}</button>
                                    <AnimatePresence>
                                        {showLetterPicker && (
                                            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute bottom-full left-0 right-0 mb-2 bg-white border-2 border-blue-200 shadow-2xl rounded-2xl p-1 z-[100] flex flex-col gap-1 max-h-56 overflow-y-auto custom-scrollbar">
                                                {PERSIAN_LETTERS.map(l => (
                                                    <button key={l} type="button" onClick={() => { setPlateParts(p => ({...p, letter: l})); setShowLetterPicker(false); }} className="w-full p-4 hover:bg-metro-blue hover:text-white rounded-xl font-black text-center transition-colors border-b last:border-0 border-gray-100">{l}</button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <input type="tel" maxLength={3} value={plateParts.part3} onChange={e => setPlateParts(p => ({...p, part3: e.target.value.replace(/\D/g, '')}))} className="w-24 h-16 border-2 rounded-xl text-center font-black text-xl bg-white focus:border-metro-blue outline-none" placeholder="365" />
                                <div className="relative">
                                    <input type="tel" maxLength={2} value={plateParts.part4} onChange={e => setPlateParts(p => ({...p, part4: e.target.value.replace(/\D/g, '')}))} className="w-14 h-16 border-2 rounded-xl text-center font-black text-xl bg-white focus:border-metro-blue outline-none" placeholder="15" />
                                    <span className="absolute -top-3 left-0 right-0 text-center text-[8px] font-bold text-gray-400">ایران</span>
                                </div>
                            </div>
                        </div>
                        <div><label className="block text-xs font-bold mb-1">توضیحات</label><textarea className="w-full p-4 bg-white border-2 border-gray-100 rounded-xl h-20" value={invoiceValues.description} onChange={(e) => setInvoiceValues({ ...invoiceValues, description: e.target.value })} /></div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t"><Button variant="secondary" onClick={() => setEditInvoice(null)}>انصراف</Button><Button onClick={handleSaveInvoice}>ذخیره تغییرات</Button></div>
                </div>
            </Modal>
        </div>
    );
};

export default RecentRecords;
