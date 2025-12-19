
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Icons } from '../common/Icons';
import ThemeToggle from '../common/ThemeToggle';
import { UserRole } from '../../types';
import { useThemeStore } from '../../store/themeStore';
import { THEMES } from '../../constants';

interface HeaderProps {
  onMenuClick: () => void;
  title: string;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, title }) => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useThemeStore(state => state.theme);
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

  // Logic: Show back button if we are NOT on the main dashboard routes
  const mainRoutes = ['/admin', '/registration', '/sales', '/login', '/'];
  const showBack = !mainRoutes.includes(location.pathname);

  return (
    <header className={`${themeColors.surface} ${themeColors.text} shadow-sm sticky top-0 z-40 transition-colors duration-300`}>
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={onMenuClick} className="lg:hidden p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
            <Icons.Menu className="w-6 h-6" />
          </button>
          
          {/* Global Back Button */}
          <button 
            onClick={() => navigate(-1)} 
            className={`p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors mr-1 ${!showBack ? 'hidden' : ''}`}
            title="بازگشت"
          >
              <Icons.ChevronRight className="w-6 h-6" />
          </button>

          <h1 
            onClick={handleHomeClick}
            className="text-xl font-black tracking-tight cursor-pointer hover:opacity-80 transition-opacity select-none"
          >
            {title}
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          <div 
            onClick={handleHomeClick}
            className="hidden sm:flex items-center gap-2 cursor-pointer bg-gray-100 dark:bg-gray-700/50 px-3 py-1.5 rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <div className={`p-1 rounded-full ${themeColors.primary} text-white`}>
                <Icons.User className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm">{user?.fullName}</span>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

export default Header;
