import React from 'react';
import { Farm, Product } from '../../../types';
import Button from '../../common/Button';
import JalaliDatePicker from '../../common/JalaliDatePicker';
import PersianNumberInput from '../../common/PersianNumberInput';
import PlateInput from '../../common/PlateInput';

interface ReportsCreateFormProps {
    subTab: 'stats' | 'invoice';
    onSubTabChange: (tab: 'stats' | 'invoice') => void;
    farms: Farm[];
    products: Product[];
    createFarmId: string;
    onFarmChange: (id: string) => void;
    createProductId: string;
    onProductChange: (id: string) => void;
    createDate: string;
    onDateChange: (date: string) => void;
    // Stat Form
    statForm: { prod: string; prodKg: string; prev: string; prevKg: string };
    onStatFormChange: (updates: Partial<{ prod: string; prodKg: string; prev: string; prevKg: string }>) => void;
    // Invoice Form
    invoiceForm: { invoiceNumber: string; cartons: string; weight: string; driver: string; plate: string; phone: string; desc: string };
    onInvoiceFormChange: (updates: Partial<{ invoiceNumber: string; cartons: string; weight: string; driver: string; plate: string; phone: string; desc: string }>) => void;
    onSubmit: () => void;
}

const ReportsCreateForm: React.FC<ReportsCreateFormProps> = ({
    subTab,
    onSubTabChange,
    farms,
    products,
    createFarmId,
    onFarmChange,
    createProductId,
    onProductChange,
    createDate,
    onDateChange,
    statForm,
    onStatFormChange,
    invoiceForm,
    onInvoiceFormChange,
    onSubmit
}) => {
    return (
        <div className="space-y-6">
            <div className="flex justify-center gap-4 bg-gray-100 dark:bg-gray-700/50 p-2 rounded-2xl w-fit mx-auto">
                <button
                    onClick={() => onSubTabChange('stats')}
                    className={`px-8 py-3 rounded-xl font-bold transition-all ${subTab === 'stats' ? 'bg-metro-blue text-white shadow-lg shadow-blue-500/20' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    ثبت آمار تولید
                </button>
                <button
                    onClick={() => onSubTabChange('invoice')}
                    className={`px-8 py-3 rounded-xl font-bold transition-all ${subTab === 'invoice' ? 'bg-metro-orange text-white shadow-lg shadow-orange-500/20' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    ثبت حواله فروش
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 p-8 rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 border-b border-gray-100 dark:border-gray-700 pb-8">
                    <div className="w-full">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 px-1">انتخاب فارم</label>
                        <select
                            value={createFarmId}
                            onChange={e => onFarmChange(e.target.value)}
                            className="w-full h-14 px-4 border-2 border-gray-200 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-900 dark:text-white font-bold outline-none focus:border-metro-blue transition-all"
                        >
                            <option value="">انتخاب فارم...</option>
                            {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                    </div>
                    <div className="w-full">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 px-1">انتخاب محصول</label>
                        <select
                            value={createProductId}
                            onChange={e => onProductChange(e.target.value)}
                            className="w-full h-14 px-4 border-2 border-gray-200 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-900 dark:text-white font-bold outline-none focus:border-metro-blue transition-all"
                        >
                            <option value="">انتخاب محصول...</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div className="w-full">
                        <JalaliDatePicker value={createDate} onChange={onDateChange} label="تاریخ ثبت" />
                    </div>
                </div>

                {subTab === 'stats' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4">
                        <div className="space-y-4">
                            <h3 className="text-blue-600 font-black flex items-center gap-2 mb-4">آمار عددی (کارتن)</h3>
                            <PersianNumberInput label="تولید (کارتن)" value={statForm.prod} onChange={v => onStatFormChange({ prod: v })} />
                            <PersianNumberInput label="موجودی قبلی (کارتن)" value={statForm.prev} onChange={v => onStatFormChange({ prev: v })} />
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-blue-600 font-black flex items-center gap-2 mb-4">آمار وزنی (کیلوگرم)</h3>
                            <PersianNumberInput label="تولید (کیلوگرم)" value={statForm.prodKg} onChange={v => onStatFormChange({ prodKg: v })} />
                            <PersianNumberInput label="موجودی قبلی (کیلوگرم)" value={statForm.prevKg} onChange={v => onStatFormChange({ prevKg: v })} />
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4">
                        <PersianNumberInput label="شماره حواله" value={invoiceForm.invoiceNumber} onChange={v => onInvoiceFormChange({ invoiceNumber: v })} />
                        <PersianNumberInput label="تعداد کل (کارتن)" value={invoiceForm.cartons} onChange={v => onInvoiceFormChange({ cartons: v })} />
                        <PersianNumberInput label="وزن کل (کیلوگرم)" value={invoiceForm.weight} onChange={v => onInvoiceFormChange({ weight: v })} />
                        <div className="w-full">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 px-1">نام راننده</label>
                            <input
                                type="text"
                                className="w-full h-14 px-4 border-2 border-gray-200 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-900 dark:text-white font-bold outline-none focus:border-metro-orange transition-all"
                                value={invoiceForm.driver}
                                onChange={e => onInvoiceFormChange({ driver: e.target.value })}
                            />
                        </div>
                        <PersianNumberInput label="شماره تماس راننده" value={invoiceForm.phone} onChange={v => onInvoiceFormChange({ phone: v })} />
                        <PlateInput value={invoiceForm.plate} onChange={(v: string) => onInvoiceFormChange({ plate: v })} label="پلاک خودرو" />
                        <div className="md:col-span-2 lg:col-span-3">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 px-1">توضیحات تکمیلی</label>
                            <textarea
                                className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-900 dark:text-white font-bold outline-none focus:border-metro-orange transition-all min-h-[100px]"
                                value={invoiceForm.desc}
                                onChange={e => onInvoiceFormChange({ desc: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                <div className="mt-10 pt-8 border-t border-gray-100 dark:border-gray-700 flex justify-center">
                    <Button
                        onClick={onSubmit}
                        className={`w-full md:w-80 h-14 rounded-2xl text-lg font-black shadow-xl transition-all ${subTab === 'stats' ? 'bg-metro-blue shadow-blue-500/30' : 'bg-metro-orange shadow-orange-500/30'}`}
                    >
                        ثبت نهایی اطلاعات
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ReportsCreateForm;
