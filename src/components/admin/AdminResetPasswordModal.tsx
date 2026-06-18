/**
 * AdminResetPasswordModal — Admin-only password reset dialog
 * 20260620 — Triggered from the Admin User Management "بازنشانی رمز عبور"
 * Refresh icon in the password cell. Lets the Admin set a new password
 * for any user OTHER than themselves (the Edge Function enforces this
 * server-side; we mirror it client-side for clearer UX).
 *
 * Flow:
 *   1. Zod validation enforces `min(passwordMinLength)` chars + letter + digit
 *      AND that the user retypes the password in a confirm field.
 *   2. Submit calls `useUserStore.adminResetUserPassword(targetUserId, newPassword)`
 *      which POSTs to the reset-user-password Edge Function. That EF calls
 *      `supabase.auth.admin.updateUserById` (service_role) AND the
 *      SEC-DEF RPC `admin_set_visible_password` so the auth password and
 *      the vault entry stay locked together.
 *   3. On success: success-card view, auto-close after 1500 ms, then the
 *      parent refetches the password map so the new plaintext appears.
 *   4. On failure: red toast with the server-supplied Persian error.
 */

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import { Icons } from '../common/Icons';
import { useUserStore } from '../../store/userStore';
import { useToastStore } from '../../store/toastStore';
import { User } from '../../types';
import { CONFIG } from '../../constants/config';

const passwordMinLength = CONFIG.BUSINESS.MIN_PASSWORD_LENGTH;
const passwordMinLengthLabel = passwordMinLength.toLocaleString('fa-IR');
const passwordRegex = new RegExp(`^(?=.*[A-Za-z])(?=.*\\d).{${passwordMinLength},}$`);

const schema = z.object({
    newPassword: z.string()
        .min(passwordMinLength, `رمز عبور باید حداقل ${passwordMinLengthLabel} کاراکتر باشد`)
        .regex(passwordRegex, 'رمز عبور باید شامل حرف و عدد باشد'),
    confirmPassword: z.string()
        .min(passwordMinLength, `رمز عبور باید حداقل ${passwordMinLengthLabel} کاراکتر باشد`),
}).superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmPassword) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'رمز عبور جدید و تکرار آن یکسان نیستند',
            path: ['confirmPassword'],
        });
    }
});

type Values = z.infer<typeof schema>;

interface Props {
    isOpen: boolean;
    targetUser: User | null;
    onClose: () => void;
    onSuccess: () => void;
}

const AdminResetPasswordModal: React.FC<Props> = ({ isOpen, targetUser, onClose, onSuccess }) => {
    const { adminResetUserPassword } = useUserStore();
    const { addToast } = useToastStore();
    const [isSuccess, setIsSuccess] = useState(false);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Values>({
        resolver: zodResolver(schema),
        defaultValues: { newPassword: '', confirmPassword: '' },
    });

    useEffect(() => {
        if (isOpen) {
            setIsSuccess(false);
            reset({ newPassword: '', confirmPassword: '' });
        }
    }, [isOpen, reset]);

    useEffect(() => {
        if (!isSuccess) return;
        const t = setTimeout(() => {
            setIsSuccess(false);
            onSuccess();
        }, 1500);
        return () => clearTimeout(t);
    }, [isSuccess, onSuccess]);

    const onSubmit = async (data: Values) => {
        if (!targetUser) return;
        const result = await adminResetUserPassword(targetUser.id, data.newPassword);
        if (result.success) {
            addToast(`رمز عبور ${targetUser.username} با موفقیت تغییر کرد.`, 'success');
            setIsSuccess(true);
        } else if (result.error) {
            addToast(result.error, 'error');
        } else {
            addToast('تغییر رمز عبور ناموفق بود. لطفاً دوباره تلاش کنید.', 'error');
        }
    };

    if (!targetUser) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`بازنشانی رمز عبور ${targetUser.fullName}`}>
            {isSuccess ? (
                <div className="text-center py-6 space-y-4">
                    <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300 rounded-full flex items-center justify-center">
                        <Icons.Check className="w-8 h-8" />
                    </div>
                    <p className="text-gray-700 dark:text-gray-200 text-sm font-bold">
                        رمز عبور کاربر به موفقیت تغییر کرد.
                    </p>
                </div>
            ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">
                    <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl p-4 flex items-start gap-3 mb-2">
                        <Icons.Lock className="w-5 h-5 text-violet-600 dark:text-violet-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-violet-800 dark:text-violet-200 leading-relaxed">
                            رمز عبور جدید برای <strong className="font-mono">{targetUser.username}</strong> ({targetUser.fullName}) تنظیم می‌شود.
                            رمز عبور فعلی او بازنویسی خواهد شد و همان رمز در پنل مدیر قابل مشاهده خواهد بود.
                        </p>
                    </div>

                    <Input
                        label="رمز عبور جدید"
                        type="password"
                        dir="ltr"
                        autoFocus
                        autoComplete="new-password"
                        data-allow-latin="true"
                        {...register('newPassword')}
                        error={errors.newPassword?.message}
                    />

                    <Input
                        label="تکرار رمز عبور جدید"
                        type="password"
                        dir="ltr"
                        autoComplete="new-password"
                        data-allow-latin="true"
                        {...register('confirmPassword')}
                        error={errors.confirmPassword?.message}
                    />

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <Button type="button" variant="secondary" onClick={onClose}>لغو</Button>
                        <Button type="submit" isLoading={isSubmitting} variant="primary">
                            <Icons.Lock className="ml-2 h-4 w-4" />
                            بازنشانی رمز عبور
                        </Button>
                    </div>
                </form>
            )}
        </Modal>
    );
};

export default AdminResetPasswordModal;
