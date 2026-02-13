import React from 'react';
import { Farm, Product, UserRole } from '../../../types';
import { Icons } from '../../common/Icons';
import { toPersianDigits } from '../../../utils/dateUtils';

interface StatsTableProps {
    data: any[];
    isSearching: boolean;
    isAdmin: boolean;
    farms: Farm[];
    products: Product[];
    getProductById: (id: string) => Product | undefined;
    onEdit: (item: any) => void;
    onDelete: (id: string) => void;
}

const StatsTable: React.FC<StatsTableProps> = ({
    data,
    isSearching,
    isAdmin,
    farms,
    getProductById,
    onEdit,
    onDelete
}) => {
    const renderDualCell = (units: number, weight: number, colorClass: string, isEdited: boolean) => {
        const hasUnits = units > 0;
        const hasWeight = weight > 0;
        return (
            <div className={`flex flex-col items-center font-black text-lg ${colorClass} ${isEdited ? 'bg-yellow-50 dark:bg-yellow-900/10 p-1 rounded' : ''}`}>
                {hasUnits && <span>{toPersianDigits(units)} <small className="text-xs text-gray-400">کارتن</small></span>}
                {hasWeight && <span>{toPersianDigits(weight)} <small className="text-xs text-gray-400">Kg</small></span>}
                {!hasUnits && !hasWeight && <span className="text-gray-300">۰</span>}
            </div>
        );
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-[28px] shadow-md overflow-hidden border border-gray-100 dark:border-gray-700 relative">
            <div className="overflow-x-auto max-h-[600px] custom-scrollbar relative">
                <table className="w-full text-right border-collapse min-w-[1200px]">
                    <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 font-black text-xs lg:text-sm uppercase tracking-wider sticky top-0 z-10 shadow-md">
                        <tr>
                            <th className="p-3 text-center">تاریخ</th>
                            <th className="p-3 text-center">فارم</th>
                            <th className="p-3 text-center">محصول</th>
                            <th className="p-3 text-center">تولید</th>
                            <th className="p-3 text-center">فروش</th>
                            <th className="p-3 text-center">موجودی</th>
                            <th className="p-3 text-center">اطلاعات ثبت</th>
                            {isAdmin && <th className="p-3 text-center">عملیات</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {isSearching ? (
                            <tr><td colSpan={10} className="text-center py-20 text-gray-400">در حال جستجو...</td></tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="text-center py-20 text-gray-400 font-bold">
                                    <div className="flex flex-col items-center justify-center opacity-50">
                                        <Icons.FileText className="w-24 h-24 text-gray-300 dark:text-gray-600 mb-4" />
                                        <span className="text-xl">رکوردی یافت نشد</span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            data.map(row => {
                                const prod = getProductById(row.productId);
                                const isEdited = row.updatedAt && row.updatedAt > row.createdAt + 1000;
                                const isAdminCreated = row.creatorRole === UserRole.ADMIN;
                                const displayTime = (!isAdminCreated || isAdmin)
                                    ? new Date(isEdited ? row.updatedAt : row.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
                                    : '---';

                                return (
                                    <tr key={row.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${isAdminCreated ? 'bg-purple-50/50 dark:bg-purple-900/10' : ''}`}>
                                        <td className="p-3 font-mono font-bold text-lg text-gray-800 dark:text-white text-center">{toPersianDigits(row.date)}</td>
                                        <td className="p-3 font-bold text-gray-800 dark:text-white text-center">{farms.find(f => f.id === row.farmId)?.name}</td>
                                        <td className="p-3 text-sm text-gray-500 font-bold w-[220px] text-center">{prod?.name}</td>
                                        <td className="p-3 text-center">{renderDualCell(row.production || 0, row.productionKg || 0, 'text-green-600', isEdited)}</td>
                                        <td className="p-3 text-center">{(() => {
                                            const prod = getProductById(row.productId);
                                            // اگر محصول مایع باشد (بر اساس نام یا hasKilogramUnit):
                                            if (prod?.name?.includes('مایع') || prod?.hasKilogramUnit) {
                                                const kg = row.salesKg || 0;
                                                return <span className="font-black text-lg text-red-500">{toPersianDigits(kg)} <small className="text-xs text-gray-400">Kg</small></span>;
                                            } else {
                                                // برای سایر محصولات فقط تعداد کارتن
                                                return <span className="font-black text-lg text-red-500">{toPersianDigits(row.sales || 0)} <small className="text-xs text-gray-400">کارتن</small></span>;
                                            }
                                        })()}</td>
                                        <td className="p-3 text-center">{renderDualCell(row.currentInventory || 0, row.currentInventoryKg || 0, 'text-metro-blue', isEdited)}</td>
                                        <td className="p-3">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center justify-center gap-2">
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
                                        {isAdmin && <td className="p-3 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => onEdit(row)} className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"><Icons.Edit className="w-5 h-5" /></button>
                                                <button onClick={() => onDelete(row.id)} className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full hover:bg-red-100 transition-colors"><Icons.Trash className="w-5 h-5" /></button>
                                            </div>
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

export default StatsTable;
