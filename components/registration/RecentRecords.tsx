
import React, { useState } from 'react';
import { useStatisticsStore, DailyStatistic } from '../../store/statisticsStore';
import { useInvoiceStore, Invoice } from '../../store/invoiceStore';
import { useFarmStore } from '../../store/farmStore';
import { useAuthStore } from '../../store/authStore';
import { Icons } from '../common/Icons';
import { useConfirm } from '../../hooks/useConfirm';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { useToastStore } from '../../store/toastStore';

const RecentRecords: React.FC = () => {
    const { statistics, deleteStatistic, updateStatistic } = useStatisticsStore();
    const { invoices, deleteInvoice, updateInvoice } = useInvoiceStore();
    const { user } = useAuthStore();
    const { products } = useFarmStore();
    const { confirm } = useConfirm();
    const { addToast } = useToastStore();
    
    // Edit States
    const [editStat, setEditStat] = useState<DailyStatistic | null>(null);
    const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
    
    // Temporary values for edit inputs
    const [statValues, setStatValues] = useState({ prod: 0, sales: 0, prev: 0 });
    const [invoiceValues, setInvoiceValues] = useState({ cartons: 0, weight: 0 });

    const farmId = user?.assignedFarms?.[0]?.id;
    // Show recent first
    const myStats = statistics.filter(s => s.farmId === farmId).sort((a,b) => b.createdAt - a.createdAt).slice(0, 10);
    const myInvoices = invoices.filter(i => i.farmId === farmId).sort((a,b) => b.createdAt - a.createdAt).slice(0, 10);

    const getProductName = (id: string) => products.find(p => p.id === id)?.name || id;

    // 24 Hour check logic
    const isEditable = (createdAt?: number) => {
        if (!createdAt) return false;
        const now = Date.now();
        const diff = now - createdAt;
        const twentyFourHours = 24 * 60 * 60 * 1000;
        return diff < twentyFourHours;
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
        // Recalculate inventory based on new values
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
        setInvoiceValues({ cartons: inv.totalCartons, weight: inv.totalWeight });
    };

    const handleSaveInvoice = () => {
        if (!editInvoice) return;
        updateInvoice(editInvoice.id, {
            totalCartons: invoiceValues.cartons,
            totalWeight: invoiceValues.weight
        });
        setEditInvoice(null);
        addToast('حواله با موفقیت ویرایش شد', 'success');
    };

    return (
        <div className="space-y-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 overflow-hidden">
                <h3 className="font-bold text-lg mb-4 text-orange-600 border-b pb-2 dark:border-gray-700">آخرین آمارهای ثبت شده</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right text-gray-600 dark:text-gray-300">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase">
                            <tr>
                                <th className="px-4 py-2 rounded-r-lg">تاریخ</th>
                                <th className="px-4 py-2">محصول</th>
                                <th className="px-4 py-2">مانده قبل</th>
                                <th className="px-4 py-2 text-green-600">تولید</th>
                                <th className="px-4 py-2 text-red-600">فروش</th>
                                <th className="px-4 py-2 font-bold">موجودی</th>
                                <th className="px-4 py-2 rounded-l-lg">عملیات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {myStats.length === 0 && <tr><td colSpan={7} className="text-center py-4">موردی یافت نشد</td></tr>}
                            {myStats.map(stat => (
                                <tr key={stat.id} className="border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap">{stat.date}</td>
                                    <td className="px-4 py-3">{getProductName(stat.productId)}</td>
                                    <td className="px-4 py-3">{stat.previousBalance}</td>
                                    <td className="px-4 py-3 text-green-600 font-bold">+{stat.production}</td>
                                    <td className="px-4 py-3 text-red-600">{stat.sales || 0}</td>
                                    <td className="px-4 py-3 font-bold">{stat.currentInventory}</td>
                                    <td className="px-4 py-3 flex gap-2">
                                        {isEditable(stat.createdAt) ? (
                                            <>
                                                <button onClick={() => handleEditStatOpen(stat)} className="text-blue-500 hover:text-blue-700 p-1 bg-blue-50 dark:bg-blue-900/30 rounded-lg transition-colors" title="ویرایش">
                                                    <Icons.Edit className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDeleteStat(stat.id)} className="text-red-500 hover:text-red-700 p-1 bg-red-50 dark:bg-red-900/30 rounded-lg transition-colors" title="حذف">
                                                    <Icons.Trash className="w-4 h-4" />
                                                </button>
                                            </>
                                        ) : (
                                            <span className="text-xs text-gray-400">قفل شده</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 overflow-hidden">
                <h3 className="font-bold text-lg mb-4 text-orange-600 border-b pb-2 dark:border-gray-700">آخرین حواله‌های ثبت شده</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right text-gray-600 dark:text-gray-300">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase">
                            <tr>
                                <th className="px-4 py-2 rounded-r-lg">تاریخ</th>
                                <th className="px-4 py-2">شماره حواله</th>
                                <th className="px-4 py-2">محصول</th>
                                <th className="px-4 py-2">تعداد (کارتن)</th>
                                <th className="px-4 py-2">وزن (کیلوگرم)</th>
                                <th className="px-4 py-2">وضعیت</th>
                                <th className="px-4 py-2 rounded-l-lg">عملیات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {myInvoices.length === 0 && <tr><td colSpan={7} className="text-center py-4">موردی یافت نشد</td></tr>}
                            {myInvoices.map(inv => (
                                <tr key={inv.id} className="border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap">{inv.date}</td>
                                    <td className="px-4 py-3 font-mono font-bold text-blue-600">{inv.invoiceNumber}</td>
                                    <td className="px-4 py-3">{inv.productId ? getProductName(inv.productId) : '-'}</td>
                                    <td className="px-4 py-3">{inv.totalCartons}</td>
                                    <td className="px-4 py-3">{inv.totalWeight}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs ${inv.isYesterday ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                                            {inv.isYesterday ? 'دیروزی' : 'عادی'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 flex gap-2">
                                        {isEditable(inv.createdAt) ? (
                                            <>
                                                <button onClick={() => handleEditInvoiceOpen(inv)} className="text-blue-500 hover:text-blue-700 p-1 bg-blue-50 dark:bg-blue-900/30 rounded-lg transition-colors" title="ویرایش">
                                                    <Icons.Edit className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDeleteInv(inv.id)} className="text-red-500 hover:text-red-700 p-1 bg-red-50 dark:bg-red-900/30 rounded-lg transition-colors" title="حذف">
                                                    <Icons.Trash className="w-4 h-4" />
                                                </button>
                                            </>
                                        ) : (
                                            <span className="text-xs text-gray-400">قفل شده</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit Stat Modal */}
            <Modal isOpen={!!editStat} onClose={() => setEditStat(null)} title="ویرایش آمار">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold mb-1 dark:text-gray-300">مانده قبل (دستی)</label>
                        <input 
                            type="number" 
                            className="w-full p-2 border rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
                            value={statValues.prev}
                            onChange={(e) => setStatValues({ ...statValues, prev: Number(e.target.value) })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1 dark:text-gray-300">تولید جدید</label>
                        <input 
                            type="number" 
                            className="w-full p-2 border rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
                            value={statValues.prod}
                            onChange={(e) => setStatValues({ ...statValues, prod: Number(e.target.value) })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1 dark:text-gray-300">فروش جدید</label>
                        <input 
                            type="number" 
                            className="w-full p-2 border rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
                            value={statValues.sales}
                            onChange={(e) => setStatValues({ ...statValues, sales: Number(e.target.value) })}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" onClick={() => setEditStat(null)}>انصراف</Button>
                        <Button onClick={handleSaveStat}>ذخیره تغییرات</Button>
                    </div>
                </div>
            </Modal>

            {/* Edit Invoice Modal */}
            <Modal isOpen={!!editInvoice} onClose={() => setEditInvoice(null)} title="ویرایش حواله">
                 <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold mb-1 dark:text-gray-300">تعداد کارتن</label>
                        <input 
                            type="number" 
                            className="w-full p-2 border rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
                            value={invoiceValues.cartons}
                            onChange={(e) => setInvoiceValues({ ...invoiceValues, cartons: Number(e.target.value) })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1 dark:text-gray-300">وزن (کیلوگرم)</label>
                        <input 
                            type="number" 
                            className="w-full p-2 border rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
                            value={invoiceValues.weight}
                            onChange={(e) => setInvoiceValues({ ...invoiceValues, weight: Number(e.target.value) })}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" onClick={() => setEditInvoice(null)}>انصراف</Button>
                        <Button onClick={handleSaveInvoice}>ذخیره تغییرات</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default RecentRecords;
