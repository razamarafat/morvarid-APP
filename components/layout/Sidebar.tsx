
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
  
  const handleHome = () => {
      onNavigate('dashboard');
      onClose();
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
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 px-3">دسترسی سریع</p>
            </div>
            
            {/* ONLY PWA INSTALL BUTTON AS REQUESTED */}
            <div className="px-3 mb-1">
                <button 
                    onClick={handleInstallClick} 
                    className={`w-full text-right flex items-center p-3 lg:p-4 transition-all duration-200 group rounded-full ${isInstalled ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' : 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-200 hover:bg-gray-100'}`}
                >
                    {isInstalled ? <Icons.Check className="w-6 h-6 ml-3" /> : <Icons.Download className="w-6 h-6 ml-3" />}
                    <span className="font-bold text-sm lg:text-base tracking-wide">
                        {isInstalled ? 'اپلیکیشن نصب شده است' : 'نصب نسخه PWA'}
                    </span>
                </button>
            </div>
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
