
import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Icons } from '../components/common/Icons';
import FarmManagement from '../components/admin/FarmManagement';
import UserManagement from '../components/admin/UserManagement';
import FeatureTesting from '../components/admin/FeatureTesting';
import Reports from '../components/admin/Reports';
import DeviceManagement from '../components/admin/DeviceManagement';
import MetroTile from '../components/common/MetroTile';
import { usePwaStore } from '../store/pwaStore';
import { useToastStore } from '../store/toastStore';
import { APP_VERSION } from '../constants';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { SkeletonTile } from '../components/common/Skeleton';

// Custom tile components with colorful backgrounds
const TechnicalCheckTile: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <div
    onClick={onClick}
    className="col-span-1 h-44 relative p-5 flex flex-col justify-between cursor-pointer select-none overflow-hidden group rounded-[32px] shadow-lg hover:shadow-2xl transition-all duration-300 transform-gpu hover:-translate-y-1 active:scale-[0.98] bg-gradient-to-br from-metro-teal to-metro-darkTeal"
  >
    <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
    <Icons.TestTube className="absolute -right-6 -bottom-6 w-32 h-32 opacity-[0.15] transform-gpu rotate-12 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6 text-white" />
    <div className="relative z-10 flex justify-between items-start w-full">
      <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md shadow-inner border border-white/20">
        <Icons.TestTube className="w-6 h-6 text-white" />
      </div>
    </div>
    <div className="relative z-10">
      <h3 className="text-white font-black text-lg leading-tight drop-shadow-sm tracking-wide">
        سنجش فنی
      </h3>
    </div>
  </div>
);

const InstallTile: React.FC<{ title: string; icon: React.ElementType; count?: string; onClick: () => void; className?: string; color?: string }> = ({ title, icon: Icon, count, onClick, className = '', color = 'bg-gradient-to-br from-metro-teal to-metro-darkTeal' }) => (
  <div
    onClick={onClick}
    className={`col-span-1 h-44 relative p-5 flex flex-col justify-between cursor-pointer select-none overflow-hidden group rounded-[32px] shadow-lg hover:shadow-2xl transition-all duration-300 transform-gpu hover:-translate-y-1 active:scale-[0.98] ${color} ${className}`}
  >
    <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
    <Icon className="absolute -right-6 -bottom-6 w-32 h-32 opacity-[0.15] transform-gpu rotate-12 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6 text-white" />
    <div className="relative z-10 flex justify-between items-start w-full">
      <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md shadow-inner border border-white/20">
        <Icon className="w-6 h-6 text-white" />
      </div>
      {count !== undefined && (
        <span className="text-3xl font-black text-white drop-shadow-md tracking-tight">
          {count}
        </span>
      )}
    </div>
    <div className="relative z-10">
      <h3 className="text-white font-black text-lg leading-tight drop-shadow-sm tracking-wide">
        {title}
      </h3>
    </div>
  </div>
);

const DeviceTile: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <div
    onClick={onClick}
    className="col-span-1 h-44 relative p-5 flex flex-col justify-between cursor-pointer select-none overflow-hidden group rounded-[32px] shadow-lg hover:shadow-2xl transition-all duration-300 transform-gpu hover:-translate-y-1 active:scale-[0.98] bg-gradient-to-br from-indigo-600 to-indigo-900"
  >
    <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
    <Icons.Globe className="absolute -right-6 -bottom-6 w-32 h-32 opacity-[0.15] transform-gpu rotate-12 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6 text-white" />
    <div className="relative z-10 flex justify-between items-start w-full">
      <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md shadow-inner border border-white/20">
        <Icons.Globe className="w-6 h-6 text-white" />
      </div>
    </div>
    <div className="relative z-10">
      <h3 className="text-white font-black text-lg leading-tight drop-shadow-sm tracking-wide">
        دستگاه‌ها
      </h3>
    </div>
  </div>
);

const VersionTile: React.FC<{ version: string; onClick: () => void }> = ({ version, onClick }) => (
  <div
    onClick={onClick}
    className="col-span-1 h-44 relative p-5 flex flex-col justify-between cursor-pointer select-none overflow-hidden group rounded-[32px] shadow-lg hover:shadow-2xl transition-all duration-300 transform-gpu hover:-translate-y-1 active:scale-[0.98] bg-gradient-to-br from-gray-600 to-gray-900"
  >
    <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
    <Icons.Info className="absolute -right-6 -bottom-6 w-32 h-32 opacity-[0.15] transform-gpu rotate-12 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6 text-white" />
    <div className="relative z-10 flex justify-between items-start w-full">
      <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md shadow-inner border border-white/20">
        <Icons.Info className="w-6 h-6 text-white" />
      </div>
      <span className="text-3xl font-black text-white drop-shadow-md tracking-tight">
        v{version}
      </span>
    </div>
    <div className="relative z-10">
      <h3 className="text-white font-black text-lg leading-tight drop-shadow-sm tracking-wide">
        نسخه سیستم
      </h3>
    </div>
  </div>
);

const AdminDashboard: React.FC = () => {
    const [currentView, setCurrentView] = useState('dashboard');
    const { addToast } = useToastStore();
    const { isLoading } = useAuthStore();

    useEffect(() => {
        const performAutoBackup = async () => {
            const LAST_BACKUP_KEY = 'morvarid_last_auto_backup';
            const BACKUP_INTERVAL = 8 * 60 * 60 * 1000;
            const lastBackupStr = localStorage.getItem(LAST_BACKUP_KEY);
            const now = Date.now();

            if (!lastBackupStr || (now - parseInt(lastBackupStr)) > BACKUP_INTERVAL) {
                try {
                    const [r1, r2, r3] = await Promise.all([
                        supabase.from('farms').select('*', { count: 'exact', head: true }),
                        supabase.from('daily_statistics').select('*', { count: 'exact', head: true }),
                        supabase.from('invoices').select('*', { count: 'exact', head: true })
                    ]);

                    if (r1.error || r2.error || r3.error) {
                        throw new Error('Database health check failed');
                    }

                    localStorage.setItem(LAST_BACKUP_KEY, now.toString());
                    addToast('بررسی خودکار سلامت دیتابیس با موفقیت انجام شد.', 'success');
                    console.log('Auto-Health Check completed successfully.');
                } catch (error: any) {
                    console.error('Auto-Health Check Failed:', error);
                }
            }
        };

        performAutoBackup();
        const backupInterval = setInterval(performAutoBackup, 60000);
        return () => clearInterval(backupInterval);
    }, []);

    const renderContent = () => {
        if (isLoading && currentView === 'dashboard') {
            return (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    <SkeletonTile size="wide" />
                    <SkeletonTile size="wide" />
                    <SkeletonTile size="medium" />
                    <SkeletonTile size="medium" />
                    <SkeletonTile size="medium" />
                </div>
            );
        }

        switch (currentView) {
            case 'farms': return <FarmManagement />;
            case 'users': return <UserManagement />;
            case 'reports': return <Reports />;
            case 'devices': return <DeviceManagement />; // New Tab
            case 'testing': return <FeatureTesting />;
            default: return <DashboardHome onNavigate={setCurrentView} />;
        }
    };

    const getTitle = () => {
        switch (currentView) {
            case 'farms': return 'مدیریت فارم‌ها';
            case 'users': return 'مدیریت کاربران';
            case 'reports': return 'گزارشات';
            case 'devices': return 'دستگاه‌های متصل';
            case 'testing': return 'سنجش ویژگی‌ها';
            default: return 'میز کار مدیریت';
        }
    }

    return (
        <DashboardLayout title={getTitle()} onNavigate={setCurrentView} currentView={currentView}>
            {renderContent()}
        </DashboardLayout>
    );
};

const DashboardHome: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
    const { deferredPrompt, setDeferredPrompt, isInstalled } = usePwaStore();
    const { addToast } = useToastStore();

    const handleInstallClick = async () => {
        if (isInstalled) {
            addToast('اپلیکیشن قبلاً نصب شده و فعال است.', 'info');
            return;
        }
        if (!deferredPrompt) {
            const isHttps = window.location.protocol === 'https:';
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            let errorMsg = 'مرورگر شما از نصب PWA پشتیبانی نمی‌کند یا قبلاً نصب شده است.';
            if (!isHttps && !isLocal) errorMsg = 'نصب برنامه نیازمند اتصال امن (HTTPS) است.';
            addToast(errorMsg, 'warning');
            return;
        }
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setDeferredPrompt(null);
    };

    const getPwaTileConfig = () => {
        if (isInstalled) return { title: "اپلیکیشن فعال است", icon: Icons.Check, color: "bg-gradient-to-br from-green-600 to-green-800", count: "نصب شده", click: () => addToast('نسخه نصبی فعال است.', 'success') };
        if (deferredPrompt) return { title: "نصب نسخه PWA", icon: Icons.Download, color: "bg-gradient-to-br from-metro-teal to-metro-darkTeal animate-pulse", count: "نصب", click: handleInstallClick };
        return { title: "نسخه وب (مرورگر)", icon: Icons.Globe, color: "bg-gradient-to-br from-gray-500 to-gray-700", count: "تحت وب", click: handleInstallClick };
    };

    const pwaConfig = getPwaTileConfig();

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 animate-in slide-in-from-bottom-5 duration-500">
            <MetroTile title="مدیریت فارم‌ها" icon={Icons.Home} color="bg-metro-green" size="wide" onClick={() => onNavigate('farms')} />
            <MetroTile title="مدیریت کاربران" icon={Icons.Users} color="bg-metro-purple" size="wide" onClick={() => onNavigate('users')} />
            <MetroTile title="گزارشات" icon={Icons.FileText} color="bg-metro-blue" size="medium" onClick={() => onNavigate('reports')} />
            <DeviceTile onClick={() => onNavigate('devices')} />
            <TechnicalCheckTile onClick={() => onNavigate('testing')} />
            <InstallTile 
                title={pwaConfig.title} 
                icon={pwaConfig.icon} 
                count={pwaConfig.count} 
                onClick={pwaConfig.click} 
                color={pwaConfig.color}
                className={!isInstalled && !deferredPrompt ? "opacity-80 grayscale-[0.3]" : ""}
            />
            <VersionTile 
                version={APP_VERSION}
                onClick={() => addToast(`نسخه فعلی: ${APP_VERSION}`, 'info')}
            />
        </div>
    );
};

export default AdminDashboard;
