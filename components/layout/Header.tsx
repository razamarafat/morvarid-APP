
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

  return (
    <header className={`${themeColors.surface} ${themeColors.text} shadow-md sticky top-0 z-30 transition-colors duration-300 border-b-2 border-gray-100 dark:border-gray-800`}>
      <div className="container mx-auto px-4 py-3 flex justify-between items-center max-w-full">
        
        <div className="flex items-center gap-1.5 md:gap-3">
          <button 
            onClick={onMenuClick} 
            className="p-2.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            aria-label="Menu"
          >
            <Icons.Menu className="w-8 h-8" />
          </button>

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
          <div className="hidden sm:flex items-center gap-2 bg-gray-100 dark:bg-gray-700/50 px-3 py-1.5 rounded-none">
            <div className={`p-1 ${themeColors.primary} text-white`}>
                <Icons.User className="w-4 h-4" />
            </div>
            <span className="font-black text-sm">{user?.fullName}</span>
          </div>

          <button onClick={handleLogout} className="sm:hidden p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
             <Icons.LogOut className="w-6 h-6" />
          </button>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

export default Header;
