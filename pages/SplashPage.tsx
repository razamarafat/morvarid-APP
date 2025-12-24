
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
    }, 2200);
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

  const logoVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.6,
        ease: "easeOut" as const
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F3F3F3] dark:bg-[#1D1D1D] text-center px-4 gpu-accelerated">
      <motion.div
        variants={logoVariants}
        initial="hidden"
        animate="visible"
        className="relative mb-12"
      >
        <div className="relative z-10 drop-shadow-2xl">
            <Logo className="w-48 h-48 md:w-64 md:h-64" />
        </div>
        <div className="absolute inset-0 bg-metro-blue/10 blur-3xl rounded-full -z-0 animate-pulse"></div>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="text-xl md:text-3xl font-black text-gray-800 dark:text-gray-100 tracking-tight leading-relaxed max-w-lg"
      >
        سامانه مدیریت یکپارچه آمار مروارید
      </motion.h1>
      
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-12 w-full max-w-[280px]"
      >
        <div className="h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden relative">
            <motion.div 
                className="absolute top-0 bottom-0 left-0 bg-metro-blue rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2, ease: "easeInOut" }}
            />
        </div>
        <p className="text-[10px] md:text-xs text-gray-400 mt-4 font-bold uppercase tracking-widest opacity-60">
            Initialising System Core...
        </p>
      </motion.div>
    </div>
  );
};

export default SplashPage;
