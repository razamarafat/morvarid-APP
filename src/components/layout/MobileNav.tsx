
import React, { useState } from 'react';
import { Icons } from '../common/Icons';
import { useAuthStore } from '../../store/authStore';
import { useAlertStore } from '../../store/alertStore';
import { UserRole } from '../../types';
import Modal from '../common/Modal';
import { toPersianDigits } from '../../utils/dateUtils';

interface MobileNavProps {
  onNavigate: (view: string) => void;
  currentView?: string;
}

const MobileNav: React.FC<MobileNavProps> = ({ onNavigate, currentView }) => {
  const { user } = useAuthStore();
  const { notifications, clearNotifications } = useAlertStore();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const role = user?.role || UserRole.ADMIN;

  const unreadCount = notifications.filter(n => !n.read).length;

  // Tile-mirror color styles for the mobile bottom-nav: each entry contains
  // LITERAL Tailwind class strings mirroring the corresponding dashboard
  // MetroTile's accent (so the header + bottom nav are visually consistent),
  // keeping the JIT scanner happy. Inactive = muted color + neutral hover,
  // active = full-color text + matching light/dark tinted background.
  const MOBILE_NAV_TILE_STYLES: Record<string, { active: string; inactive: string }> = {
    gray: {
      active: 'text-gray-700 bg-gray-200/60 dark:bg-gray-700/40 dark:text-white',
      inactive: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/60',
    },
    green: {
      active: 'text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400',
      inactive: 'text-green-600/80 dark:text-green-400/80 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20',
    },
    blue: {
      active: 'text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
      inactive: 'text-blue-600/80 dark:text-blue-400/80 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20',
    },
    orange: {
      active: 'text-orange-700 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400',
      inactive: 'text-orange-600/80 dark:text-orange-400/80 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20',
    },
    purple: {
      active: 'text-purple-700 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400',
      inactive: 'text-purple-600/80 dark:text-purple-400/80 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20',
    },
    violet: {
      active: 'text-violet-700 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-400',
      inactive: 'text-violet-600/80 dark:text-violet-400/80 hover:text-violet-700 dark:hover:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/20',
    },
  };

  const NavItem = ({ icon: Icon, label, view, isActive, color = 'gray' }: { icon: any, label: string, view: string, isActive: boolean, color?: string }) => {
    const styles = MOBILE_NAV_TILE_STYLES[color] || MOBILE_NAV_TILE_STYLES.gray;
    return (
      <button
        onClick={() => onNavigate(view)}
        className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all active:scale-95 ${isActive ? styles.active : styles.inactive}`}
      >
        <div className="p-1.5 rounded-full transition-colors">
          <Icon className={`w-6 h-6 ${isActive ? 'fill-current' : ''}`} />
        </div>
        <span className={`text-[10px] sm:text-xs font-bold ${isActive ? 'opacity-100' : 'opacity-80'}`}>{label}</span>
      </button>
    );
  };

  const renderNavItems = () => {
    // Common middle button for Notifications on mobile
    const notifButton = (
      <button
        onClick={() => setIsNotifOpen(true)}
        className="relative flex flex-col items-center justify-center w-full h-full -mt-6"
      >
        <div className="bg-metro-blue text-white p-3 rounded-full shadow-lg shadow-blue-500/30 border-4 border-[#F3F3F3] dark:border-[#2D2D2D] active:scale-95 transition-transform">
          <Icons.Bell className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-[#2D2D2D]"></span>
          )}
        </div>
        <span className="text-[10px] font-bold mt-1 text-gray-500 dark:text-gray-400">اعلان‌ها</span>
      </button>
    );

    switch (role) {
      case UserRole.REGISTRATION:
        return (
          <>
            <NavItem icon={Icons.Desk} label="میز کار" view="dashboard" isActive={currentView === 'dashboard'} color="gray" />
            <NavItem icon={Icons.BarChart} label="ثبت آمار" view="stats" isActive={currentView === 'stats'} color="orange" />
            {notifButton}
            <NavItem icon={Icons.FileText} label="ثبت حواله" view="invoice" isActive={currentView === 'invoice'} color="blue" />
            <NavItem icon={Icons.Refresh} label="سوابق" view="recent" isActive={currentView === 'recent'} color="green" />
          </>
        );
      case UserRole.SALES:
        return (
          <>
            <NavItem icon={Icons.Desk} label="میز کار" view="dashboard" isActive={currentView === 'dashboard'} color="gray" />
            <NavItem icon={Icons.BarChart} label="آمار" view="farm-stats" isActive={currentView === 'farm-stats'} color="blue" />
            {notifButton}
            <NavItem icon={Icons.FileText} label="حواله‌ها" view="invoices" isActive={currentView === 'invoices'} color="orange" />
            <NavItem icon={Icons.FileText} label="گزارشات" view="reports" isActive={currentView === 'reports'} color="purple" />
          </>
        );
      case UserRole.ADMIN:
      default:
        return (
          <>
            <NavItem icon={Icons.Desk} label="میز کار" view="dashboard" isActive={currentView === 'dashboard'} color="gray" />
            <NavItem icon={Icons.Home} label="فارم‌ها" view="farms" isActive={currentView === 'farms'} color="green" />
            {notifButton}
            <NavItem icon={Icons.Users} label="کاربران" view="users" isActive={currentView === 'users'} color="purple" />
            <NavItem icon={Icons.FileText} label="گزارشات" view="reports" isActive={currentView === 'reports'} color="blue" />
          </>
        );
    }
  };

  return (
    <>
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#F3F3F3]/95 dark:bg-[#2D2D2D]/95 backdrop-blur-lg border-t border-gray-200 dark:border-gray-700 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-safe">
        <div className="flex items-center justify-around h-full max-w-md mx-auto px-2">
          {renderNavItems()}
        </div>
      </div>

      <Modal isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} title="تاریخچه اعلان‌ها">
        <div className="h-[400px] flex flex-col">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-1 space-y-2">
            {notifications.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <Icons.Bell className="w-12 h-12 mb-2 opacity-20" />
                <span className="text-sm font-bold">هیچ اعلانی وجود ندارد</span>
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id} className={`p-3 rounded-xl border ${n.type === 'error' ? 'bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900' : 'bg-gray-50 border-gray-100 dark:bg-gray-800 dark:border-gray-700'}`}>
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-sm dark:text-white">{n.title}</span>
                    <span className="text-[10px] text-gray-400 font-mono">{new Date(n.timestamp).toLocaleTimeString('fa-IR')}</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{n.message}</p>
                </div>
              ))
            )}
          </div>
          {notifications.length > 0 && (
            <button
              onClick={clearNotifications}
              className="mt-4 w-full py-3 bg-gray-100 dark:bg-gray-800 text-red-500 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors"
            >
              پاکسازی تاریخچه
            </button>
          )}
        </div>
      </Modal>
    </>
  );
};

export default MobileNav;
