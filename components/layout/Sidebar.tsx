
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
    <span className="font-bold inherit group-hover:opacity-100 transition-opacity">{label}</span>
  </button>
);

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onNavigate }) => {
  const { user, logout } = useAuthStore();
  const { theme } = useThemeStore();
  const navigate = useNavigate();
  const { confirm } = useConfirm();

  const role = user?.role || UserRole.ADMIN;
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
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] transition-opacity lg:hidden ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed top-0 right-0 h-full w-80 ${themeColors.surface} ${themeColors.text} shadow-2xl z-[70] transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } lg:relative lg:translate-x-0 lg:w-72 flex flex-col border-l border-gray-100 dark:border-gray-700`}
      >
        <div 
            className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3 cursor-pointer"
            onClick={handleHome}
        >
            <div className="w-12 h-12 bg-gray-50 dark:bg-gray-700 rounded-2xl flex items-center justify-center p-1 shadow-sm shrink-0 border border-gray-100 dark:border-gray-600">
                <Logo className="w-full h-full object-contain" />
            </div>
            <div className="overflow-hidden">
                <h2 className="text-sm font-black leading-tight">شرکت صنایع غذایی و تولیدی مروارید</h2>
                <p className="text-[10px] opacity-60 font-bold mt-0.5">سامانه جامع پایش فارم ها</p>
            </div>
        </div>
        
        <nav className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-1">
            {getNavLinks()}
        </nav>
        
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 pb-8 lg:pb-4">
            <button 
                onClick={handleLogout} 
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors group"
            >
                <div className="flex items-center">
                    <Icons.LogOut className="w-5 h-5 ml-2" />
                    <span className="font-bold">خروج از حساب</span>
                </div>
                <Icons.ChevronLeft className="w-4 h-4 opacity-50 group-hover:-translate-x-1 transition-transform" />
            </button>
            <div className="text-center text-xs opacity-50 mt-4 font-mono">
                v{APP_VERSION}
            </div>
        </div>
      </aside>
    </>
  );
};
export default Sidebar;
