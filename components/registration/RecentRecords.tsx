
import React, { useState } from 'react';
import { useStatisticsStore, DailyStatistic } from '../../store/statisticsStore';
// Fix: Removed Invoice from invoiceStore import as it is not exported there
import { useInvoiceStore } from '../../store/invoiceStore';
import { useFarmStore } from '../../store/farmStore';
import { useAuthStore } from '../../store/authStore';
import { Icons } from '../common/Icons';
import { useConfirm } from '../../hooks/useConfirm';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { useToastStore } from '../../store/toastStore';
import { toPersianDigits } from '../../utils/dateUtils';
// Fix: Import Invoice from types.ts
import { Invoice } from '../../types';

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
    
    // Values
    const [statValues, setStatValues] = useState({ prod: 0, sales: 0, prev: 0 });
    const [invoiceValues, setInvoiceValues] = useState({ 
        cartons: 0, 
        weight: 0,
        driverName: '',
        plateNumber: '',
        driverPhone: ''
    });

    const farmId = user?.assignedFarms?.[0]?.id;
    // Show recent first
    const myStats = statistics.filter(s => s.farmId === farmId).sort((a,b) => b.createdAt - a.createdAt).slice(0, 20);
    const myInvoices = invoices.filter(i => i.farmId === farmId).sort((a,b) => b.createdAt - a.createdAt).slice(0, 20);

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

    const renderInvoiceNumber = (num: string) => {
        const strNum = toPersianDigits(num);
        if (strNum.length < 4) return <span className="text-gray-800 dark:text-gray-200">{strNum}</span>;
        
        const mainPart = strNum.slice(0, -4);
        const lastPart = strNum.slice(-4);
        
        return (
            <div className="flex justify-end items-center gap-0.5">
                <span className="text-gray-500 dark:text-gray-400 font-bold">{mainPart}</span>
                <span className="text-black dark:text-white font-black text-base">{lastPart}</span>
            </div>
        );
    };

    return (
        <div className="space-y-8 pb-20">
            {/* Stats Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 overflow-hidden border-t-4 border-orange-500">
                <h3 className="font-bold text-lg mb-4 text-gray-800 dark:text-gray-100 border-b pb-2 dark:border-gray-700 flex justify-between">
                    <span>آخرین آمارهای ثبت شده</span>
                    <span className="text-xs font-normal text-gray-500 dark:text-gray-400 self-center">نمایش ۲۰ مورد اخیر</span>
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right text-gray-700 dark:text-gray-300">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase text-gray-600 dark:text-gray-400">
                            <tr>
                                <th className="px-4 py-2">تاریخ</th>
                                <th className="px-4 py-2">محصول</th>
                                <th className="px-4 py-2">تولید</th>
                                <th className="px-4 py-2">موجودی</th>
                                <th className="px-4 py-2">وضعیت</th>
                                <th className="px-4 py-2 text-left">عملیات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {myStats.length === 0 && <tr><td colSpan={6} className="text-center py-4 text-gray-400">موردی یافت نشد</td></tr>}
                            {myStats.map(stat => (
                                <tr key={stat.id} className="last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap font-medium">{toPersianDigits(stat.date)}</td>
                                    <td className="px-4 py-3 font-bold">{getProductName(stat.productId)}</td>
                                    <td className="px-4 py-3 text-green-600 dark:text-green-400 font-bold">+{toPersianDigits(stat.production)}</td>
                                    <td className="px-4 py-3 font-bold text-blue-600 dark:text-blue-400">{toPersianDigits(stat.currentInventory)}</td>
                                    <td className="px-4 py-3 text-xs">
                                        {stat.updatedAt ? (
                                            <span className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded">ویرایش شده</span>
                                        ) : <span className="text-gray-400 dark:text-gray-500">ثبت اولیه</span>}
                                    </td>
                                    <td className="px-4 py-3 flex gap-2 justify-end">
                                        {isEditable(stat.createdAt) ? (
                                            <>
                                                <button onClick={() => handleEditStatOpen(stat)} className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-2 rounded-lg" title="ویرایش">
                                                    <Icons.Edit className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDeleteStat(stat.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg" title="حذف">
                                                    <Icons.Trash className="w-4 h-4" />
                                                </button>
                                            </>
                                        ) : (
                                            <Icons.Lock className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Invoices Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 overflow-hidden border-t-4 border-blue-500">
                <h3 className="font-bold text-lg mb-4 text-gray-800 dark:text-gray-100 border-b pb-2 dark:border-gray-700">آخرین حواله‌های ثبت شده</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right text-gray-700 dark:text-gray-300">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase text-gray-600 dark:text-gray-400">
                            <tr>
                                <th className="px-4 py-2">تاریخ</th>
                                <th className="px-4 py-2 text-center">کد حواله</th>
                                <th className="px-4 py-2">محصول</th>
                                <th className="px-4 py-2">کارتن/وزن</th>
                                <th className="px-4 py-2">راننده</th>
                                <th className="px-4 py-2">وضعیت</th>
                                <th className="px-4 py-2 text-left">عملیات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {myInvoices.length === 0 && <tr><td colSpan={7} className="text-center py-4 text-gray-400">موردی یافت نشد</td></tr>}
                            {myInvoices.map(inv => (
                                <tr key={inv.id} className="last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap font-medium">{toPersianDigits(inv.date)}</td>
                                    <td className="px-4 py-3 text-center dir-ltr" dir="ltr">
                                        {renderInvoiceNumber(inv.invoiceNumber)}
                                    </td>
                                    <td className="px-4 py-3 text-xs">{inv.productId ? getProductName(inv.productId) : '-'}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                            <span className="font-bold">{toPersianDigits(inv.totalCartons)} کارتن</span>
                                            <span className="text-xs text-gray-400">{toPersianDigits(inv.totalWeight)} کیلو</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs">
                                        {inv.driverName || '-'} 
                                        {inv.plateNumber && <div className="font-mono mt-1 dark:text-gray-400">{toPersianDigits(inv.plateNumber)}</div>}
                                    </td>
                                    <td className="px-4 py-3 text-xs">
                                        <div className="flex flex-col gap-1">
                                            <span className={`px-2 py-0.5 rounded-full w-fit ${inv.isYesterday ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                                                {inv.isYesterday ? 'دیروزی' : 'عادی'}
                                            </span>
                                            {inv.updatedAt && (
                                                <span className="text-amber-600 dark:text-amber-400 font-bold" title={`زمان ویرایش: ${new Date(inv.updatedAt).toLocaleTimeString('fa-IR')}`}>
                                                    (ویرایش شده)
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 flex gap-2 justify-end items-center">
                                        {isEditable(inv.createdAt) ? (
                                            <>
                                                <button onClick={() => handleEditInvoiceOpen(inv)} className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-2 rounded-lg" title="ویرایش کامل">
                                                    <Icons.Edit className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDeleteInv(inv.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg" title="حذف">
                                                    <Icons.Trash className="w-4 h-4" />
                                                </button>
                                            </>
                                        ) : (
                                            <Icons.Lock className="w-4 h-4 text-gray-300 dark:text-gray-600" />
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
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-xs text-blue-800 dark:text-blue-300 mb-4">
                        توجه: با تغییر مقادیر، موجودی نهایی به صورت خودکار بازآرایی می‌شود.
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1 dark:text-gray-300">تولید (کارتن/دبه)</label>
                            <input 
                                type="number" 
                                className="w-full p-2 border rounded-lg text-center font-bold bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                value={statValues.prod}
                                onChange={(e) => setStatValues({ ...statValues, prod: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1 dark:text-gray-300">فروش</label>
                            <input 
                                type="number" 
                                className="w-full p-2 border rounded-lg text-center font-bold bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                value={statValues.sales}
                                onChange={(e) => setStatValues({ ...statValues, sales: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold mb-1 dark:text-gray-300">مانده قبل (اصلاح دستی)</label>
                        <input 
                            type="number" 
                            className="w-full p-2 border rounded-lg text-center font-bold bg-gray-50 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                            value={statValues.prev}
                            onChange={(e) => setStatValues({ ...statValues, prev: Number(e.target.value) })}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" onClick={() => setEditStat(null)}>انصراف</Button>
                        <Button onClick={handleSaveStat}>ذخیره تغییرات</Button>
                    </div>
                </div>
            </Modal>

            {/* Edit Invoice Modal - FULL FIELDS */}
            <Modal isOpen={!!editInvoice} onClose={() => setEditInvoice(null)} title="ویرایش کامل حواله">
                 <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1 dark:text-gray-300">تعداد کارتن</label>
                            <input 
                                type="number" 
                                className="w-full p-2 border rounded-lg text-center font-bold bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                value={invoiceValues.cartons}
                                onChange={(e) => setInvoiceValues({ ...invoiceValues, cartons: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1 dark:text-gray-300">وزن (کیلوگرم)</label>
                            <input 
                                type="number" 
                                className="w-full p-2 border rounded-lg text-center font-bold bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                value={invoiceValues.weight}
                                onChange={(e) => setInvoiceValues({ ...invoiceValues, weight: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                    
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
                        <label className="block text-xs font-bold mb-1 dark:text-gray-300">نام راننده</label>
                        <input 
                            type="text" 
                            className="w-full p-2 border rounded-lg text-right bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            value={invoiceValues.driverName}
                            onChange={(e) => setInvoiceValues({ ...invoiceValues, driverName: e.target.value })}
                            placeholder="نام راننده"
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1 dark:text-gray-300">شماره تماس</label>
                            <input 
                                type="text" 
                                dir="ltr"
                                className="w-full p-2 border rounded-lg text-center bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                value={invoiceValues.driverPhone}
                                onChange={(e) => setInvoiceValues({ ...invoiceValues, driverPhone: e.target.value })}
                                placeholder="09..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1 dark:text-gray-300">پلاک خودرو</label>
                            <input 
                                type="text" 
                                className="w-full p-2 border rounded-lg text-center bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                value={invoiceValues.plateNumber}
                                onChange={(e) => setInvoiceValues({ ...invoiceValues, plateNumber: e.target.value })}
                                placeholder="پلاک"
                            />
                        </div>
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
