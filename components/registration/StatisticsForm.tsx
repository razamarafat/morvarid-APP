
import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useAuthStore } from '../../store/authStore';
import { useFarmStore } from '../../store/farmStore';
import { useStatisticsStore } from '../../store/statisticsStore';
import { useToastStore } from '../../store/toastStore';
import { useLogStore } from '../../store/logStore';
import { FarmType, ProductUnit } from '../../types';
import { getTodayJalali, toEnglishDigits } from '../../utils/dateUtils';
import Button from '../common/Button';
import { useConfirm } from '../../hooks/useConfirm';

const StatisticsForm: React.FC = () => {
    const { user } = useAuthStore();
    const { getProductById } = useFarmStore();
    const { addStatistic, getLatestInventory } = useStatisticsStore();
    const { addToast } = useToastStore();
    const { addLog } = useLogStore();
    const { confirm } = useConfirm();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const userFarms = user?.assignedFarms || [];
    const [selectedFarmId, setSelectedFarmId] = useState<string>(userFarms[0]?.id || '');
    const selectedFarm = userFarms.find(f => f.id === selectedFarmId);

    const { control, register, handleSubmit, watch, replace, setValue } = useForm({
        defaultValues: {
            date: getTodayJalali(),
            items: [] as any[]
        }
    });

    const { fields, replace: replaceFields } = useFieldArray({
        control,
        name: "items"
    });

    const formItems = watch('items');

    useEffect(() => {
        if (selectedFarm) {
            const newItems = selectedFarm.productIds.map(pid => {
                const product = getProductById(pid);
                const prevBalance = selectedFarm.type === FarmType.MORVARIDI ? getLatestInventory(selectedFarm.id, pid) : 0;
                
                return {
                    productId: pid,
                    productName: product?.name,
                    productDesc: product?.description,
                    unit: product?.unit,
                    hasKilogram: product?.hasKilogramUnit,
                    selectedUnit: ProductUnit.CARTON,
                    previousBalance: prevBalance === 0 ? '' : prevBalance, 
                    production: '',
                    sales: '',
                    currentInventory: prevBalance
                };
            });
            replaceFields(newItems);
        }
    }, [selectedFarmId, selectedFarm, getProductById, getLatestInventory]);

    // Auto-calculation logic
    useEffect(() => {
        if (selectedFarm?.type === FarmType.MORVARIDI) {
            formItems.forEach((item, index) => {
                const prev = Number(item.previousBalance) || 0;
                const prod = Number(item.production) || 0;
                const sale = Number(item.sales) || 0;
                
                const current = prev + prod - sale;
                
                if (item.currentInventory !== current) {
                     setValue(`items.${index}.currentInventory`, current);
                }
            });
        }
    }, [JSON.stringify(formItems.map(i => [i.previousBalance, i.production, i.sales])), selectedFarm, setValue]);

    const onSubmit = async (data: any) => {
        const hasNegative = data.items.some((i: any) => i.currentInventory < 0);
        if (hasNegative) {
            addToast('خطا: موجودی نهایی نمی‌تواند منفی باشد.', 'error');
            return;
        }

        const confirmed = await confirm({
            title: 'ثبت آمار روزانه',
            message: 'آیا از صحت اطلاعات وارد شده اطمینان دارید؟',
            confirmText: 'ثبت نهایی',
            type: 'info'
        });

        if (confirmed) {
            setIsSubmitting(true);
            let successCount = 0;
            let errorCount = 0;

            const normalizedDate = toEnglishDigits(data.date);

            for (const item of data.items) {
                // Skip empty items if they have no production/sales in "MOTEFEREGHE" to avoid clutter? 
                // No, we usually want to record 0 for consistency, or maybe logic depends. 
                // For now we record everything.

                const result = await addStatistic({
                    farmId: selectedFarmId,
                    date: normalizedDate,
                    productId: item.productId,
                    previousBalance: Number(item.previousBalance) || 0,
                    production: Number(item.production) || 0,
                    sales: Number(item.sales) || 0,
                    currentInventory: item.currentInventory
                });

                if (result.success) {
                    successCount++;
                    addLog('info', 'database', `آمار ثبت شد: ${item.productName}`, user?.id);
                } else {
                    errorCount++;
                    console.error('Failed to save stat:', result.error);
                }
            }
            
            setIsSubmitting(false);

            if (errorCount === 0) {
                addToast('تمام آمارها با موفقیت ثبت شدند', 'success');
                 // Reset for next day logic
                const resetItems = data.items.map((item: any) => ({ 
                    ...item, 
                    production: '', 
                    sales: '',
                    previousBalance: item.currentInventory 
                }));
                setValue('items', resetItems);
            } else if (successCount > 0) {
                addToast(`ثبت با هشدار: ${successCount} موفق، ${errorCount} ناموفق`, 'warning');
            } else {
                addToast('خطا در ثبت اطلاعات. لطفا اتصال اینترنت را بررسی کنید', 'error');
            }
        }
    };

    const inputClass = "w-full p-3 bg-white text-gray-900 dark:bg-gray-900 dark:text-white border-2 border-gray-300 dark:border-gray-600 rounded-2xl focus:border-orange-500 focus:ring-0 transition-colors text-center font-bold text-lg placeholder-gray-300";

    if (!selectedFarm) return <div className="text-center p-8 text-gray-500">هیچ فارمی به شما تخصیص داده نشده است.</div>;

    return (
        <div className="max-w-5xl mx-auto bg-white dark:bg-gray-800 rounded-[32px] shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-8 text-white flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black tracking-tight mb-1">ثبت آمار روزانه</h2>
                    <p className="text-orange-100 text-sm font-medium">{selectedFarm.name} ({selectedFarm.type === FarmType.MORVARIDI ? 'مرواریدی' : 'متفرقه'})</p>
                </div>
                <div className="bg-white/20 px-4 py-2 rounded-2xl text-lg font-mono backdrop-blur-sm border border-white/30">
                    {getTodayJalali()}
                </div>
            </div>
            
            <div className="p-8">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {fields.map((field, index) => {
                        const isLiquid = formItems[index]?.hasKilogram; 
                        const unit1Label = isLiquid ? 'دبه / ظرف' : 'کارتن';
                        const unit2Label = 'کیلوگرم (توزین)';

                        return (
                        <div key={field.id} className="border border-gray-200 dark:border-gray-700 rounded-[24px] p-6 bg-gray-50 dark:bg-gray-800/50 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 border-b border-gray-200 dark:border-gray-700 pb-4 gap-4">
                                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2 flex-wrap">
                                    <span className="w-3 h-3 bg-orange-500 rounded-full inline-block"></span>
                                    {formItems[index]?.productName}
                                    {formItems[index]?.productDesc && (
                                        <span className="text-sm text-gray-500 dark:text-gray-400 font-normal mr-2">
                                            {formItems[index].productDesc}
                                        </span>
                                    )}
                                </h3>
                                
                                {formItems[index]?.hasKilogram && (
                                    <div className="flex bg-white dark:bg-gray-700 p-1.5 rounded-2xl shadow-sm self-start md:self-auto border border-gray-200 dark:border-gray-600">
                                        <button
                                            type="button"
                                            className={`px-4 py-1.5 rounded-xl text-sm font-bold transition-all ${formItems[index].selectedUnit === ProductUnit.CARTON ? 'bg-orange-500 text-white shadow-md' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                                            onClick={() => setValue(`items.${index}.selectedUnit`, ProductUnit.CARTON)}
                                        >
                                            {unit1Label}
                                        </button>
                                        <button
                                            type="button"
                                            className={`px-4 py-1.5 rounded-xl text-sm font-bold transition-all ${formItems[index].selectedUnit === ProductUnit.KILOGRAM ? 'bg-orange-500 text-white shadow-md' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                                            onClick={() => setValue(`items.${index}.selectedUnit`, ProductUnit.KILOGRAM)}
                                        >
                                            {unit2Label}
                                        </button>
                                    </div>
                                )}
                            </div>
                            
                            {selectedFarm.type === FarmType.MOTEFEREGHE ? (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        تولید روزانه ({formItems[index].selectedUnit === ProductUnit.KILOGRAM ? unit2Label : unit1Label})
                                    </label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        {...register(`items.${index}.production` as const)}
                                        placeholder="مقدار وارد کنید..."
                                        className={inputClass}
                                        onKeyDown={(e) => ["-", "e", "E", "+"].includes(e.key) && e.preventDefault()}
                                    />
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-2">مانده دیروز (قابل ویرایش)</label>
                                        <input 
                                            type="number"
                                            {...register(`items.${index}.previousBalance` as const)}
                                            placeholder="0"
                                            className={`${inputClass} border-gray-300 dark:border-gray-600`}
                                            onKeyDown={(e) => ["-", "e", "E", "+"].includes(e.key) && e.preventDefault()}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-green-600 mb-2">تولید (+)</label>
                                        <input 
                                            type="number"
                                            min="0"
                                            {...register(`items.${index}.production` as const)}
                                            placeholder="0"
                                            className={`${inputClass} border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 focus:border-green-500`}
                                            onKeyDown={(e) => ["-", "e", "E", "+"].includes(e.key) && e.preventDefault()}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-red-500 mb-2">فروش (-)</label>
                                        <input 
                                            type="number"
                                            min="0"
                                            {...register(`items.${index}.sales` as const)}
                                            placeholder="0"
                                            className={`${inputClass} border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 focus:border-red-500`}
                                            onKeyDown={(e) => ["-", "e", "E", "+"].includes(e.key) && e.preventDefault()}
                                        />
                                    </div>
                                    <div className={`p-2 rounded-2xl border ${formItems[index].currentInventory < 0 ? 'bg-red-100 border-red-500 animate-pulse' : 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800'}`}>
                                        <label className="block text-xs font-bold text-orange-800 dark:text-orange-300 mb-1 text-center">موجودی نهایی</label>
                                        <div className={`text-xl font-black text-center ${formItems[index].currentInventory < 0 ? 'text-red-600' : 'text-orange-600 dark:text-orange-400'}`}>
                                             {formItems[index].currentInventory || 0}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )})}
                    <div className="flex justify-end pt-4">
                        <Button type="submit" size="lg" isLoading={isSubmitting} className="w-full md:w-auto bg-gradient-to-l from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 shadow-lg shadow-orange-500/30 rounded-2xl py-4 px-12 text-lg font-bold">
                            ثبت نهایی آمار
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StatisticsForm;
