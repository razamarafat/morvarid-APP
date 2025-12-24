
import React, { useState, useMemo } from 'react';
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
    isMotefereghe: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ stat, getProductName, getProductUnit, isEditable, onEdit, onDelete, isMotefereghe }) => {
    const isLiquid = getProductName(stat.productId).includes('مایع');
    
    return (
        <div className="bg-white dark:bg-gray-800 rounded-[24px] shadow-sm border border-gray-200 dark:border-gray-700 p-6 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h4 className="font-black text-xl text-gray-800 dark:text-gray-100">{getProductName(stat.productId)}</h4>
                    <span className="text-sm text-gray-400 font-bold bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{getProductUnit(stat.productId)}</span>
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

            {/* Content Grid: 2 cols on mobile for Morvaridi (4 items), 3 cols for Motefereghe (3 items) */}
            <div className={`grid gap-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 items-center text-center ${!isMotefereghe ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3'}`}>
                
                {/* Previous Balance - Only for Morvaridi */}
                {!isMotefereghe && (
                    <div className="flex flex-col items-center justify-center border-l border-gray-200 dark:border-gray-700 md:col-span-1 col-span-1">
                        <span className="text-xs lg:text-sm font-bold text-gray-400 mb-1">موجودی قبل</span>
                        {isLiquid ? (
                            <div className="flex flex-col items-center">
                                <span className="text-lg lg:text-xl font-black text-gray-600 dark:text-gray-300">{toPersianDigits(stat.previousBalance)}</span>
                                {stat.previousBalanceKg ? <span className="text-xs font-bold text-gray-500">{toPersianDigits(stat.previousBalanceKg)} <small>Kg</small></span> : null}
                            </div>
                        ) : (
                            <span className="text-2xl lg:text-3xl font-black text-gray-600 dark:text-gray-300">{toPersianDigits(stat.previousBalance)}</span>
                        )}
                    </div>
                )}

                <div className={`flex flex-col items-center justify-center ${!isMotefereghe ? 'border-l border-gray-200 dark:border-gray-700' : 'border-l border-gray-200 dark:border-gray-700'} md:col-span-1 col-span-1`}>
                    <span className="text-xs lg:text-sm font-bold text-gray-500 mb-1">تولید</span>
                    {isLiquid ? (
                        <div className="flex flex-col items-center">
                            {stat.production > 0 && <span className="text-lg lg:text-xl font-black text-green-600">+{toPersianDigits(stat.production)} <small className="text-xs">Crt</small></span>}
                            {stat.productionKg ? <span className="text-lg lg:text-xl font-black text-metro-blue">{toPersianDigits(stat.productionKg)} <small className="text-xs">Kg</small></span> : null}
                        </div>
                    ) : (
                        <span className="text-2xl lg:text-3xl font-black text-green-600">+{toPersianDigits(stat.production)}</span>
                    )}
                </div>

                <div className="flex flex-col items-center justify-center border-l border-gray-200 dark:border-gray-700 md:col-span-1 col-span-1">
                    <span className="text-xs lg:text-sm font-bold text-gray-500 mb-1">فروش</span>
                    <span className="text-xl lg:text-2xl font-black text-red-500">-{toPersianDigits(isLiquid ? (stat.salesKg || 0) : (stat.sales || 0))}</span>
                </div>

                <div className="flex flex-col items-center justify-center md:col-span-1 col-span-1">
                    <span className="text-xs lg:text-sm font-bold text-gray-500 mb-1">موجودی</span>
                    <span className="text-2xl lg:text-3xl font-black text-metro-blue">{toPersianDigits(isLiquid ? (stat.currentInventoryKg || 0) : (stat.currentInventory || 0))}</span>
                </div>
            </div>
            
            {stat.updatedAt && (
                <div className="absolute bottom-2 left-4 text-xs text-amber-600 font-bold bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
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

    const formatPlate = (plate?: string) => {
        if (!plate || !plate.includes('-')) return plate || '-';
        const parts = plate.split('-');
        if (parts.length === 4) {
            // Visual: 39 M 169 - 60
            return `${parts[0]} ${parts[1]} ${parts[2]} - ${parts[3]}`;
        }
        return plate;
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-[24px] shadow-sm border-l-[6px] border-metro-orange p-6 relative group hover:shadow-xl transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className="bg-orange-100 dark:bg-orange-900/20 p-2.5 rounded-full text-orange-600">
                        <Icons.FileText className="w-6 h-6" />
                    </div>
                    <div>
                        <span className="block text-sm font-bold text-gray-400">رمز حواله</span>
                        <span className="font-mono text-3xl font-black tracking-widest text-gray-800 dark:text-gray-100">{toPersianDigits(inv.invoiceNumber)}</span>
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
                <h4 className="font-bold text-xl text-gray-700 dark:text-gray-200">{getProductName(inv.productId || '')}</h4>
                <div className="flex flex-col gap-1 mt-2">
                    {inv.driverName && <p className="text-base text-gray-500 flex items-center gap-2">
                        <Icons.User className="w-4 h-4" /> {inv.driverName} 
                    </p>}
                    {inv.plateNumber && <p className="text-sm font-mono text-gray-400 flex items-center gap-2">
                        <Icons.HardDrive className="w-4 h-4" /> {formatPlate(inv.plateNumber)}
                    </p>}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className={`flex-1 rounded-2xl p-3 text-center bg-white dark:bg-gray-700 border dark:border-gray-600`}>
                    <span className="block text-sm font-bold text-gray-500 dark:text-gray-400 mb-1">تعداد</span>
                    <span className="font-black text-2xl text-gray-800 dark:text-white">{toPersianDigits(inv.totalCartons || 0)}</span>
                </div>
                <div className={`flex-1 rounded-2xl p-3 text-center bg-white dark:bg-gray-700 border dark:border-gray-600 ${isLiquid ? 'ring-2 ring-blue-500/20' : ''}`}>
                    <span className={`block text-sm font-bold mb-1 ${isLiquid ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400'}`}>وزن (Kg)</span>
                    <span className={`font-black text-2xl ${isLiquid ? 'text-blue-700 dark:text-blue-400' : 'text-metro-blue'}`}>{toPersianDigits(inv.totalWeight)}</span>
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
    const farmType = user?.assignedFarms?.[0]?.type;
    const isMotefereghe = farmType === FarmType.MOTEFEREGHE;

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

    const handleCancelStat = () => {
        setEditStat(null);
        setStatValues({ prod: '', prev: '', prodKg: '', prevKg: '' });
    };

    const handleSaveStat = async () => {
        if (!editStat) return;
        const prod = Number(statValues.prod);
        // Force 0 for Motefereghe
        const prev = isMotefereghe ? 0 : Number(statValues.prev); 
        const prodKg = Number(statValues.prodKg);
        // Force 0 for Motefereghe
        const prevKg = isMotefereghe ? 0 : Number(statValues.prevKg); 

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

        if (result.success) { setEditInvoice(null); addToast('حواله ویرایش شد', 'success'); }
        else addToast('خطا در ویرایش: ' + result.error, 'error');
    };

    // Updated styles for dark mode compatibility
    const inputClasses = "w-full p-4 border-2 rounded-xl text-center font-black text-2xl bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:border-metro-blue outline-none transition-all";

    return (
        <div className="pb-24">
            <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-full mb-8 mx-auto max-w-md sticky top-6 z-20 shadow-md border border-gray-200 dark:border-gray-700">
                <button onClick={() => setActiveTab('stats')} className={`flex-1 py-3 rounded-full text-base font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'stats' ? 'bg-white dark:bg-gray-700 text-metro-blue shadow-sm' : 'text-gray-500'}`}>
                    <Icons.BarChart className="w-5 h-5" /> آمار تولید
                </button>
                <button onClick={() => setActiveTab('invoices')} className={`flex-1 py-3 rounded-full text-base font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'invoices' ? 'bg-white dark:bg-gray-700 text-metro-orange shadow-sm' : 'text-gray-500'}`}>
                    <Icons.FileText className="w-5 h-5" /> حواله‌ها
                </button>
            </div>

            <div className="max-w-4xl mx-auto space-y-10 px-2">
                <div className="space-y-4">
                    <h3 className="font-black text-3xl px-2 text-gray-800 dark:text-white">امروز ({toPersianDigits(today)})</h3>
                    <div className="grid gap-6 md:grid-cols-2">
                        {activeTab === 'stats' ? (
                            todayStats.length > 0 ? todayStats.map(stat => <StatCard key={stat.id} stat={stat} getProductName={getProductName} getProductUnit={(id)=>products.find(p=>p.id===id)?.unit==='CARTON'?'کارتن':'واحد'} isEditable={isEditable} onEdit={handleEditStatOpen} onDelete={(id)=>deleteStatistic(id)} isMotefereghe={isMotefereghe} />) : <div className="col-span-full p-10 text-center text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-[24px]">هنوز آماری ثبت نشده است.</div>
                        ) : (
                            todayInvoices.length > 0 ? todayInvoices.map(inv => <InvoiceCard key={inv.id} inv={inv} getProductName={getProductName} isEditable={isEditable} onEdit={handleEditInvoiceOpen} onDelete={(id)=>deleteInvoice(id)} />) : <div className="col-span-full p-10 text-center text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-[24px]">هنوز حواله‌ای ثبت نشده است.</div>
                        )}
                    </div>
                </div>
            </div>

            <Modal isOpen={!!editStat} onClose={handleCancelStat} title="ویرایش آمار روزانه">
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
                    {editStat && isLiquid(editStat.productId) && (
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
                    <p className="text-xs text-gray-400 text-center">توجه: مقدار فروش به صورت خودکار بر اساس حواله‌ها محاسبه می‌شود.</p>
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700"><Button variant="secondary" onClick={handleCancelStat}>انصراف</Button><Button onClick={handleSaveStat}>بروزرسانی آمار</Button></div>
                </div>
            </Modal>

            <Modal isOpen={!!editInvoice} onClose={handleCancelInvoice} title="ویرایش حواله خروج">
                <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1 custom-scrollbar">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-orange-200 dark:border-orange-800">
                        <label className="block text-sm font-bold mb-2 text-orange-700 dark:text-orange-400">رمز حواله</label>
                        <input type="tel" inputMode="numeric" dir="ltr" className="w-full p-4 border-2 border-orange-100 dark:border-orange-900 rounded-xl text-center font-black text-3xl tracking-widest bg-white dark:bg-gray-700 dark:text-white focus:border-metro-orange outline-none" value={invoiceValues.invoiceNumber} onChange={(e) => setInvoiceValues({ ...invoiceValues, invoiceNumber: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-bold mb-2 dark:text-gray-300">تعداد کارتن</label><input type="tel" inputMode="numeric" className={inputClasses} value={invoiceValues.cartons} onChange={(e) => setInvoiceValues({ ...invoiceValues, cartons: e.target.value })} /></div>
                        <div><label className="block text-sm font-bold mb-2 text-blue-600 dark:text-blue-400">وزن واقعی (Kg)</label><input type="tel" inputMode="decimal" className={`${inputClasses} border-blue-100 dark:border-blue-900`} value={invoiceValues.weight} onChange={(e) => setInvoiceValues({ ...invoiceValues, weight: e.target.value })} /></div>
                    </div>
                    <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <h4 className="font-bold text-gray-400 text-base">مشخصات راننده</h4>
                        <input type="text" placeholder="نام راننده" className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl text-right font-bold outline-none border border-gray-200 dark:border-gray-600 focus:border-gray-300" value={invoiceValues.driverName} onChange={(e) => setInvoiceValues({ ...invoiceValues, driverName: e.target.value })} />
                        <input type="tel" placeholder="شماره تماس" dir="ltr" className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl text-left font-mono font-bold outline-none border border-gray-200 dark:border-gray-600 focus:border-gray-300" value={invoiceValues.driverPhone} onChange={(e) => setInvoiceValues({ ...invoiceValues, driverPhone: e.target.value })} />
                        
                        {/* FIXED: Force light background and black text for license plate even in dark mode */}
                        <div className="bg-gray-100 dark:bg-gray-200 p-3 rounded-xl flex items-center justify-center gap-1 border border-gray-300" dir="ltr">
                             <input type="tel" maxLength={2} value={plateParts.part1} onChange={e => setPlateParts({...plateParts, part1: e.target.value})} className="w-10 h-10 text-center font-black text-xl bg-white rounded-lg outline-none text-black dark:text-black placeholder-gray-400" />
                             <button type="button" onClick={() => setShowLetterPicker(!showLetterPicker)} className="w-10 h-10 bg-white rounded-lg font-black text-red-600 relative">
                                {plateParts.letter || 'الف'}
                                {showLetterPicker && (
                                    <div className="absolute bottom-full left-0 mb-1 w-48 h-40 bg-white shadow-xl rounded-lg overflow-y-auto grid grid-cols-4 gap-1 p-1 z-50 border border-gray-200">
                                        {PERSIAN_LETTERS.map(l => (
                                            <button key={l} type="button" onClick={(e) => { e.stopPropagation(); setPlateParts({...plateParts, letter: l}); setShowLetterPicker(false); }} className="p-1 hover:bg-gray-100 rounded text-black">{l}</button>
                                        ))}
                                    </div>
                                )}
                             </button>
                             <input type="tel" maxLength={3} value={plateParts.part3} onChange={e => setPlateParts({...plateParts, part3: e.target.value})} className="w-14 h-10 text-center font-black text-xl bg-white rounded-lg outline-none text-black dark:text-black placeholder-gray-400" />
                             <div className="w-10 h-10 bg-white rounded-lg flex flex-col items-center justify-center border-l-2 border-black">
                                <span className="text-[6px] font-bold text-black dark:text-black">ایران</span>
                                <input type="tel" maxLength={2} value={plateParts.part4} onChange={e => setPlateParts({...plateParts, part4: e.target.value})} className="w-full text-center font-black text-sm outline-none bg-transparent text-black dark:text-black placeholder-gray-400" />
                             </div>
                        </div>

                        <textarea placeholder="توضیحات اصلاحیه" className="w-full p-3 bg-gray-50 dark:bg-gray-700 dark:text-white rounded-xl text-right outline-none border border-gray-200 dark:border-gray-600 focus:border-gray-300 h-20" value={invoiceValues.description} onChange={(e) => setInvoiceValues({ ...invoiceValues, description: e.target.value })}></textarea>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700"><Button variant="secondary" onClick={handleCancelInvoice}>انصراف</Button><Button onClick={handleSaveInvoice}>ثبت تغییرات</Button></div>
                </div>
            </Modal>
        </div>
    );
};

export default RecentRecords;
