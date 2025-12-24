
import React from 'react';
import { Icons } from '../common/Icons';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../types';

interface MobileNavProps {
  onNavigate: (view: string) => void;
  currentView?: string;
}

const MobileNav: React.FC<MobileNavProps> = ({ onNavigate, currentView }) => {
  const { user } = useAuthStore();
  const role = user?.role || UserRole.ADMIN;

  const NavItem = ({ icon: Icon, label, view, isActive }: { icon: any, label: string, view: string, isActive: boolean }) => (
    <button 
      onClick={() => onNavigate(view)}
      className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all active:scale-95 ${isActive ? 'text-metro-blue' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
    >
      <div className={`p-1.5 rounded-full transition-colors ${isActive ? 'bg-metro-blue/10 dark:bg-metro-blue/20' : ''}`}>
         <Icon className={`w-6 h-6 ${isActive ? 'fill-current' : ''}`} />
      </div>
      {/* Changed text-[10px] to text-xs for better readability */}
      <span className={`text-[10px] sm:text-xs font-bold ${isActive ? 'opacity-100' : 'opacity-80'}`}>{label}</span>
    </button>
  );

  const renderNavItems = () => {
    switch(role) {
      case UserRole.REGISTRATION:
        return (
          <>
            <NavItem icon={Icons.Home} label="داشبورد" view="dashboard" isActive={currentView === 'dashboard'} />
            <NavItem icon={Icons.BarChart} label="ثبت آمار" view="stats" isActive={currentView === 'stats'} />
            <NavItem icon={Icons.FileText} label="ثبت حواله" view="invoice" isActive={currentView === 'invoice'} />
            <NavItem icon={Icons.Refresh} label="سوابق" view="recent" isActive={currentView === 'recent'} />
          </>
        );
      case UserRole.SALES:
        return (
          <>
            <NavItem icon={Icons.Home} label="داشبورد" view="dashboard" isActive={currentView === 'dashboard'} />
            <NavItem icon={Icons.BarChart} label="آمار" view="farm-stats" isActive={currentView === 'farm-stats'} />
            <NavItem icon={Icons.FileText} label="حواله‌ها" view="invoices" isActive={currentView === 'invoices'} />
            <NavItem icon={Icons.BarChart} label="نمودار" view="analytics" isActive={currentView === 'analytics'} />
            <NavItem icon={Icons.FileText} label="گزارشات" view="reports" isActive={currentView === 'reports'} />
          </>
        );
      case UserRole.ADMIN:
      default:
        return (
          <>
            <NavItem icon={Icons.Home} label="داشبورد" view="dashboard" isActive={currentView === 'dashboard'} />
            <NavItem icon={Icons.Home} label="فارم‌ها" view="farms" isActive={currentView === 'farms'} />
            <NavItem icon={Icons.Users} label="کاربران" view="users" isActive={currentView === 'users'} />
            <NavItem icon={Icons.FileText} label="گزارشات" view="reports" isActive={currentView === 'reports'} />
            <NavItem icon={Icons.TestTube} label="سنجش فنی" view="testing" isActive={currentView === 'testing'} />
          </>
        );
    }
  };

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#F3F3F3]/95 dark:bg-[#2D2D2D]/95 backdrop-blur-lg border-t border-gray-200 dark:border-gray-700 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-safe">
      <div className="flex items-center justify-around h-full max-w-md mx-auto px-2">
        {renderNavItems()}
      </div>
    </div>
  );
};

export default MobileNav;
