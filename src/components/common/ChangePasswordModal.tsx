/**
 * ChangePasswordModal — Self-service password change dialog
 * 20260620 — Triggered from the Sidebar/Header "تغییر رمز عبور" menu item.
 * Wire-up: Sidebar mounts this modal at the bottom of its drawer and toggles
 * `isOpen`/`onClose` based on the hamburger-menu click. There is no captcha /
 * current-password field — the existing Supabase session is the proof of
 * identity. The change-password Edge Function still re-confirms the JWT and
 * updates `supabase.auth.updateUser` server-side.
 *
 * Flow:
 *   1. Zod validation enforces 8+ chars with at least one letter + digit
 *      (mirrors both the create-user Edge Function and the global
 *      CONFIG.BUSINESS.MIN_PASSWORD_LENGTH single-source-of-truth).
 *   2. Submit calls `useAuthStore.changePassword(newPassword)` which in
 *      turn POSTs to the change-password Edge Function. That EF calls
 *      auth.updateUser AND RPC self_set_visible_password so the admin's
 *      visible_password column stays in sync.
 *   3. On success: brief "success card" view, auto-close after 1500 ms.
 *   4. On failure: red toast with the server-supplied Persian error.
 */

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import Modal from './Modal';
import Input from './Input';
import Button from './Button';
import { Icons } from './Icons';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { CONFIG } from '../../constants/config';

// Mirror UserFormModal Zod regex + create-user EF and change-password EF
// validation. Single source of truth: CONFIG.BUSINESS.MIN_PASSWORD_LENGTH.
// Persist the same Persian message text as the rest of the auth flow so
// the user gets consistent UX wherever they enter that error.
const passwordMinLength = CONFIG.BUSINESS.MIN_PASSWORD_LENGTH;
const passwordMinLengthLabel = passwordMinLength.toLocaleString('fa-IR');
const passwordRegex = new RegExp(`^(?=.*[A-Za-z])(?=.*\\d).{${passwordMinLength},}$`);

const changeSchema = z.object({
    newPassword: z.string()
        .min(passwordMinLength, `رمز عبور باید حداقل ${passwordMinLengthLabel} کاراکتر باشد`)
        .regex(passwordRegex, `رمز عبور باید حداقل ${passwordMinLengthLabel} کاراکتر باشد و شامل حرف و عدد باشد`),
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

type ChangePasswordValues = z.infer<typeof changeSchema>;

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
    const { changePassword } = useAuthStore();
    const { addToast } = useToastStore();
    const [isSuccess, setIsSuccess] = useState(false);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ChangePasswordValues>({
        resolver: zodResolver(changeSchema),
        defaultValues: { newPassword: '', confirmPassword: '' },
    });

    // Reset internal state every time the modal opens so back-to-back
    // failures don't show a stale success card.
    useEffect(() => {
        if (isOpen) {
            setIsSuccess(false);
            reset({ newPassword: '', confirmPassword: '' });
        }
    }, [isOpen, reset]);

    // Auto-close on the success card so the user doesn't have to click
    // a second OK button. 1500 ms is long enough to read the green check.
    useEffect(() => {
        if (!isSuccess) return;
        const t = setTimeout(() => {
            setIsSuccess(false);
            onClose();
        }, 1500);
        return () => clearTimeout(t);
    }, [isSuccess, onClose]);

    const onSubmit = async (data: ChangePasswordValues) => {
        const result = await changePassword(data.newPassword);
        if (result.success) {
            addToast('رمز عبور با موفقیت تغییر کرد.', 'success');
            setIsSuccess(true);
        } else if (result.error) {
            addToast(result.error, 'error');
        } else {
            addToast('تغییر رمز عبور ناموفق بود. لطفاً دوباره تلاش کنید.', 'error');
        }
    };

    if (isSuccess) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="رمز عبور تغییر کرد">
                <div className="text-center py-6 space-y-4">
                    <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300 rounded-full flex items-center justify-center">
                        <Icons.Check className="w-8 h-8" />
                    </div>
                    <p className="text-gray-700 dark:text-gray-200 text-sm font-bold">
                        رمز عبور شما با موفقیت به‌روزرسانی شد.
                    </p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs">
                        این پنجره به‌صورت خودکار بسته می‌شود…
                    </p>
                </div>
            </Modal>
        );
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="تغییر رمز عبور">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3 mb-2">
                    <Icons.Lock className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />                        <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                        رمز عبور جدید حداقل {passwordMinLengthLabel} کاراکتر باشد و ترکیبی از حروف و اعداد باشد.
                        پس از تغییر، رمز عبور در پنل مدیر نیز به‌صورت همزمان به‌روزرسانی می‌شود.
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
                    placeholder="مثلاً Abc12345"
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
                    <Button type="submit" isLoading={isSubmitting}>
                        <Icons.Lock className="ml-2 h-4 w-4" />
                        تغییر رمز عبور
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default ChangePasswordModal;
