
import React, { useState, useMemo } from 'react';
import { useStatisticsStore, DailyStatistic } from '../../store/statisticsStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useFarmStore } from '../../store/farmStore';
import { useUserStore } from '../../store/userStore';
import { useToastStore } from '../../store/toastStore';
import { Icons } from '../common/Icons';
import Button from '../common/Button';
import JalaliDatePicker from '../common/JalaliDatePicker';
import { toPersianDigits, getTodayJalali, normalizeDate, isDateInRange } from '../../utils/dateUtils';
import { Invoice } from '../../types';
import Modal from '../common/Modal';
import { useConfirm } from '../../hooks/useConfirm';

type TabType = 'stats' | 'invoices';

const GlobalRecordManager: React.FC = () => {
    const { statistics, updateStatistic, deleteStatistic } = useStatisticsStore();
    const { invoices, updateInvoice, deleteInvoice } = useInvoiceStore();
    const { farms, products } = useFarmStore();
    const { users } = useUserStore();
    const { addToast } = useToastStore();
    const { confirm } = useConfirm();

    const [activeTab, setActiveTab] = useState<TabType>('stats');
    
    // Filters
    const [selectedFarmId, setSelectedFarmId] = useState<string>('all');
    const [startDate, setStartDate] = useState(getTodayJalali());
    const [endDate, setEndDate] = useState(getTodayJalali());

    // Editing State
    const [editingStat, setEditingStat] = useState<DailyStatistic | null>(null);
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
    
    // Form Values
    const [statForm, setStatForm] = useState({ prod: 0, sales: 0, prev: 0 });
    const [invoiceForm, setInvoiceForm] = useState({ cartons: 0, weight: 0, driver: '', plate: '', phone: '', desc: '' });

    // --- Helpers ---
    const getUserName = (userId?: string) => {
        if (!userId) return 'ناشناس';
        const u = users.find(user => user.id === userId);
        return u ? u.fullName : 'کاربر حذف شده';
    };

    const getProductName = (id?: string) => products.find(p => p.id === id)?.name || 'نامشخص';
    const getFarmName = (id: string) => farms.find(f => f.id === id)?.name || 'ناشناس';

    // --- Filtering Logic ---
    const filteredStats = useMemo(() => {
        const start = normalizeDate(startDate);
        const end = normalizeDate(endDate);
        return statistics.filter(s => {
            const farmMatch = selectedFarmId === 'all' || s.farmId === selectedFarmId;
            const dateMatch = isDateInRange(s.date, start, end);
            return farmMatch && dateMatch;
        }).sort((a, b) => b.createdAt - a.createdAt);
    }, [statistics, selectedFarmId, startDate, endDate]);

    const filteredInvoices = useMemo(() => {
        const start = normalizeDate(startDate);
        const end = normalizeDate(endDate);
        return invoices.filter(i => {
            const farmMatch = selectedFarmId === 'all' || i.farmId === selectedFarmId;
            const dateMatch = isDateInRange(i.date, start, end);
            return farmMatch && dateMatch;
        }).sort((a, b) => b.createdAt - a.createdAt);
    }, [invoices, selectedFarmId, startDate, endDate]);

    // --- Handlers ---
    
    const handleDeleteStat = async (id: string) => {
        const yes = await confirm({ title: 'حذف دائمی آمار', message: 'مدیر گرامی، آیا از حذف این رکورد اطمینان دارید؟', type: 'danger', confirmText: 'حذف اجباری' });
        if (yes) {
            await deleteStatistic(id);
            addToast('رکورد آمار با موفقیت حذف شد', 'success');
        }
    };

    const handleDeleteInvoice = async (id: string) => {
        const yes = await confirm({ title: 'حذف دائمی حواله', message: 'مدیر گرامی، آیا از حذف این حواله اطمینان دارید؟', type: 'danger', confirmText: 'حذف اجباری' });
        if (yes) {
            await deleteInvoice(id);
            addToast('حواله با موفقیت حذف شد', 'success');
        }
    };

    const openStatEdit = (stat: DailyStatistic) => {
        setEditingStat(stat);
        setStatForm({ prod: stat.production, sales: stat.sales || 0, prev: stat.previousBalance || 0 });
    };

    const saveStatEdit = async () => {
        if (!editingStat) return;
        const yes = await confirm({ title: 'اصلاح مدیریتی آمار', message: 'آیا تغییرات ذخیره شود؟ موجودی انبار بازنشانی خواهد شد.', type: 'info' });
        if (yes) {
            const newInv = Number(statForm.prev) + Number(statForm.prod) - Number(statForm.sales);
            await updateStatistic(editingStat.id, {
                production: Number(statForm.prod),
                sales: Number(statForm.sales),
                previousBalance: Number(statForm.prev),
                currentInventory: newInv
            });
            setEditingStat(null);
            addToast('آمار با دسترسی مدیریت ویرایش شد', 'success');
        }
    };

    const openInvoiceEdit = (inv: Invoice) => {
        setEditingInvoice(inv);
        setInvoiceForm({
            cartons: inv.totalCartons,
            weight: inv.totalWeight,
            driver: inv.driverName || '',
            plate: inv.plateNumber || '',
            phone: inv.driverPhone || '',
            desc: inv.description || ''
        });
    };

    const saveInvoiceEdit = async () => {
        if (!editingInvoice) return;
        const yes = await confirm({ title: 'اصلاح مدیریتی حواله', message: 'آیا تغییرات ذخیره شود؟', type: 'info' });
        if (yes) {
            await updateInvoice(editingInvoice.id, {
                totalCartons: Number(invoiceForm.cartons),
                totalWeight: Number(invoiceForm.weight),
                driverName: invoiceForm.driver,
                plateNumber: invoiceForm.plate,
                driverPhone: invoiceForm.phone,
                description: invoiceForm.desc
            });
            setEditingInvoice(null);
            addToast('حواله با دسترسی مدیریت ویرایش شد', 'success');
        }
    };

    // --- Render ---
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2">
                    <Icons.HardDrive className="text-metro-purple" />
                    مدیریت جامع داده‌ها (Admin)
                </h2>
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-t-4 border-metro-purple grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">فیلتر فارم</label>
                    <select 
                        value={selectedFarmId} 
                        onChange={(e) => setSelectedFarmId(e.target.value)} 
                        className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="all">همه فارم‌ها</option>
                        {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                </div>
                <div><JalaliDatePicker value={startDate} onChange={setStartDate} label="از تاریخ" /></div>
                <div><JalaliDatePicker value={endDate} onChange={setEndDate} label="تا تاریخ" /></div>
                
                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('stats')}
                        className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'stats' ? 'bg-metro-purple text-white shadow' : 'text-gray-500 dark:text-gray-300'}`}
                    >
                        آمار تولید
                    </button>
                    <button 
                        onClick={() => setActiveTab('invoices')}
                        className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'invoices' ? 'bg-metro-orange text-white shadow' : 'text-gray-500 dark:text-gray-300'}`}
                    >
                        حواله‌ها
                    </button>
                </div>
            </div>

            {/* Content Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden border border-gray-200 dark:border-gray-700 min-h-[400px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 uppercase text-xs">
                            <tr>
                                {activeTab === 'stats' ? (
                                    <>
                                        <th className="px-4 py-3">تاریخ</th>
                                        <th className="px-4 py-3">زمان ثبت</th>
                                        <th className="px-4 py-3">فارم / محصول</th>
                                        <th className="px-4 py-3 text-center">تولید</th>
                                        <th className="px-4 py-3 text-center">فروش</th>
                                        <th className="px-4 py-3 text-center">موجودی</th>
                                        <th className="px-4 py-3">ثبت کننده</th>
                                        <th className="px-4 py-3 text-center">عملیات</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-4 py-3 text-center">کد حواله</th>
                                        <th className="px-4 py-3">تاریخ / زمان</th>
                                        <th className="px-4 py-3">فارم / محصول</th>
                                        <th className="px-4 py-3 text-center">تعداد</th>
                                        <th className="px-4 py-3 text-center">وزن</th>
                                        <th className="px-4 py-3">راننده / پلاک</th>
                                        <th className="px-4 py-3">ثبت کننده</th>
                                        <th className="px-4 py-3 text-center">عملیات</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {activeTab === 'stats' ? (
                                filteredStats.length === 0 ? <tr><td colSpan={8} className="text-center py-10 text-gray-400">رکوردی یافت نشد</td></tr> :
                                filteredStats.map(stat => (
                                    <tr key={stat.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-4 py-3 font-mono">{toPersianDigits(stat.date)}</td>
                                        <td className="px-4 py-3 text-xs text-gray-400">{new Date(stat.createdAt).toLocaleTimeString('fa-IR')}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-bold dark:text-white">{getFarmName(stat.farmId)}</div>
                                            <div className="text-xs text-gray-500">{getProductName(stat.productId)}</div>
                                        </td>
                                        <td className="px-4 py-3 text-center font-bold text-green-600">{toPersianDigits(stat.production)}</td>
                                        <td className="px-4 py-3 text-center text-red-500">{toPersianDigits(stat.sales || 0)}</td>
                                        <td className="px-4 py-3 text-center font-bold text-blue-600">{toPersianDigits(stat.currentInventory)}</td>
                                        <td className="px-4 py-3 text-xs">
                                            <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{stat.creatorName}</span>
                                        </td>
                                        <td className="px-4 py-3 flex justify-center gap-2">
                                            <button onClick={() => openStatEdit(stat)} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"><Icons.Edit className="w-4 h-4"/></button>
                                            <button onClick={() => handleDeleteStat(stat.id)} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100"><Icons.Trash className="w-4 h-4"/></button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                filteredInvoices.length === 0 ? <tr><td colSpan={8} className="text-center py-10 text-gray-400">حواله‌ای یافت نشد</td></tr> :
                                filteredInvoices.map(inv => (
                                    <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-4 py-3 text-center font-black text-metro-orange">{toPersianDigits(inv.invoiceNumber)}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-mono text-sm">{toPersianDigits(inv.date)}</div>
                                            <div className="text-[10px] text-gray-400">{new Date(inv.createdAt).toLocaleTimeString('fa-IR')}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-bold dark:text-white">{getFarmName(inv.farmId)}</div>
                                            <div className="text-xs text-gray-500">{getProductName(inv.productId)}</div>
                                        </td>
                                        <td className="px-4 py-3 text-center font-bold">{toPersianDigits(inv.totalCartons)}</td>
                                        <td className="px-4 py-3 text-center font-bold text-blue-600">{toPersianDigits(inv.totalWeight)}</td>
                                        <td className="px-4 py-3 text-xs">
                                            <div>{inv.driverName || '-'}</div>
                                            <div className="font-mono text-gray-500">{toPersianDigits(inv.plateNumber || '')}</div>
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                             <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{getUserName(inv.createdBy)}</span>
                                        </td>
                                        <td className="px-4 py-3 flex justify-center gap-2">
                                            <button onClick={() => openInvoiceEdit(inv)} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"><Icons.Edit className="w-4 h-4"/></button>
                                            <button onClick={() => handleDeleteInvoice(inv.id)} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100"><Icons.Trash className="w-4 h-4"/></button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- Modals --- */}
            
            {/* Stat Edit Modal */}
            <Modal isOpen={!!editingStat} onClose={() => setEditingStat(null)} title="ویرایش آمار (مدیریت)">
                <div className="space-y-4">
                     <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded text-xs text-purple-800 dark:text-purple-300">
                         شما در حال ویرایش با دسترسی مدیر هستید. هیچ محدودیت زمانی اعمال نمی‌شود.
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <label className="text-xs font-bold block mb-1">تولید</label>
                             <input type="number" value={statForm.prod} onChange={e => setStatForm({...statForm, prod: Number(e.target.value)})} className="w-full p-2 border rounded text-center font-bold" />
                         </div>
                         <div>
                             <label className="text-xs font-bold block mb-1">فروش</label>
                             <input type="number" value={statForm.sales} onChange={e => setStatForm({...statForm, sales: Number(e.target.value)})} className="w-full p-2 border rounded text-center font-bold" />
                         </div>
                     </div>
                     <div>
                         <label className="text-xs font-bold block mb-1">مانده قبل (اصلاح دستی)</label>
                         <input type="number" value={statForm.prev} onChange={e => setStatForm({...statForm, prev: Number(e.target.value)})} className="w-full p-2 border rounded text-center font-bold bg-gray-50" />
                     </div>
                     <div className="flex justify-end gap-2 mt-4">
                         <Button variant="secondary" onClick={() => setEditingStat(null)}>لغو</Button>
                         <Button onClick={saveStatEdit}>ذخیره تغییرات</Button>
                     </div>
                </div>
            </Modal>

             {/* Invoice Edit Modal */}
             <Modal isOpen={!!editingInvoice} onClose={() => setEditingInvoice(null)} title="ویرایش حواله (مدیریت)">
                <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                     <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded text-xs text-purple-800 dark:text-purple-300">
                         ویرایش حواله باعث بروزرسانی خودکار موجودی انبار در تاریخ مربوطه خواهد شد.
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <label className="text-xs font-bold block mb-1">تعداد کارتن</label>
                             <input type="number" value={invoiceForm.cartons} onChange={e => setInvoiceForm({...invoiceForm, cartons: Number(e.target.value)})} className="w-full p-2 border rounded text-center font-bold" />
                         </div>
                         <div>
                             <label className="text-xs font-bold block mb-1">وزن (Kg)</label>
                             <input type="number" value={invoiceForm.weight} onChange={e => setInvoiceForm({...invoiceForm, weight: Number(e.target.value)})} className="w-full p-2 border rounded text-center font-bold" />
                         </div>
                     </div>
                     <div>
                         <label className="text-xs font-bold block mb-1">نام راننده</label>
                         <input type="text" value={invoiceForm.driver} onChange={e => setInvoiceForm({...invoiceForm, driver: e.target.value})} className="w-full p-2 border rounded" />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <label className="text-xs font-bold block mb-1">پلاک</label>
                             <input type="text" value={invoiceForm.plate} onChange={e => setInvoiceForm({...invoiceForm, plate: e.target.value})} className="w-full p-2 border rounded text-center" />
                         </div>
                         <div>
                             <label className="text-xs font-bold block mb-1">موبایل</label>
                             <input type="text" value={invoiceForm.phone} onChange={e => setInvoiceForm({...invoiceForm, phone: e.target.value})} className="w-full p-2 border rounded text-center" />
                         </div>
                     </div>
                     <div>
                         <label className="text-xs font-bold block mb-1">توضیحات</label>
                         <textarea value={invoiceForm.desc} onChange={e => setInvoiceForm({...invoiceForm, desc: e.target.value})} className="w-full p-2 border rounded h-20" />
                     </div>
                     <div className="flex justify-end gap-2 mt-4">
                         <Button variant="secondary" onClick={() => setEditingInvoice(null)}>لغو</Button>
                         <Button onClick={saveInvoiceEdit}>ذخیره تغییرات</Button>
                     </div>
                </div>
            </Modal>
        </div>
    );
};

export default GlobalRecordManager;
