
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../store/authStore';
import ThemeToggle from '../components/common/ThemeToggle';
import { Icons } from '../components/common/Icons';
import { UserRole } from '../types';
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
  const { login, blockUntil, loadSavedUsername, savedUsername } = useAuthStore();
  
  const [currentTime, setCurrentTime] = useState(getCurrentTime());
  const [currentDate, setCurrentDate] = useState(getTodayJalaliPersian());
  const [error, setError] = useState<string | null>(null);
  
  // Local state to keep loading active during redirect
  const [isRedirecting, setIsRedirecting] = useState(false);

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

  // Load username on mount
  useEffect(() => {
      loadSavedUsername();
  }, [loadSavedUsername]);

  // Update form when savedUsername changes
  useEffect(() => {
      if (savedUsername) {
          setValue('username', savedUsername);
          setValue('rememberMe', true);
      }
  }, [savedUsername, setValue]);

  const isBlocked = blockUntil ? Date.now() < blockUntil : false;

  const onSubmit = async (data: LoginFormValues) => {
    setError(null);
    if (isBlocked) {
        setError('حساب مسدود است.');
        return;
    }

    const result = await login(data.username, data.password, !!data.rememberMe);

    if (result.success) {
        // Keep the loading state true while navigating
        setIsRedirecting(true);
        const currentUser = useAuthStore.getState().user;
        
        // Small delay to ensure the user sees the success/loading state
        setTimeout(() => {
            switch (currentUser?.role) {
                case UserRole.ADMIN: navigate('/admin', { replace: true }); break;
                case UserRole.REGISTRATION: navigate('/registration', { replace: true }); break;
                case UserRole.SALES: navigate('/sales', { replace: true }); break;
                default: navigate('/home', { replace: true });
            }
        }, 500);
    } else {
        setError(result.error || 'خطا در ورود');
        setIsRedirecting(false);
    }
  };

  // M3 Outlined Text Field Style
  const inputClass = "w-full p-4 bg-transparent text-white border border-white/40 focus:border-metro-blue outline-none transition-all placeholder-transparent rounded-xl peer focus:border-2";
  const labelClass = "absolute right-12 -top-2.5 bg-[#111827] px-1 text-xs text-gray-400 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-4 peer-placeholder-shown:right-12 peer-focus:-top-2.5 peer-focus:text-xs peer-focus:text-metro-blue transition-all pointer-events-none";

  return (
    <div className="min-h-screen bg-[#004E98] dark:bg-[#0f172a] relative overflow-hidden flex flex-col md:flex-row transition-colors duration-300">
      
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] animate-[pulse_3s_ease-in-out_infinite] z-0"></div>
      
      {/* Floating Circles (Desktop) */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 hidden md:block">
          <div className="absolute top-[10%] left-[20%] w-64 h-64 bg-white/5 rounded-full blur-3xl animate-[bounce_8s_infinite]"></div>
          <div className="absolute bottom-[20%] right-[20%] w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-[bounce_12s_infinite]"></div>
      </div>

      {/* Left Side: Lock Screen (Desktop Only) */}
      <div className="hidden md:flex flex-1 flex-col justify-end p-12 lg:p-24 text-white z-10 bg-gradient-to-r from-black/40 to-transparent">
          <h1 className="text-[6rem] lg:text-[8rem] font-black leading-none font-sans tabular-nums tracking-tighter drop-shadow-2xl min-w-[500px]">
              {currentDate}
          </h1>
          <h2 className="text-4xl lg:text-5xl font-light mt-2 opacity-90 drop-shadow-md font-sans tabular-nums">
              {currentTime}
          </h2>
          
          <div className="mt-8 pr-2">
              <p className="text-3xl lg:text-4xl font-light text-white tracking-wide font-sans border-b border-white/20 pb-4 inline-block">
                  سامانه مدیریت مروارید
              </p>
              <p className="text-sm mt-3 opacity-70 font-sans font-light">مدیریت یکپارچه زنجیره تولید و توزیع</p>
          </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 bg-transparent md:bg-[#1D1D1D]/90 dark:md:bg-[#111827]/95 backdrop-blur-none md:backdrop-blur-md z-10 shadow-none md:shadow-2xl md:border-l border-white/10 dark:border-gray-700 transition-colors duration-300">
        
        {/* Mobile Header */}
        <div className="md:hidden w-full text-center text-white mb-6 z-20 relative animate-in slide-in-from-top-4 duration-700">
             <div className="font-sans tabular-nums font-black text-5xl tracking-tighter drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">{currentDate}</div>
             <div className="text-lg mt-1 font-light opacity-90 font-sans drop-shadow-md tabular-nums">{currentTime}</div>
             <div className="mt-4">
                <span className="text-white font-light text-lg tracking-wide drop-shadow-md border-b border-white/30 pb-2">سامانه مدیریت مروارید</span>
             </div>
        </div>

        <div className="w-full max-w-sm space-y-8 relative z-20">
            <div className="flex flex-col items-center gap-3 mb-5">
                 <div className="w-24 h-24 bg-gray-800/80 backdrop-blur-xl rounded-[28px] flex items-center justify-center border border-white/10 shadow-2xl relative group">
                     <div className="absolute inset-0 bg-white/5 group-hover:bg-transparent transition-colors rounded-[28px]"></div>
                     <Icons.User className="w-10 h-10 text-white relative z-10" />
                 </div>
                 <h2 className="text-xl text-white font-light font-sans tracking-wide mt-2">خوش آمدید</h2>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {error && <div className="bg-red-500/20 backdrop-blur-md p-3 text-red-200 text-sm font-bold text-center border border-red-500/50 rounded-xl">{error}</div>}
                
                <div className="relative group">
                    <div className="absolute top-4 right-4 z-10">
                        <Icons.User className="w-5 h-5 text-gray-400 group-focus-within:text-metro-blue transition-colors" />
                    </div>
                    <input
                        type="text"
                        dir="ltr"
                        id="username"
                        placeholder=" "
                        disabled={isBlocked}
                        {...register('username')}
                        className={inputClass}
                        autoComplete="off"
                    />
                    <label htmlFor="username" className={labelClass}>نام کاربری</label>
                </div>

                <div className="relative group">
                     <div className="absolute top-4 right-4 z-10">
                        <Icons.Fingerprint className="w-5 h-5 text-gray-400 group-focus-within:text-metro-blue transition-colors" />
                    </div>
                    <input
                        type="password"
                        dir="ltr"
                        id="password"
                        placeholder=" "
                        disabled={isBlocked}
                        {...register('password')}
                        className={inputClass}
                        autoComplete="off"
                    />
                    <label htmlFor="password" className={labelClass}>رمز عبور</label>
                </div>

                <div className="flex items-center gap-2 mt-2 px-1">
                    <input 
                        type="checkbox" 
                        {...register('rememberMe')} 
                        id="remember"
                        className="w-5 h-5 border-2 border-gray-400 bg-transparent text-metro-blue focus:ring-0 checked:bg-metro-blue rounded-md transition-all"
                    />
                    <label htmlFor="remember" className="text-sm text-gray-300 cursor-pointer font-light font-sans select-none">مرا به خاطر بسپار</label>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting || isRedirecting || isBlocked}
                    className="w-full py-4 mt-6 bg-metro-blue hover:bg-metro-cobalt text-white font-bold text-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-metro-blue/30 rounded-full disabled:opacity-70 disabled:cursor-wait"
                >
                    {isSubmitting || isRedirecting ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white ml-2"></div>
                            در حال ورود...
                        </>
                    ) : (
                        <><Icons.ChevronLeft className="w-5 h-5" /> ورود به سامانه</>
                    )}
                </button>
            </form>
            
            <div className="mt-8 text-center">
                 <p className="text-gray-500 text-[10px] font-mono mb-4">v{APP_VERSION}</p>
                 <div className="inline-block bg-black/30 backdrop-blur-md rounded-full px-4 py-2 border border-white/10">
                    <ThemeToggle />
                 </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
