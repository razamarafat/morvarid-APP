
import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { User, UserRole } from '../../types';
import { useUserStore } from '../../store/userStore';
import { useFarmStore } from '../../store/farmStore';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import { useConfirm } from '../../hooks/useConfirm';
import { Icons } from '../common/Icons';
import { useToastStore } from '../../store/toastStore';
import { sanitizeString } from '../../utils/sanitizers';

// Strict Persian Regex (No numbers allowed)
const persianLettersOnlyRegex = /^[\u0600-\u06FF\s]+$/;
// Username: Latin letters (case sensitive), numbers, underscore, hyphen
const usernameRegex = /^[a-zA-Z0-9_-]+$/;
// Password: Minimum 6 chars
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;

const userSchema = z.object({
    fullName: z.string()
        .min(1, 'نام کامل الزامی است')
        .regex(persianLettersOnlyRegex, 'نام کامل باید فقط شامل حروف فارسی باشد (از نوشتن اعداد یا حروف لاتین خودداری کنید)'),
    username: z.string()
        .min(4, 'نام کاربری باید حداقل ۴ کاراکتر باشد')
        .regex(usernameRegex, 'نام کاربری فقط باید شامل حروف لاتین، اعداد، خط تیره یا زیرخط باشد'),
    password: z.string().optional().refine((val) => {
        if (!val) return true; // Optional allowed
        return passwordRegex.test(val);
    }, {
        message: 'رمز عبور باید حداقل ۶ کاراکتر و شامل حروف و اعداد باشد',
    }),
    role: z.nativeEnum(UserRole),
    phoneNumber: z.string().optional(),
    isActive: z.boolean(),
    assignedFarmIds: z.array(z.string()).optional(),
    notificationsEnabled: z.boolean().optional(),
}).superRefine((data, ctx) => {
    if (data.role === UserRole.REGISTRATION && (!data.assignedFarmIds || data.assignedFarmIds.length === 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "برای مسئول ثبت، انتخاب حداقل یک فارم الزامی است",
            path: ["assignedFarmIds"]
        });
    }
});

type UserFormValues = z.infer<typeof userSchema>;

interface UserFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
}

const UserFormModal: React.FC<UserFormModalProps> = ({ isOpen, onClose, user }) => {
    const { addUser, updateUser } = useUserStore();
    const { farms } = useFarmStore();
    const { confirm } = useConfirm();
    const { addToast } = useToastStore();

    const [createdCreds, setCreatedCreds] = useState<{ username: string, password: string } | null>(null);

    const { register, handleSubmit, control, watch, reset, setValue, formState: { errors, isSubmitting } } = useForm<UserFormValues>({
        resolver: zodResolver(userSchema),
        defaultValues: {
            isActive: true,
            role: UserRole.REGISTRATION,
            assignedFarmIds: [],
            notificationsEnabled: true
        }
    });

    const selectedRole = watch('role');

    useEffect(() => {
        if (isOpen) {
            setCreatedCreds(null); // Reset credentials view
            if (user) {
                reset({
                    fullName: user.fullName,
                    username: user.username,
                    role: user.role,
                    phoneNumber: user.phoneNumber || '',
                    isActive: user.isActive,
                    assignedFarmIds: user.assignedFarms?.map(f => f.id) || [],
                    notificationsEnabled: user.notificationsEnabled ?? true,
                    password: ''
                });
            } else {
                reset({
                    fullName: '',
                    username: '',
                    password: '',
                    role: UserRole.REGISTRATION,
                    isActive: true,
                    assignedFarmIds: [],
                    notificationsEnabled: true,
                    phoneNumber: ''
                });
            }
        }
    }, [user, isOpen, reset]);

    const handleCopyCredentials = () => {
        if (createdCreds) {
            const text = `نام کاربری: ${createdCreds.username}\nرمز عبور: ${createdCreds.password}\n\nلطفاً این اطلاعات را در جای امن ذخیره کنید.`;
            navigator.clipboard.writeText(text).then(() => {
                addToast('اطلاعات کاربری در حافظه کپی شد', 'success');
            }).catch(() => {
                addToast('خطا در کپی اطلاعات', 'error');
            });
        }
    };

    const handleCloseModal = () => {
        setCreatedCreds(null);
        onClose();
    };

    const onSubmit = async (data: UserFormValues) => {
        const confirmed = await confirm({
            title: user ? 'ویرایش کاربر' : 'ایجاد کاربر',
            message: 'آیا از ذخیره اطلاعات اطمینان دارید؟',
            confirmText: 'بله، ذخیره شود',
            type: 'info'
        });

        if (confirmed) {
            const finalAssignedIds = data.role === UserRole.REGISTRATION ? data.assignedFarmIds : [];
            const assignedFarms = finalAssignedIds?.map(id => farms.find(f => f.id === id)).filter(Boolean) as any[];

            // SANITIZATION
            const cleanUsername = sanitizeString(data.username);
            const cleanFullName = sanitizeString(data.fullName);
            const cleanPhone = sanitizeString(data.phoneNumber || '');

            const userData: any = {
                fullName: cleanFullName,
                username: cleanUsername,
                role: data.role,
                phoneNumber: cleanPhone,
                isActive: data.isActive,
                assignedFarms: assignedFarms,
                notificationsEnabled: data.notificationsEnabled,
                ...(data.password ? { password: data.password } : {}) // Password is not sanitized to allow special chars if needed, but validated by regex
            };

            if (user) {
                await updateUser({ ...userData, id: user.id });
                onClose();
            } else {
                const result = await addUser({ ...userData, password: data.password });
                if (result.success) {
                    if (result.password) {
                        // If a password was generated or we want to confirm credentials
                        setCreatedCreds({
                            username: cleanUsername,
                            password: result.password
                        });
                        // Keep modal open to show credentials
                    } else {
                        // If password was manually set and we don't need to show it back
                        onClose();
                    }
                }
            }
        }
    };

    const selectClass = "w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:border-metro-blue focus:ring-0 outline-none transition-all";

    // If credentials are created, show the success/credentials view instead of the form
    if (createdCreds) {
        return (
            <Modal isOpen={isOpen} onClose={handleCloseModal} title="کاربر با موفقیت ایجاد شد">
                <div className="space-y-6 py-4 text-center">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Icons.Check className="w-8 h-8" />
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed px-4">
                        کاربر جدید با موفقیت ساخته شد. لطفاً اطلاعات ورود زیر را کپی کرده و در اختیار کاربر قرار دهید.
                        <br />
                        <span className="text-red-500 font-bold text-xs mt-1 block">این اطلاعات دیگر نمایش داده نخواهد شد.</span>
                    </p>

                    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 mx-4 text-right dir-rtl" dir="rtl">
                        <div className="flex justify-between items-center mb-2 border-b border-gray-200 dark:border-gray-600 pb-2">
                            <span className="text-gray-500 text-xs font-bold">نام کاربری:</span>
                            <span className="font-mono text-lg font-bold text-gray-800 dark:text-white select-all">{createdCreds.username}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 text-xs font-bold">رمز عبور:</span>
                            <span className="font-mono text-lg font-bold text-metro-blue select-all">{createdCreds.password}</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 px-4">
                        <Button onClick={handleCopyCredentials} className="w-full bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200">
                            <Icons.FileText className="w-4 h-4 ml-2" />
                            کپی اطلاعات
                        </Button>
                        <Button onClick={handleCloseModal} className="w-full">
                            متوجه شدم / بستن
                        </Button>
                    </div>
                </div>
            </Modal>
        );
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={user ? 'ویرایش کاربر' : 'ایجاد کاربر جدید'}
        >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">

                <Input
                    label="نام کامل (فارسی - بدون عدد)"
                    {...register('fullName')}
                    error={errors.fullName?.message}
                    autoComplete="off"
                    onInput={(e) => {
                        e.currentTarget.value = e.currentTarget.value.replace(/[0-9]/g, '');
                    }}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Input
                            label="نام کاربری (حساس به حروف)"
                            dir="ltr"
                            {...register('username')}
                            error={errors.username?.message}
                            autoComplete="new-username"
                        />
                        <p className="text-[10px] text-gray-400 mt-1 px-1">تغییر نام کاربری ممکن است بر ورود کاربر تاثیر بگذارد.</p>
                    </div>
                    <div>
                        <Input
                            label="رمز عبور (اختیاری)"
                            type="password"
                            dir="ltr"
                            {...register('password')}
                            error={errors.password?.message}
                            autoComplete="new-password"
                            placeholder="تولید خودکار در صورت خالی بودن"
                        />
                    </div>
                </div>

                <Input
                    label="شماره تماس"
                    dir="ltr"
                    {...register('phoneNumber')}
                    error={errors.phoneNumber?.message}
                />

                <div>
                    <label className="block text-sm font-bold mb-1.5 px-1 dark:text-gray-300">نقش کاربر</label>
                    <select {...register('role')} className={selectClass}>
                        <option value={UserRole.ADMIN}>مدیر سیستم</option>
                        <option value={UserRole.REGISTRATION}>مسئول ثبت</option>
                        <option value={UserRole.SALES}>مسئول فروش</option>
                    </select>
                </div>

                {selectedRole === UserRole.REGISTRATION && (
                    <div className={`border p-4 rounded-2xl ${errors.assignedFarmIds ? 'bg-red-50 border-red-200' : 'bg-gray-50 dark:bg-gray-900/10 border-gray-200 dark:border-gray-700'}`}>
                        <label className="block text-sm font-bold mb-3 dark:text-gray-300">
                            تخصیص فارم‌ها
                            <span className="text-red-500 text-xs mr-1">(الزامی برای مسئول ثبت)</span>
                        </label>
                        <Controller
                            name="assignedFarmIds"
                            control={control}
                            render={({ field }) => (
                                <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                                    {farms.map(farm => (
                                        <label key={farm.id} className="flex items-center gap-3 p-2 hover:bg-white/50 dark:hover:bg-black/20 rounded-lg cursor-pointer transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={field.value?.includes(farm.id)}
                                                onChange={(e) => {
                                                    const val = field.value || [];
                                                    field.onChange(e.target.checked ? [...val, farm.id] : val.filter(id => id !== farm.id));
                                                }}
                                                className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-gray-300"
                                            />
                                            <span className="text-sm font-medium dark:text-gray-200">{farm.name}</span>
                                        </label>
                                    ))}
                                    {farms.length === 0 && <p className="text-sm text-gray-500">هیچ فارمی تعریف نشده است.</p>}
                                </div>
                            )}
                        />
                        {errors.assignedFarmIds && <p className="text-red-500 text-xs mt-2 font-bold">{errors.assignedFarmIds.message}</p>}
                    </div>
                )}

                {selectedRole === UserRole.SALES && (
                    <div className="border p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" {...register('notificationsEnabled')} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300" />
                            <span className="text-sm font-medium text-blue-800 dark:text-blue-300">دریافت اعلان هنگام ثبت آمار و حواله</span>
                        </label>
                    </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                    <input type="checkbox" id="isActiveUser" {...register('isActive')} className="w-5 h-5 rounded text-violet-600 focus:ring-violet-500 border-gray-300" />
                    <label htmlFor="isActiveUser" className="text-sm font-bold dark:text-gray-300 cursor-pointer">حساب کاربری فعال است</label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button type="button" variant="secondary" onClick={onClose}>لغو</Button>
                    <Button type="submit" isLoading={isSubmitting}>ذخیره تغییرات</Button>
                </div>
            </form>
        </Modal>
    );
};

export default UserFormModal;
