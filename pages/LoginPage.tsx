
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

// --- ULTRA REALISTIC INDUSTRIAL SKETCH (REFINED) ---
// All paths are closed (end with Z) or fully connected to ground.
const UltraRealisticSketch = () => (
  <svg viewBox="0 0 1400 200" className="w-full h-full opacity-70 dark:opacity-40 pointer-events-none text-gray-800 dark:text-gray-500" preserveAspectRatio="xMidYMax slice">
    <defs>
        <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.1"/>
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.8"/>
        </linearGradient>
    </defs>
    
    {/* Ground Plane (Solid) */}
    <rect x="0" y="180" width="1400" height="20" fill="url(#groundGrad)" />
    <line x1="0" y1="180" x2="1400" y2="180" stroke="currentColor" strokeWidth="2" />

    {/* --- LEFT: POULTRY FARM (Closed Shapes) --- */}
    <g transform="translate(50, 60)">
        {/* Silo 1 - Full Shape */}
        <path d="M20,120 L20,40 C20,30 40,30 40,40 L40,120 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M20,50 Q30,55 40,50" stroke="currentColor" strokeWidth="0.5" fill="none" />
        <path d="M20,70 Q30,75 40,70" stroke="currentColor" strokeWidth="0.5" fill="none" />
        <path d="M20,90 Q30,95 40,90" stroke="currentColor" strokeWidth="0.5" fill="none" />
        
        {/* Silo 2 - Full Shape */}
        <path d="M50,120 L50,30 C50,20 70,20 70,30 L70,120 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M50,40 Q60,45 70,40" stroke="currentColor" strokeWidth="0.5" fill="none" />
        <path d="M50,60 Q60,65 70,60" stroke="currentColor" strokeWidth="0.5" fill="none" />
        
        {/* Feed Pipes */}
        <path d="M40,100 L80,80" stroke="currentColor" strokeWidth="1" fill="none" />
        <path d="M70,90 L80,80" stroke="currentColor" strokeWidth="1" fill="none" />

        {/* Barn - Closed Shape */}
        <path d="M80,120 L80,80 L140,50 L200,60 L200,120 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        {/* Roof Line */}
        <path d="M80,80 L200,60" stroke="currentColor" strokeWidth="0.5" fill="none" />
        {/* Windows */}
        <rect x="100" y="90" width="20" height="15" stroke="currentColor" fill="none" />
        <rect x="140" y="90" width="20" height="15" stroke="currentColor" fill="none" />
    </g>

    {/* --- CENTER: FACTORY (Closed Shapes) --- */}
    <g transform="translate(300, 40)">
        {/* Main Hall */}
        <path d="M0,140 L0,60 L50,40 L50,60 L100,40 L100,60 L150,40 L150,60 L200,40 L200,140 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        {/* Gate */}
        <rect x="20" y="80" width="160" height="60" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" fill="none" />
        
        {/* Chimney */}
        <path d="M180,40 L180,10 L190,10 L190,0 L170,0 L170,10 L180,10" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="1" />
        
        {/* Conveyor Belt System */}
        <path d="M200,100 L350,100 L350,110 L200,110 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        {/* Legs */}
        <path d="M220,110 L225,140" stroke="currentColor" strokeWidth="1" fill="none"/>
        <path d="M280,110 L285,140" stroke="currentColor" strokeWidth="1" fill="none"/>
        <path d="M340,110 L345,140" stroke="currentColor" strokeWidth="1" fill="none"/>
        
        {/* Boxes */}
        <rect x="210" y="85" width="20" height="15" stroke="currentColor" fill="none" />
        <rect x="240" y="85" width="20" height="15" stroke="currentColor" fill="none" />
        <rect x="270" y="85" width="20" height="15" stroke="currentColor" fill="none" />
        
        {/* Forklift */}
        <g transform="translate(380, 110)">
            <path d="M0,10 L30,10 L30,30 L0,30 Z" stroke="currentColor" fill="none" />
            <circle cx="5" cy="30" r="4" stroke="currentColor" fill="none" />
            <circle cx="25" cy="30" r="4" stroke="currentColor" fill="none" />
            <line x1="30" y1="10" x2="30" y2="30" stroke="currentColor" strokeWidth="1.5" />
            <path d="M30,20 L40,20" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            <rect x="35" y="5" width="15" height="15" stroke="currentColor" fill="none" />
        </g>
    </g>

    {/* --- RIGHT: TRANSPORT (Closed Shapes) --- */}
    <g transform="translate(800, 70)">
        
        {/* KHAVAR TRUCK */}
        <g transform="translate(0, 0)">
            {/* Cargo Box */}
            <rect x="0" y="20" width="140" height="70" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <line x1="0" y1="20" x2="140" y2="90" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
            <line x1="140" y1="20" x2="0" y2="90" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
            
            {/* Cabin */}
            <path d="M140,90 L140,30 L160,30 L170,50 L170,90 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="145" y="35" width="20" height="15" stroke="currentColor" fill="none" />
            
            {/* Wheels */}
            <circle cx="30" cy="90" r="10" stroke="currentColor" fill="none" strokeWidth="1.5" />
            <circle cx="150" cy="90" r="10" stroke="currentColor" fill="none" strokeWidth="1.5" />
        </g>

        {/* NISSAN BLUE */}
        <g transform="translate(200, 35)">
            {/* Bed */}
            <path d="M0,55 L0,35 L80,35 L80,55 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="5" y="20" width="70" height="15" stroke="currentColor" fill="none" strokeDasharray="2 2" />
            
            {/* Cabin */}
            <path d="M80,55 L80,25 L100,25 L115,40 L115,55 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M85,30 L95,30 L105,40 L105,50 L85,50 Z" stroke="currentColor" strokeWidth="0.5" fill="none" />
            
            {/* Wheels */}
            <circle cx="20" cy="55" r="8" stroke="currentColor" fill="none" strokeWidth="1.5" />
            <circle cx="95" cy="55" r="8" stroke="currentColor" fill="none" strokeWidth="1.5" />
        </g>
    </g>
  </svg>
);

// --- ORBITAL SYSTEM (Refined Colors & Visibility) ---
const OrbitalSystem = () => (
  <div className="relative w-full h-full flex items-center justify-center">
      {/* Core Glow */}
      <div className="absolute w-4 h-4 bg-orange-100 dark:bg-white rounded-full blur-md animate-pulse"></div>
      
      {/* Orbit 1 - Amber/Orange Theme */}
      <motion.div 
        className="absolute w-24 h-24 border-[1px] border-orange-300 dark:border-white/40 rounded-full"
        style={{ rotateX: 60, rotateY: 10 }}
        animate={{ rotateZ: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      >
          <div className="absolute top-0 left-1/2 w-2 h-2 bg-amber-500 rounded-full blur-[1px] -translate-x-1/2 -translate-y-1/2 shadow-[0_0_10px_rgba(245,158,11,0.8)]"></div>
      </motion.div>

      {/* Orbit 2 - Orange Theme */}
      <motion.div 
        className="absolute w-32 h-32 border-[1px] border-orange-300 dark:border-white/30 rounded-full"
        style={{ rotateX: -60, rotateY: 45 }}
        animate={{ rotateZ: -360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
          <div className="absolute bottom-0 left-1/2 w-2 h-2 bg-orange-600 rounded-full blur-[1px] -translate-x-1/2 translate-y-1/2 shadow-[0_0_10px_rgba(234,88,12,0.8)]"></div>
      </motion.div>

      {/* Orbit 3 - Yellow Theme */}
      <motion.div 
        className="absolute w-20 h-20 border-[1px] border-orange-300 dark:border-white/50 rounded-full"
        style={{ rotateX: 0, rotateY: 80 }}
        animate={{ rotateZ: 360 }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
      >
          <div className="absolute right-0 top-1/2 w-1.5 h-1.5 bg-yellow-400 rounded-full blur-[1px] translate-x-1/2 -translate-y-1/2 shadow-[0_0_8px_rgba(250,204,21,0.8)]"></div>
      </motion.div>
  </div>
);

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
    // Background adjusted to Soft Orange in Light Mode
    <div className="h-[100dvh] w-full flex flex-col relative overflow-hidden bg-[#FFF8F0] dark:bg-gray-900 font-sans transition-colors duration-500">
      
      {/* --- BACKGROUND GRADIENT & PATTERN --- */}
      <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-[#FFF8F0] dark:bg-gray-900"></div>
          {/* Gradient: Warm orange glow */}
          <div className="absolute inset-0 bg-gradient-to-b md:bg-gradient-to-l from-orange-100/90 via-orange-50/50 to-transparent dark:from-orange-900/20 dark:via-orange-800/10 dark:to-transparent"></div>
          
          <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.05]" 
               style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
          </div>
      </div>

      {/* --- REALISTIC INDUSTRIAL SKETCH (Fixed Bottom) --- */}
      <div className="absolute bottom-0 left-0 w-full h-[120px] md:h-[180px] z-0 opacity-100">
          <UltraRealisticSketch />
      </div>

      {/* --- MAIN CONTENT CONTAINER --- */}
      <div className="relative z-10 flex flex-col md:flex-row h-full w-full">
          
          {/* --- LEFT SIDE (Visuals) --- */}
          <div className="flex-1 md:w-[55%] flex flex-col items-center justify-center p-4 pb-0 md:p-0 md:pb-20 relative transition-all duration-500">
              
              {/* Text: Reordered & Bold Persian Title */}
              <div className="text-center z-20 mt-2 md:mt-6 transform-gpu">
                  <h1 className="text-3xl md:text-5xl font-black tracking-[0.2em] text-gray-900 dark:text-white mb-1 md:mb-2 drop-shadow-md">MORVARID</h1>
                  <div className="h-1 md:h-1.5 w-16 md:w-24 bg-gradient-to-r from-orange-400 to-yellow-400 mx-auto rounded-full mb-3 md:mb-5 shadow-sm"></div>
                  
                  {/* Persian Title Moved Up & Bolded */}
                  <h1 className="text-4xl md:text-6xl font-black text-gray-800 dark:text-white mb-2 tracking-tight drop-shadow-sm scale-y-110">
                      مـرواریــد
                  </h1>
                  
                  <h2 className="text-sm md:text-lg font-bold text-gray-500 dark:text-gray-300 tracking-wide hidden md:block mt-2 opacity-80">
                      سیستم هوشمند پایش زنجیره آمار، تولید و توزیع
                  </h2>
              </div>

              {/* THE EGG */}
              <div className="relative w-[180px] h-[180px] md:w-[340px] md:h-[340px] flex items-center justify-center my-4 transform-gpu">
                  
                  {/* --- HALOS --- */}
                  <div className="absolute inset-[-20px] md:inset-[-40px] rounded-full bg-orange-400/20 blur-3xl animate-pulse" style={{ animationDuration: '8s' }}></div>
                  <div className="absolute inset-[-10px] md:inset-[-20px] rounded-full bg-yellow-400/20 blur-2xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }}></div>
                  <div className="absolute inset-0 rounded-full bg-white/30 dark:bg-white/10 blur-xl"></div>

                  {/* PEARL/EGG SHELL */}
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1, y: [0, -8, 0] }}
                    transition={{ 
                        scale: { duration: 1.5, ease: "easeInOut" },
                        y: { duration: 8, repeat: Infinity, ease: "easeInOut" } // Slow float
                    }}
                    className="relative w-32 h-40 md:w-60 md:h-72 bg-gradient-to-br from-white via-gray-100 to-gray-300 dark:from-gray-200 dark:via-gray-400 dark:to-gray-600 rounded-[50%/60%_60%_40%_40%] shadow-[inset_-10px_-10px_30px_rgba(0,0,0,0.1),0_20px_50px_rgba(0,0,0,0.2)] z-20 flex items-center justify-center overflow-hidden border border-white/90"
                  >
                      {/* Lustre Highlight */}
                      <div className="absolute top-[10%] left-[15%] w-[40%] h-[25%] bg-white rounded-[50%] blur-md md:blur-xl opacity-90"></div>
                      
                      {/* Orbital System inside */}
                      <OrbitalSystem />
                  </motion.div>
              </div>

              {/* Date & Time - Soft Orange Box */}
              <div className="hidden md:flex items-center justify-center gap-8 z-20 bg-orange-100/60 dark:bg-black/40 px-10 py-5 rounded-2xl backdrop-blur-md border border-orange-200 dark:border-white/10 shadow-lg transform-gpu hover:scale-105 transition-transform duration-500 hover:shadow-2xl">
                  <div className="text-4xl font-black text-gray-800 dark:text-white tabular-nums tracking-tight drop-shadow-sm">
                      {currentTime}
                  </div>
                  <div className="w-[2px] h-10 bg-orange-300 dark:bg-gray-600 rounded-full"></div>
                  <div className="text-4xl font-black text-gray-800 dark:text-white tabular-nums tracking-tight drop-shadow-sm">
                      {currentDate}
                  </div>
              </div>
          </div>


          {/* --- RIGHT SIDE: FORM --- */}
          <div className="flex-1 md:w-[45%] flex flex-col items-center justify-start md:justify-center p-6 pt-0 md:p-12 relative z-30">
              
              <div className="w-full max-w-[380px] md:max-w-[420px] relative">
                  {/* Pulse Outbox */}
                  <div className="absolute inset-0 bg-amber-400/20 rounded-[40px] blur-2xl animate-pulse -z-10 transform-gpu"></div>
                  
                  <div className="backdrop-blur-xl bg-white/80 dark:bg-black/60 p-6 md:p-10 rounded-[32px] md:rounded-[36px] border-2 border-white/60 dark:border-white/10 shadow-2xl drop-shadow-2xl animate-in slide-in-from-bottom-10 duration-700">
                      
                      <div className="mb-6 md:mb-8 text-center">
                          <div className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-yellow-500 text-white mb-3 md:mb-4 shadow-lg shadow-orange-500/40 transform rotate-3">
                              <Icons.User className="w-6 h-6 md:w-8 md:h-8" />
                          </div>
                          <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">ورود به حساب کاربری</h3>
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
                                      className="block w-full h-12 md:h-14 pr-12 pl-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-base placeholder-gray-400 focus:border-orange-500 focus:bg-white dark:focus:bg-black/50 focus:outline-none transition-all font-bold text-left shadow-sm group-hover:border-gray-300 dark:group-hover:border-gray-600"
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
                                      className="block w-full h-12 md:h-14 pr-12 pl-12 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-base tracking-widest placeholder-gray-400 focus:border-orange-500 focus:bg-white dark:focus:bg-black/50 focus:outline-none transition-all font-mono text-left shadow-sm group-hover:border-gray-300 dark:group-hover:border-gray-600"
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
                                      <span>ورود امن</span>
                                      <Icons.ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-300" />
                                  </>
                              )}
                          </button>
                      </form>
                  </div>

                  {/* Theme Toggle & Version Below Card */}
                  <div className="mt-4 md:mt-6 flex items-center justify-between px-2">
                      <div className="flex items-center gap-3 bg-white/50 dark:bg-black/30 px-4 py-2 rounded-full backdrop-blur-md border border-white/40 dark:border-white/10 shadow-sm">
                          <span className="text-xs font-bold text-gray-500 dark:text-gray-400">حالت شب</span>
                          <ThemeToggle />
                      </div>
                      <div className="text-right opacity-60">
                          <p className="text-[10px] text-gray-400 font-medium">Morvarid Cloud • v{APP_VERSION}</p>
                      </div>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default LoginPage;