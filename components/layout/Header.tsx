
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

  const handleHomeClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent any default form submission if inside a form
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
          message: 'آیا می‌خواهید از حساب کاربری خود خارج شوید؟',
          confirmText: 'خروج',
          cancelText: 'انصراف',
          type: 'danger' 
      });
      
      if (confirmed) {
          await logout();
          navigate('/login');
      }
  };

  const handleBack = async () => {
      navigate(-1);
  };

  const rootPaths = ['/admin', '/registration', '/sales'];
  const isRootPath = rootPaths.includes(location.pathname);
  const hideBack = ['/', '/login'].includes(location.pathname) || isRootPath;

  return (
    <header className={`${themeColors.surface} ${themeColors.text} shadow-md sticky top-0 z-30 transition-colors duration-300 border-b-2 border-gray-100 dark:border-gray-800`}>
      <div className="container mx-auto px-4 py-3 flex justify-between items-center max-w-full">
        
        {/* Right Side: Menu + Dashboard Button + Title */}
        <div className="flex items-center gap-4">
          <button 
            onClick={onMenuClick} 
            className="p-2.5 -ml-2 hover:bg-black/5 dark:hover:bg-white/10 transition-colors active:scale-95 rounded-full"
            aria-label="Menu"
          >
            <Icons.Menu className="w-8 h-8" />
          </button>

          {/* DASHBOARD BUTTON - Moved Here */}
          <button 
            onClick={handleHomeClick}
            type="button"
            className={`hidden md:flex items-center gap-2 px-4 py-2 ${themeColors.primary} text-white hover:opacity-90 transition-opacity shadow-sm rounded-lg active:scale-95`}
          >
             <Icons.Home className="w-4 h-4" />
             <span className="font-bold text-sm">سیستم مدیریت مروارید</span>
          </button>
          
          {!hideBack && (
              <button 
                onClick={handleBack} 
                className="p-2 hover:bg-black/5 dark:hover:bg-white/10 transition-colors mr-1 rounded-full"
                title="بازگشت"
              >
                  <Icons.ChevronRight className="w-6 h-6" />
              </button>
          )}

          {/* Page Title */}
          <h1 className="text-lg md:text-2xl font-black tracking-tighter truncate max-w-[150px] sm:max-w-none border-r-2 border-gray-300 dark:border-gray-600 pr-4 mr-2">
            {title}
          </h1>
        </div>
        
        {/* Left Side: User Info + Logout + Theme */}
        <div className="flex items-center gap-3">
          
          <div 
            className="hidden sm:flex items-center gap-2 bg-gray-100 dark:bg-gray-700/50 px-3 py-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors rounded-full"
          >
            <div className={`p-1 ${themeColors.primary} text-white rounded-full`}>
                <Icons.User className="w-4 h-4" />
            </div>
            <span className="font-black text-sm">{user?.fullName}</span>
          </div>

          <button 
            onClick={handleLogout}
            className="sm:hidden p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors active:scale-95 rounded-full"
            title="خروج"
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
