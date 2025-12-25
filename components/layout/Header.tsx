
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Icons } from '../common/Icons';
import ThemeToggle from '../common/ThemeToggle';
import { UserRole } from '../../types';
import { useThemeStore } from '../../store/themeStore';
import { THEMES } from '../../constants';
import { useConfirm } from '../../hooks/useConfirm';
import { usePwaStore } from '../../store/pwaStore';
import OnlineStatusBadge from '../common/OnlineStatusBadge';

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
  const { deferredPrompt, setDeferredPrompt, isInstalled } = usePwaStore(); 

  const role = user?.role || UserRole.ADMIN;
  const themeColors = THEMES[theme][role];

  const handleNavClick = (view: string) => {
      const event = new CustomEvent('dashboard-navigate', { detail: { view } });
      window.dispatchEvent(event);
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

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const getDesktopNavItems = () => {
      const btnClass = "px-4 py-2 rounded-xl text-sm font-bold transition-all hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2";
      
      switch(role) {
          case UserRole.REGISTRATION:
              return (
                  <>
                    <button onClick={() => handleNavClick('dashboard')} className={btnClass}><Icons.Home className="w-4 h-4"/> داشبورد</button>
                    <button onClick={() => handleNavClick('stats')} className={btnClass}><Icons.BarChart className="w-4 h-4"/> ثبت آمار</button>
                    <button onClick={() => handleNavClick('invoice')} className={btnClass}><Icons.FileText className="w-4 h-4"/> ثبت حواله</button>
                    <button onClick={() => handleNavClick('recent')} className={btnClass}><Icons.Refresh className="w-4 h-4"/> سوابق</button>
                  </>
              );
          case UserRole.SALES:
              return (
                  <>
                    <button onClick={() => handleNavClick('dashboard')} className={btnClass}><Icons.Home className="w-4 h-4"/> داشبورد</button>
                    <button onClick={() => handleNavClick('farm-stats')} className={btnClass}><Icons.BarChart className="w-4 h-4"/> آمار فارم</button>
                    <button onClick={() => handleNavClick('invoices')} className={btnClass}><Icons.FileText className="w-4 h-4"/> لیست حواله</button>
                    <button onClick={() => handleNavClick('analytics')} className={btnClass}><Icons.BarChart className="w-4 h-4"/> نمودارها</button>
                    <button onClick={() => handleNavClick('reports')} className={btnClass}><Icons.FileText className="w-4 h-4"/> گزارشات</button>
                  </>
              );
          case UserRole.ADMIN:
          default:
              return (
                  <>
                    <button onClick={() => handleNavClick('dashboard')} className={btnClass}><Icons.Home className="w-4 h-4"/> داشبورد</button>
                    <button onClick={() => handleNavClick('farms')} className={btnClass}><Icons.Home className="w-4 h-4"/> فارم‌ها</button>
                    <button onClick={() => handleNavClick('users')} className={btnClass}><Icons.Users className="w-4 h-4"/> کاربران</button>
                    <button onClick={() => handleNavClick('reports')} className={btnClass}><Icons.FileText className="w-4 h-4"/> گزارشات</button>
                    <button onClick={() => handleNavClick('testing')} className={btnClass}><Icons.TestTube className="w-4 h-4"/> سنجش فنی</button>
                  </>
              );
      }
  };

  return (
    <header className={`${themeColors.surface} ${themeColors.text} sticky top-0 z-30 transition-colors duration-300 border-b border-gray-200 dark:border-gray-800 shadow-sm`}>
      <div className="container mx-auto px-4 h-16 flex justify-between items-center max-w-full">
        
        <div className="flex items-center gap-2 md:gap-4 flex-1 overflow-hidden">
          <button 
            onClick={onMenuClick} 
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors active:scale-95 lg:hidden shrink-0"
            aria-label="Menu"
          >
            <Icons.Menu className="w-6 h-6" />
          </button>

          {/* Fixed: Allow text wrap/shrink on mobile */}
          <h1 className="text-sm sm:text-lg md:text-2xl font-bold tracking-tight ml-2 sm:ml-4 leading-tight line-clamp-2">
            {title}
          </h1>

          {/* DESKTOP NAVIGATION LINKS */}
          <div className="hidden lg:flex items-center gap-1 mr-4 border-r pr-4 border-gray-300 dark:border-gray-600">
              {getDesktopNavItems()}
          </div>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          
          <OnlineStatusBadge />

          {/* PWA INSTALL BUTTON (Desktop Only) */}
          {deferredPrompt && !isInstalled && (
              <button 
                onClick={handleInstallClick}
                className="hidden lg:flex items-center gap-2 bg-metro-blue hover:bg-metro-cobalt text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-all shadow-md active:scale-95 animate-pulse"
              >
                  <Icons.Download className="w-4 h-4" />
                  <span>نصب برنامه</span>
              </button>
          )}

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
