
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import Logo from '../components/common/Logo';

const SplashPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuthStore();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isLoading && minTimeElapsed) {
      if (user) {
        navigate('/home', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    }
  }, [isLoading, minTimeElapsed, user, navigate]);

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-white dark:bg-[#0f172a] overflow-hidden selection:bg-metro-blue selection:text-white">
      
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[60vh] h-[60vh] bg-blue-500/10 dark:bg-blue-600/20 rounded-full blur-[120px] animate-pulse mix-blend-multiply dark:mix-blend-screen" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60vh] h-[60vh] bg-purple-500/10 dark:bg-purple-600/20 rounded-full blur-[120px] animate-pulse delay-1000 mix-blend-multiply dark:mix-blend-screen" />

      {/* Main Container */}
      <div className="z-10 flex flex-col items-center justify-center w-full max-w-md px-6">
        
        {/* Logo Section */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0, rotate: -10 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ duration: 1, type: "spring", bounce: 0.5 }}
          className="mb-10 relative"
        >
          <div className="relative z-10 p-8 bg-white/80 dark:bg-white/5 backdrop-blur-2xl rounded-[3rem] shadow-2xl border border-white/40 dark:border-white/10 ring-1 ring-black/5 dark:ring-white/10">
             <Logo className="w-24 h-24 md:w-32 md:h-32 drop-shadow-md" />
          </div>
          {/* Ambient Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-metro-blue/40 blur-3xl rounded-full -z-10" />
        </motion.div>

        {/* Typography */}
        <div className="text-center space-y-2">
            <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
                className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white font-sans tracking-[0.2em] ml-2"
            >
                MORVARID
            </motion.h1>

            <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "100%" }}
                transition={{ duration: 1, delay: 0.6 }}
                className="h-[1px] bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent my-4"
            />

            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.8 }}
                transition={{ duration: 0.8, delay: 0.8 }}
                className="text-base md:text-lg font-bold text-gray-500 dark:text-gray-400 font-sans tracking-wide"
            >
                سامانه مدیریت یکپارچه
            </motion.p>
        </div>

        {/* Loading Indicator */}
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="mt-16 flex items-center gap-3"
        >
            <div className="flex space-x-2 space-x-reverse">
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full bg-metro-blue dark:bg-blue-400"
                        animate={{
                            y: [-5, 5, -5],
                            opacity: [0.5, 1, 0.5]
                        }}
                        transition={{
                            duration: 1.2,
                            repeat: Infinity,
                            delay: i * 0.15,
                            ease: "easeInOut"
                        }}
                    />
                ))}
            </div>
        </motion.div>
        
        {/* Footer Text */}
         <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ delay: 1.5 }}
            className="absolute bottom-8 text-[10px] text-gray-400 font-mono tracking-widest uppercase"
         >
            Secure Enterprise System
         </motion.div>

      </div>
    </div>
  );
};

export default SplashPage;
