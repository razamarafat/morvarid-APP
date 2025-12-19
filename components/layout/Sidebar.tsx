
import React from 'react';
import { useAuthStore } from '../../store/authStore';
import { Icons } from '../common/Icons';
import { APP_VERSION, THEMES } from '../../constants';
import { UserRole } from '../../types';
import { useNavigate } from 'react-router-dom';
import { useConfirm } from '../../hooks/useConfirm';
import Logo from '../common/Logo';
import { useThemeStore } from '../../store/themeStore';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
}

const NavLink: React.FC<{ icon: React.ElementType, label: string, onClick: () => void }> = ({ icon: Icon, label, onClick }) => (
  <button onClick={onClick} className="w-full text-right flex items-center p-4 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all duration-200 group mb-1">
    <Icon className="w-5 h-5 ml-2 text-gray-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors" />
    <span className="font-bold text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">{label}</span>
  </button>
);

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onNavigate }) => {
  const { user, logout } = useAuthStore();
  const { theme } = useThemeStore();
  const navigate = useNavigate();
  const { confirm } = useConfirm();

  const role = user?.role || UserRole.ADMIN;
  // Use surface color from constants to ensure consistency with Header and prevent "dark in light mode" issues
  const themeColors = THEMES[theme][role];

  const handleLogout = async () => {
    const confirmed = await confirm({
        title: 'خروج از حساب',
        message: 'آیا می‌خواهید از حساب کاربری خود خارج شوید؟',
        confirmText: 'خروج',
        cancelText: 'انصراف',
        type: 'warning'
    });
    
    if (confirmed) {
        logout();
        navigate('/login');
    }
  };
  
  const handleNavigation = (view: string) => {
    onNavigate(view);
    onClose();
  }

  const handleHome = () => {
      handleNavigation('dashboard');
  };

  const adminLinks = [
    { icon: Icons.Home, label: 'مدیریت فارم‌ها', view: 'farms' },
    { icon: Icons.Users, label: 'مدیریت کاربران', view: 'users' },
    { icon: Icons.FileText, label: 'گزارشات', view: 'reports' },
    { icon: Icons.HardDrive, label: 'پشتیبان‌گیری', view: 'backup' },
    { icon: Icons.AlertCircle, label: 'لاگ‌های سیستم', view: 'logs' },
    { icon: Icons.TestTube, label: 'سنجش ویژگی‌ها', view: 'testing' },
  ];

  const registrationLinks = [
    { icon: Icons.BarChart, label: 'ثبت آمار', view: 'stats' },
    { icon: Icons.FileText, label: 'ثبت حواله فروش', view: 'invoice' },
    { icon: Icons.Refresh, label: 'سوابق اخیر', view: 'recent' },
  ];

  const salesLinks = [
    { icon: Icons.BarChart, label: 'آمار فارم‌ها', view: 'farm-stats' },
    { icon: Icons.FileText, label: 'حواله‌های فروش', view: 'invoices' },
    { icon: Icons.User, label: 'رانندگان', view: 'drivers' },
    { icon: Icons.FileText, label: 'گزارشات جامع', view: 'reports' },
  ];

  const getNavLinks = () => {
    switch (user?.role) {
      case UserRole.ADMIN:
        return adminLinks.map(link => <NavLink key={link.view} {...link} onClick={() => handleNavigation(link.view)} />);
      case UserRole.REGISTRATION:
        return registrationLinks.map(link => <NavLink key={link.view} {...link} onClick={() => handleNavigation(link.view)} />);
      case UserRole.SALES:
        return salesLinks.map(link => <NavLink key={link.view} {...link} onClick={() => handleNavigation(link.view)} />);
      default:
        return null;
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity lg:hidden ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed top-0 right-0 h-full w-72 ${themeColors.surface} text-gray-800 dark:text-gray-200 shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } lg:relative lg:translate-x-0 lg:w-72 flex flex-col border-l border-gray-100 dark:border-gray-700`}
      >
        <div 
            className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center gap-4 cursor-pointer"
            onClick={handleHome}
        >
            <div className="w-12 h-12 bg-orange-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center p-1">
                <Logo className="w-full h-full object-contain" />
            </div>
            <div>
                <h2 className="text-xl font-black text-gray-800 dark:text-white">مروارید</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">مدیریت یکپارچه آمار</p>
            </div>
        </div>
        
        <nav className="flex-1 p-4 overflow-y-auto">
            {getNavLinks()}
        </nav>
        
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
            <NavLink icon={Icons.LogOut} label="خروج امن" onClick={handleLogout} />
            <div className="text-center text-xs text-gray-400 mt-2 font-mono opacity-60">
                v{APP_VERSION}
            </div>
        </div>
      </aside>
    </>
  );
};
export default Sidebar;
