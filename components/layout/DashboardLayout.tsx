
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
    <div className={`flex h-screen ${themeColors.background} ${themeColors.text} overflow-hidden`}>
      {/* Sidebar for Desktop */}
      <div className="hidden lg:block h-full">
         <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={onNavigate}/>
      </div>

      {/* Mobile Sidebar (Drawer) */}
      <div className="lg:hidden">
         <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={onNavigate}/>
      </div>

      <div className="flex-1 flex flex-col h-full w-full relative">
        <Header onMenuClick={() => setSidebarOpen(true)} title={title} />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto pb-24 lg:pb-8 scroll-smooth">
          <div className="container mx-auto px-4 py-6 md:px-6 md:py-8 max-w-7xl">
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
