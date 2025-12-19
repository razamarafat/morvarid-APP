import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../../store/authStore';
import { useFarmStore } from '../../store/farmStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useToastStore } from '../../store/toastStore';
import { useLogStore } from '../../store/logStore';
import { FarmType } from '../../types';
import { getTodayJalali, toEnglishDigits } from '../../utils/dateUtils';
import Button from '../common/Button';
import { Icons } from '../common/Icons';
import { useSMS } from '../../hooks/useSMS';
import { useConfirm } from '../../hooks/useConfirm';
import Modal from '../common/Modal';

const invoiceSchema = z.object({
    invoiceNumber: z.string().min(1, 'شماره حواله الزامی است'),
    totalCartons: z.number({ invalid_type_error: 'تعداد کارتن باید عدد باشد' }).min(1, 'حداقل ۱ کارتن'),
    totalWeight: z.number({ invalid_type_error: 'وزن باید عدد باشد' }).min(0.1, 'وزن نامعتبر است'),
    productId: z.string().optional(),
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
    const { addLog } = useLogStore();
    const { readFromClipboard, parseInvoiceSMS } = useSMS();
    const { confirm } = useConfirm();
    
    const [showDriverDetails, setShowDriverDetails] = useState(false);
    const [isSMSModalOpen, setSMSModalOpen] = useState(false);
    const [smsText, setSmsText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const userFarms = user?.assignedFarms || [];
    const [selectedFarmId, setSelectedFarmId] = useState<string>(userFarms[0]?.id || '');
    const selectedFarm = userFarms.find(f => f.id === selectedFarmId);

    const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<InvoiceFormValues>({
        resolver: zodResolver(invoiceSchema),
        defaultValues: { isYesterday: false }
    });

    const handlePasteSMS = async () => {
        const data = await readFromClipboard();
        if (data) {
            fillFromData(data);
        } else {
            setSMSModalOpen(true);
        }
    };

    const handleManualSMS = () => {
        const parsed = parseInvoiceSMS(smsText);
        if (parsed) {
            fillFromData(parsed);
            setSMSModalOpen(false);
            setSmsText('');
            addToast('اطلاعات پیامک با موفقیت استخراج شد', 'success');
        } else {
            addToast('فرمت متن وارد شده صحیح نیست', 'error');
        }
    };

    const fillFromData = (data: any) => {
        if (data.invoiceNumber) setValue('invoiceNumber', data.invoiceNumber);
        if (data.cartons) setValue('totalCartons', data.cartons);
        if (data.weight) setValue('totalWeight', data.weight);
    };

    const onSubmit = async (data: InvoiceFormValues) => {
        if (selectedFarm?.type === FarmType.MORVARIDI && !data.productId) {
            addToast('لطفا نوع محصول را انتخاب کنید', 'error');
            return;
        }

        const confirmed = await confirm({
            title: 'ثبت حواله فروش',
            message: 'آیا از صحت اطلاعات وارد شده اطمینان دارید؟',
            confirmText: 'بله، ثبت کن',
            type: 'info'
        });

        if (confirmed) {
            setIsSubmitting(true);
            const result = await addInvoice({
                farmId: selectedFarmId,
                date: toEnglishDigits(getTodayJalali()),
                invoiceNumber: toEnglishDigits(data.invoiceNumber),
                totalCartons: data.totalCartons,
                totalWeight: data.totalWeight,
                productId: data.productId,
                driverName: data.driverName,
                driverPhone: data.driverPhone ? toEnglishDigits(data.driverPhone) : undefined,
                plateNumber: data.plateNumber,
                isYesterday: data.isYesterday
            });

            setIsSubmitting(false);

            if (result.success) {
                addLog('info', 'database', `حواله فروش ثبت شد: ${data.invoiceNumber} - ${data.totalWeight}kg`, user?.id);
                addToast('حواله با موفقیت ثبت شد', 'success');
                reset({
                     isYesterday: false,
                     driverName: '',
                     driverPhone: '',
                     plateNumber: '',
                     description: '',
                     invoiceNumber: '',
                     totalCartons: undefined,
                     totalWeight: undefined
                });
            } else {
                addToast('خطا در ثبت حواله: ' + (result.error?.message || 'خطای شبکه'), 'error');
            }
        }
    };

    const inputClass = "w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white text-gray-900 dark:bg-gray-900 dark:text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors placeholder-gray-400 dark:placeholder-gray-500";

    if (!selectedFarm) return <div className="text-center p-8 text-gray-500 dark:text-gray-400">فارمی یافت نشد.</div>;

    return (
        <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-[24px] shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
             <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-white flex justify-between items-center">
                <h2 className="text-xl font-black">ثبت حواله فروش</h2>
                <div className="flex gap-3 items-center">
                    <button onClick={handlePasteSMS} className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl text-sm font-bold flex items-center gap-2 backdrop-blur-sm transition-colors" title="خواندن از پیامک">
                        <Icons.FileText className="w-4 h-4" />
                        <span>خواندن پیامک</span>
                    </button>
                </div>
            </div>

            <div className="p-8">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-2xl border-2 border-yellow-100 dark:border-yellow-900/30">
                        <label className="flex items-center gap-4 cursor-pointer">
                            <input type="checkbox" {...register('isYesterday')} className="w-6 h-6 text-orange-600 rounded-lg focus:ring-orange-500 border-gray-300 dark:border-gray-600 dark:bg-gray-700" />
                            <div className="flex flex-col">
                                <span className="font-bold text-gray-800 dark:text-gray-200">حواله دیروزی</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">اگر بارگیری دیروز انجام شده و امروز ثبت می‌کنید، این گزینه را تیک بزنید.</span>
                            </div>
                        </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">شماره رمز حواله <span className="text-red-500">*</span></label>
                            <input 
                                type="text" 
                                dir="ltr" 
                                placeholder="مثلا 1766..."
                                {...register('invoiceNumber')} 
                                className={`${inputClass} font-mono text-center tracking-widest text-lg`}
                            />
                            {errors.invoiceNumber && <p className="text-red-500 text-sm mt-1">{errors.invoiceNumber.message}</p>}
                        </div>
                        
                         {selectedFarm.type === FarmType.MORVARIDI && (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">نوع محصول <span className="text-red-500">*</span></label>
                                <select {...register('productId')} className={inputClass}>
                                    <option value="">انتخاب کنید...</option>
                                    {selectedFarm.productIds.map(pid => {
                                        const p = getProductById(pid);
                                        return <option key={pid} value={pid}>{p?.name}</option>;
                                    })}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">تعداد کارتن <span className="text-red-500">*</span></label>
                            <input 
                                type="number" 
                                placeholder="عدد وارد کنید"
                                {...register('totalCartons', { valueAsNumber: true })} 
                                className={inputClass}
                                onKeyDown={(e) => ["-", "e", "E", "+", "."].includes(e.key) && e.preventDefault()}
                            />
                            {errors.totalCartons && <p className="text-red-500 text-sm mt-1">{errors.totalCartons.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">وزن کل (کیلوگرم) <span className="text-red-500">*</span></label>
                            <input 
                                type="text" 
                                placeholder="مثلا 12.5"
                                // Using text input with regex validation for precision
                                {...register('totalWeight', { 
                                    valueAsNumber: true,
                                    shouldUnregister: true
                                })} 
                                className={inputClass}
                            />
                            {errors.totalWeight && <p className="text-red-500 text-sm mt-1">{errors.totalWeight.message}</p>}
                        </div>
                    </div>

                    <div className="border-t border-gray-100 dark:border-gray-700 pt-6">
                        <button type="button" onClick={() => setShowDriverDetails(!showDriverDetails)} className="flex items-center text-orange-600 hover:text-orange-700 font-bold text-sm bg-orange-50 dark:bg-orange-900/10 px-4 py-2 rounded-xl transition-colors">
                            {showDriverDetails ? <Icons.ChevronDown className="w-4 h-4 ml-1" /> : <Icons.ChevronLeft className="w-4 h-4 ml-1" />}
                            اطلاعات راننده و توضیحات (اختیاری)
                        </button>

                        {showDriverDetails && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 animate-in fade-in slide-in-from-top-2">
                                <div><label className="block text-sm mb-2 text-gray-600 dark:text-gray-400">نام راننده</label><input {...register('driverName')} className={inputClass} /></div>
                                <div><label className="block text-sm mb-2 text-gray-600 dark:text-gray-400">شماره تماس</label><input dir="ltr" {...register('driverPhone')} className={inputClass} /></div>
                                <div><label className="block text-sm mb-2 text-gray-600 dark:text-gray-400">پلاک</label><input {...register('plateNumber')} className={inputClass} /></div>
                                <div><label className="block text-sm mb-2 text-gray-600 dark:text-gray-400">توضیحات</label><input {...register('description')} className={inputClass} /></div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button type="submit" size="lg" isLoading={isSubmitting} className="bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-500/30 rounded-xl py-4 px-8 text-lg font-bold">ثبت حواله</Button>
                    </div>
                </form>
            </div>

            <Modal isOpen={isSMSModalOpen} onClose={() => setSMSModalOpen(false)} title="وارد کردن متن پیامک">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300">متن پیامک حواله را اینجا Paste کنید:</p>
                    <textarea 
                        value={smsText}
                        onChange={(e) => setSmsText(e.target.value)}
                        className="w-full h-32 p-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:border-orange-500 outline-none"
                        placeholder="متن پیامک..."
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setSMSModalOpen(false)}>لغو</Button>
                        <Button onClick={handleManualSMS}>پردازش</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default InvoiceForm;