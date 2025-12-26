
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, FieldErrors } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { Icons } from '../components/common/Icons';
import { UserRole } from '../types';
import { getTodayJalaliPersian, getCurrentTime } from '../utils/dateUtils';
import { APP_VERSION } from '../constants';
import { motion } from 'framer-motion';
import ThemeToggle from '../components/common/ThemeToggle';

const loginSchema = z.object({
  username: z.string().min(1, "نام کاربری الزامی است"),
  password: z.string().min(1, "رمز عبور الزامی است"),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// --- OPTIMIZED STATIC STARS (No JS Randomness) ---
const StarryNight = React.memo(() => {
    const stars = [
        { t: '10%', l: '20%', d: '0s', s: '2px' },
        { t: '30%', l: '80%', d: '1.2s', s: '3px' },
        { t: '50%', l: '10%', d: '0.5s', s: '1.5px' },
        { t: '70%', l: '90%', d: '2.5s', s: '2px' },
        { t: '15%', l: '60%', d: '1.8s', s: '2.5px' },
        { t: '85%', l: '30%', d: '3s', s: '1.8px' },
        { t: '40%', l: '40%', d: '0.8s', s: '2.2px' },
        { t: '5%', l: '95%', d: '2.1s', s: '3px' },
        { t: '60%', l: '75%', d: '1.5s', s: '1.5px' },
        { t: '90%', l: '10%', d: '0.2s', s: '2px' },
        { t: '25%', l: '5%', d: '2.8s', s: '2.5px' },
        { t: '75%', l: '50%', d: '1s', s: '1.8px' }
    ];

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden hidden dark:block z-0">
            {stars.map((s, i) => (
                <div 
                    key={i}
                    className="absolute bg-white rounded-full star-anim"
                    style={{
                        top: s.t,
                        left: s.l,
                        width: s.s,
                        height: s.s,
                        animationDelay: s.d
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
        addToast('حساب شما موقتاً مسدود است. لطفا دقایقی صبر کنید.', 'error');
        return;
    }
    const result = await login(data.username, data.password, !!data.rememberMe);
    if (result.success) {
        setIsRedirecting(true);
        const currentUser = useAuthStore.getState().user;
        addToast(`خوش آمدید ${currentUser?.fullName || ''}`, 'success');
        setTimeout(() => {
            switch (currentUser?.role) {
                case UserRole.ADMIN: navigate('/admin', { replace: true }); break;
                case UserRole.REGISTRATION: navigate('/registration', { replace: true }); break;
                case UserRole.SALES: navigate('/sales', { replace: true }); break;
                default: navigate('/home', { replace: true });
            }
        }, 500);
    } else {
        addToast(result.error || 'خطا در ورود به سیستم', 'error');
        setIsRedirecting(false);
    }
  };

  const onError = (errors: FieldErrors<LoginFormValues>) => {
      const firstError = Object.values(errors)[0] as any;
      if (firstError?.message) addToast(firstError.message as string, 'error');
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col relative overflow-hidden bg-[#FFF8F0] dark:bg-[#0f172a] font-sans transition-colors duration-500">
      
      {/* --- THEME TOGGLE --- */}
      <div className="fixed top-4 left-4 z-50">
          <div className="bg-white/50 dark:bg-black/30 p-2 rounded-full backdrop-blur-md border border-white/40 dark:border-white/10 shadow-sm">
              <ThemeToggle />
          </div>
      </div>

      {/* --- BACKGROUND --- */}
      <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b md:bg-gradient-to-l from-orange-100/90 via-orange-50/50 to-transparent dark:from-orange-900/10 dark:via-orange-800/5 dark:to-transparent"></div>
          <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.05]" 
               style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
          </div>
          <StarryNight />
      </div>

      {/* --- SKETCH IMAGE (Visible on Mobile & Desktop) --- */}
      {/* PLEASE PLACE 'login-sketch.png' IN YOUR PUBLIC FOLDER */}
      <div className="absolute bottom-0 left-0 w-full z-0 pointer-events-none flex items-end justify-center">
          <img 
            src="/login-sketch.png" 
            alt="Industrial Sketch" 
            className="w-full h-auto max-h-[300px] object-cover object-bottom opacity-100 dark:opacity-80 dark:invert dark:grayscale transition-all duration-500"
          />
      </div>

      {/* --- MAIN LAYOUT --- */}
      <div className="relative z-10 flex flex-col md:flex-row h-full w-full">
          
          {/* --- TOP/LEFT SECTION (Visuals) --- */}
          <div className="absolute inset-0 z-0 flex flex-col items-center justify-start pt-12 md:pt-0 md:relative md:flex-1 md:w-[55%] md:justify-center md:pb-20 md:z-10 pointer-events-none md:pointer-events-auto opacity-100 transition-all duration-500">
              
              <div className="text-center z-20 md:mt-6 transform-gpu scale-75 md:scale-100 origin-top">
                  <h1 className="text-3xl md:text-5xl font-black tracking-[0.2em] text-gray-900 dark:text-white mb-1 md:mb-2 drop-shadow-md">MORVARID</h1>
                  <div className="h-1 md:h-1.5 w-12 md:w-24 bg-gradient-to-r from-orange-400 to-yellow-400 mx-auto rounded-full mb-2 md:mb-5 shadow-sm"></div>
                  
                  <h1 className="text-4xl md:text-6xl font-black text-gray-800 dark:text-white mb-2 md:mb-5 tracking-tight drop-shadow-sm scale-y-110">
                      مـرواریــد
                  </h1>
                  <h2 className="text-sm md:text-lg font-bold text-gray-600 dark:text-gray-300 tracking-wide mt-1 opacity-90 backdrop-blur-sm bg-white/30 dark:bg-black/30 p-1.5 rounded-lg border border-white/20 dark:border-white/5">
                      سیستم هوشمند پایش زنجیره آمار، تولید و توزیع
                  </h2>
              </div>

              {/* THE EGG (Visible on Mobile, Smaller) */}
              <div className="relative w-20 h-20 mt-2 md:w-[340px] md:h-[340px] md:mt-4 flex items-center justify-center transform-gpu z-10">
                  <div className="hidden md:block absolute inset-[-10px] md:inset-[-40px] rounded-full bg-orange-400/10 md:bg-orange-400/20 blur-xl md:blur-3xl animate-pulse" style={{ animationDuration: '8s' }}></div>
                  
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1, y: [0, -3, 0] }}
                    transition={{ 
                        scale: { duration: 1.5 },
                        y: { duration: 4, repeat: Infinity, ease: "easeInOut" } 
                    }}
                    className="relative w-16 h-20 md:w-60 md:h-72 bg-gradient-to-br from-white via-gray-100 to-gray-200 dark:from-gray-200 dark:via-gray-400 dark:to-gray-500 rounded-[50%/60%_60%_40%_40%] z-20 flex items-center justify-center overflow-hidden border border-white/60 dark:border-white/10 shadow-[0_0_15px_rgba(0,0,0,0.1),inset_-5px_-5px_20px_rgba(0,0,0,0.05)] md:shadow-[0_0_25px_rgba(0,0,0,0.1),inset_-5px_-5px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                  >
                      <div className="absolute top-[15%] left-[20%] w-[30%] h-[15%] bg-white rounded-[50%] blur-sm md:blur-md opacity-90"></div>
                      <div className="absolute inset-0 rounded-[50%/60%_60%_40%_40%] shadow-[inset_5px_5px_10px_rgba(255,255,255,0.8)] md:shadow-[inset_10px_10px_20px_rgba(255,255,255,0.8)] pointer-events-none"></div>
                  </motion.div>
              </div>

              {/* Date & Time (Visible on Mobile now) */}
              <div className="flex md:hidden items-center justify-center gap-3 z-20 bg-orange-50/50 dark:bg-black/30 px-4 py-1.5 rounded-xl backdrop-blur-sm border border-orange-200/50 dark:border-white/10 shadow-sm mt-2">
                  <div className="text-lg font-black text-gray-800 dark:text-white tabular-nums tracking-tight">
                      {currentTime}
                  </div>
                  <div className="w-[1px] h-4 bg-orange-300 dark:bg-gray-600 rounded-full"></div>
                  <div className="text-lg font-black text-gray-800 dark:text-white tabular-nums tracking-tight">
                      {currentDate}
                  </div>
              </div>

              {/* Desktop Date & Time */}
              <div className="hidden md:flex items-center justify-center gap-6 z-20 bg-orange-100/60 dark:bg-black/40 px-6 py-3 md:px-10 md:py-5 rounded-2xl backdrop-blur-sm border border-orange-200 dark:border-white/10 shadow-md transform-gpu mb-10 md:mb-20">
                  <div className="text-2xl md:text-4xl font-black text-gray-800 dark:text-white tabular-nums tracking-tight">
                      {currentTime}
                  </div>
                  <div className="w-[2px] h-6 md:h-10 bg-orange-300 dark:bg-gray-600 rounded-full"></div>
                  <div className="text-2xl md:text-4xl font-black text-gray-800 dark:text-white tabular-nums tracking-tight">
                      {currentDate}
                  </div>
              </div>
          </div>

          {/* --- RIGHT/BOTTOM SECTION (Form) --- */}
          <div className="relative z-20 w-full h-full flex flex-col items-center justify-end md:justify-center p-6 pb-24 md:pb-48 md:flex-1 md:w-[45%] md:relative md:z-30">
              <div className="w-full max-w-[340px] md:max-w-[420px] relative">
                  <div className="hidden md:block absolute inset-0 bg-amber-400/20 rounded-[32px] blur-xl animate-[pulse_4s_ease-in-out_infinite] -z-10"></div>
                  
                  <div className="backdrop-blur-xl bg-white/85 dark:bg-black/70 p-6 md:p-10 rounded-[32px] md:rounded-[36px] border-2 border-white/60 dark:border-white/10 shadow-2xl drop-shadow-2xl animate-in slide-in-from-bottom-10 duration-700">
                      
                      <div className="mb-6 md:mb-8 text-center">
                          <div className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-yellow-500 text-white mb-3 md:mb-4 shadow-lg shadow-orange-500/40 transform rotate-3">
                              <Icons.User className="w-6 h-6 md:w-8 md:h-8" />
                          </div>
                          <h3 className="text-lg md:text-2xl font-black text-gray-900 dark:text-white">ورود به حساب</h3>
                      </div>

                      <form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-4 md:space-y-6">
                          <div className="space-y-1.5">
                              <div className="relative group">
                                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                                      <Icons.User className="w-5 h-5 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
                                  </div>
                                  <input
                                      type="text"
                                      dir="ltr"
                                      disabled={isBlocked}
                                      {...register('username')}
                                      className="block w-full h-12 md:h-14 pr-12 pl-4 rounded-xl bg-gray-50/80 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-base placeholder-gray-400 focus:border-orange-500 focus:bg-white dark:focus:bg-black/50 focus:outline-none transition-all font-bold text-left shadow-sm group-hover:border-gray-300 dark:group-hover:border-gray-600"
                                      placeholder="Username"
                                      autoComplete="username"
                                  />
                              </div>
                          </div>

                          <div className="space-y-1.5">
                              <div className="relative group">
                                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                                      <Icons.Lock className="w-5 h-5 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
                                  </div>
                                  <input
                                      type={showPassword ? "text" : "password"}
                                      dir="ltr"
                                      disabled={isBlocked}
                                      {...register('password')}
                                      className="block w-full h-12 md:h-14 pr-12 pl-12 rounded-xl bg-gray-50/80 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-base tracking-widest placeholder-gray-400 focus:border-orange-500 focus:bg-white dark:focus:bg-black/50 focus:outline-none transition-all font-mono text-left shadow-sm group-hover:border-gray-300 dark:group-hover:border-gray-600"
                                      placeholder="••••••"
                                      autoComplete="current-password"
                                  />
                                  <button 
                                      type="button"
                                      onClick={() => setShowPassword(!showPassword)}
                                      className="absolute left-1 top-1/2 -translate-y-1/2 p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none transition-colors"
                                      tabIndex={-1}
                                  >
                                      {showPassword ? <Icons.EyeOff className="w-5 h-5" /> : <Icons.Eye className="w-5 h-5" />}
                                  </button>
                              </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                              <label className="flex items-center gap-2 cursor-pointer group select-none">
                                  <div className="relative">
                                      <input 
                                          type="checkbox" 
                                          {...register('rememberMe')} 
                                          className="peer sr-only"
                                      />
                                      <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 peer-checked:bg-orange-500 peer-checked:border-orange-500 transition-all"></div>
                                      <Icons.Check className="absolute top-0.5 left-0.5 w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                                  </div>
                                  <span className="text-sm font-bold text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-200 transition-colors">مرا به خاطر بسپار</span>
                              </label>
                          </div>

                          <button
                              type="submit"
                              disabled={isSubmitting || isRedirecting || isBlocked}
                              className="w-full h-14 md:h-16 bg-gradient-to-r from-gray-900 to-black hover:from-black hover:to-gray-900 dark:from-orange-500 dark:to-yellow-500 dark:hover:from-orange-600 dark:hover:to-yellow-600 text-white font-black text-lg rounded-2xl transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-3 shadow-xl shadow-gray-400/30 dark:shadow-orange-500/30 disabled:opacity-70 disabled:cursor-wait mt-2 group relative overflow-hidden"
                          >
                              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out skew-x-12"></div>
                              {isSubmitting || isRedirecting ? (
                                  <>
                                      <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                      <span>در حال پردازش...</span>
                                  </>
                              ) : (
                                  <>
                                      <span>ورود</span>
                                      <Icons.ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-300" />
                                  </>
                              )}
                          </button>
                      </form>
                  </div>
                  
                  <div className="mt-4 text-center relative z-20">
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium backdrop-blur-sm inline-block px-2 rounded">Morvarid Cloud • v{APP_VERSION}</p>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default LoginPage;
