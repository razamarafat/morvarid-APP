
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
import { getTodayJalaliPersian, getCurrentTime } from '../utils/dateUtils';
import { APP_VERSION } from '../constants';

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
  
  const [currentTime, setCurrentTime] = useState(getCurrentTime());
  const [currentDate, setCurrentDate] = useState(getTodayJalaliPersian());
  const [error, setError] = useState<string | null>(null);

  // Time Updater
  useEffect(() => {
    const timer = setInterval(() => {
        setCurrentTime(getCurrentTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
        setError('حساب مسدود است.');
        return;
    }

    const result = await login(data.username, data.password, !!data.rememberMe);

    if (result.success) {
        const currentUser = useAuthStore.getState().user;
        addLog('info', 'auth', `کاربر ${data.username} وارد شد`, currentUser?.id);
        
        switch (currentUser?.role) {
            case UserRole.ADMIN: navigate('/admin', { replace: true }); break;
            case UserRole.REGISTRATION: navigate('/registration', { replace: true }); break;
            case UserRole.SALES: navigate('/sales', { replace: true }); break;
            default: navigate('/home', { replace: true });
        }
    } else {
        setError(result.error || 'خطا در ورود');
        addLog('warn', 'security', `تلاش ناموفق: ${data.username}`);
    }
  };

  const inputClass = "w-full p-3 bg-white/10 dark:bg-black/20 hover:bg-white/20 dark:hover:bg-black/40 focus:bg-white dark:focus:bg-gray-800 text-white dark:focus:text-white focus:text-black border-2 border-white/30 dark:border-gray-600 focus:border-white dark:focus:border-gray-400 outline-none transition-all placeholder-transparent";

  return (
    <div className="min-h-screen bg-[#004E98] dark:bg-[#0f172a] relative overflow-hidden flex flex-col md:flex-row transition-colors duration-300">
      {/* Background Pattern with Animation */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] animate-[pulse_10s_ease-in-out_infinite]"></div>
      
      {/* Floating Circles for Dynamism */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[10%] left-[20%] w-64 h-64 bg-white/5 rounded-full blur-3xl animate-[bounce_8s_infinite]"></div>
          <div className="absolute bottom-[20%] right-[20%] w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-[bounce_12s_infinite]"></div>
      </div>

      {/* Left Side: Lock Screen Clock (Desktop) */}
      <div className="hidden md:flex flex-1 flex-col justify-end p-12 lg:p-24 text-white z-10 bg-gradient-to-r from-black/40 to-transparent">
          <h1 className="text-[7rem] lg:text-[9rem] font-black leading-none font-sans tracking-tighter drop-shadow-2xl">
              {currentTime}
          </h1>
          <h2 className="text-4xl lg:text-5xl font-bold mt-4 opacity-95 drop-shadow-md">
              {currentDate}
          </h2>
          <div className="mt-8 border-r-4 border-metro-orange pr-6">
              <p className="text-2xl lg:text-3xl font-black opacity-100 text-metro-orange">
                  سامانه جامع پایش فارم‌های مروارید
              </p>
              <p className="text-sm mt-2 opacity-80">مدیریت یکپارچه تولید، فروش و انبار</p>
          </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 bg-[#1D1D1D] dark:bg-[#111827] md:bg-[#1D1D1D]/90 dark:md:bg-[#111827]/95 backdrop-blur-md z-20 shadow-2xl border-l border-white/10 dark:border-gray-700 transition-colors duration-300">
        <div className="w-full max-w-sm space-y-8">
            <div className="flex flex-col items-center gap-4 mb-8">
                 <div className="w-24 h-24 bg-gray-600 dark:bg-gray-700 rounded-full flex items-center justify-center overflow-hidden border-4 border-gray-500 dark:border-gray-600 shadow-xl relative group">
                     <div className="absolute inset-0 bg-white/10 group-hover:bg-transparent transition-colors"></div>
                     <Icons.User className="w-12 h-12 text-gray-300 relative z-10" />
                 </div>
                 <h2 className="text-2xl text-white font-bold">ورود به سیستم</h2>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {error && <div className="bg-metro-red p-3 text-white text-sm font-bold text-center animate-pulse border-2 border-red-400">{error}</div>}
                
                <div className="group relative">
                    <label className="block text-xs uppercase text-gray-400 mb-1 font-bold">نام کاربری</label>
                    <div className="flex shadow-lg">
                        <div className="bg-white/10 dark:bg-black/20 p-3 flex items-center justify-center border-2 border-white/30 dark:border-gray-600 border-l-0">
                            <Icons.User className="w-5 h-5 text-white/70" />
                        </div>
                        <input
                            type="text"
                            dir="ltr"
                            disabled={isBlocked}
                            {...register('username')}
                            className={inputClass}
                            autoComplete="off"
                        />
                    </div>
                </div>

                <div className="group relative">
                    <label className="block text-xs uppercase text-gray-400 mb-1 font-bold">رمز عبور</label>
                    <div className="flex shadow-lg">
                        <div className="bg-white/10 dark:bg-black/20 p-3 flex items-center justify-center border-2 border-white/30 dark:border-gray-600 border-l-0">
                            <Icons.Fingerprint className="w-5 h-5 text-white/70" />
                        </div>
                        <input
                            type="password"
                            dir="ltr"
                            disabled={isBlocked}
                            {...register('password')}
                            className={inputClass}
                            autoComplete="off"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 mt-4">
                    <input 
                        type="checkbox" 
                        {...register('rememberMe')} 
                        id="remember"
                        className="w-5 h-5 border-2 border-gray-500 bg-transparent text-metro-blue focus:ring-0 checked:bg-metro-blue"
                    />
                    <label htmlFor="remember" className="text-sm text-gray-300 cursor-pointer font-bold">مرا به خاطر بسپار</label>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting || isBlocked}
                    className="w-full py-4 mt-6 bg-metro-blue hover:bg-metro-cobalt dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-black text-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg hover:shadow-metro-blue/50"
                >
                    {isSubmitting ? '...' : <><Icons.ChevronLeft className="w-6 h-6" /> ورود</>}
                </button>
            </form>
            
            <div className="mt-12 text-center">
                 <p className="text-gray-500 text-xs font-mono mb-4">v{APP_VERSION}</p>
                 <div className="inline-block bg-white/10 dark:bg-black/20 rounded-full px-4 py-2">
                    <ThemeToggle />
                 </div>
            </div>
        </div>
      </div>
      
      {/* Mobile Clock overlay */}
      <div className="md:hidden absolute top-8 left-6 right-6 text-white text-center z-10 pointer-events-none">
          <div className="font-black text-5xl drop-shadow-lg font-sans">{currentTime}</div>
          <div className="text-lg mt-1 font-bold opacity-90">{currentDate}</div>
          <div className="text-metro-orange font-black text-xl mt-4 drop-shadow-md">سامانه مدیریت مروارید</div>
      </div>
    </div>
  );
};

export default LoginPage;
