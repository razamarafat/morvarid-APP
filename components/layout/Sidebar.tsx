
import React from 'react';
import { useAuthStore } from '../../store/authStore';
import { Icons } from '../common/Icons';
import { APP_VERSION } from '../../constants';
import { UserRole } from '../../types';
import { useNavigate } from 'react-router-dom';
import { useConfirm } from '../../hooks/useConfirm';
import { usePwaStore } from '../../store/pwaStore'; // Changed import

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
  variant?: 'mobile' | 'desktop';
}

const NavLink: React.FC<{ icon: React.ElementType, label: string, view: string, currentView: string, role: UserRole, onClick: () => void }> = ({ icon: Icon, label, view, currentView, role, onClick }) => {
    let activeClass = '';
    let hoverClass = '';
    
    switch(role) {
        case UserRole.REGISTRATION:
            activeClass = 'bg-metro-orange text-white border-white';
            hoverClass = 'hover:bg-metro-orange hover:text-white';
            break;
        case UserRole.SALES:
            activeClass = 'bg-metro-blue text-white border-white';
            hoverClass = 'hover:bg-metro-blue hover:text-white';
            break;
        default: // ADMIN
            activeClass = 'bg-metro-purple text-white border-white';
            hoverClass = 'hover:bg-metro-purple hover:text-white';
    }

    const isActive = currentView === view;

    return (
      <button 
        onClick={onClick} 
        className={`w-full text-right flex items-center p-4 transition-all duration-200 group mb-1 border-r-4 ${isActive ? activeClass : `border-transparent text-gray-700 dark:text-gray-300 ${hoverClass}`}`}
      >
        <Icon className={`w-5 h-5 ml-2 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
        <span className="font-bold">{label}</span>
      </button>
    );
};

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onNavigate, variant = 'mobile' }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const { deferredPrompt, setDeferredPrompt, isInstalled } = usePwaStore(); // Use Global Store
  
  const role = user?.role || UserRole.ADMIN;
  let headerColor = 'bg-metro-purple';
  if (role === UserRole.REGISTRATION) headerColor = 'bg-metro-orange';
  if (role === UserRole.SALES) headerColor = 'bg-metro-blue';

  const [active, setActive] = React.useState('dashboard');

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleLogout = async () => {
    if (window.innerWidth < 1024) onClose();
    
    setTimeout(async () => {
        const confirmed = await confirm({
            title: 'خروج از حساب',
            message: 'آیا می‌خواهید از حساب کاربری خود خارج شوید؟',
            confirmText: 'خروج',
            cancelText: 'انصراف',
            type: 'danger'
        });
        
        if (confirmed) {
            logout();
            navigate('/login');
        }
    }, 150);
  };
  
  const handleNavigation = (view: string) => {
    onNavigate(view);
    if (window.innerWidth < 1024) {
        onClose();
    }
  }

  const handleHome = () => {
      setActive('dashboard');
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
    const links = user?.role === UserRole.ADMIN ? adminLinks : 
                  user?.role === UserRole.REGISTRATION ? registrationLinks : 
                  salesLinks;

    return links.map(link => (
        <NavLink 
            key={link.view} 
            {...link} 
            role={role}
            currentView={active}
            onClick={() => { setActive(link.view); handleNavigation(link.view); }} 
        />
    ));
  };

  const baseClasses = "h-full w-80 bg-[#F3F3F3] dark:bg-[#2D2D2D] shadow-2xl z-[101] flex flex-col border-l dark:border-gray-700 transition-transform duration-300 ease-out";
  
  const desktopClasses = "relative translate-x-0 w-72";
  const mobileClasses = `fixed top-0 right-0 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`;

  const finalClasses = `${baseClasses} ${variant === 'desktop' ? desktopClasses : mobileClasses}`;

  return (
    <>
      {variant === 'mobile' && (
        <div
          className={`fixed inset-0 bg-black/80 z-[100] transition-opacity lg:hidden ${
            isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={onClose}
        />
      )}
      
      <aside className={finalClasses}>
        <div 
            className={`h-24 ${headerColor} flex items-center px-6 cursor-pointer hover:opacity-90 transition-opacity`}
            onClick={handleHome}
        >
            <div className="text-white">
                <h2 className="text-2xl font-black leading-tight">M.I.S</h2>
                <p className="text-sm opacity-80 font-normal">سیستم مدیریت مروارید</p>
            </div>
        </div>
        
        <nav className="flex-1 py-4 overflow-y-auto custom-scrollbar space-y-1">
            {getNavLinks()}
        </nav>
        
        <div className="p-4 bg-gray-200 dark:bg-black/20 space-y-2">
            {!isInstalled && deferredPrompt && (
                <button
                    onClick={handleInstallClick}
                    className="w-full flex items-center justify-center p-3 bg-metro-teal text-white hover:bg-teal-700 transition-colors font-bold shadow-md animate-pulse"
                >
                    <Icons.HardDrive className="w-5 h-5 ml-2" />
                    <span className="text-sm">نصب اپلیکیشن (PWA)</span>
                </button>
            )}

            <button 
                onClick={handleLogout} 
                className="w-full flex items-center justify-between p-4 bg-metro-red text-white hover:bg-red-700 transition-colors font-bold"
            >
                <div className="flex items-center">
                    <Icons.LogOut className="w-5 h-5 ml-2" />
                    <span className="text-sm">خروج از حساب</span>
                </div>
            </button>
            <div className="text-center text-[10px] text-gray-500 mt-2 font-mono">
                {APP_VERSION}
            </div>
        </div>
      </aside>
    </>
  );
};
export default Sidebar;
