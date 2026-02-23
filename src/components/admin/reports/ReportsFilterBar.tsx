import React from 'react';
import { Farm, Product } from '../../../types';
import Button from '../../common/Button';
import { Icons } from '../../common/Icons';
import JalaliDatePicker from '../../common/JalaliDatePicker';

interface ReportsFilterBarProps {
    reportTab: 'stats' | 'invoices';
    onTabChange: (tab: 'stats' | 'invoices') => void;
    farms: Farm[];
    products: Product[];
    selectedFarmId: string;
    onFarmChange: (id: string) => void;
    selectedProductId: string;
    onProductChange: (id: string) => void;
    startDate: string;
    onStartDateChange: (date: string) => void;
    endDate: string;
    onEndDateChange: (date: string) => void;
    searchTerm: string;
    onSearchTermChange: (term: string) => void;
    onRefresh: () => void;
    onExport: () => void;
    onClear: () => void;
    isSearching: boolean;
}

const ReportsFilterBar: React.FC<ReportsFilterBarProps> = ({
    reportTab,
    onTabChange,
    farms,
    products,
    selectedFarmId,
    onFarmChange,
    selectedProductId,
    onProductChange,
    startDate,
    onStartDateChange,
    endDate,
    onEndDateChange,
    searchTerm,
    onSearchTermChange,
    onRefresh,
    onExport,
    onClear,
    isSearching
}) => {
    return (
        <div className="bg-white dark:bg-gray-800 p-4 lg:p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-6">
            {/* Filters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div>
                    <JalaliDatePicker label="از تاریخ" value={startDate} onChange={onStartDateChange} />
                </div>
                <div>
                    <JalaliDatePicker label="تا تاریخ" value={endDate} onChange={onEndDateChange} />
                </div>
                <div>
                    <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300 px-1">فیلتر فارم</label>
                    <select
                        className="w-full p-3 lg:p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 dark:text-white font-bold outline-none focus:border-metro-blue transition-all"
                        value={selectedFarmId}
                        onChange={(e) => onFarmChange(e.target.value)}
                    >
                        <option value="all">همه فارم‌ها</option>
                        {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300 px-1">فیلتر محصول</label>
                    <select
                        className="w-full p-3 lg:p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 dark:text-white font-bold outline-none focus:border-metro-blue transition-all"
                        value={selectedProductId}
                        onChange={(e) => onProductChange(e.target.value)}
                    >
                        <option value="all">همه محصولات</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Search + Actions Wrapper */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Icons.Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder={reportTab === 'invoices' ? "جستجو در شماره حواله، نام راننده، پلاک..." : "جستجو در نام ثبت کننده..."}
                        className="w-full pl-4 pr-12 h-[50px] lg:h-[60px] border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900/50 dark:text-white font-bold outline-none focus:border-metro-blue focus:bg-white dark:focus:bg-gray-800 transition-all placeholder:text-gray-400"
                        value={searchTerm}
                        onChange={(e) => onSearchTermChange(e.target.value)}
                    />
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <Button
                        onClick={onRefresh}
                        isLoading={isSearching}
                        className="flex-1 md:flex-none px-8 !h-[50px] lg:!h-[60px] rounded-xl font-bold bg-metro-blue hover:bg-metro-cobalt shadow-lg shadow-blue-500/30 text-base whitespace-nowrap"
                    >
                        {!isSearching && <Icons.Refresh className="w-5 h-5 ml-2" />}
                        نمایش گزارش
                    </Button>
                    <Button
                        onClick={onClear}
                        variant="secondary"
                        className="flex-1 md:flex-none px-6 !h-[50px] lg:!h-[60px] rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 whitespace-nowrap"
                    >
                        <Icons.X className="w-5 h-5 ml-2" />
                        حذف فیلترها
                    </Button>
                    <Button
                        onClick={onExport}
                        variant="ghost"
                        className="flex-1 md:flex-none px-6 !h-[50px] lg:!h-[60px] rounded-xl font-bold text-sm bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20 border-none whitespace-nowrap"
                    >
                        <Icons.Download className="w-4 h-4 ml-2" /> خروجی اکسل
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ReportsFilterBar;
