
import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { User, UserRole } from '../../types';
import { useUserStore } from '../../store/userStore';
import { useFarmStore } from '../../store/farmStore';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { useConfirm } from '../../hooks/useConfirm';

// Strict Persian Regex (including spaces)
const persianRegex = /^[\u0600-\u06FF\s]+$/;
// Username: Latin letters, numbers, underscore
const usernameRegex = /^[a-zA-Z0-9_]+$/;
// Password: Minimum 6 chars
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;

const userSchema = z.object({
  fullName: z.string()
    .min(1, 'نام کامل الزامی است')
    .regex(persianRegex, 'نام کامل باید فقط شامل حروف فارسی باشد (از نوشتن نام لاتین خودداری کنید)'),
  username: z.string()
    .min(4, 'نام کاربری باید حداقل ۴ کاراکتر باشد')
    .regex(usernameRegex, 'نام کاربری فقط باید شامل حروف لاتین و اعداد باشد'),
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
            message: "لطفا حداقل یک فارم به کاربر اختصاص دهید",
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

  const onSubmit = async (data: UserFormValues) => {
    const confirmed = await confirm({
        title: user ? 'ویرایش کاربر' : 'ایجاد کاربر',
        message: 'آیا از ذخیره اطلاعات اطمینان دارید؟',
        confirmText: 'بله، ذخیره شود',
        type: 'info'
    });

    if (confirmed) {
        const assignedFarms = data.assignedFarmIds?.map(id => farms.find(f => f.id === id)).filter(Boolean) as any[];

        // Strict sanitization on submit
        const cleanUsername = data.username.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');

        const userData: any = {
            fullName: data.fullName,
            username: cleanUsername,
            role: data.role,
            phoneNumber: data.phoneNumber,
            isActive: data.isActive,
            assignedFarms: assignedFarms,
            notificationsEnabled: data.notificationsEnabled,
            ...(data.password ? { password: data.password } : {})
        };

        if (user) {
           updateUser({ ...userData, id: user.id });
        } else {
           // We pass password even if empty here, store handles default
           addUser({ ...userData, password: data.password });
        }
        onClose();
    }
  };

  const inputClass = "w-full p-2.5 border rounded-xl bg-white text-gray-900 border-gray-300 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors placeholder-gray-400";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={user ? 'ویرایش کاربر' : 'ایجاد کاربر جدید'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">
        
        <div>
          <label className="block text-sm font-bold mb-1 dark:text-gray-300">نام کامل (فارسی)</label>
          <input {...register('fullName')} className={inputClass} placeholder="مثال: علی محمدی" autoComplete="off" />
          {errors.fullName && <p className="text-red-500 text-xs mt-1 font-bold">{errors.fullName.message}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-bold mb-1 dark:text-gray-300">نام کاربری (لاتین)</label>
                <input 
                    dir="ltr" 
                    {...register('username')} 
                    className={inputClass} 
                    placeholder="ali_mohammadi" 
                    autoComplete="new-username"
                    // Removed custom onChange to prevent conflict with register
                />
                <p className="text-[10px] text-gray-400 mt-1">فقط حروف کوچک انگلیسی و اعداد</p>
                {errors.username && <p className="text-red-500 text-xs mt-1 font-bold">{errors.username.message}</p>}
            </div>
            <div>
                <label className="block text-sm font-bold mb-1 dark:text-gray-300">رمز عبور {user && '(اختیاری)'}</label>
                <input 
                    dir="ltr" 
                    type="password" 
                    {...register('password')} 
                    className={inputClass} 
                    placeholder={user ? 'تغییر رمز...' : '******'} 
                    autoComplete="new-password"
                />
                {errors.password && <p className="text-red-500 text-xs mt-1 font-bold">{errors.password.message}</p>}
            </div>
        </div>

        <div>
            <label className="block text-sm font-bold mb-1 dark:text-gray-300">شماره تماس</label>
            <input dir="ltr" {...register('phoneNumber')} className={inputClass} placeholder="0912..." />
        </div>

        <div>
            <label className="block text-sm font-bold mb-2 dark:text-gray-300">نقش کاربر</label>
            <select {...register('role')} className={inputClass}>
                <option value={UserRole.ADMIN}>مدیر سیستم</option>
                <option value={UserRole.REGISTRATION}>مسئول ثبت</option>
                <option value={UserRole.SALES}>مسئول فروش</option>
            </select>
        </div>

        {selectedRole === UserRole.REGISTRATION && (
            <div className="border p-4 rounded-2xl bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800">
                <label className="block text-sm font-bold mb-3 text-orange-800 dark:text-orange-300">تخصیص فارم‌ها (الزامی)</label>
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
