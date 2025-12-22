
import React, { useEffect } from 'react';
import { useThemeStore } from '../../store/themeStore';
import { Icons } from './Icons';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore();

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none transition-transform active:scale-95"
      aria-label="تغییر تم"
      type="button"
    >
      {theme === 'light' ? <Icons.Moon className="w-6 h-6" /> : <Icons.Sun className="w-6 h-6" />}
    </button>
  );
};

export default ThemeToggle;
