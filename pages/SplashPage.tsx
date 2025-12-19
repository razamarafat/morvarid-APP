
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import Logo from '../components/common/Logo';

const SplashPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (user) {
        navigate('/home');
      } else {
        navigate('/login');
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [navigate, user]);

  const logoVariants = {
    hidden: { opacity: 0, scale: 0.5 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 20,
        duration: 1.5
      }
    }
  };

  const textVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        delay: 0.5
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-center px-4">
      <motion.div
        variants={logoVariants}
        initial="hidden"
        animate="visible"
        className="relative mb-8"
      >
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
            filter: ["brightness(1)", "brightness(1.1)", "brightness(1)"],
          }}
          transition={{
            duration: 3,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        >
            <Logo className="w-40 h-40 md:w-56 md:h-56 drop-shadow-2xl" />
        </motion.div>
        <div className="absolute inset-0 bg-violet-500/20 blur-3xl rounded-full -z-10 animate-pulse"></div>
      </motion.div>

      <motion.h1
        variants={textVariants}
        initial="hidden"
        animate="visible"
        className="text-xl md:text-3xl font-black text-gray-800 dark:text-gray-100 tracking-tight leading-relaxed"
      >
        به سامانه مدیریت یکپارچه آمار مروارید خوش آمدید
      </motion.h1>
    </div>
  );
};

export default SplashPage;
