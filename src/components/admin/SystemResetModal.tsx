import React, { useState, useRef, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import { Icons } from '../common/Icons';
import { useToastStore } from '../../store/toastStore';
import { supabase } from '../../lib/supabase';

interface SystemResetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onResetComplete: () => void;
}

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    children: React.ReactNode;
}

type ResetStep = 'warning' | 'credentials' | 'confirmation' | 'processing' | 'complete';

const SystemResetModal: React.FC<SystemResetModalProps> = ({ isOpen, onClose, onResetComplete }) => {
    const [step, setStep] = useState<ResetStep>('warning');
    const [credentials, setCredentials] = useState({ username: '', password: '' });
    const [confirmationText, setConfirmationText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [resetResult, setResetResult] = useState<any>(null);
    const { addToast } = useToastStore();
    
    const passwordRef = useRef<HTMLInputElement>(null);
    const confirmationRef = useRef<HTMLInputElement>(null);

    // Reset modal state when closed
    useEffect(() => {
        if (!isOpen) {
            setStep('warning');
            setCredentials({ username: '', password: '' });
            setConfirmationText('');
            setIsProcessing(false);
            setResetResult(null);
        }
    }, [isOpen]);

    const handleCredentialSubmit = async () => {
        if (!credentials.username || !credentials.password) {
            addToast('لطفاً نام کاربری و رمز عبور را وارد کنید', 'error');
            return;
        }

        try {
            setIsProcessing(true);
            const { data, error } = await supabase.rpc('verify_super_admin_access', {
                admin_username: credentials.username,
                admin_password: credentials.password
            });

            if (error) throw error;

            if (data?.success) {
                setStep('confirmation');
                setTimeout(() => confirmationRef.current?.focus(), 100);
            } else {
                addToast('اعتبارسنجی ناموفق - دسترسی غیر مجاز', 'error');
            }
        } catch (error: any) {
            console.error('Credential verification failed:', error);
            addToast('خطا در اعتبارسنجی', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFinalReset = async () => {
        if (confirmationText !== 'RESET_COMPLETE_SYSTEM') {
            addToast('متن تایید صحیح نیست', 'error');
            return;
        }

        try {
            setIsProcessing(true);
            setStep('processing');

            const { data, error } = await supabase.rpc('perform_system_reset', {
                admin_username: credentials.username,
                admin_password: credentials.password,
                confirmation_text: confirmationText
            });

            if (error) throw error;

            if (data?.success) {
                setResetResult(data);
                setStep('complete');
                addToast('سیستم با موفقیت بازنشانی شد', 'success');
                
                // Auto close and trigger app reload after 3 seconds
                setTimeout(() => {
                    onResetComplete();
                    window.location.reload();
                }, 3000);
            } else {
                throw new Error(data?.message || 'Reset failed');
            }
        } catch (error: any) {
            console.error('System reset failed:', error);
            addToast(`خطا در بازنشانی: ${error.message}`, 'error');
            setStep('confirmation');
        } finally {
            setIsProcessing(false);
        }
    };

    const renderStepContent = () => {
        switch (step) {
            case 'warning':
                return (
                    <div className="space-y-6">
                        <div className="flex items-center space-x-3 space-x-reverse text-red-400">
                            <Icons.AlertTriangle className="w-8 h-8 flex-shrink-0" />
                            <h3 className="text-xl font-bold">هشدار بحرانی سیستم</h3>
                        </div>
                        
                        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 space-y-3">
                            <p className="text-red-200 text-sm leading-relaxed">
                                ⚠️ این عملیات تمام داده‌های سیستم را به طور کامل حذف خواهد کرد
                            </p>
                            <ul className="text-red-300 text-sm space-y-1 mr-4">
                                <li>• تمام کاربران و پروفایل‌ها</li>
                                <li>• تمام فارم‌ها و تخصیص‌ها</li>
                                <li>• تمام آمار روزانه و حواله‌ها</li>
                                <li>• تمام لاگ‌ها و تاریخچه</li>
                            </ul>
                            <p className="text-red-200 text-sm font-medium">
                                🔄 سیستم با یک اکانت مدیر اصلی بازنشانی خواهد شد
                            </p>
                        </div>

                        <div className="bg-amber-900/20 border border-amber-500/50 rounded-lg p-4">
                            <p className="text-amber-200 text-sm">
                                💡 این قابلیت فقط برای مرحله آزمایش طراحی شده و در محیط تولید نباید استفاده شود.
                            </p>
                        </div>

                        <div className="flex space-x-3 space-x-reverse">
                            <Button 
                                onClick={onClose} 
                                variant="secondary" 
                                className="flex-1"
                            >
                                انصراف
                            </Button>
                            <Button 
                                onClick={() => setStep('credentials')} 
                                variant="danger" 
                                className="flex-1"
                            >
                                ادامه عملیات
                            </Button>
                        </div>
                    </div>
                );

            case 'credentials':
                return (
                    <div className="space-y-6">
                        <div className="flex items-center space-x-3 space-x-reverse text-blue-400">
                            <Icons.Lock className="w-6 h-6" />
                            <h3 className="text-lg font-bold">اعتبارسنجی مدیر اصلی</h3>
                        </div>

                        <div className="space-y-4">
                            <Input
                                label="نام کاربری مدیر اصلی"
                                type="text"
                                value={credentials.username}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                                placeholder="نام کاربری..."
                                className="text-center"
                                autoComplete="off"
                            />
                            <Input
                                ref={passwordRef}
                                label="رمز عبور مدیر اصلی"
                                type="password"
                                value={credentials.password}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                                placeholder="رمز عبور..."
                                className="text-center"
                                autoComplete="off"
                                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleCredentialSubmit()}
                            />
                        </div>

                        <div className="flex space-x-3 space-x-reverse">
                            <Button 
                                onClick={() => setStep('warning')} 
                                variant="secondary" 
                                className="flex-1"
                            >
                                بازگشت
                            </Button>
                            <Button 
                                onClick={handleCredentialSubmit} 
                                variant="primary"
                                disabled={isProcessing || !credentials.username || !credentials.password}
                                className="flex-1"
                            >
                                {isProcessing ? 'در حال تایید...' : 'تایید هویت'}
                            </Button>
                        </div>
                    </div>
                );

            case 'confirmation':
                return (
                    <div className="space-y-6">
                        <div className="flex items-center space-x-3 space-x-reverse text-red-400">
                            <Icons.Shield className="w-6 h-6" />
                            <h3 className="text-lg font-bold">تایید نهایی عملیات</h3>
                        </div>

                        <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                            <p className="text-gray-300 text-sm">
                                برای تایید نهایی، عبارت زیر را دقیقاً تایپ کنید:
                            </p>
                            <div className="bg-gray-700 rounded px-3 py-2">
                                <code className="text-red-400 font-mono text-sm">RESET_COMPLETE_SYSTEM</code>
                            </div>
                        </div>

                        <Input
                            ref={confirmationRef}
                            label="متن تایید"
                            type="text"
                            value={confirmationText}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmationText(e.target.value)}
                            placeholder="RESET_COMPLETE_SYSTEM"
                            className="text-center font-mono"
                            autoComplete="off"
                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleFinalReset()}
                        />

                        <div className="flex space-x-3 space-x-reverse">
                            <Button 
                                onClick={() => setStep('credentials')} 
                                variant="secondary" 
                                className="flex-1"
                            >
                                بازگشت
                            </Button>
                            <Button 
                                onClick={handleFinalReset} 
                                variant="danger"
                                disabled={isProcessing || confirmationText !== 'RESET_COMPLETE_SYSTEM'}
                                className="flex-1"
                            >
                                {isProcessing ? 'در حال بازنشانی...' : 'بازنشانی کامل سیستم'}
                            </Button>
                        </div>
                    </div>
                );

            case 'processing':
                return (
                    <div className="space-y-6 text-center">
                        <div className="flex justify-center">
                            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-500"></div>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2">در حال بازنشانی سیستم...</h3>
                            <p className="text-gray-400 text-sm">لطفاً صبر کنید، این عملیات چند دقیقه طول می‌کشد</p>
                            <p className="text-red-400 text-xs mt-2">⚠️ صفحه را نبندید و منتظر بمانید</p>
                        </div>
                    </div>
                );

            case 'complete':
                return (
                    <div className="space-y-6 text-center">
                        <div className="flex justify-center">
                            <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center">
                                <Icons.Check className="w-8 h-8 text-white" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-green-400 mb-2">بازنشانی با موفقیت انجام شد</h3>
                            <p className="text-gray-400 text-sm">سیستم به حالت اولیه بازگشت</p>
                            <p className="text-green-400 text-xs mt-2">🔄 صفحه به زودی بازآوری می‌شود...</p>
                        </div>
                        {resetResult && (
                            <div className="bg-gray-800 rounded-lg p-4 text-right">
                                <p className="text-xs text-gray-500">شناسه مدیر جدید:</p>
                                <p className="text-xs font-mono text-green-400">{resetResult.super_admin_id}</p>
                            </div>
                        )}
                    </div>
                );
        }
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={step === 'processing' ? () => {} : onClose} 
            title="خام کردن کل برنامه"
        >
            {renderStepContent()}
        </Modal>
    );
};

export default SystemResetModal;