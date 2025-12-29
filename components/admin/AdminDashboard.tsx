
import React, { useState, useEffect } from 'react';
import DashboardLayout from '../layout/DashboardLayout';
import { Icons } from '../common/Icons';
import FarmManagement from '../admin/FarmManagement';
import UserManagement from '../admin/UserManagement';
import FeatureTesting from '../admin/FeatureTesting';
import Reports from '../admin/Reports';
import DeviceManagement from '../admin/DeviceManagement'; // Imported
import MetroTile from '../common/MetroTile';
import { usePwaStore } from '../../store/pwaStore';
import { useToastStore } from '../../store/toastStore';
import { APP_VERSION } from '../../constants';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { SkeletonTile } from '../common/Skeleton';

const AdminDashboard: React.FC = () => {
    const [currentView, setCurrentView] = useState('dashboard');
    const { addToast } = useToastStore();
    const { isLoading } = useAuthStore();

    useEffect(() => {
        const performAutoBackup = async () => {
            const LAST_BACKUP_KEY = 'morvarid_last_auto_backup';
            const BACKUP_INTERVAL = 8 * 60 * 60 * 1000; // 8 Hours check
            const lastBackupStr = localStorage.getItem(LAST_BACKUP_KEY);
            const now = Date.now();

            // Only run logic if enough time has passed
            if (!lastBackupStr || (now - parseInt(lastBackupStr)) > BACKUP_INTERVAL) {
                try {
                    // Optimized: Use count only, no data fetch needed for health check
                    const [r1, r2, r3] = await Promise.all([
                        supabase.from('farms').select('*', { count: 'exact', head: true }),
                        supabase.from('daily_statistics').select('*', { count: 'exact', head: true }),
                        supabase.from('invoices').select('*', { count: 'exact', head: true })
                    ]);

                    if (r1.error || r2.error || r3.error) {
                        throw new Error('Database health check failed');
                    }

                    localStorage.setItem(LAST_BACKUP_KEY, now.toString());
                    // Log to console instead of toast to be less intrusive
                    console.log(`[System] DB Health Check Passed. Farms: ${r1.count}, Stats: ${r2.count}, Invoices: ${r3.count}`);
                } catch (error: any) {
                    console.error('Auto-Health Check Failed:', error);
                }
            }
        };

        performAutoBackup();
        // OPTIMIZATION: Check every 5 minutes instead of 1 minute to reduce background activity
        const backupInterval = setInterval(performAutoBackup, 5 * 60 * 1000); 
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
        switch(currentView){
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
        if (isInstalled) return { title: "اپلیکیشن فعال است", icon: Icons.Check, color: "bg-green-700", count: "نصب شده", click: () => addToast('نسخه نصبی فعال است.', 'success') };
        if (deferredPrompt) return { title: "نصب نسخه PWA", icon: Icons.Download, color: "bg-metro-teal animate-pulse", count: "نصب", click: handleInstallClick };
        return { title: "نسخه وب (مرورگر)", icon: Icons.Globe, color: "bg-gray-500", count: "تحت وب", click: handleInstallClick };
    };

    const pwaConfig = getPwaTileConfig();

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 animate-in slide-in-from-bottom-5 duration-500">
            <MetroTile title="مدیریت فارم‌ها" icon={Icons.Home} color="bg-metro-green" size="wide" onClick={() => onNavigate('farms')} />
            <MetroTile title="مدیریت کاربران" icon={Icons.Users} color="bg-metro-purple" size="wide" onClick={() => onNavigate('users')} />
            <MetroTile title="گزارشات" icon={Icons.FileText} color="bg-metro-blue" size="medium" onClick={() => onNavigate('reports')} />
            {/* Added Device Manager Tile */}
            <MetroTile title="دستگاه‌ها" icon={Icons.Globe} color="bg-indigo-600" size="medium" onClick={() => onNavigate('devices')} />
            <MetroTile title="سنجش فنی" icon={Icons.TestTube} color="bg-metro-teal" size="medium" onClick={() => onNavigate('testing')} />
            <MetroTile title={pwaConfig.title} icon={pwaConfig.icon} color={pwaConfig.color} size="medium" count={pwaConfig.count} onClick={pwaConfig.click} className={!isInstalled && !deferredPrompt ? "opacity-80 grayscale-[0.3]" : ""} />
            <div className="col-span-1 h-32 sm:h-40 bg-gray-700 p-4 flex items-end justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-black/20 pattern-grid-lg opacity-20" />
                <span className="text-white text-xs opacity-50 relative z-10 font-mono">v{APP_VERSION}</span>
            </div>
        </div>
    );
};

export default AdminDashboard;
