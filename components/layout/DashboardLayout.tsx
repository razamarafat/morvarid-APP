import React, { useState, useEffect } from 'react';
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
  currentView?: string;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title, onNavigate, currentView }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const user = useAuthStore(state => state.user);
  const theme = useThemeStore(state => state.theme);
  const role = user?.role || UserRole.ADMIN;
  const themeColors = THEMES[theme][role];

  const handleToggleSidebar = () => {
    setSidebarOpen(!isSidebarOpen);
  };

  useEffect(() => {
    const handleNavEvent = (e: Event) => {
        const customEvent = e as CustomEvent;
        if (customEvent.detail && customEvent.detail.view) {
            onNavigate(customEvent.detail.view);
        }
    };

    window.addEventListener('dashboard-navigate', handleNavEvent);
    return () => window.removeEventListener('dashboard-navigate', handleNavEvent);
  }, [onNavigate]);

  return (
    <div className={`flex flex-col h-[100dvh] w-full ${themeColors.background} text-black dark:text-white overflow-hidden font-sans`}>
      
      <Sidebar 
          isOpen={isSidebarOpen} 
          onClose={() => setSidebarOpen(false)} 
          onNavigate={onNavigate}
      />

      <div className="flex-1 flex flex-col min-h-0 w-full relative">
        
        <Header onMenuClick={handleToggleSidebar} title={title} />
        
        <main 
          className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F3F3F3] dark:bg-[#1D1D1D]"
          data-scrollable="true"
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            touchAction: 'pan-y'
          }}
        >
          <div className="container-fluid mx-auto px-4 py-6 md:px-10 md:py-10 pb-24 lg:pb-8 animate-in fade-in duration-500 max-w-full">
             {children}
          </div>
        </main>

        <MobileNav onNavigate={onNavigate} currentView={currentView} />
      </div>
    </div>
  );
};

export default DashboardLayout;
