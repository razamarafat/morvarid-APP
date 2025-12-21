
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../../store/authStore';
import { useFarmStore } from '../../store/farmStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useToastStore } from '../../store/toastStore';
import { useLogStore } from '../../store/logStore';
import { getTodayJalali, normalizeDate, toPersianDigits } from '../../utils/dateUtils';
import Button from '../common/Button';
import { Icons } from '../common/Icons';
import { useConfirm } from '../../hooks/useConfirm';
import { FarmType } from '../../types';

const invoiceSchema = z.object({
    invoiceNumber: z.string().min(1, 'شماره حواله الزامی است'),
    totalCartons: z.number().min(1, 'حداقل ۱ کارتن'),
    totalWeight: z.number().min(0.1, 'وزن نامعتبر است'),
    productId: z.string().min(1, 'انتخاب محصول الزامی است'),
    isYesterday: z.boolean(),
    driverName: z.string().optional(),
    driverPhone: z.string().optional(),
    plateNumber: z.string().optional(),
    description: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

const InvoiceForm: React.FC = () => {
    const { user } = useAuthStore();
    const { getProductById } = useFarmStore();
    const { addInvoice } = useInvoiceStore();
    const { addToast } = useToastStore();
    const { confirm } = useConfirm();
    
    const todayJalali = getTodayJalali();
    const normalizedDate = normalizeDate(todayJalali);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const userFarms = user?.assignedFarms || [];
    const [selectedFarmId, setSelectedFarmId] = useState<string>(userFarms[0]?.id || '');
    const selectedFarm = userFarms.find(f => f.id === selectedFarmId);

    const { register, handleSubmit, setValue, reset, watch, formState: { errors } } = useForm<InvoiceFormValues>({
        resolver: zodResolver(invoiceSchema),
        defaultValues: { isYesterday: false, productId: '', description: '' }
    });

    const isMorvaridi = selectedFarm?.type === FarmType.MORVARIDI;

    const handleSave = async (data: InvoiceFormValues, keepInvoiceInfo: boolean) => {
        const confirmed = await confirm({
            title: 'ثبت حواله',
            message: `آیا اطلاعات مورد تایید است؟`,
            confirmText: 'بله، ثبت شود',
            type: 'info'
        });

        if (!confirmed) return;

        setIsSubmitting(true);
        const result = await addInvoice({
            farmId: selectedFarmId,
            date: normalizedDate,
            invoiceNumber: data.invoiceNumber,
            totalCartons: data.totalCartons,
            totalWeight: data.totalWeight,
            productId: data.productId,
            driverName: data.driverName || '',
            driverPhone: data.driverPhone || '',
            plateNumber: data.plateNumber || '',
            description: data.description || '',
            isYesterday: data.isYesterday
        });
        setIsSubmitting(false);

        if (result.success) {
            addToast('حواله ثبت شد', 'success');
            if (keepInvoiceInfo) {
                // Keep Invoice Num, Driver, Plate. Reset Product/Weight/Cartons
                setValue('totalCartons', 0);
                setValue('totalWeight', 0);
                setValue('productId', '');
                setValue('description', '');
                addToast('اطلاعات محصول پاک شد، می‌توانید محصول بعدی این حواله را ثبت کنید.', 'info');
            } else {
                reset();
            }
        } else {
            addToast('خطا در ثبت: ' + result.error, 'error');
        }
    };

    const inputClass = "w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-800 dark:text-white focus:border-metro-orange focus:bg-white transition-all font-bold text-center";

    if (!selectedFarm) return <div className="text-center p-12">فارمی انتخاب نشده است.</div>;

    return (
        <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-[32px] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
             <div className="bg-gradient-to-r from-orange-600 to-amber-600 p-6 text-white flex justify-between items-center">
                <h2 className="text-2xl font-black">ثبت حواله فروش</h2>
                <span className="bg-white/20 px-3 py-1 rounded-lg font-mono">{toPersianDigits(normalizedDate)}</span>
            </div>

            <div className="p-6">
                <form id="invoiceForm" onSubmit={handleSubmit((d) => handleSave(d, false))} className="space-y-6">
                    <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/30 flex justify-between items-center">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" {...register('isYesterday')} className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500" />
                            <span className="font-bold text-gray-800 dark:text-gray-200 text-sm">حواله دیروز</span>
                        </label>
                        <div className="w-1/2">
                            <input type="text" dir="ltr" {...register('invoiceNumber')} className={inputClass} placeholder="شماره حواله" />
                            {errors.invoiceNumber && <p className="text-red-500 text-xs mt-1 text-center font-bold">{errors.invoiceNumber.message}</p>}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-black text-gray-400 mb-2 mr-2 text-right">محصول</label>
                        <div className="grid grid-cols-2 gap-3">
                            {selectedFarm.productIds.map(pid => {
                                const p = getProductById(pid);
                                return (
                                    <label key={pid} className="relative cursor-pointer group">
                                        <input type="radio" value={pid} {...register('productId')} className="peer hidden" />
                                        <div className="p-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-center font-bold text-gray-600 dark:text-gray-300 peer-checked:border-orange-500 peer-checked:bg-orange-50 dark:peer-checked:bg-orange-900/20 peer-checked:text-orange-600 transition-all group-hover:bg-gray-50 dark:group-hover:bg-gray-700">
                                            {p?.name}
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                        {errors.productId && <p className="text-red-500 text-xs mt-2 font-bold text-center">{errors.productId.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1 text-gray-500 text-center">تعداد کارتن</label>
                            <input type="number" {...register('totalCartons', { valueAsNumber: true })} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1 text-gray-500 text-center">وزن (کیلوگرم)</label>
                            <input type="number" step="0.01" {...register('totalWeight', { valueAsNumber: true })} className={inputClass} />
                        </div>
                    </div>

                    {isMorvaridi && (
                        <div className="border-t pt-4 border-dashed dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold mb-1 text-gray-500 text-center">نام راننده (اختیاری)</label>
                                <input {...register('driverName')} className={`${inputClass} text-sm font-normal`} placeholder="-" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1 text-gray-500 text-center">شماره تماس (اختیاری)</label>
                                <input {...register('driverPhone')} className={`${inputClass} text-sm font-normal`} placeholder="-" dir="ltr" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold mb-1 text-gray-500 text-center">پلاک خودرو (اختیاری)</label>
                                <input {...register('plateNumber')} className={`${inputClass} text-sm font-normal`} placeholder="-" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold mb-1 text-gray-500 text-center">توضیحات حواله (اختیاری)</label>
                                <textarea {...register('description')} className={`${inputClass} text-sm font-normal h-20 text-right`} placeholder="توضیحات اضافی..."></textarea>
                            </div>
                        </div>
                    )}

                    {!isMorvaridi && (
                         <div className="md:col-span-2">
                             <label className="block text-xs font-bold mb-1 text-gray-500 text-center">توضیحات حواله (اختیاری)</label>
                             <textarea {...register('description')} className={`${inputClass} text-sm font-normal h-20 text-right`} placeholder="توضیحات اضافی..."></textarea>
                         </div>
                    )}

                    <div className="pt-4 flex flex-col gap-3">
                        <Button 
                            type="button" 
                            onClick={handleSubmit((d) => handleSave(d, true))} 
                            isLoading={isSubmitting} 
                            variant="secondary"
                            className="w-full py-4 rounded-xl border-dashed border-2 border-orange-300 text-orange-700 font-bold"
                        >
                            <Icons.Plus className="ml-2" />
                            ثبت و افزودن محصول دیگر به همین حواله
                        </Button>
                        
                        <Button 
                            type="submit" 
                            isLoading={isSubmitting} 
                            className="w-full py-4 rounded-2xl bg-orange-600 hover:bg-orange-700 shadow-xl text-xl font-black"
                        >
                            ثبت نهایی و جدید
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default InvoiceForm;
