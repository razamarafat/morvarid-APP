
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
  const [showPassword, setShowPassword] = useState(false);
  
  const [isRedirecting, setIsRedirecting] = useState(false);

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
  }, [loadSavedUsername]);

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
        setIsRedirecting(true);
        const currentUser = useAuthStore.getState().user;
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

  // Background color for the label "cut" effect matching the card background
  const labelBgColor = "bg-[#111827]"; 

  return (
    <div className="min-h-screen bg-[#004E98] dark:bg-[#0f172a] relative overflow-hidden flex flex-col md:flex-row transition-colors duration-300">
      
      {/* Background Patterns */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] z-0"></div>
      <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-white/5 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Left Side: Info Screen (Desktop Only) */}
      <div className="hidden md:flex flex-1 flex-col justify-center p-12 lg:p-24 text-white z-10 bg-gradient-to-r from-black/20 to-transparent backdrop-blur-[2px]">
          <div className="animate-in slide-in-from-left-8 duration-700">
              <h1 className="text-[6rem] lg:text-[7rem] font-black leading-none font-sans tabular-nums tracking-tighter drop-shadow-2xl">
                  {currentDate}
              </h1>
              <h2 className="text-4xl lg:text-5xl font-light mt-2 opacity-90 drop-shadow-md font-sans tabular-nums tracking-wide">
                  {currentTime}
              </h2>
              
              <div className="mt-10 pr-2 border-r-4 border-metro-orange py-2 mr-1">
                  <p className="text-3xl lg:text-4xl font-bold text-white tracking-wide font-sans">
                      سامانه مدیریت مروارید
                  </p>
                  <p className="text-base mt-2 opacity-80 font-sans font-light max-w-md leading-relaxed">
                      مدیریت یکپارچه زنجیره تولید، انبارداری و توزیع
                  </p>
              </div>
          </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 z-20">
        
        {/* Mobile Header Date/Time (Visible only on mobile) */}
        <div className="md:hidden w-full text-center text-white mb-8 z-20 animate-in slide-in-from-top-4 duration-700">
             <div className="font-sans tabular-nums font-black text-5xl tracking-tighter drop-shadow-lg">{currentDate}</div>
             <div className="text-xl mt-1 font-light opacity-90 font-sans tabular-nums">{currentTime}</div>
        </div>

        {/* Login Card */}
        <div className={`w-full max-w-[400px] p-8 lg:p-10 rounded-[32px] shadow-2xl border border-white/10 relative z-20 ${labelBgColor} backdrop-blur-xl animate-in zoom-in-95 duration-500`}>
            
            {/* Header */}
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-white/10 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-inner border border-white/5">
                    <Icons.User className="w-8 h-8 text-white drop-shadow-md" />
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight mb-2">خوش آمدید</h2>
                <p className="text-gray-400 text-sm font-medium">جهت ورود به حساب کاربری خود اقدام کنید</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                        <Icons.AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                        <span className="text-red-200 text-sm font-bold leading-tight">{error}</span>
                    </div>
                )}
                
                {/* Username Input (M3 Outlined) */}
                <div className="relative group">
                    <input
                        type="text"
                        dir="ltr"
                        id="username"
                        disabled={isBlocked}
                        {...register('username')}
                        className="peer block w-full px-4 h-[56px] rounded-xl bg-transparent border border-gray-600 text-white text-lg placeholder-transparent focus:border-metro-blue focus:border-2 focus:outline-none transition-all disabled:opacity-50"
                        placeholder=" "
                        autoComplete="off"
                    />
                    <label 
                        htmlFor="username" 
                        className={`absolute right-4 right-origin top-1/2 -translate-y-1/2 text-gray-400 text-base transition-all duration-200 ease-out origin-right 
                                    peer-focus:top-0 peer-focus:scale-75 peer-focus:-translate-y-1/2 peer-focus:text-metro-blue peer-focus:font-bold
                                    peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-[-50%]
                                    peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:scale-75 peer-[:not(:placeholder-shown)]:-translate-y-1/2
                                    pointer-events-none px-1 z-10 ${labelBgColor}`}
                    >
                        نام کاربری
                    </label>
                </div>

                {/* Password Input (M3 Outlined with Toggle) */}
                <div className="relative group">
                    <input
                        type={showPassword ? "text" : "password"}
                        dir="ltr"
                        id="password"
                        disabled={isBlocked}
                        {...register('password')}
                        className="peer block w-full pl-12 pr-4 h-[56px] rounded-xl bg-transparent border border-gray-600 text-white text-lg font-mono tracking-widest placeholder-transparent focus:border-metro-blue focus:border-2 focus:outline-none transition-all disabled:opacity-50"
                        placeholder=" "
                        autoComplete="off"
                    />
                    <label 
                        htmlFor="password" 
                        className={`absolute right-4 right-origin top-1/2 -translate-y-1/2 text-gray-400 text-base transition-all duration-200 ease-out origin-right 
                                    peer-focus:top-0 peer-focus:scale-75 peer-focus:-translate-y-1/2 peer-focus:text-metro-blue peer-focus:font-bold
                                    peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-[-50%]
                                    peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:scale-75 peer-[:not(:placeholder-shown)]:-translate-y-1/2
                                    pointer-events-none px-1 z-10 ${labelBgColor}`}
                    >
                        رمز عبور
                    </label>
                    
                    {/* Toggle Button (Left side to avoid label conflict in RTL layout logic, though input is LTR) */}
                    <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full text-gray-500 hover:text-white hover:bg-white/10 focus:outline-none transition-colors z-20"
                        tabIndex={-1}
                        title={showPassword ? "مخفی کردن" : "نمایش"}
                    >
                        {showPassword ? <Icons.EyeOff className="w-5 h-5" /> : <Icons.Eye className="w-5 h-5" />}
                    </button>
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                    <div className="relative flex items-center">
                        <input 
                            type="checkbox" 
                            {...register('rememberMe')} 
                            id="remember"
                            className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-gray-500 bg-transparent checked:border-metro-blue checked:bg-metro-blue transition-all"
                        />
                        <Icons.Check className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" />
                    </div>
                    <label htmlFor="remember" className="text-sm text-gray-300 cursor-pointer font-medium select-none hover:text-white transition-colors">مرا به خاطر بسپار</label>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting || isRedirecting || isBlocked}
                    className="w-full h-[56px] bg-metro-blue hover:bg-blue-600 text-white font-bold text-lg rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-70 disabled:cursor-wait group relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none"></div>
                    {isSubmitting || isRedirecting ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white ml-2"></div>
                            <span className="relative z-10">در حال ورود...</span>
                        </>
                    ) : (
                        <span className="flex items-center gap-2 relative z-10">ورود به سامانه <Icons.ChevronLeft className="w-5 h-5" /></span>
                    )}
                </button>
            </form>
            
            <div className="mt-8 flex items-center justify-between border-t border-gray-800 pt-4">
                 <div className="flex items-center gap-2">
                    <div className="bg-gray-800 p-1.5 rounded-lg border border-gray-700">
                        <ThemeToggle />
                    </div>
                    <span className="text-xs text-gray-500 font-bold">تغییر تم</span>
                 </div>
                 <div className="text-right">
                     <p className="text-gray-500 text-[10px] font-bold">نسخه سیستم</p>
                     <p className="text-gray-600 text-[10px] font-mono tracking-widest">v{APP_VERSION}</p>
                 </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
