
import React, { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import { UserRole } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { THEMES } from '../../constants';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  onNavigate: (view: string) => void;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title, onNavigate }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const user = useAuthStore(state => state.user);
  const theme = useThemeStore(state => state.theme);
  const role = user?.role || UserRole.ADMIN;
  const themeColors = THEMES[theme][role];

  return (
    <div className={`flex h-screen ${themeColors.background} text-black dark:text-white overflow-hidden font-sans`}>
      {/* Sidebar for Desktop - Flat Dark Style */}
      <div className="hidden lg:block h-full border-l border-gray-800">
         <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={onNavigate}/>
      </div>

      {/* Mobile Sidebar (Drawer) */}
      <div className="lg:hidden">
         <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={onNavigate}/>
      </div>

      <div className="flex-1 flex flex-col h-full w-full relative">
        <Header onMenuClick={() => setSidebarOpen(true)} title={title} />
        
        {/* Main Content Area - Horizontal Scroll feel if content overflows, or Grid */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto pb-24 lg:pb-8 scroll-smooth bg-[#F3F3F3] dark:bg-[#1D1D1D]">
          <div className="container mx-auto px-4 py-6 md:px-8 md:py-10 max-w-7xl animate-in fade-in duration-500">
             <h2 className="text-3xl font-light mb-6 text-gray-700 dark:text-gray-200 uppercase tracking-tight">{title}</h2>
             {children}
          </div>
        </main>

        {/* Bottom Navigation for Mobile */}
        <MobileNav onNavigate={onNavigate} />
      </div>
    </div>
  );
};

export default DashboardLayout;
