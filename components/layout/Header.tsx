
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useLogStore } from '../../store/logStore';
import { Icons } from '../common/Icons';
import ThemeToggle from '../common/ThemeToggle';
import { UserRole } from '../../types';
import { useThemeStore } from '../../store/themeStore';
import { THEMES } from '../../constants';
import { useConfirm } from '../../hooks/useConfirm';

interface HeaderProps {
  onMenuClick: () => void;
  title: string;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, title }) => {
  const { user, logout } = useAuthStore();
  const { logAction } = useLogStore();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useThemeStore(state => state.theme);
  const { confirm } = useConfirm();

  const role = user?.role || UserRole.ADMIN;
  const themeColors = THEMES[theme][role];

  // Logic to navigate back to the role-specific main dashboard
  const handleGoToDashboard = () => {
    if (!user) {
        navigate('/login');
        return;
    }

    logAction('INFO', 'UI', `User requested dashboard navigation from ${location.pathname}`);

    switch (user.role) {
        case UserRole.ADMIN: navigate('/admin'); break;
        case UserRole.REGISTRATION: navigate('/registration'); break;
        case UserRole.SALES: navigate('/sales'); break;
        default: navigate('/login');
    }
  };

  const handleLogout = async () => {
      const confirmed = await confirm({
          title: 'خروج از حساب',
          message: 'آیا می‌خواهید از حساب کاربری خود خارج شوید؟',
          confirmText: 'خروج',
          cancelText: 'انصراف',
          type: 'danger' 
      });
      
      if (confirmed) {
          logAction('INFO', 'AUTH', `Manual logout via header`);
          await logout();
          navigate('/login');
      }
  };

  // Check if current path is already a primary dashboard
  const dashboardPaths = ['/admin', '/registration', '/sales'];
  const isAtDashboard = dashboardPaths.includes(location.pathname);
  // Show button only if we are in sub-pages and NOT on login/splash
  const shouldShowHome = !['/', '/login'].includes(location.pathname) && !isAtDashboard;

  return (
    <header className={`${themeColors.surface} ${themeColors.text} shadow-md sticky top-0 z-30 transition-colors duration-300 border-b-2 border-gray-100 dark:border-gray-800`}>
      <div className="container mx-auto px-4 py-3 flex justify-between items-center max-w-full">
        
        <div className="flex items-center gap-1.5 md:gap-3">
          {/* Hamburger Menu Toggle */}
          <button 
            onClick={() => {
                logAction('INFO', 'UI', 'Hamburger menu clicked');
                onMenuClick();
            }} 
            className="p-2.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors active:scale-95"
            aria-label="Menu"
          >
            <Icons.Menu className="w-8 h-8" />
          </button>

          {/* Unified Home Button - Next to Hamburger, visible on all devices */}
          {shouldShowHome && (
              <button 
                onClick={handleGoToDashboard} 
                className={`p-2.5 ${themeColors.primary} text-white hover:opacity-90 shadow-sm transition-all active:scale-90 flex items-center justify-center`}
                title="بازگشت به داشبورد"
              >
                  <Icons.Home className="w-7 h-7" />
              </button>
          )}

          <h1 className="text-lg md:text-2xl font-black tracking-tighter truncate max-w-[140px] sm:max-w-none border-r-2 border-gray-300 dark:border-gray-600 pr-3 mr-1">
            {title}
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Profile Name (Desktop Only) */}
          <div className="hidden sm:flex items-center gap-2 bg-gray-100 dark:bg-gray-700/50 px-3 py-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <div className={`p-1 ${themeColors.primary} text-white`}>
                <Icons.User className="w-4 h-4" />
            </div>
            <span className="font-black text-sm">{user?.fullName}</span>
          </div>

          {/* Quick Logout (Mobile Only) */}
          <button 
            onClick={handleLogout}
            className="sm:hidden p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors active:scale-95"
            title="خروج سریع"
          >
             <Icons.LogOut className="w-6 h-6" />
          </button>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

export default Header;
