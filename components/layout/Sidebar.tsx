
import React from 'react';
import { useAuthStore } from '../../store/authStore';
import { Icons } from '../common/Icons';
import { APP_VERSION } from '../../constants';
import { UserRole } from '../../types';
import { useNavigate } from 'react-router-dom';
import { useConfirm } from '../../hooks/useConfirm';
import { usePwaStore } from '../../store/pwaStore';
import { useToastStore } from '../../store/toastStore';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
}

const NavLink: React.FC<{ icon: React.ElementType, label: string, view: string, currentView: string, role: UserRole, onClick: () => void, isAction?: boolean }> = ({ icon: Icon, label, view, currentView, role, onClick, isAction }) => {
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

    const isActive = !isAction && currentView === view;

    return (
      <button 
        onClick={onClick} 
        className={`w-full text-right flex items-center p-4 lg:p-5 transition-all duration-200 group mb-1 lg:mb-2 border-r-4 ${isActive ? activeClass : `border-transparent text-gray-700 dark:text-gray-300 ${hoverClass}`}`}
      >
        <Icon className={`w-5 h-5 lg:w-7 lg:h-7 ml-3 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
        <span className="font-bold text-sm lg:text-lg tracking-wide">{label}</span>
      </button>
    );
};

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onNavigate }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const { deferredPrompt, setDeferredPrompt, isInstalled } = usePwaStore();
  const { addToast } = useToastStore();
  
  const role = user?.role || UserRole.ADMIN;
  let headerColor = 'bg-metro-purple';
  if (role === UserRole.REGISTRATION) headerColor = 'bg-metro-orange';
  if (role === UserRole.SALES) headerColor = 'bg-metro-blue';

  const [active, setActive] = React.useState('dashboard');

  const handleInstallClick = async () => {
    if (isInstalled) {
        addToast('اپلیکیشن قبلاً نصب شده است.', 'success');
        return;
    }
    if (!deferredPrompt) {
        addToast('قابلیت نصب در این مرورگر پشتیبانی نمی‌شود یا قبلا نصب شده است.', 'info');
        return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleLogout = async () => {
    onClose();
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
  
  const handleNavigation = (view: string, label: string) => {
    onNavigate(view);
    onClose();
  }

  const handleHome = () => {
      setActive('dashboard');
      handleNavigation('dashboard', 'داشبورد اصلی');
  };

  // Base links per role
  const adminLinks = [
    { icon: Icons.Home, label: 'مدیریت فارم‌ها', view: 'farms' },
    { icon: Icons.Users, label: 'مدیریت کاربران', view: 'users' },
    { icon: Icons.FileText, label: 'گزارشات', view: 'reports' },
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
    { icon: Icons.BarChart, label: 'تحلیل نموداری', view: 'analytics' },
    { icon: Icons.FileText, label: 'گزارشات جامع', view: 'reports' },
  ];

  const getNavLinks = () => {
    let links = user?.role === UserRole.ADMIN ? adminLinks : 
                  user?.role === UserRole.REGISTRATION ? registrationLinks : 
                  salesLinks;

    return (
        <>
            {links.map(link => (
                <NavLink 
                    key={link.view} 
                    {...link} 
                    role={role}
                    currentView={active}
                    onClick={() => { setActive(link.view); handleNavigation(link.view, link.label); }} 
                />
            ))}
            <NavLink 
                icon={isInstalled ? Icons.Check : Icons.Download}
                label={isInstalled ? 'اپلیکیشن فعال است' : 'نصب نسخه PWA'}
                view="pwa-install"
                currentView={active}
                role={role}
                isAction={true}
                onClick={handleInstallClick}
            />
        </>
    );
  };

  const sidebarClasses = `fixed top-0 right-0 h-full w-80 lg:w-[340px] bg-[#F3F3F3] dark:bg-[#2D2D2D] shadow-2xl z-[101] flex flex-col border-l dark:border-gray-700 transition-transform duration-300 ease-out transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/80 z-[100] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      <aside className={sidebarClasses}>
        <div 
            className={`h-24 lg:h-28 ${headerColor} flex items-center px-6 cursor-pointer hover:opacity-90 transition-opacity relative`}
            onClick={handleHome}
        >
            <div className="text-white">
                <h2 className="text-2xl lg:text-4xl font-black leading-tight tracking-tight">M.I.S</h2>
                <p className="text-sm lg:text-base opacity-90 font-normal mt-1">سیستم مدیریت مروارید</p>
            </div>
            <button onClick={(e) => {
                e.stopPropagation();
                onClose();
            }} className="absolute top-4 left-4 text-white/70 hover:text-white">
                <Icons.X className="w-6 h-6" />
            </button>
        </div>
        
        <nav className="flex-1 py-4 lg:py-6 overflow-y-auto custom-scrollbar space-y-1">
            {getNavLinks()}
        </nav>
        
        <div className="p-4 lg:p-6 bg-gray-200 dark:bg-black/20 space-y-3">
            <button 
                onClick={handleLogout} 
                className="w-full flex items-center justify-between p-4 lg:p-5 bg-metro-red text-white hover:bg-red-700 transition-colors font-bold rounded-none shadow-md hover:shadow-lg"
            >
                <div className="flex items-center">
                    <Icons.LogOut className="w-5 h-5 lg:w-6 lg:h-6 ml-2" />
                    <span className="text-sm lg:text-base">خروج از حساب</span>
                </div>
            </button>
            <div className="text-center text-[10px] lg:text-xs text-gray-500 mt-2 font-mono">
                {APP_VERSION}
            </div>
        </div>
      </aside>
    </>
  );
};
export default Sidebar;
