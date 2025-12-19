
import React, { useState } from 'react';
import { useStatisticsStore } from '../../store/statisticsStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useFarmStore } from '../../store/farmStore';
import { getTodayJalali, isDateInRange } from '../../utils/dateUtils';
import Button from '../common/Button';
import { Icons } from '../common/Icons';
import * as XLSX from 'xlsx';
import { useToastStore } from '../../store/toastStore';
import JalaliDatePicker from '../common/JalaliDatePicker';

const Reports: React.FC = () => {
    const [startDate, setStartDate] = useState(getTodayJalali());
    const [endDate, setEndDate] = useState(getTodayJalali());
    const [activeTab, setActiveTab] = useState<'stats' | 'invoices'>('stats');
    
    // Filters
    const [selectedFarmId, setSelectedFarmId] = useState<string>('all');
    // Multi-select for products
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
    
    const [showResults, setShowResults] = useState(false);

    const { statistics } = useStatisticsStore();
    const { invoices } = useInvoiceStore();
    const { farms, products } = useFarmStore();
    const { addToast } = useToastStore();

    const getFarmName = (id: string) => farms.find(f => f.id === id)?.name || 'نامشخص';
    const getProduct = (id: string) => products.find(p => p.id === id);
    const getProductName = (id: string) => getProduct(id)?.name || 'نامشخص';

    const toggleProduct = (id: string) => {
        if (selectedProductIds.includes(id)) {
            setSelectedProductIds(selectedProductIds.filter(pid => pid !== id));
        } else {
            setSelectedProductIds([...selectedProductIds, id]);
        }
    };

    const getFilteredStats = () => {
        return statistics.filter(s => {
            const dateMatch = isDateInRange(s.date, startDate, endDate);
            const farmMatch = selectedFarmId === 'all' || s.farmId === selectedFarmId;
            const productMatch = selectedProductIds.length === 0 || selectedProductIds.includes(s.productId);
            return dateMatch && farmMatch && productMatch;
        });
    };

    const getFilteredInvoices = () => {
        return invoices.filter(i => {
            const dateMatch = isDateInRange(i.date, startDate, endDate);
            const farmMatch = selectedFarmId === 'all' || i.farmId === selectedFarmId;
            const productMatch = selectedProductIds.length === 0 || (i.productId && selectedProductIds.includes(i.productId));
            return dateMatch && farmMatch && productMatch;
        });
    };

    const filteredStats = getFilteredStats();
    const filteredInvoices = getFilteredInvoices();

    const handleSearch = () => {
        setShowResults(true);
    };

    const handleExport = () => {
        try {
            const wb = XLSX.utils.book_new();
            wb.Workbook = { Views: [{ RTL: true }] }; 

            let sheetName = '';
            let ws;

            if (activeTab === 'stats') {
                sheetName = 'آمار تولید';
                const statsData = filteredStats.map(s => {
                    const p = getProduct(s.productId);
                    return {
                        'تاریخ': s.date,
                        'فارم': getFarmName(s.farmId),
                        'محصول': p?.name,
                        'واحد': p?.unit,
                        'مانده قبل': s.previousBalance || 0,
                        'تولید': s.production,
                        'فروش': s.sales || 0,
                        'موجودی': s.currentInventory || 0
                    };
                });
                ws = XLSX.utils.json_to_sheet(statsData);
            } else {
                sheetName = 'حواله ها';
                const invData = filteredInvoices.map(i => ({
                    'تاریخ': i.date,
                    'فارم': getFarmName(i.farmId),
                    'شماره حواله': i.invoiceNumber,
                    'محصول': i.productId ? getProductName(i.productId) : '-',
                    'تعداد کارتن': i.totalCartons,
                    'وزن (کیلوگرم)': i.totalWeight,
                    'نام راننده': i.driverName || '-',
                    'شماره راننده': i.driverPhone || '-',
                    'پلاک': i.plateNumber || '-',
                    'وضعیت': i.isYesterday ? 'دیروزی' : 'عادی'
                }));
                ws = XLSX.utils.json_to_sheet(invData);
            }

            // Set Worksheet View to Right-to-Left
            if(!ws['!views']) ws['!views'] = [];
            ws['!views'].push({ rightToLeft: true });

            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            XLSX.writeFile(wb, `Morvarid_${activeTab}_${startDate.replace(/\//g,'-')}_to_${endDate.replace(/\//g,'-')}.xlsx`);
            addToast('فایل اکسل با موفقیت دانلود شد', 'success');
        } catch (error) {
            console.error(error);
            addToast('خطا در ایجاد فایل اکسل', 'error');
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-[24px] shadow-sm transition-colors duration-200 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-6">
                    <Icons.FileText className="w-6 h-6 text-violet-500" />
                    <h2 className="text-xl font-bold dark:text-white">گزارش‌گیری جامع</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
                    <JalaliDatePicker 
                        label="از تاریخ"
                        value={startDate} 
                        onChange={setStartDate} 
                    />
                    <JalaliDatePicker 
                        label="تا تاریخ"
                        value={endDate} 
                        onChange={setEndDate} 
                    />
                     <div>
                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">انتخاب فارم</label>
                        <select 
                            className="w-full p-2.5 border rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            value={selectedFarmId}
                            onChange={(e) => setSelectedFarmId(e.target.value)}
                        >
                            <option value="all">همه فارم‌ها</option>
                            {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                    </div>
                    
                    {/* Collapsible Multi-select Dropdown */}
                    <div className="relative">
                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">انتخاب محصول (چند انتخابی)</label>
                        <button 
                            className="w-full p-2.5 border rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white flex justify-between items-center text-sm"
                            onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                        >
                            <span className="truncate">
                                {selectedProductIds.length === 0 ? 'همه محصولات' : `${selectedProductIds.length} محصول انتخاب شده`}
                            </span>
                            <Icons.ChevronDown className={`w-4 h-4 transition-transform ${isProductDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {isProductDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto custom-scrollbar p-2">
                                <label className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-600 rounded cursor-pointer border-b dark:border-gray-500 mb-1">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedProductIds.length === 0}
                                        onChange={() => setSelectedProductIds([])}
                                        className="rounded text-violet-600"
                                    />
                                    <span className="text-sm dark:text-white font-bold">همه محصولات</span>
                                </label>
                                {products.map(p => (
                                    <label key={p.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-600 rounded cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedProductIds.includes(p.id)}
                                            onChange={() => toggleProduct(p.id)}
                                            className="rounded text-violet-600"
                                        />
                                        <span className="text-sm dark:text-white">{p.name}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                 <div className="flex gap-4 mt-6">
                    <Button onClick={handleSearch} className="flex-1 py-3 rounded-xl font-bold bg-violet-600 hover:bg-violet-700">
                        <Icons.Search className="ml-2 w-4 h-4" />
                        جستجو
                    </Button>
                     {showResults && (
                        <Button onClick={handleExport} className="flex-1 py-3 rounded-xl font-bold bg-green-600 hover:bg-green-700">
                            <Icons.FileText className="ml-2 w-4 h-4" />
                            خروجی اکسل ({activeTab === 'stats' ? 'آمار' : 'حواله'})
                        </Button>
                    )}
                </div>
            </div>

            {showResults && (
                <div className="bg-white dark:bg-gray-800 rounded-[24px] shadow-sm overflow-hidden transition-colors duration-200 border border-gray-100 dark:border-gray-700">
                    <div className="flex border-b dark:border-gray-700">
                        <button 
                            className={`flex-1 p-4 font-bold text-center transition-colors ${activeTab === 'stats' ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 border-b-2 border-violet-600' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                            onClick={() => setActiveTab('stats')}
                        >
                            آمار تولید
                        </button>
                        <button 
                            className={`flex-1 p-4 font-bold text-center transition-colors ${activeTab === 'invoices' ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 border-b-2 border-violet-600' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                            onClick={() => setActiveTab('invoices')}
                        >
                            حواله‌های فروش
                        </button>
                    </div>

                    <div className="overflow-x-auto max-h-[500px]">
                        {activeTab === 'stats' ? (
                            <table className="w-full text-sm text-right text-gray-500 dark:text-gray-400">
                                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-3">تاریخ</th>
                                        <th className="px-6 py-3">فارم</th>
                                        <th className="px-6 py-3">محصول</th>
                                        <th className="px-6 py-3">واحد</th>
                                        <th className="px-6 py-3">مانده قبل</th>
                                        <th className="px-6 py-3">تولید</th>
                                        <th className="px-6 py-3">فروش</th>
                                        <th className="px-6 py-3">موجودی</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStats.length === 0 ? (
                                        <tr><td colSpan={8} className="text-center p-8 text-gray-400">داده‌ای یافت نشد</td></tr>
                                    ) : (
                                        filteredStats.map(s => {
                                            const p = getProduct(s.productId);
                                            return (
                                                <tr key={s.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                    <td className="px-6 py-4">{s.date}</td>
                                                    <td className="px-6 py-4">{getFarmName(s.farmId)}</td>
                                                    <td className="px-6 py-4">{p?.name}</td>
                                                    <td className="px-6 py-4 text-xs">{p?.unit === 'CARTON' ? 'کارتن' : 'کیلوگرم'}</td>
                                                    <td className="px-6 py-4">{s.previousBalance || 0}</td>
                                                    <td className="px-6 py-4 text-green-600 dark:text-green-400 font-bold">{s.production}</td>
                                                    <td className="px-6 py-4 text-red-600 dark:text-red-400">{s.sales || 0}</td>
                                                    <td className="px-6 py-4 font-bold dark:text-gray-200">{s.currentInventory || '-'}</td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        ) : (
                            <table className="w-full text-sm text-right text-gray-500 dark:text-gray-400">
                                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-3">تاریخ</th>
                                        <th className="px-6 py-3">شماره حواله</th>
                                        <th className="px-6 py-3">فارم</th>
                                        <th className="px-6 py-3">محصول</th>
                                        <th className="px-6 py-3">کارتن</th>
                                        <th className="px-6 py-3">وزن</th>
                                        <th className="px-6 py-3">راننده</th>
                                        <th className="px-6 py-3">شماره تماس</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredInvoices.length === 0 ? (
                                        <tr><td colSpan={8} className="text-center p-8 text-gray-400">داده‌ای یافت نشد</td></tr>
                                    ) : (
                                        filteredInvoices.map(i => (
                                            <tr key={i.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="px-6 py-4">{i.date}</td>
                                                <td className="px-6 py-4 font-mono">{i.invoiceNumber}</td>
                                                <td className="px-6 py-4">{getFarmName(i.farmId)}</td>
                                                <td className="px-6 py-4">{i.productId ? getProductName(i.productId) : '-'}</td>
                                                <td className="px-6 py-4">{i.totalCartons}</td>
                                                <td className="px-6 py-4">{i.totalWeight}</td>
                                                <td className="px-6 py-4 text-xs">{i.driverName || '-'}</td>
                                                <td className="px-6 py-4 text-xs">{i.driverPhone || '-'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Reports;
