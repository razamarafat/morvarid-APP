
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../store/authStore';
import { useLogStore } from '../store/logStore';
import ThemeToggle from '../components/common/ThemeToggle';
import { Icons } from '../components/common/Icons';
import { UserRole } from '../types';
import { useToastStore } from '../store/toastStore';
import Logo from '../components/common/Logo';

const loginSchema = z.object({
  username: z.string().min(1, "نام کاربری الزامی است"),
  password: z.string().min(1, "رمز عبور الزامی است"),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, blockUntil, savedUsername, loadSavedUsername } = useAuthStore();
  const { addLog } = useLogStore();
  const { addToast } = useToastStore();
  
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, setValue, formState: { isSubmitting } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
        rememberMe: false
    }
  });

  useEffect(() => {
      loadSavedUsername();
      const saved = localStorage.getItem('morvarid_saved_username');
      if (saved) {
          setValue('username', saved);
          setValue('rememberMe', true);
      }
  }, [setValue, loadSavedUsername]);

  const isBlocked = blockUntil ? Date.now() < blockUntil : false;

  const onSubmit = async (data: LoginFormValues) => {
    setError(null);
    if (isBlocked) {
        setError('حساب مسدود است. لطفا بعدا تلاش کنید.');
        return;
    }

    const result = await login(data.username, data.password, !!data.rememberMe);

    if (result.success) {
        const currentUser = useAuthStore.getState().user;
        addLog('info', 'auth', `کاربر ${data.username} وارد شد`, currentUser?.id);
        addToast(`خوش آمدید ${currentUser?.fullName}`, 'success');
        
        switch (currentUser?.role) {
            case UserRole.ADMIN: navigate('/admin', { replace: true }); break;
            case UserRole.REGISTRATION: navigate('/registration', { replace: true }); break;
            case UserRole.SALES: navigate('/sales', { replace: true }); break;
            default: navigate('/home', { replace: true });
        }
    } else {
        setError(result.error || 'نام کاربری یا رمز عبور اشتباه است');
        addLog('warn', 'security', `تلاش ناموفق: ${data.username}`);
    }
  };

  const inputClass = "w-full px-5 py-3.5 bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-transparent focus:bg-white focus:border-violet-500 rounded-2xl text-gray-900 dark:text-white outline-none transition-all font-bold text-base text-center placeholder-gray-300 focus:ring-4 focus:ring-violet-500/10";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4 transition-colors">
      <div className="absolute top-6 left-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
            <div className="w-20 h-20 bg-white dark:bg-gray-800 rounded-2xl shadow-xl mx-auto mb-4 flex items-center justify-center p-2 border border-gray-100 dark:border-gray-700">
                <Logo className="w-full h-full object-contain" />
            </div>
            <h1 className="text-xl font-black text-gray-800 dark:text-white">شرکت صنایع غذایی و تولیدی مروارید</h1>
            <p className="text-xs text-gray-400 font-bold mt-1">سامانه جامع پایش فارم ها</p>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-[32px] p-6 md:p-8 relative overflow-hidden border border-gray-100 dark:border-gray-700/50">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 relative z-10">
            {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-2xl text-xs font-bold text-center border border-red-100">{error}</div>}
            
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mr-2 tracking-widest">نام کاربری</label>
              <div className="relative mt-1">
                  <input
                    type="text"
                    dir="ltr"
                    disabled={isBlocked}
                    {...register('username')}
                    className={inputClass}
                    placeholder="Username"
                  />
                  <Icons.User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
              </div>
            </div>

            <div>
               <label className="text-[10px] font-black text-gray-400 uppercase mr-2 tracking-widest">رمز عبور</label>
               <div className="relative mt-1">
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
                  className="absolute inset-y-0 right-0 px-4 text-gray-300 hover:text-violet-500 transition-colors"
                >
                  {showPassword ? <Icons.EyeOff className="w-4 h-4" /> : <Icons.Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-start py-1">
                <label className="flex items-center gap-2 cursor-pointer group select-none">
                    <input 
                        type="checkbox" 
                        {...register('rememberMe')} 
                        className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 transition-all cursor-pointer"
                    />
                    <span className="text-xs font-bold text-gray-400 group-hover:text-violet-600 transition-colors">
                        مرا به خاطر بسپار
                    </span>
                </label>
            </div>

            <button
                type="submit"
                disabled={isSubmitting || isBlocked}
                className="w-full py-4 rounded-2xl font-black text-base text-white bg-violet-600 hover:bg-violet-700 active:scale-95 transition-all shadow-lg shadow-violet-600/20 disabled:opacity-50 mt-2"
            >
                {isSubmitting ? 'در حال ورود...' : 'ورود به سیستم'}
            </button>
          </form>
        </div>
        <p className="text-center text-gray-400 text-[10px] mt-6 font-bold tracking-tight">تمامی حقوق این نرم افزار متعلق به شرکت مروارید میباشد</p>
      </div>
    </div>
  );
};

export default LoginPage;
