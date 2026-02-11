import React from 'react';
import { Farm, Product, UserRole } from '../../../types';
import { Icons } from '../../common/Icons';
import { toPersianDigits } from '../../../utils/dateUtils';
import { formatPlateNumberForUI } from '../../../utils/formatUtils';

interface InvoicesTableProps {
    data: any[];
    isSearching: boolean;
    isAdmin: boolean;
    farms: Farm[];
    getProductById: (id: string) => Product | undefined;
    onEdit: (item: any) => void;
    onDelete: (id: string) => void;
}

const InvoicesTable: React.FC<InvoicesTableProps> = ({
    data,
    isSearching,
    isAdmin,
    farms,
    getProductById,
    onEdit,
    onDelete
}) => {
    const formatPlateVisual = (plate: string) => formatPlateNumberForUI(plate) || '-';

    return (
        <div className="bg-white dark:bg-gray-800 rounded-[28px] shadow-md overflow-hidden border border-gray-100 dark:border-gray-700 relative">
            <div className="overflow-x-auto max-h-[600px] custom-scrollbar relative">
                <table className="w-full text-right border-collapse min-w-[1200px]">
                    <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 font-black text-xs lg:text-sm uppercase tracking-wider sticky top-0 z-10 shadow-md">
                        <tr>
                            <th className="p-3">تاریخ</th>
                            <th className="p-3 text-center">رمز حواله</th>
                            <th className="p-3">فارم</th>
                            <th className="p-3">نوع محصول</th>
                            <th className="p-3 text-center">تعداد</th>
                            <th className="p-3 text-center">وزن</th>
                            <th className="p-3">شماره تماس</th>
                            <th className="p-3">راننده</th>
                            <th className="p-3">پلاک</th>
                            <th className="p-3">اطلاعات ثبت</th>
                            {isAdmin && <th className="p-3 text-center">عملیات</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {isSearching ? (
                            <tr><td colSpan={11} className="text-center py-20 text-gray-400">در حال جستجو...</td></tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={11} className="text-center py-20 text-gray-400 font-bold">
                                    <div className="flex flex-col items-center justify-center opacity-50">
                                        <Icons.FileText className="w-24 h-24 text-gray-300 dark:text-gray-600 mb-4" />
                                        <span className="text-xl">رکوردی یافت نشد</span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            data.map(row => {
                                const prod = getProductById(row.productId);
                                const isEdited = row.updatedAt && row.updatedAt > row.createdAt + 2000;
                                const isAdminCreated = row.creatorRole === UserRole.ADMIN;
                                const displayTime = (!isAdminCreated || isAdmin)
                                    ? new Date(isEdited ? row.updatedAt : row.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
                                    : '---';

                                return (
                                    <tr key={row.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${isAdminCreated ? 'bg-purple-50/50 dark:bg-purple-900/10' : ''}`}>
                                        <td className="p-3 font-mono font-bold text-lg text-gray-800 dark:text-white">{toPersianDigits(row.date)}</td>
                                        <td className="p-3 text-center font-black text-xl lg:text-2xl tracking-widest text-metro-orange">{toPersianDigits(row.invoiceNumber)}</td>
                                        <td className="p-3 font-bold text-gray-800 dark:text-white">{farms.find(f => f.id === row.farmId)?.name}</td>
                                        <td className="p-3 font-bold text-gray-600 dark:text-gray-300">{prod?.name || '-'}</td>
                                        <td className={`p-3 text-center font-black text-xl lg:text-2xl text-gray-800 dark:text-white ${isEdited ? 'bg-yellow-50 dark:bg-yellow-900/10 rounded' : ''}`}>{toPersianDigits(row.totalCartons || 0)}</td>
                                        <td className={`p-3 text-center text-blue-600 font-black text-xl lg:text-2xl ${isEdited ? 'bg-yellow-50 dark:bg-yellow-900/10 rounded' : ''}`}>{toPersianDigits(row.totalWeight || 0)}</td>
                                        <td className="p-3 font-mono font-bold text-sm text-gray-600 dark:text-gray-400">{toPersianDigits(row.driverPhone || '-')}</td>
                                        <td className="p-3 font-bold text-gray-700 dark:text-gray-300">{row.driverName || '-'}</td>
                                        <td className="p-3 font-mono text-sm text-gray-600 dark:text-gray-400 text-center" dir="rtl">{formatPlateVisual(row.plateNumber || '') || '-'}</td>
                                        <td className="p-3">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded-md font-bold text-xs ${isAdminCreated ? 'bg-purple-200 text-purple-800' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                                                        {isAdminCreated ? 'ثبت توسط مدیر' : (row.creatorName || 'ناشناس')}
                                                    </span>
                                                    <div className="flex flex-col">
                                                        <span className="font-mono text-[10px] opacity-60 text-gray-500 dark:text-gray-400">{toPersianDigits(displayTime)}</span>
                                                        {isEdited && <span className="text-[9px] text-orange-500 font-bold">(ویرایش شده)</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        {isAdmin && <td className="p-3 flex justify-center gap-2">
                                            <button onClick={() => onEdit(row)} className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"><Icons.Edit className="w-5 h-5" /></button>
                                            <button onClick={() => onDelete(row.id)} className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full hover:bg-red-100 transition-colors"><Icons.Trash className="w-5 h-5" /></button>
                                        </td>}
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default InvoicesTable;
