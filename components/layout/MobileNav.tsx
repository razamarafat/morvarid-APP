
import React from 'react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { Icons } from '../common/Icons';
import { UserRole } from '../../types';
import { THEMES } from '../../constants';

interface MobileNavProps {
  onNavigate: (view: string) => void;
  currentView?: string;
}

const MobileNav: React.FC<MobileNavProps> = ({ onNavigate }) => {
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const role = user?.role || UserRole.ADMIN;
  const themeColors = THEMES[theme][role];

  const getNavItems = () => {
    switch (role) {
      case UserRole.ADMIN:
        return [
          { icon: Icons.Home, label: 'فارم‌ها', view: 'farms' },
          { icon: Icons.Users, label: 'کاربران', view: 'users' },
          { icon: Icons.FileText, label: 'گزارشات', view: 'reports' },
          { icon: Icons.AlertCircle, label: 'لاگ‌ها', view: 'logs' },
        ];
      case UserRole.REGISTRATION:
        return [
          { icon: Icons.BarChart, label: 'آمار', view: 'stats' },
          { icon: Icons.FileText, label: 'حواله', view: 'invoice' },
          { icon: Icons.Refresh, label: 'سوابق', view: 'recent' },
        ];
      case UserRole.SALES:
        return [
          { icon: Icons.BarChart, label: 'آمارها', view: 'farm-stats' },
          { icon: Icons.FileText, label: 'حواله‌ها', view: 'invoices' },
          { icon: Icons.FileText, label: 'گزارشات', view: 'reports' },
        ];
      default:
        return [];
    }
  };

  const items = getNavItems();

  return (
    <div className={`lg:hidden fixed bottom-0 left-0 right-0 h-20 ${themeColors.surface}/90 backdrop-blur-lg border-t border-gray-200 dark:border-gray-700 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-safe`}>
      <div className="flex items-center justify-around h-full max-w-md mx-auto px-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button 
              key={item.view}
              onClick={() => onNavigate(item.view)}
              className="flex flex-col items-center justify-center w-full h-full space-y-1 text-gray-500 hover:text-violet-600 dark:hover:text-violet-400 active:scale-95 transition-all"
            >
              <Icon className="w-6 h-6" />
              <span className="text-[10px] font-bold">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MobileNav;
