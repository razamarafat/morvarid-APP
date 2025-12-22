
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
  const { login, blockUntil, savedUsername, loadSavedUsername } = useAuthStore();
  
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
        
        switch (currentUser?.role) {
            case UserRole.ADMIN: navigate('/admin', { replace: true }); break;
            case UserRole.REGISTRATION: navigate('/registration', { replace: true }); break;
            case UserRole.SALES: navigate('/sales', { replace: true }); break;
            default: navigate('/home', { replace: true });
        }
    } else {
        setError(result.error || 'خطا در ورود');
    }
  };

  // Improved Input styles
  const inputClass = "w-full p-3 bg-black/40 dark:bg-black/50 hover:bg-black/60 focus:bg-black/70 text-white border-2 border-white/20 focus:border-white/50 outline-none transition-all placeholder-transparent rounded-lg backdrop-blur-sm";

  return (
    <div className="min-h-screen bg-[#004E98] dark:bg-[#0f172a] relative overflow-hidden flex flex-col md:flex-row transition-colors duration-300">
      
      {/* Background Pattern: Faster Animation (3s) and slightly more visible */}
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] animate-[pulse_3s_ease-in-out_infinite] z-0"></div>
      
      {/* Floating Circles (Desktop) */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 hidden md:block">
          <div className="absolute top-[10%] left-[20%] w-64 h-64 bg-white/5 rounded-full blur-3xl animate-[bounce_8s_infinite]"></div>
          <div className="absolute bottom-[20%] right-[20%] w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-[bounce_12s_infinite]"></div>
      </div>

      {/* Left Side: Lock Screen (Desktop Only) - SWAPPED Date/Time */}
      <div className="hidden md:flex flex-1 flex-col justify-end p-12 lg:p-24 text-white z-10 bg-gradient-to-r from-black/40 to-transparent">
          {/* Date is now dominant */}
          <h1 className="text-[6rem] lg:text-[8rem] font-black leading-none font-sans tabular-nums tracking-tighter drop-shadow-2xl min-w-[500px]">
              {currentDate}
          </h1>
          {/* Time is secondary */}
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
        
        {/* Mobile Header (Clock/Title) - Compact Version */}
        <div className="md:hidden w-full text-center text-white mb-6 z-20 relative animate-in slide-in-from-top-4 duration-700">
             {/* Date Big (Reduced size) */}
             <div className="font-sans tabular-nums font-black text-5xl tracking-tighter drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">{currentDate}</div>
             {/* Time Small */}
             <div className="text-lg mt-1 font-light opacity-90 font-sans drop-shadow-md tabular-nums">{currentTime}</div>
             
             <div className="mt-4">
                <span className="text-white font-light text-lg tracking-wide drop-shadow-md border-b border-white/30 pb-2">سامانه مدیریت مروارید</span>
             </div>
        </div>

        <div className="w-full max-w-sm space-y-5 relative z-20">
            <div className="flex flex-col items-center gap-3 mb-5">
                 <div className="w-20 h-20 bg-gray-600/50 dark:bg-gray-700/50 backdrop-blur-md rounded-full flex items-center justify-center overflow-hidden border-2 border-white/20 shadow-xl relative group">
                     <div className="absolute inset-0 bg-white/10 group-hover:bg-transparent transition-colors"></div>
                     <Icons.User className="w-8 h-8 text-white relative z-10" />
                 </div>
                 <h2 className="text-lg text-white font-light font-sans tracking-wide">ورود به حساب کاربری</h2>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                {error && <div className="bg-metro-red p-2.5 text-white text-xs font-bold text-center animate-pulse border-2 border-red-400 font-sans shadow-lg rounded-lg">{error}</div>}
                
                <div className="group relative">
                    <label className="block text-xs text-gray-400 mb-1 font-medium font-sans">نام کاربری</label>
                    <div className="flex shadow-lg rounded-lg overflow-hidden">
                        <div className="bg-black/40 p-3 flex items-center justify-center border-2 border-r-0 border-white/20">
                            <Icons.User className="w-5 h-5 text-white/90" />
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
                    <label className="block text-xs text-gray-400 mb-1 font-medium font-sans">رمز عبور</label>
                    <div className="flex shadow-lg rounded-lg overflow-hidden">
                        <div className="bg-black/40 p-3 flex items-center justify-center border-2 border-r-0 border-white/20">
                            <Icons.Fingerprint className="w-5 h-5 text-white/90" />
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

                <div className="flex items-center gap-2 mt-3">
                    <input 
                        type="checkbox" 
                        {...register('rememberMe')} 
                        id="remember"
                        className="w-4 h-4 border-2 border-gray-400 bg-white/10 text-metro-blue focus:ring-0 checked:bg-metro-blue rounded"
                    />
                    <label htmlFor="remember" className="text-xs text-gray-300 cursor-pointer font-light font-sans">مرا به خاطر بسپار</label>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting || isBlocked}
                    className="w-full py-3 mt-4 bg-metro-blue hover:bg-metro-cobalt dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-bold text-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg hover:shadow-metro-blue/50 font-sans border border-white/10 rounded-lg"
                >
                    {isSubmitting ? '...' : <><Icons.ChevronLeft className="w-5 h-5" /> ورود</>}
                </button>
            </form>
            
            <div className="mt-8 text-center">
                 <p className="text-gray-500 text-[10px] font-mono mb-3">v{APP_VERSION}</p>
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
