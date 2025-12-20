
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

  const handleHomeClick = () => {
    switch (role) {
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
          type: 'warning'
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
    <header className={`${themeColors.surface} ${themeColors.text} shadow-sm sticky top-0 z-30 transition-colors duration-300`}>
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          {/* Menu Button - Larger Touch Target */}
          <button 
            onClick={onMenuClick} 
            className="lg:hidden p-3 -ml-2 rounded-2xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors active:scale-95"
            aria-label="Menu"
          >
            <Icons.Menu className="w-7 h-7" />
          </button>
          
          {/* Back Button */}
          {!hideBack && (
              <button 
                onClick={handleBack} 
                className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors mr-1"
                title="بازگشت"
              >
                  <Icons.ChevronRight className="w-6 h-6" />
              </button>
          )}

          <h1 
            onClick={handleHomeClick}
            className="text-lg md:text-xl font-black tracking-tight cursor-pointer hover:opacity-80 transition-opacity select-none truncate max-w-[150px] sm:max-w-none"
          >
            {title}
          </h1>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3">
          <div 
            onClick={handleHomeClick}
            className="hidden sm:flex items-center gap-2 cursor-pointer bg-gray-100 dark:bg-gray-700/50 px-3 py-1.5 rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <div className={`p-1 rounded-full ${themeColors.primary} text-white`}>
                <Icons.User className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm">{user?.fullName}</span>
          </div>

          {/* Mobile Logout Button - Direct Access */}
          <button 
            onClick={handleLogout}
            className="sm:hidden p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors active:scale-95"
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
