
import { useEffect, useRef } from 'react';
import { useThemeStore } from '../store/themeStore';

export const useAutoTheme = () => {
  const setTheme = useThemeStore((state) => state.setTheme);
  const mounted = useRef(false);

  useEffect(() => {
    const handleAutoTheme = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();

      // Definition of Dark Mode Hours: 18:00 (6 PM) to 06:00 (6 AM)
      const isNightTime = hours >= 18 || hours < 6;
      const targetTheme = isNightTime ? 'dark' : 'light';

      // 1. Initial Load Check (Force time-based theme on startup/refresh)
      // This ensures that every time the user opens the app, it defaults to the correct time-based theme.
      if (!mounted.current) {
        setTheme(targetTheme);
        mounted.current = true;
        return;
      }

      // 2. Real-time transition check
      // Only switch exactly when the time condition changes (at 18:00:00 or 06:00:00)
      // This allows the user to manually toggle the theme in between these times without being immediately overridden.
      
      // Switch to Dark at 18:00:00
      if (hours === 18 && minutes === 0 && seconds < 2) {
         setTheme('dark');
      } 
      // Switch to Light at 06:00:00
      else if (hours === 6 && minutes === 0 && seconds < 2) {
         setTheme('light');
      }
    };

    // Run logic immediately on mount
    handleAutoTheme();

    // Check every second to catch the exact transition time
    const interval = setInterval(handleAutoTheme, 1000);

    return () => clearInterval(interval);
  }, [setTheme]);
};
