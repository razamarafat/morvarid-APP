
import React from 'react';
import { useThemeStore } from '../../store/themeStore';
import { Icons } from './Icons';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? <Icons.Moon className="w-6 h-6" /> : <Icons.Sun className="w-6 h-6" />}
    </button>
  );
};

export default ThemeToggle;
