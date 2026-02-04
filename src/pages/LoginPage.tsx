
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, FieldErrors } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { Icons } from '../components/common/Icons';
import { TOAST_IDS } from '../constants';
import { UserRole } from '../types';
import { getTodayJalaliPersian, getCurrentTime, getTodayDayName, toPersianDigits } from '../utils/dateUtils';
import ThemeToggle from '../components/common/ThemeToggle';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { APP_VERSION } from '../constants';
import { SKETCH_BASE64 } from '../components/common/SketchAsset';

const loginSchema = z.object({
    username: z.string().min(1, "نام کاربری الزامی است"),
    password: z.string().min(1, "رمز عبور الزامی است"),
    rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// --- STARS ---
const StarryNight = React.memo(() => {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden hidden dark:block z-0 transform-gpu">
            {[...Array(12)].map((_, i) => (
                <div
                    key={i}
                    className="absolute bg-white rounded-full star-anim"
                    style={{
                        top: `${Math.random() * 100}%`,
                        left: `${Math.random() * 100}%`,
                        width: `${Math.random() * 2 + 1}px`,
                        height: `${Math.random() * 2 + 1}px`,
                        animationDelay: `${Math.random() * 3}s`
                    }}
                />
            ))}
        </div>
    );
});

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const { login, blockUntil, loadSavedUsername, savedUsername } = useAuthStore();
    const { addToast } = useToastStore();

    const [currentTime, setCurrentTime] = useState(getCurrentTime());
    const [currentDate, setCurrentDate] = useState(getTodayJalaliPersian());
    const [currentDayName, setCurrentDayName] = useState(getTodayDayName());
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
        defaultValues: { rememberMe: false }
    });

    useEffect(() => { loadSavedUsername(); }, [loadSavedUsername]);

    useEffect(() => {
        if (savedUsername) {
            setValue('username', savedUsername);
            setValue('rememberMe', true);
        }
    }, [savedUsername, setValue]);

    const isBlocked = blockUntil ? Date.now() < blockUntil : false;

    const onSubmit = async (data: LoginFormValues) => {
        if (isBlocked) {
            addToast('حساب شما موقتاً مسدود است. لطفا دقایقی صبر کنید.', 'error', TOAST_IDS.ACCOUNT_BLOCKED);
            return;
        }
        const result = await login(data.username, data.password, !!data.rememberMe);
        if (result.success) {
            setIsRedirecting(true);
            const currentUser = useAuthStore.getState().user;
            addToast(`خوش آمدید ${currentUser?.fullName || ''}`, 'success', TOAST_IDS.LOGIN_SUCCESS);
            setTimeout(() => {
                switch (currentUser?.role) {
                    case UserRole.ADMIN: navigate('/admin', { replace: true }); break;
                    case UserRole.REGISTRATION: navigate('/registration', { replace: true }); break;
                    case UserRole.SALES: navigate('/sales', { replace: true }); break;
                    default: navigate('/home', { replace: true });
                }
            }, 500);
        } else {
            addToast(result.error || 'خطا در ورود به سیستم', 'error', TOAST_IDS.LOGIN_ERROR);
            setIsRedirecting(false);
        }
    };

    const onError = (errors: FieldErrors<LoginFormValues>) => {
        const firstError = Object.values(errors)[0] as any;
        if (firstError?.message) addToast(firstError.message as string, 'error');
    };

    return (
        // OPTIMIZED CONTAINER: No Scroll on Mobile (h-100dvh, overflow-hidden)
        <div className="h-[100dvh] w-full flex flex-col relative overflow-hidden bg-[#FFF8F0] dark:bg-[#0f172a] font-sans transition-colors duration-500">

            {/* Theme Toggle - Absolute Top Left */}
            <div className="absolute top-3 left-3 z-50">
                <div className="bg-white/50 dark:bg-black/30 p-1.5 rounded-full backdrop-blur-md border border-white/40 dark:border-white/10 shadow-sm scale-90 md:scale-100">
                    <ThemeToggle />
                </div>
            </div>

            {/* Background */}
            <div className="absolute inset-0 z-0 pointer-events-none transform-gpu">
                <div className="absolute inset-0 bg-gradient-to-b md:bg-gradient-to-l from-orange-100/90 via-orange-50/50 to-transparent dark:from-orange-900/10 dark:via-orange-800/5 dark:to-transparent will-change-transform"></div>
                <div className="absolute inset-0 opacity-[0.04] dark:opacity-0"
                    style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
                </div>
                <StarryNight />
            </div>

            {/* Footer Sketch - Image Asset (Restricted Height & Masked) */}
            {SKETCH_BASE64 && (
                <img
                    src={SKETCH_BASE64}
                    alt="Production Chain Sketch"
                    className="absolute bottom-0 left-0 w-full h-32 md:h-64 object-cover object-bottom opacity-80 mix-blend-multiply dark:mix-blend-screen dark:invert pointer-events-none z-0 transition-opacity duration-500"
                    style={{
                        maskImage: 'linear-gradient(to top, black 60%, transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to top, black 60%, transparent 100%)'
                    }}
                />
            )}

            {/* MAIN CONTENT AREA - Flex layout */}
            <div className="relative z-10 flex flex-col md:flex-row h-full w-full justify-between pb-safe">

                {/* --- TOP SECTION (Logo, Clock) --- */}
                <div className="flex-none flex flex-col items-center justify-start pt-safe mt-10 md:mt-12 relative z-20 shrink-0 md:flex-1 md:w-[55%]">

                    <div className="text-center z-20 transform-gpu">
                        {/* Logo Text */}
                        <div className="relative inline-block mb-1 w-auto">
                            <img
                                src="/images/logo.png"
                                alt="Morvarid Logo"
                                className="h-24 md:h-32 w-auto mx-auto mb-4 rounded-2xl shadow-lg hover:scale-105 transition-transform duration-500 ease-out"
                                style={{ imageRendering: '-webkit-optimize-contrast' } as React.CSSProperties}
                            />
                        </div>

                        <div className="h-1 w-12 md:w-24 bg-gradient-to-r from-orange-400 to-yellow-400 mx-auto rounded-full mb-2 md:mb-4 shadow-sm"></div>

                        <h1 className="text-5xl md:text-6xl font-black text-gray-800 dark:text-white mb-1 md:mb-3 tracking-tight drop-shadow-sm scale-y-110">
                            مـرواریــد
                        </h1>

                        {/* Updated Title */}
                        <h2 className="text-sm md:text-lg font-bold text-gray-600 dark:text-gray-300 tracking-wide mt-1 opacity-90 backdrop-blur-sm bg-white/30 dark:bg-black/30 p-1.5 rounded-lg border border-white/20 dark:border-white/5 inline-block leading-relaxed">
                            سیستم هوشمند مدیریت یکپارچه زنجیره تولید ، آمار و فروش
                        </h2>
                    </div>

                    {/* Clock & Date */}
                    <div className="hidden md:flex mt-4 md:mt-8 z-20 flex-col items-center gap-0 w-full max-w-[320px] md:max-w-md">
                        <div className="w-full text-center flex flex-col gap-1 md:gap-4">
                            <div className="flex md:flex-col items-center justify-center gap-3 md:gap-2">
                                <div className="text-sm md:text-2xl font-black text-gray-700 dark:text-gray-300 tracking-[0.2em] md:tracking-[0.6em] uppercase opacity-90 scale-x-110">
                                    {currentDayName}
                                </div>
                                <div className="hidden md:block w-32 h-1 bg-gradient-to-r from-transparent via-orange-400 to-transparent mx-auto rounded-full opacity-80"></div>
                                <div className="md:hidden h-4 w-[2px] bg-orange-400 rounded-full opacity-50"></div>
                                <div className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white tabular-nums tracking-tight leading-none">
                                    {toPersianDigits(currentDate)}
                                </div>
                            </div>
                            <div className="hidden md:block w-32 h-1 bg-gradient-to-r from-transparent via-orange-400 to-transparent mx-auto rounded-full opacity-80"></div>
                            <div className="text-2xl md:text-4xl font-black text-gray-600 dark:text-gray-400 tabular-nums tracking-widest opacity-80 leading-none">
                                {toPersianDigits(currentTime)}
                            </div>
                        </div>
                    </div>

                </div>

                {/* --- MIDDLE/BOTTOM SECTION (Form Container) --- */}
                <div className="flex-1 md:w-[45%] flex flex-col items-center justify-start md:justify-center px-6 pt-4 md:pt-0 relative z-30 w-full min-h-0">

                    <div className="w-full max-w-[320px] md:max-w-[420px] relative flex flex-col items-center">

                        {/* Form Container */}
                        <div className="w-full backdrop-blur-sm bg-white/10 md:bg-white/20 dark:bg-black/20 md:dark:bg-black/30 p-5 md:p-10 rounded-[24px] md:rounded-[36px] border border-white/20 dark:border-white/10 shadow-2xl drop-shadow-2xl animate-in slide-in-from-bottom-5 duration-700">

                            <div className="mb-3 md:mb-8 text-center">
                                <h3 className="text-lg md:text-2xl font-black text-gray-900 dark:text-white flex items-center justify-center gap-2">
                                    <Icons.User className="w-5 h-5 md:w-8 md:h-8 text-orange-500" />
                                    ورود به حساب
                                </h3>
                            </div>

                            <form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-3 md:space-y-6">
                                <div className="space-y-1">
                                    {/* Using base Input but overriding className for login specific look */}
                                    <Input
                                        type="text"
                                        dir="ltr"
                                        disabled={isBlocked}
                                        {...register('username')}
                                        className="block w-full h-10 md:h-14 pr-3 pl-3 rounded-xl bg-white/50 dark:bg-black/50 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white text-base md:text-base font-bold text-center shadow-sm focus:border-orange-500 outline-none backdrop-blur-sm transition-all"
                                        placeholder="نام کاربری"
                                        autoComplete="username"
                                    />
                                </div>

                                <div className="space-y-1 relative">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        dir="ltr"
                                        disabled={isBlocked}
                                        {...register('password')}
                                        className="block w-full h-10 md:h-14 pr-3 pl-8 rounded-xl bg-white/50 dark:bg-black/50 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white text-base md:text-base font-bold text-center shadow-sm focus:border-orange-500 outline-none backdrop-blur-sm transition-all"
                                        placeholder="رمز عبور"
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        tabIndex={-1}
                                        className="absolute left-2 top-2.5 md:top-4 text-gray-500 dark:text-gray-400 focus:outline-none"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <Icons.EyeOff className="w-5 h-5" /> : <Icons.Eye className="w-5 h-5" />}
                                    </button>
                                </div>

                                <div className="flex items-center justify-between py-1">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            {...register('rememberMe')}
                                            className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500 border-gray-300"
                                        />
                                        <span className="text-sm font-bold text-gray-600 dark:text-gray-300 select-none">مرا به خاطر بسپار</span>
                                    </label>
                                </div>

                                <Button
                                    type="submit"
                                    isLoading={isSubmitting || isRedirecting}
                                    disabled={isBlocked}
                                    className="w-full h-12 md:h-16 text-lg md:text-xl font-black bg-gradient-to-r from-orange-500 to-amber-500 hover:to-amber-600 shadow-xl shadow-orange-200/50 dark:shadow-none rounded-2xl transition-all active:scale-95 text-white mt-2"
                                >
                                    {isSubmitting || isRedirecting ? 'در حال پردازش' : (isBlocked ? `مسدود (${Math.ceil((blockUntil! - Date.now()) / 1000)}s)` : 'ورود به حساب')}
                                </Button>
                            </form>
                        </div>

                        {/* Task 3: Version Number */}
                        <div className="mt-3 text-[10px] text-gray-500 dark:text-gray-400 font-bold font-mono opacity-80 select-none">
                            v{APP_VERSION}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
