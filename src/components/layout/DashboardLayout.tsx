
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

  // ----------------------------------------------------------------------------
  // Smart visibility: hide the universal BackButton on root dashboards.
  // The dashboards drive sub-pages via internal `currentView` state, so the
  // button is shown whenever the user is on a sub-page and hidden on the
  // root "میز کار" view (currentView === 'dashboard' or undefined).
  // ----------------------------------------------------------------------------
  const showBackButton = !!currentView && currentView !== 'dashboard';

  // The back handler simply resets the dashboard view state machine to the
  // root view — no URL navigation needed because the app is a single-page
  // dashboard where each role owns its own view stack. BackButton's own
  // fallback (navigate(-1) → '/home') kicks in if this prop is ever omitted.
  const handleBack = () => {
    onNavigate('dashboard');
  };

  return (
    <div className={`flex h-[100dvh] ${themeColors.background} text-black dark:text-white overflow-hidden font-sans transition-colors duration-500`}>
      
      {/* Sidebar */}
      <Sidebar 
          isOpen={isSidebarOpen} 
          onClose={() => setSidebarOpen(false)} 
          onNavigate={onNavigate}
      />

      <div className="flex-1 flex flex-col h-full w-full relative transition-all duration-300">
        <Header
          onMenuClick={handleToggleSidebar}
          title={title}
          showBackButton={showBackButton}
          onBack={handleBack}
        />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto pb-24 lg:pb-8 scroll-smooth">
          {/* Main content container with less padding on mobile for cleaner look */}
          <div className="container-fluid mx-auto px-4 py-6 md:px-8 md:py-8 animate-in fade-in duration-500 max-w-full">
             {children}
          </div>
        </main>

        <MobileNav onNavigate={onNavigate} currentView={currentView} />
      </div>
    </div>
  );
};

export default DashboardLayout;