
import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useAuthStore } from '../../store/authStore';
import { useFarmStore } from '../../store/farmStore';
import { useStatisticsStore } from '../../store/statisticsStore';
import { useToastStore } from '../../store/toastStore';
import { useLogStore } from '../../store/logStore';
import { FarmType, ProductUnit } from '../../types';
import { getTodayJalali, normalizeDate } from '../../utils/dateUtils';
import Button from '../common/Button';
import { useConfirm } from '../../hooks/useConfirm';
import { Icons } from '../common/Icons';

interface FormItem {
    productId: string;
    productName?: string;
    productDesc?: string;
    unit?: string;
    hasKilogram?: boolean;
    selectedUnit: ProductUnit;
    previousBalance: number | string;
    production: number | string;
    sales: number | string;
    currentInventory: number;
}

interface StatisticsFormValues {
    // date field removed from user input interface
    items: FormItem[];
}

const StatisticsForm: React.FC = () => {
    const { user } = useAuthStore();
    const { getProductById } = useFarmStore();
    const { statistics, addStatistic, getLatestInventory } = useStatisticsStore();
    const { addToast } = useToastStore();
    const { addLog } = useLogStore();
    const { confirm } = useConfirm();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // SYSTEMATIC DATE GENERATION
    const todayJalali = getTodayJalali();
    const normalizedDate = normalizeDate(todayJalali);

    const userFarms = user?.assignedFarms || [];
    const [selectedFarmId, setSelectedFarmId] = useState<string>(userFarms[0]?.id || '');
    const selectedFarm = userFarms.find(f => f.id === selectedFarmId);

    const { control, register, handleSubmit, watch, setValue } = useForm<StatisticsFormValues>({
        defaultValues: {
            items: []
        }
    });

    const { fields, replace: replaceFields } = useFieldArray({
        control,
        name: "items"
    });

    const formItems = watch('items');

    useEffect(() => {
        if (selectedFarm) {
            const newItems: FormItem[] = selectedFarm.productIds.map(pid => {
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
    }, [selectedFarmId, selectedFarm, getProductById, getLatestInventory, replaceFields]);

    useEffect(() => {
        if (selectedFarm?.type === FarmType.MORVARIDI && formItems) {
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
    }, [JSON.stringify(formItems?.map(i => [i.previousBalance, i.production, i.sales])), selectedFarm, setValue]);

    const onSubmit = async (data: StatisticsFormValues) => {
        // STRICT ENFORCEMENT: Use the system calculated date, ignore any potential user manipulation
        const systemDate = normalizedDate;
        
        // CHECK FOR DUPLICATES: Only one record per farm/product/date
        const duplicates = data.items.filter(item => 
            statistics.some(s => 
                s.farmId === selectedFarmId && 
                normalizeDate(s.date) === systemDate && 
                s.productId === item.productId
            )
        );

        if (duplicates.length > 0) {
            addToast(`آمار برخی محصولات برای تاریخ امروز (${systemDate}) قبلاً ثبت شده است.`, 'warning');
            return;
        }

        const hasNegative = data.items.some((i) => i.currentInventory < 0);
        if (hasNegative) {
            addToast('خطا: موجودی نهایی نمی‌تواند منفی باشد.', 'error');
            return;
        }

        const confirmed = await confirm({
            title: 'ثبت آمار روزانه',
            message: `آیا از ثبت آمار برای تاریخ امروز (${systemDate}) اطمینان دارید؟`,
            confirmText: 'ثبت نهایی',
            type: 'info'
        });

        if (confirmed) {
            setIsSubmitting(true);
            let successCount = 0;
            let errorCount = 0;

            for (const item of data.items) {
                const result = await addStatistic({
                    farmId: selectedFarmId,
                    date: systemDate, // Enforced Date
                    productId: item.productId,
                    previousBalance: Number(item.previousBalance) || 0,
                    production: Number(item.production) || 0,
                    sales: Number(item.sales) || 0,
                    currentInventory: item.currentInventory
                });

                if (result.success) {
                    successCount++;
                    addLog('info', 'database', `آمار ثبت شد: ${item.productName} (${systemDate})`, user?.id);
                } else {
                    errorCount++;
                }
            }
            
            setIsSubmitting(false);

            if (errorCount === 0) {
                addToast('تمام آمارها با موفقیت ثبت شدند', 'success');
                const resetItems = data.items.map((item) => ({ 
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

    const inputClass = "w-full p-2.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:border-orange-500 focus:ring-0 transition-colors text-center font-bold text-base placeholder-gray-400 dark:placeholder-gray-500";

    if (!selectedFarm) return <div className="text-center p-8 text-gray-500 dark:text-gray-400">هیچ فارمی به شما تخصیص داده نشده است.</div>;

    return (
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-[24px] md:rounded-[32px] shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-5 md:p-8 text-white flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-center md:text-right">
                    <h2 className="text-xl md:text-2xl font-black tracking-tight mb-1">ثبت آمار روزانه</h2>
                    <p className="text-orange-100 text-xs md:text-sm font-medium">{selectedFarm.name} ({selectedFarm.type === FarmType.MORVARIDI ? 'مرواریدی' : 'متفرقه'})</p>
                </div>
                
                {/* READ ONLY DATE DISPLAY */}
                <div className="bg-white/20 px-6 py-2 rounded-xl text-base md:text-lg font-mono backdrop-blur-sm border border-white/30 flex items-center gap-2 shadow-inner">
                    <span className="font-black tracking-wider">{normalizedDate}</span>
                    <Icons.Calendar className="w-5 h-5 opacity-80" />
                </div>
            </div>
            
            <div className="p-4 md:p-8">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
                    {fields.map((field, index) => {
                        const item = formItems[index];
                        if (!item) return null;
                        const isLiquid = item.hasKilogram; 
                        const unit1Label = isLiquid ? 'دبه' : 'کارتن';
                        const unit2Label = 'کیلوگرم';

                        return (
                        <div key={field.id} className="border border-gray-100 dark:border-gray-700 rounded-[20px] md:rounded-[24px] p-4 md:p-6 bg-gray-50 dark:bg-gray-800/50 shadow-sm transition-shadow">
                            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 md:mb-6 border-b dark:border-gray-700 pb-3 gap-3">
                                <h3 className="font-bold text-base md:text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 bg-orange-500 rounded-full inline-block"></span>
                                    {item.productName}
                                </h3>
                                
                                {item.hasKilogram && (
                                    <div className="flex bg-white dark:bg-gray-700 p-1 rounded-xl shadow-sm self-start border dark:border-gray-600">
                                        <button
                                            type="button"
                                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${item.selectedUnit === ProductUnit.CARTON ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-400'}`}
                                            onClick={() => setValue(`items.${index}.selectedUnit`, ProductUnit.CARTON)}
                                        >
                                            {unit1Label}
                                        </button>
                                        <button
                                            type="button"
                                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${item.selectedUnit === ProductUnit.KILOGRAM ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-400'}`}
                                            onClick={() => setValue(`items.${index}.selectedUnit`, ProductUnit.KILOGRAM)}
                                        >
                                            {unit2Label}
                                        </button>
                                    </div>
                                )}
                            </div>
                            
                            {selectedFarm.type === FarmType.MOTEFEREGHE ? (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">تولید روزانه ({item.selectedUnit === ProductUnit.KILOGRAM ? unit2Label : unit1Label})</label>
                                    <input 
                                        type="number" 
                                        {...register(`items.${index}.production` as const)}
                                        placeholder="0"
                                        className={inputClass}
                                    />
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 mb-1 text-center">مانده قبل</label>
                                        <input 
                                            type="number"
                                            {...register(`items.${index}.previousBalance` as const)}
                                            className={`${inputClass} !p-2 !text-sm border-gray-200 cursor-not-allowed opacity-70`}
                                            readOnly // Previous balance usually shouldn't be edited manually if calculated automatically
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-green-500 mb-1 text-center">تولید (+)</label>
                                        <input 
                                            type="number"
                                            {...register(`items.${index}.production` as const)}
                                            className={`${inputClass} !p-2 !text-sm border-green-100 bg-green-50/50`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-red-400 mb-1 text-center">فروش (-)</label>
                                        <input 
                                            type="number"
                                            {...register(`items.${index}.sales` as const)}
                                            className={`${inputClass} !p-2 !text-sm border-red-100 bg-red-50/50`}
                                        />
                                    </div>
                                    <div className={`p-2 rounded-xl border ${item.currentInventory < 0 ? 'bg-red-50 border-red-400 animate-pulse' : 'bg-orange-50 dark:bg-orange-900/10 border-orange-100'} h-[48px] flex flex-col justify-center`}>
                                        <label className="block text-[10px] font-black text-orange-800 dark:text-orange-400 text-center leading-tight">موجودی نهایی</label>
                                        <div className={`text-base font-black text-center ${item.currentInventory < 0 ? 'text-red-600' : 'text-orange-600'}`}>
                                             {item.currentInventory || 0}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )})}
                    <div className="flex justify-end pt-2">
                        <Button type="submit" size="lg" isLoading={isSubmitting} className="w-full md:w-auto bg-orange-600 hover:bg-orange-700 shadow-xl shadow-orange-500/20 rounded-xl py-4 px-12 text-base font-black">
                            ثبت نهایی آمار
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StatisticsForm;
