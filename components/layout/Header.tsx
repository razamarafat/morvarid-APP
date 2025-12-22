
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
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
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useThemeStore(state => state.theme);
  const { confirm } = useConfirm();

  const role = user?.role || UserRole.ADMIN;
  const themeColors = THEMES[theme][role];

  const handleGoToDashboard = () => {
    if (!user) {
        navigate('/login');
        return;
    }

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
          message: 'آیا می‌خواهید خارج شوید؟',
          confirmText: 'خروج',
          cancelText: 'انصراف',
          type: 'danger' 
      });
      
      if (confirmed) {
          await logout();
          navigate('/login');
      }
  };

  const dashboardPaths = ['/admin', '/registration', '/sales'];
  const isAtDashboard = dashboardPaths.includes(location.pathname);
  const shouldShowHome = !['/', '/login'].includes(location.pathname) && !isAtDashboard;

  // M3 Top App Bar: Minimal elevation, surface color
  return (
    <header className={`${themeColors.surface} ${themeColors.text} sticky top-0 z-30 transition-colors duration-300 border-b border-gray-200 dark:border-gray-800`}>
      <div className="container mx-auto px-4 h-16 flex justify-between items-center max-w-full">
        
        <div className="flex items-center gap-2 md:gap-4">
          <button 
            onClick={onMenuClick} 
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors active:scale-95"
            aria-label="Menu"
          >
            <Icons.Menu className="w-6 h-6" />
          </button>

          {shouldShowHome && (
              <button 
                onClick={handleGoToDashboard} 
                className={`p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors active:scale-95 text-${themeColors.primaryText}`}
                title="بازگشت به داشبورد"
              >
                  <Icons.Home className="w-6 h-6" />
              </button>
          )}

          <h1 className="text-lg md:text-2xl font-bold tracking-tight truncate max-w-[180px] sm:max-w-none">
            {title}
          </h1>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-3 bg-gray-100 dark:bg-gray-800 px-4 py-1.5 rounded-full border border-gray-200 dark:border-gray-700">
            <div className={`p-1 rounded-full ${themeColors.primary} text-white`}>
                <Icons.User className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm">{user?.fullName}</span>
          </div>

          <button onClick={handleLogout} className="sm:hidden p-2 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
             <Icons.LogOut className="w-6 h-6" />
          </button>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

export default Header;
