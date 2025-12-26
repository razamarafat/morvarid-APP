
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
import ThemeToggle from '../components/common/ThemeToggle';

const loginSchema = z.object({
  username: z.string().min(1, "نام کاربری الزامی است"),
  password: z.string().min(1, "رمز عبور الزامی است"),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// --- EXISTING: SKETCH ---
const UltraRealisticSketch = React.memo(() => (
  <svg viewBox="0 0 1000 150" className="w-full h-full opacity-80 dark:opacity-50 pointer-events-none text-gray-700 dark:text-gray-400" preserveAspectRatio="xMidYMax meet">
    <defs>
        <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.2"/>
        </pattern>
        <pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="2" height="4" transform="translate(0,0)" fill="currentColor" fillOpacity="0.1"></rect>
        </pattern>
    </defs>
    
    {/* Ground Line (y=140) */}
    <line x1="0" y1="140" x2="1000" y2="140" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

    {/* --- 1. TRADITIONAL FARM (Far Left) --- */}
    <g transform="translate(20, 90)">
        <path d="M0,50 L0,20 L60,5 L120,20 L120,50 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect x="30" y="0" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1" />
        <rect x="80" y="0" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1" />
        <path d="M28,0 L42,0 M78,0 L92,0" stroke="currentColor" strokeWidth="1" />
        <path d="M130,50 L130,20 L140,10 L150,20 L150,50" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <line x1="130" y1="25" x2="150" y2="25" stroke="currentColor" strokeWidth="0.5" />
        <line x1="130" y1="35" x2="150" y2="35" stroke="currentColor" strokeWidth="0.5" />
    </g>

    {/* --- 1.5 CHICKENS (Small, on the line) --- */}
    <g transform="translate(160, 132)">
        <path d="M0,8 Q2,0 6,2 Q10,4 8,8 Z" fill="none" stroke="currentColor" strokeWidth="1" />
        <line x1="2" y1="8" x2="2" y2="10" stroke="currentColor" strokeWidth="0.5" />
        <line x1="6" y1="8" x2="6" y2="10" stroke="currentColor" strokeWidth="0.5" />
        <g transform="translate(15, 0)">
             <path d="M0,8 Q-2,0 4,0 Q8,4 6,8 Z" fill="none" stroke="currentColor" strokeWidth="1" />
             <line x1="1" y1="8" x2="1" y2="10" stroke="currentColor" strokeWidth="0.5" />
             <line x1="5" y1="8" x2="5" y2="10" stroke="currentColor" strokeWidth="0.5" />
        </g>
        <g transform="translate(30, 2)">
             <path d="M0,6 Q3,0 7,3 Q9,6 6,6 Z" fill="none" stroke="currentColor" strokeWidth="1" />
             <line x1="2" y1="6" x2="2" y2="8" stroke="currentColor" strokeWidth="0.5" />
             <line x1="5" y1="6" x2="5" y2="8" stroke="currentColor" strokeWidth="0.5" />
        </g>
    </g>

    {/* --- 2. MODERN FACTORY (Mid Left) --- */}
    <g transform="translate(220, 40)">
        <path d="M0,100 L0,30 L40,10 L80,30 L80,100 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect x="25" y="60" width="30" height="40" fill="url(#hatch)" stroke="currentColor" strokeWidth="1" />
        <rect x="60" y="-10" width="10" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </g>

    {/* --- 3. CONVEYOR BELT --- */}
    <g transform="translate(320, 100)">
        <line x1="10" y1="10" x2="10" y2="40" stroke="currentColor" strokeWidth="1" />
        <line x1="50" y1="10" x2="50" y2="40" stroke="currentColor" strokeWidth="1" />
        <line x1="90" y1="10" x2="90" y2="40" stroke="currentColor" strokeWidth="1" />
        <rect x="0" y="5" width="100" height="5" fill="currentColor" stroke="none" />
        <rect x="15" y="-5" width="15" height="10" fill="white" stroke="currentColor" strokeWidth="1" />
        <rect x="55" y="-5" width="15" height="10" fill="white" stroke="currentColor" strokeWidth="1" />
    </g>

    {/* --- 4. FORKLIFT --- */}
    <g transform="translate(450, 95)">
        <path d="M20,40 L20,15 L45,15 L50,40 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M20,15 L20,0 L40,0 L45,15" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <line x1="55" y1="45" x2="55" y2="-10" stroke="currentColor" strokeWidth="2" />
        <line x1="55" y1="35" x2="75" y2="35" stroke="currentColor" strokeWidth="1.5" />
        <rect x="57" y="15" width="16" height="20" fill="white" stroke="currentColor" strokeWidth="1" />
        <circle cx="25" cy="45" r="5" fill="white" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="45" cy="45" r="5" fill="white" stroke="currentColor" strokeWidth="1.5" />
    </g>

    {/* --- 5. DELIVERY TRUCK (Mid Right) --- */}
    <g transform="translate(560, 60)">
        <rect x="0" y="10" width="110" height="60" fill="white" stroke="currentColor" strokeWidth="1.5" />
        <rect x="10" y="20" width="90" height="40" fill="url(#grid)" stroke="none" opacity="0.3" />
        <path d="M110,70 L110,30 L130,30 L145,50 L145,70 Z" fill="white" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="30" cy="72" r="8" fill="white" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="30" cy="72" r="3" fill="currentColor" />
        <circle cx="125" cy="72" r="8" fill="white" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="125" cy="72" r="3" fill="currentColor" />
    </g>

    {/* --- 6. NISSAN JUNIOR (Right, Loaded, Leaving) --- */}
    <g transform="translate(780, 85)">
        <path d="M0,20 L0,50 L70,50 L70,20 Z" fill="white" stroke="currentColor" strokeWidth="1.5" />
        <path d="M70,50 L70,10 L95,10 L110,30 L110,50 Z" fill="white" stroke="currentColor" strokeWidth="1.5" />
        <line x1="95" y1="10" x2="95" y2="50" stroke="currentColor" strokeWidth="1" /> 
        <rect x="5" y="10" width="15" height="10" fill="white" stroke="currentColor" strokeWidth="1" />
        <rect x="25" y="10" width="15" height="10" fill="white" stroke="currentColor" strokeWidth="1" />
        <rect x="45" y="10" width="15" height="10" fill="white" stroke="currentColor" strokeWidth="1" />
        <rect x="15" y="0" width="15" height="10" fill="white" stroke="currentColor" strokeWidth="1" />
        <rect x="35" y="0" width="15" height="10" fill="white" stroke="currentColor" strokeWidth="1" />
        <circle cx="25" cy="55" r="7" fill="white" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="25" cy="55" r="2.5" fill="currentColor" />
        <circle cx="90" cy="55" r="7" fill="white" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="90" cy="55" r="2.5" fill="currentColor" />
    </g>
  </svg>
));

// --- EXISTING: STARS ---
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
    // Fixed height 100dvh prevents scrolling. Overflow hidden crucial.
    <div className="h-[100dvh] w-full flex flex-col relative overflow-hidden bg-[#FFF8F0] dark:bg-[#0f172a] font-sans transition-colors duration-500">
      
      {/* --- THEME TOGGLE --- */}
      <div className="absolute top-3 left-3 z-50">
          <div className="bg-white/50 dark:bg-black/30 p-1.5 rounded-full backdrop-blur-md border border-white/40 dark:border-white/10 shadow-sm scale-90 md:scale-100">
              <ThemeToggle />
          </div>
      </div>

      {/* --- BACKGROUND --- */}
      <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b md:bg-gradient-to-l from-orange-100/90 via-orange-50/50 to-transparent dark:from-orange-900/10 dark:via-orange-800/5 dark:to-transparent"></div>
          <div className="absolute inset-0 opacity-[0.04] dark:opacity-0" 
               style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
          </div>
          <StarryNight />
      </div>

      {/* --- SKETCH FOOTER (Fixed Bottom) --- */}
      <div className="absolute bottom-0 left-0 w-full z-0 h-[120px] md:h-[180px] pointer-events-none opacity-60">
          <UltraRealisticSketch />
      </div>

      {/* --- MAIN LAYOUT --- */}
      <div className="relative z-10 flex flex-col md:flex-row h-full w-full justify-between md:justify-center">
          
          {/* --- TOP SECTION (Logo & Title) --- */}
          <div className="flex-none flex flex-col items-center justify-center md:justify-start pt-8 md:pt-32 relative z-20 shrink-0 md:flex-1 md:w-[55%]">
              
              <div className="text-center z-20 transform-gpu transition-transform duration-300">
                  {/* MORVARID TEXT WITHOUT CROWN */}
                  <div className="relative inline-block mb-2 md:mb-2 w-auto">
                      <h1 className="text-4xl md:text-5xl font-black tracking-[0.2em] text-gray-900 dark:text-white drop-shadow-md relative z-10">MORVARID</h1>
                  </div>

                  <div className="h-1.5 w-16 md:w-24 bg-gradient-to-r from-orange-400 to-yellow-400 mx-auto rounded-full mb-3 md:mb-5 shadow-sm"></div>
                  
                  <h1 className="text-5xl md:text-6xl font-black text-gray-800 dark:text-white mb-3 md:mb-5 tracking-tight drop-shadow-sm scale-y-110">
                      مـرواریــد
                  </h1>
                  
                  <h2 className="text-sm md:text-lg font-bold text-gray-600 dark:text-gray-300 tracking-wide mt-1 opacity-90 backdrop-blur-sm bg-white/30 dark:bg-black/30 p-1.5 rounded-lg border border-white/20 dark:border-white/5 inline-block">
                      سیستم هوشمند پایش زنجیره آمار، تولید و فروش
                  </h2>
              </div>

              {/* Mobile Date - Visible */}
              <div className="flex md:hidden items-center justify-center gap-4 z-20 bg-orange-50/50 dark:bg-black/30 px-4 py-2 rounded-lg backdrop-blur-sm border border-orange-200/50 dark:border-white/10 shadow-sm mt-4">
                  <div className="text-sm font-black text-gray-800 dark:text-white tabular-nums tracking-tight">
                      {currentTime}
                  </div>
                  <div className="w-[1px] h-3 bg-orange-300 dark:bg-gray-600 rounded-full"></div>
                  <div className="text-sm font-black text-gray-800 dark:text-white tabular-nums tracking-tight">
                      {currentDate}
                  </div>
              </div>

              {/* Desktop Date */}
              <div className="hidden md:flex items-center justify-center gap-6 z-20 bg-orange-100/60 dark:bg-black/40 px-6 py-3 md:px-10 md:py-5 rounded-2xl backdrop-blur-sm border border-orange-200 dark:border-white/10 shadow-md transform-gpu mt-8">
                  <div className="text-2xl md:text-4xl font-black text-gray-800 dark:text-white tabular-nums tracking-tight">
                      {currentTime}
                  </div>
                  <div className="w-[2px] h-6 md:h-10 bg-orange-300 dark:bg-gray-600 rounded-full"></div>
                  <div className="text-2xl md:text-4xl font-black text-gray-800 dark:text-white tabular-nums tracking-tight">
                      {currentDate}
                  </div>
              </div>

          </div>

          {/* --- BOTTOM SECTION (Form) --- */}
          <div className="flex-1 md:w-[45%] flex flex-col items-center justify-center px-6 pb-20 md:pb-0 relative z-30 w-full">
              <div className="w-full max-w-[340px] md:max-w-[420px] relative">
                  
                  {/* Form Container - TRANSPARENT GLASS STYLE */}
                  <div className="backdrop-blur-sm bg-white/10 md:bg-white/20 dark:bg-black/20 md:dark:bg-black/30 p-6 md:p-10 rounded-[30px] md:rounded-[36px] border border-white/20 dark:border-white/10 shadow-2xl drop-shadow-2xl animate-in slide-in-from-bottom-10 duration-700">
                      
                      <div className="mb-4 md:mb-8 text-center">
                          <div className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-yellow-500 text-white mb-2 md:mb-4 shadow-lg shadow-orange-500/40">
                              <Icons.User className="w-6 h-6 md:w-8 md:h-8" />
                          </div>
                          <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">ورود به حساب</h3>
                      </div>

                      <form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-4 md:space-y-6">
                          <div className="space-y-1">
                              <div className="relative group">
                                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                      <Icons.User className="w-5 h-5 text-gray-500 dark:text-gray-400 group-focus-within:text-orange-500 transition-colors" />
                                  </div>
                                  <input
                                      type="text"
                                      dir="ltr"
                                      disabled={isBlocked}
                                      {...register('username')}
                                      className="block w-full h-12 md:h-14 pr-10 pl-4 rounded-xl bg-white/50 dark:bg-black/50 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white text-base placeholder-gray-500 dark:placeholder-gray-400 focus:border-orange-500 focus:bg-white/80 dark:focus:bg-black/70 focus:outline-none transition-all font-bold text-left shadow-sm group-hover:border-gray-300 dark:group-hover:border-gray-500 backdrop-blur-sm"
                                      placeholder="Username"
                                      autoComplete="username"
                                  />
                              </div>
                          </div>

                          <div className="space-y-1">
                              <div className="relative group">
                                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                      <Icons.Lock className="w-5 h-5 text-gray-500 dark:text-gray-400 group-focus-within:text-orange-500 transition-colors" />
                                  </div>
                                  <input
                                      type={showPassword ? "text" : "password"}
                                      dir="ltr"
                                      disabled={isBlocked}
                                      {...register('password')}
                                      className="block w-full h-12 md:h-14 pr-10 pl-10 rounded-xl bg-white/50 dark:bg-black/50 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white text-base tracking-widest placeholder-gray-500 dark:placeholder-gray-400 focus:border-orange-500 focus:bg-white/80 dark:focus:bg-black/70 focus:outline-none transition-all font-mono text-left shadow-sm group-hover:border-gray-300 dark:group-hover:border-gray-500 backdrop-blur-sm"
                                      placeholder="••••••"
                                      autoComplete="current-password"
                                  />
                                  <button 
                                      type="button"
                                      onClick={() => setShowPassword(!showPassword)}
                                      className="absolute left-1 top-1/2 -translate-y-1/2 p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none transition-colors"
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
                                      <div className="w-5 h-5 border-2 border-gray-400 dark:border-gray-500 rounded-md bg-white/50 dark:bg-black/50 peer-checked:bg-orange-500 peer-checked:border-orange-500 transition-all backdrop-blur-sm"></div>
                                      <Icons.Check className="absolute top-0 left-0 w-5 h-5 text-white opacity-0 peer-checked:opacity-100 transition-opacity p-0.5" />
                                  </div>
                                  <span className="text-sm font-bold text-gray-600 group-hover:text-gray-800 dark:text-gray-300 dark:group-hover:text-white transition-colors">مرا به خاطر بسپار</span>
                              </label>
                          </div>

                          <button
                              type="submit"
                              disabled={isSubmitting || isRedirecting || isBlocked}
                              className="w-full h-14 md:h-16 bg-gradient-to-r from-gray-900 to-black hover:from-black hover:to-gray-900 dark:from-orange-500 dark:to-yellow-500 dark:hover:from-orange-600 dark:hover:to-yellow-600 text-white font-black text-lg rounded-xl md:rounded-2xl transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-3 shadow-xl shadow-gray-400/30 dark:shadow-orange-500/30 disabled:opacity-70 disabled:cursor-wait mt-2 group relative overflow-hidden"
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
                  
                  <div className="mt-4 text-center relative z-20 pb-4">
                      <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 font-medium backdrop-blur-sm inline-block px-2 rounded">Morvarid Cloud • v{APP_VERSION}</p>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default LoginPage;
