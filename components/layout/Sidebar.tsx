
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
    
    // M3: Active states use Tonal colors (Secondary Container)
    // We map existing roles to M3-like tonal states
    switch(role) {
        case UserRole.REGISTRATION:
            activeClass = 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100';
            hoverClass = 'hover:bg-orange-50 dark:hover:bg-orange-900/20';
            break;
        case UserRole.SALES:
            activeClass = 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100';
            hoverClass = 'hover:bg-blue-50 dark:hover:bg-blue-900/20';
            break;
        default: // ADMIN
            activeClass = 'bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-100';
            hoverClass = 'hover:bg-purple-50 dark:hover:bg-purple-900/20';
    }

    const isActive = !isAction && currentView === view;

    return (
      <div className="px-3 mb-1">
          <button 
            onClick={onClick} 
            className={`w-full text-right flex items-center p-3 lg:p-4 transition-all duration-200 group rounded-full ${isActive ? activeClass : `text-gray-700 dark:text-gray-300 ${hoverClass}`}`}
          >
            <Icon className={`w-5 h-5 lg:w-6 lg:h-6 ml-3 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
            <span className={`font-bold text-sm lg:text-base tracking-wide ${isActive ? 'font-black' : ''}`}>{label}</span>
          </button>
      </div>
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
            <div className="my-2 border-t border-gray-200 dark:border-gray-700 mx-4"></div>
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

  // M3 Drawer: Rounded top-right/bottom-right corners for the sheet
  const sidebarClasses = `fixed top-0 right-0 h-full w-80 lg:w-[340px] bg-[#FDFBFF] dark:bg-[#1E1E1E] shadow-xl z-[101] flex flex-col rounded-l-[28px] lg:rounded-l-[28px] border-l dark:border-gray-800 transition-transform duration-300 ease-out transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      <aside className={sidebarClasses}>
        <div 
            className={`h-32 ${headerColor} flex flex-col justify-end px-6 pb-6 cursor-pointer hover:opacity-95 transition-opacity relative`}
            onClick={handleHome}
        >
            <div className="text-white">
                <h2 className="text-2xl lg:text-3xl font-black leading-tight tracking-tight">M.I.S</h2>
                <p className="text-sm lg:text-base opacity-90 font-medium mt-1">سیستم مدیریت مروارید</p>
            </div>
            <button onClick={(e) => {
                e.stopPropagation();
                onClose();
            }} className="absolute top-6 left-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
                <Icons.X className="w-5 h-5" />
            </button>
        </div>
        
        <nav className="flex-1 py-4 lg:py-6 overflow-y-auto custom-scrollbar space-y-1">
            <div className="px-4 mb-2">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 px-3">منوی اصلی</p>
            </div>
            {getNavLinks()}
        </nav>
        
        <div className="p-4 lg:p-6 mb-safe">
            <button 
                onClick={handleLogout} 
                className="w-full flex items-center justify-center p-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-bold rounded-full"
            >
                <Icons.LogOut className="w-5 h-5 ml-2" />
                <span className="text-sm lg:text-base">خروج از حساب</span>
            </button>
            <div className="text-center text-[10px] text-gray-400 mt-2 font-mono">
                {APP_VERSION}
            </div>
        </div>
      </aside>
    </>
  );
};
export default Sidebar;
