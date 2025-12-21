
import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useAuthStore } from '../../store/authStore';
import { useFarmStore } from '../../store/farmStore';
import { useStatisticsStore } from '../../store/statisticsStore';
import { useToastStore } from '../../store/toastStore';
import { useLogStore } from '../../store/logStore';
import { FarmType, ProductUnit } from '../../types';
import { getTodayJalali, normalizeDate, toPersianDigits } from '../../utils/dateUtils';
import Button from '../common/Button';
import { useConfirm } from '../../hooks/useConfirm';
import { Icons } from '../common/Icons';

interface FormItem {
    productId: string;
    productName?: string;
    unit?: string;
    hasKilogram?: boolean;
    selectedUnit: ProductUnit;
    previousBalance: number | string;
    production: number | string;
    productionKg?: number | string;
    sales: number | string;
    salesKg?: number | string;
    currentInventory: number;
}

interface StatisticsFormValues {
    items: FormItem[];
}

const StatisticsForm: React.FC = () => {
    const { user } = useAuthStore();
    const { getProductById } = useFarmStore();
    const { statistics, addStatistic, getLatestInventory, fetchStatistics } = useStatisticsStore();
    const { addToast } = useToastStore();
    const { addLog } = useLogStore();
    const { confirm } = useConfirm();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const todayJalali = getTodayJalali();
    const normalizedDate = normalizeDate(todayJalali);

    const userFarms = user?.assignedFarms || [];
    const [selectedFarmId, setSelectedFarmId] = useState<string>(userFarms[0]?.id || '');
    const selectedFarm = userFarms.find(f => f.id === selectedFarmId);

    const { control, register, handleSubmit, watch, setValue } = useForm<StatisticsFormValues>({
        defaultValues: { items: [] }
    });

    const { fields, replace: replaceFields } = useFieldArray({ control, name: "items" });
    const formItems = watch('items');

    useEffect(() => {
        fetchStatistics();
    }, []);

    useEffect(() => {
        if (selectedFarm) {
            const newItems: FormItem[] = selectedFarm.productIds.map(pid => {
                const product = getProductById(pid);
                const prevBalance = selectedFarm.type === FarmType.MORVARIDI ? getLatestInventory(selectedFarm.id, pid) : 0;
                
                return {
                    productId: pid,
                    productName: product?.name,
                    unit: product?.unit,
                    hasKilogram: product?.hasKilogramUnit,
                    selectedUnit: ProductUnit.CARTON,
                    previousBalance: prevBalance, 
                    production: '',
                    productionKg: '',
                    sales: '',
                    salesKg: '',
                    currentInventory: prevBalance
                };
            });
            replaceFields(newItems);
        }
    }, [selectedFarmId, selectedFarm, getProductById, getLatestInventory, replaceFields]);

    useEffect(() => {
        if (formItems) {
            formItems.forEach((item, index) => {
                const prev = Number(item.previousBalance) || 0;
                const prod = Number(item.production) || 0;
                const sale = Number(item.sales) || 0;
                
                let current = 0;
                if (selectedFarm?.type === FarmType.MOTEFEREGHE) {
                    current = prod; 
                } else {
                    current = prev + prod - sale;
                }

                if (item.currentInventory !== current) {
                     setValue(`items.${index}.currentInventory`, current);
                }
            });
        }
    }, [JSON.stringify(formItems?.map(i => [i.previousBalance, i.production, i.sales])), selectedFarm, setValue]);

    const onSubmit = async (data: StatisticsFormValues) => {
        const systemDate = normalizedDate;
        
        const duplicates = data.items.filter(item => {
            const hasData = Number(item.production) > 0 || Number(item.sales) > 0 || Number(item.productionKg) > 0;
            if(!hasData) return false;

            return statistics.some(s => 
                s.farmId === selectedFarmId && 
                normalizeDate(s.date) === systemDate && 
                s.productId === item.productId
            );
        });

        if (duplicates.length > 0) {
            addToast(`خطا: آمار محصول "${duplicates[0].productName}" برای امروز قبلاً ثبت شده است.`, 'error');
            return;
        }

        const hasNegative = data.items.some((i) => i.currentInventory < 0);
        if (selectedFarm?.type === FarmType.MORVARIDI && hasNegative) {
            addToast('خطا: موجودی نهایی نمی‌تواند منفی باشد.', 'error');
            return;
        }

        const itemsToSave = data.items.filter(item => 
            (Number(item.production) || 0) > 0 || 
            (Number(item.sales) || 0) > 0 ||
            (Number(item.productionKg) || 0) > 0
        );

        if (itemsToSave.length === 0) {
            addToast('لطفاً حداقل برای یک محصول مقادیر را وارد کنید.', 'warning');
            return;
        }

        const confirmed = await confirm({
            title: 'ثبت نهایی آمار',
            message: `آیا از ثبت آمار برای تاریخ ${systemDate} اطمینان دارید؟`,
            confirmText: 'بله، ثبت شود',
            type: 'info'
        });

        if (confirmed) {
            setIsSubmitting(true);
            let successCount = 0;
            let errorCount = 0;

            for (const item of itemsToSave) {
                const result = await addStatistic({
                    farmId: selectedFarmId,
                    date: systemDate,
                    productId: item.productId,
                    previousBalance: Number(item.previousBalance) || 0,
                    production: Number(item.production) || 0,
                    sales: Number(item.sales) || 0,
                    currentInventory: item.currentInventory
                });

                if (result.success) {
                    successCount++;
                    addLog('info', 'database', `Stats Saved: ${item.productName}`, user?.id);
                } else {
                    errorCount++;
                    console.error("Save failed", result.error);
                }
            }
            
            setIsSubmitting(false);

            if (errorCount === 0) {
                addToast('آمار با موفقیت ثبت شد', 'success');
                const resetItems = data.items.map((item) => ({ 
                    ...item, 
                    production: '', productionKg: '',
                    sales: '', salesKg: '',
                    previousBalance: item.currentInventory 
                }));
                setValue('items', resetItems);
            } else {
                addToast('خطا در ثبت برخی موارد.', 'error');
            }
        }
    };

    const inputClass = "w-full p-3 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-lg text-center font-bold text-gray-800 dark:text-white focus:border-orange-500 focus:ring-0 transition-all";
    const labelClass = "block text-xs font-black text-gray-500 dark:text-gray-400 mb-1 text-center";

    if (!selectedFarm) return <div className="text-center p-8 text-gray-500">فارمی یافت نشد.</div>;

    return (
        <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 shadow-2xl rounded-[32px] overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className="bg-metro-orange p-6 text-white flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black mb-1">ثبت آمار تولید</h2>
                    {/* TASK: Removed Farm Type Text as requested */}
                    <p className="text-white/80 text-sm font-bold">{selectedFarm.name}</p>
                </div>
                <div className="bg-white/20 px-4 py-2 rounded-xl backdrop-blur-md font-mono font-bold text-lg">
                    {toPersianDigits(normalizedDate)}
                </div>
            </div>
            
            <div className="p-6">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                    {fields.map((field, index) => {
                        const item = formItems[index];
                        if (!item) return null;
                        const isLiquid = item.hasKilogram;

                        return (
                        <div key={field.id} className="bg-gray-50 dark:bg-gray-900/50 p-5 rounded-2xl border-r-4 border-metro-orange shadow-sm">
                            <h3 className="font-black text-lg text-gray-800 dark:text-white mb-4 flex items-center gap-2 border-b dark:border-gray-700 pb-2">
                                <Icons.BarChart className="w-5 h-5 text-orange-500" />
                                {item.productName}
                            </h3>
                            
                            <div className="flex flex-col gap-4">
                                {selectedFarm.type === FarmType.MOTEFEREGHE ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClass}>تولید روزانه ({isLiquid ? 'دبه' : 'کارتن'})</label>
                                            <input type="number" {...register(`items.${index}.production` as const)} className={inputClass} placeholder="0" />
                                            <p className="text-[10px] text-gray-400 mt-1 text-center font-bold">برای فارم متفرقه فقط تولید ثبت می‌شود</p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 items-end">
                                            <div>
                                                <label className={labelClass}>مانده از قبل</label>
                                                <input 
                                                    type="number"
                                                    {...register(`items.${index}.previousBalance` as const)}
                                                    className={`${inputClass} bg-gray-100 dark:bg-gray-800 border-gray-300`}
                                                />
                                            </div>
                                            <div>
                                                <label className={`${labelClass} text-green-600`}>تولید ({isLiquid ? 'دبه' : 'کارتن'})</label>
                                                <input 
                                                    type="number"
                                                    {...register(`items.${index}.production` as const)}
                                                    className={`${inputClass} border-green-200 focus:border-green-500 bg-green-50/20`}
                                                />
                                            </div>
                                            <div>
                                                <label className={`${labelClass} text-red-600`}>فروش ({isLiquid ? 'دبه' : 'کارتن'})</label>
                                                <input 
                                                    type="number"
                                                    {...register(`items.${index}.sales` as const)}
                                                    className={`${inputClass} border-red-200 focus:border-red-500 bg-red-50/20`}
                                                />
                                            </div>
                                            <div className="bg-orange-50 dark:bg-orange-900/10 border-2 border-orange-200 dark:border-orange-800 rounded-xl p-2 flex flex-col justify-center h-[52px]">
                                                <label className="text-[10px] text-orange-800 dark:text-orange-400 font-black text-center block">موجودی نهایی</label>
                                                <div className="text-xl font-black text-center text-orange-600 dark:text-orange-300">
                                                    {toPersianDigits(item.currentInventory)}
                                                </div>
                                            </div>
                                        </div>

                                        {isLiquid && (
                                            <div className="mt-4 pt-4 border-t border-dashed border-gray-300 dark:border-gray-700">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">بخش وزنی (مایع)</span>
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
                                                    <div className="md:col-start-2">
                                                        <label className={labelClass}>تولید (کیلوگرم)</label>
                                                        <input type="number" {...register(`items.${index}.productionKg` as const)} className={`${inputClass} text-sm`} placeholder="Optional" />
                                                    </div>
                                                    <div>
                                                        <label className={labelClass}>فروش (کیلوگرم)</label>
                                                        <input type="number" {...register(`items.${index}.salesKg` as const)} className={`${inputClass} text-sm`} placeholder="Optional" />
                                                    </div>
                                                </div>
                                                <p className="text-[10px] text-gray-400 mt-1 text-center">نکته: سیستم فعلاً موجودی را بر اساس تعداد دبه محاسبه می‌کند.</p>
                                            </div>
                                        )}
                                        
                                        {selectedFarm.type === FarmType.MORVARIDI && !isLiquid && (
                                            <p className="text-[10px] text-gray-400 mt-2 text-center font-bold opacity-60">
                                                (تولید روزانه = جمع تولیدات سالن‌ها - ضایعات)
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )})}
                    
                    <div className="pt-4">
                        <Button type="submit" size="lg" isLoading={isSubmitting} className="w-full bg-orange-600 hover:bg-orange-700 shadow-xl shadow-orange-500/30 text-xl font-black py-4 rounded-2xl">
                            ثبت نهایی اطلاعات
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StatisticsForm;
