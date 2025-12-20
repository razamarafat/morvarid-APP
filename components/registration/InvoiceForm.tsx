
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../../store/authStore';
import { useFarmStore } from '../../store/farmStore';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useToastStore } from '../../store/toastStore';
import { useLogStore } from '../../store/logStore';
import { getTodayJalali, normalizeDate } from '../../utils/dateUtils';
import Button from '../common/Button';
import { Icons } from '../common/Icons';
import { useSMS, ParsedSMS } from '../../hooks/useSMS';
import { useConfirm } from '../../hooks/useConfirm';
import Modal from '../common/Modal';

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
    const { addLog } = useLogStore();
    const { readFromClipboard, TARGET_SENDER } = useSMS();
    const { confirm } = useConfirm();
    
    // SYSTEM DATE
    const todayJalali = getTodayJalali();
    const normalizedDate = normalizeDate(todayJalali);

    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [isSMSModalOpen, setIsSMSModalOpen] = useState(false);
    const [detectedInvoices, setDetectedInvoices] = useState<ParsedSMS[]>([]);
    const [isProcessingClipboard, setIsProcessingClipboard] = useState(false);

    const userFarms = user?.assignedFarms || [];
    const [selectedFarmId, setSelectedFarmId] = useState<string>(userFarms[0]?.id || '');
    const selectedFarm = userFarms.find(f => f.id === selectedFarmId);

    const { register, handleSubmit, setValue, reset, watch, formState: { errors } } = useForm<InvoiceFormValues>({
        resolver: zodResolver(invoiceSchema),
        defaultValues: { isYesterday: false, productId: '' }
    });

    const selectedProductId = watch('productId');

    const handleOpenSMSReader = () => {
        setIsSMSModalOpen(true);
        setDetectedInvoices([]);
    };

    const processClipboard = async () => {
        setIsProcessingClipboard(true);
        const results = await readFromClipboard();
        
        if (results.length > 0) {
            setDetectedInvoices(results);
            addToast(`${results.length} حواله معتبر شناسایی شد.`, 'success');
        } else {
            addToast('حواله‌ای با فرمت استاندارد در متن کپی شده یافت نشد.', 'warning');
        }
        setIsProcessingClipboard(false);
    };

    const handleConfirmBatch = async () => {
        if (!selectedProductId) {
            addToast('لطفاً ابتدا نوع محصول را انتخاب کنید.', 'error');
            return;
        }

        const confirmed = await confirm({
            title: 'ثبت دسته‌ای حواله‌ها',
            message: `آیا از ثبت ${detectedInvoices.length} حواله استخراج شده اطمینان دارید؟`,
            confirmText: 'بله، ثبت شوند',
            type: 'info'
        });

        if (confirmed) {
            setIsSubmitting(true);
            let successCount = 0;
            const today = normalizedDate; // Enforce today

            for (const inv of detectedInvoices) {
                const res = await addInvoice({
                    farmId: selectedFarmId,
                    date: today,
                    invoiceNumber: inv.invoiceNumber,
                    totalCartons: inv.cartons,
                    totalWeight: inv.weight,
                    productId: selectedProductId,
                    isYesterday: false 
                });
                if (res.success) successCount++;
            }

            setIsSubmitting(false);
            setIsSMSModalOpen(false);
            addToast(`${successCount} حواله با موفقیت در سیستم ثبت شد.`, 'success');
        }
    };

    const handleApplySingle = (inv: ParsedSMS) => {
        setValue('invoiceNumber', inv.invoiceNumber);
        if (inv.cartons > 0) setValue('totalCartons', inv.cartons);
        if (inv.weight > 0) setValue('totalWeight', inv.weight);
        setIsSMSModalOpen(false);
        addToast('اطلاعات حواله در فرم درج گردید.', 'info');
    };

    const onSubmit = async (data: InvoiceFormValues) => {
        const confirmed = await confirm({
            title: 'تایید نهایی حواله',
            message: `آیا از ثبت حواله برای تاریخ امروز (${normalizedDate}) اطمینان دارید؟`,
            confirmText: 'بله، ثبت شود',
            type: 'info'
        });

        if (confirmed) {
            setIsSubmitting(true);
            const result = await addInvoice({
                farmId: selectedFarmId,
                date: normalizedDate, // Enforce systematic date
                invoiceNumber: data.invoiceNumber,
                totalCartons: data.totalCartons,
                totalWeight: data.totalWeight,
                productId: data.productId,
                driverName: data.driverName,
                driverPhone: data.driverPhone,
                plateNumber: data.plateNumber,
                isYesterday: data.isYesterday
            });

            setIsSubmitting(false);

            if (result.success) {
                addToast('حواله با موفقیت ثبت شد', 'success');
                reset();
            } else {
                addToast('خطا در ثبت: ' + (result.error || 'خطای شبکه'), 'error');
            }
        }
    };

    const inputClass = "w-full p-4 border-2 border-gray-100 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-900 dark:text-white focus:border-orange-500 focus:bg-white outline-none transition-all font-bold text-center";

    if (!selectedFarm) return <div className="text-center p-12 text-gray-500 font-bold">فارمی برای شما تعریف نشده است.</div>;

    return (
        <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-[32px] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700 transition-colors">
             <div className="bg-gradient-to-r from-orange-600 to-amber-600 p-8 text-white">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-black">ثبت حواله بارگیری</h2>
                    <div className="bg-white/20 px-4 py-1.5 rounded-xl text-sm font-mono backdrop-blur-sm border border-white/30 flex items-center gap-2">
                        <span>{normalizedDate}</span>
                        <Icons.Calendar className="w-4 h-4" />
                    </div>
                </div>
                <p className="text-orange-100 font-medium">لطفاً اطلاعات حواله خروجی را با دقت وارد نمایید.</p>
            </div>

            <div className="p-8">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <button 
                        type="button" 
                        onClick={handleOpenSMSReader}
                        className="w-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 p-5 rounded-2xl border-2 border-dashed border-blue-200 dark:border-blue-800 flex items-center justify-center gap-4 hover:bg-blue-100 transition-all font-black group shadow-sm"
                    >
                        <Icons.Refresh className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" />
                        استخراج هوشمند از پیامک‌های شرکت
                    </button>

                    <div className="bg-amber-50 dark:bg-amber-900/10 p-5 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                        <label className="flex items-center gap-4 cursor-pointer select-none">
                            <input type="checkbox" {...register('isYesterday')} className="w-6 h-6 text-orange-600 rounded-lg focus:ring-orange-500 border-gray-300" />
                            <div>
                                <span className="font-black text-gray-800 dark:text-gray-200">رمز حواله دیروز دریافت شده است (بارگیری امروز)</span>
                                <p className="text-[10px] text-amber-600 mt-1 font-bold italic">این گزینه فقط برای تفکیک حواله‌های صادر شده در تاریخ قبل است، اما تاریخ ثبت، تاریخ امروز خواهد بود.</p>
                            </div>
                        </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-black text-gray-400 mb-2 mr-2">انتخاب محصول بارگیری شده</label>
                            <div className="grid grid-cols-2 gap-3">
                                {selectedFarm.productIds.map(pid => {
                                    const p = getProductById(pid);
                                    return (
                                        <label key={pid} className="relative cursor-pointer">
                                            <input type="radio" value={pid} {...register('productId')} className="peer hidden" />
                                            <div className="p-4 border-2 border-gray-100 dark:border-gray-700 rounded-2xl text-center font-bold peer-checked:border-orange-500 peer-checked:bg-orange-50 dark:peer-checked:bg-orange-900/20 peer-checked:text-orange-600 transition-all">
                                                {p?.name}
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                            {errors.productId && <p className="text-red-500 text-xs mt-2 font-bold">{errors.productId.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-black text-gray-400 mb-2 mr-2">رمز حواله (۱۰ رقمی)</label>
                            <input type="text" dir="ltr" {...register('invoiceNumber')} className={`${inputClass} font-mono tracking-widest text-xl`} placeholder="176XXXXXXX" />
                            {errors.invoiceNumber && <p className="text-red-500 text-xs mt-1 font-bold">{errors.invoiceNumber.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-black text-gray-400 mb-2 mr-2">تعداد کارتن</label>
                            <input type="number" {...register('totalCartons', { valueAsNumber: true })} className={inputClass} placeholder="0" />
                            {errors.totalCartons && <p className="text-red-500 text-xs mt-1 font-bold">{errors.totalCartons.message}</p>}
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-black text-gray-400 mb-2 mr-2">وزن خالص (کیلوگرم)</label>
                            <input type="number" step="0.01" {...register('totalWeight', { valueAsNumber: true })} className={inputClass} placeholder="0.00" />
                            {errors.totalWeight && <p className="text-red-500 text-xs mt-1 font-bold">{errors.totalWeight.message}</p>}
                        </div>
                    </div>

                    <div className="pt-6">
                        <Button type="submit" isLoading={isSubmitting} className="w-full py-5 rounded-[22px] bg-orange-600 hover:bg-orange-700 shadow-xl shadow-orange-500/30 text-xl font-black">
                            تایید و ثبت نهایی حواله
                        </Button>
                    </div>
                </form>
            </div>

            <Modal isOpen={isSMSModalOpen} onClose={() => setIsSMSModalOpen(false)} title="استخراج هوشمند حواله">
                <div className="space-y-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border-r-8 border-blue-500">
                        <h4 className="font-black text-blue-800 dark:text-blue-400 mb-3 text-lg">دستورالعمل اداری:</h4>
                        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-3 font-bold leading-relaxed">
                            <li className="flex gap-2">
                                <span className="bg-blue-600 text-white w-5 h-5 flex items-center justify-center rounded-full text-[10px] shrink-0">۱</span>
                                به بخش پیامک‌های گوشی بروید.
                            </li>
                            <li className="flex gap-2">
                                <span className="bg-blue-600 text-white w-5 h-5 flex items-center justify-center rounded-full text-[10px] shrink-0">۲</span>
                                پیامک‌های سرشماره <strong dir="ltr">{TARGET_SENDER}</strong> را انتخاب و <strong>کپی (Copy)</strong> نمایید.
                            </li>
                            <li className="flex gap-2">
                                <span className="bg-blue-600 text-white w-5 h-5 flex items-center justify-center rounded-full text-[10px] shrink-0">۳</span>
                                به این برنامه بازگشته و دکمه زیر را جهت تحلیل متن فشار دهید.
                            </li>
                        </ul>
                    </div>

                    <Button onClick={processClipboard} isLoading={isProcessingClipboard} className="w-full py-5 rounded-2xl font-black bg-blue-600 hover:bg-blue-700 text-lg shadow-lg">
                        {isProcessingClipboard ? 'در حال تحلیل داده‌ها...' : 'تحلیل متن کپی شده (Clipboard)'}
                    </Button>

                    {detectedInvoices.length > 0 && (
                        <div className="mt-6 animate-in slide-in-from-bottom-5">
                            <div className="flex justify-between items-center mb-3">
                                <h5 className="font-black text-gray-700 dark:text-gray-200">حواله‌های شناسایی شده:</h5>
                                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-black">{detectedInvoices.length} حواله</span>
                            </div>
                            <div className="border-2 border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-gray-900">
                                <table className="w-full text-sm text-right">
                                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-400">
                                        <tr>
                                            <th className="p-4">کد حواله</th>
                                            <th className="p-4">کارتن / وزن</th>
                                            <th className="p-4">عملیات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-gray-700">
                                        {detectedInvoices.map((inv, idx) => (
                                            <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                                <td className="p-4 font-mono font-black text-blue-600">{inv.invoiceNumber}</td>
                                                <td className="p-4">
                                                    <div className="font-bold">{inv.cartons} کارتن</div>
                                                    <div className="text-[10px] text-gray-400">{inv.weight} کیلوگرم</div>
                                                </td>
                                                <td className="p-4">
                                                    <button onClick={() => handleApplySingle(inv)} className="text-xs bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg font-black hover:bg-orange-200 transition-colors">
                                                        درج در فرم
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-6">
                                <Button variant="primary" className="w-full py-5 rounded-2xl bg-green-600 hover:bg-green-700 font-black shadow-xl" onClick={handleConfirmBatch}>
                                    ثبت دسته‌ای تمامی موارد فوق
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default InvoiceForm;
