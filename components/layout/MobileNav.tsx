
import React from 'react';
import { Icons } from '../common/Icons';

interface MobileNavProps {
  onNavigate: (view: string) => void;
  currentView?: string;
}

const MobileNav: React.FC<MobileNavProps> = ({ onNavigate }) => {
  // TASK 6: Removed 'isActive' logic so the button doesn't stay lit persistently.
  
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#F3F3F3]/95 dark:bg-[#2D2D2D]/95 backdrop-blur-lg border-t border-gray-200 dark:border-gray-700 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-safe">
      <div className="flex items-center justify-center h-full max-w-md mx-auto px-4">
        <button 
          onClick={() => onNavigate('dashboard')}
          className="flex flex-col items-center justify-center w-full h-full space-y-1 active:scale-95 transition-all group text-gray-600 dark:text-gray-400 hover:text-metro-blue dark:hover:text-metro-blue active:text-metro-blue dark:active:text-metro-blue"
        >
          <div className="p-1.5 rounded-full transition-colors group-hover:bg-metro-blue/10 dark:group-hover:bg-white/5 group-active:bg-metro-blue/10">
             <Icons.Home className="w-7 h-7" />
          </div>
          <span className="text-[11px] font-black">داشبورد اصلی</span>
        </button>
      </div>
    </div>
  );
};

export default MobileNav;
