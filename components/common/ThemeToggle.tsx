
import React, { useEffect } from 'react';
import { useThemeStore } from '../../store/themeStore';
import { useLogStore } from '../../store/logStore';
import { useAuthStore } from '../../store/authStore';
import { Icons } from './Icons';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore();
  const { addLog } = useLogStore();
  const { user } = useAuthStore();

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  const handleToggle = () => {
    const nextTheme = theme === 'light' ? 'تاریک' : 'روشن';
    toggleTheme();
    
    addLog(
      'info', 
      'frontend', 
      `کاربر تم سیستم را به حالت [${nextTheme}] تغییر داد.`, 
      user?.id
    );
  };

  return (
    <button
      onClick={handleToggle}
      className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none transition-transform active:scale-95"
      aria-label="تغییر تم"
      type="button"
    >
      {theme === 'light' ? <Icons.Moon className="w-6 h-6" /> : <Icons.Sun className="w-6 h-6" />}
    </button>
  );
};

export default ThemeToggle;
