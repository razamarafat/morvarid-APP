
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../store/authStore';
import { useLogStore } from '../store/logStore';
import ThemeToggle from '../components/common/ThemeToggle';
import { Icons } from '../components/common/Icons';
import { UserRole } from '../types';
import { useBiometric } from '../hooks/useBiometric';
import { useToastStore } from '../store/toastStore';
import Logo from '../components/common/Logo';

const loginSchema = z.object({
  username: z.string().min(1, "نام کاربری الزامی است"),
  password: z.string().min(1, "رمز عبور الزامی است"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, blockUntil } = useAuthStore();
  const { addLog } = useLogStore();
  const { isAvailable: isBiometricAvailable } = useBiometric();
  const { addToast } = useToastStore();
  
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const isBlocked = blockUntil ? Date.now() < blockUntil : false;

  const onSubmit = async (data: LoginFormValues) => {
    setError(null);
    if (isBlocked) {
        setError('حساب مسدود است. لطفا بعدا تلاش کنید.');
        return;
    }

    const result = await login(data.username, data.password);

    if (result.success) {
        const currentUser = useAuthStore.getState().user;
        addLog('info', 'auth', `کاربر ${data.username} با موفقیت وارد شد`, currentUser?.id);
        addToast(`خوش آمدید ${currentUser?.fullName}`, 'success');
        
        switch (currentUser?.role) {
            case UserRole.ADMIN: navigate('/admin'); break;
            case UserRole.REGISTRATION: navigate('/registration'); break;
            case UserRole.SALES: navigate('/sales'); break;
            default: navigate('/home');
        }
    } else {
        setError(result.error || 'خطا در ورود');
        addLog('warn', 'security', `تلاش ناموفق برای ورود: ${data.username}`);
    }
  };

  const inputClass = "w-full px-5 py-4 bg-white dark:bg-gray-700/50 border border-gray-300 dark:border-transparent focus:bg-white dark:focus:bg-gray-700 focus:border-violet-500 dark:focus:border-violet-500 rounded-2xl text-gray-900 dark:text-white outline-none transition-all font-bold text-lg text-center placeholder-gray-400 focus:ring-4 focus:ring-violet-500/10";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-950 flex flex-col items-center justify-center p-4">
      <div className="absolute top-6 left-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="text-center mb-8 transform hover:scale-105 transition-transform duration-500">
            <div className="w-28 h-28 bg-white dark:bg-gray-800 rounded-[30px] shadow-2xl mx-auto mb-6 flex items-center justify-center p-2">
                <Logo className="w-full h-full object-contain" />
            </div>
            <h1 className="text-3xl font-black text-gray-800 dark:text-white tracking-tight">مروارید</h1>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-black/50 rounded-[32px] p-8 relative overflow-hidden border border-gray-100 dark:border-gray-700/50">
          {/* Decor element */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 relative z-10">
            {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-2xl text-sm font-bold text-center animate-pulse border border-red-100">{error}</div>}
            
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mr-2">نام کاربری</label>
              <div className="relative">
                  <input
                    type="text"
                    dir="ltr"
                    disabled={isBlocked}
                    {...register('username')}
                    className={inputClass}
                    placeholder="Username"
                  />
                  <Icons.User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1">
               <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mr-2">رمز عبور</label>
               <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  dir="ltr"
                  disabled={isBlocked}
                  {...register('password')}
                  className={inputClass}
                  placeholder="••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center px-4 text-gray-400 hover:text-violet-500 transition-colors"
                >
                  {showPassword ? <Icons.EyeOff className="w-5 h-5" /> : <Icons.Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
                type="submit"
                disabled={isSubmitting || isBlocked}
                className="w-full py-4 rounded-2xl font-bold text-lg text-white bg-violet-600 hover:bg-violet-700 active:scale-95 transition-all shadow-lg shadow-violet-500/30 disabled:opacity-50 disabled:shadow-none"
            >
                {isSubmitting ? 'در حال اتصال...' : 'ورود به حساب'}
            </button>
            
            {isBiometricAvailable && (
               <div className="flex justify-center pt-2">
                   <button
                    type="button"
                    disabled
                    className="flex items-center gap-2 text-gray-400 cursor-not-allowed opacity-50"
                    title="در نسخه وب فعال نیست"
                  >
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-2xl">
                         <Icons.Fingerprint className="w-8 h-8" />
                    </div>
                    <span className="text-sm font-medium">ورود با اثر انگشت</span>
                  </button>
               </div>
            )}
          </form>
        </div>
        <p className="text-center text-gray-400 text-xs mt-6">متصل به سرورهای ابری مروارید</p>
      </div>
    </div>
  );
};

export default LoginPage;
