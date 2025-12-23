import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Icons } from '../components/common/Icons';
import FarmManagement from '../components/admin/FarmManagement';
import UserManagement from '../components/admin/UserManagement';
import FeatureTesting from '../components/admin/FeatureTesting';
import Reports from '../components/admin/Reports';
import MetroTile from '../components/common/MetroTile';
import { usePwaStore } from '../store/pwaStore';
import { useToastStore } from '../store/toastStore';
import { APP_VERSION } from '../constants';
import { supabase } from '../lib/supabase';

const AdminDashboard: React.FC = () => {
    const [currentView, setCurrentView] = useState('dashboard');
    const { addToast } = useToastStore();

    useEffect(() => {
        const performAutoBackup = async () => {
            const LAST_BACKUP_KEY = 'morvarid_last_auto_backup';
            const BACKUP_INTERVAL = 8 * 60 * 60 * 1000;
            const lastBackupStr = localStorage.getItem(LAST_BACKUP_KEY);
            const now = Date.now();
            if (!lastBackupStr || (now - parseInt(lastBackupStr)) > BACKUP_INTERVAL) {
                try {
                    await supabase.from('farms').select('*', { count: 'exact', head: true });
                    localStorage.setItem(LAST_BACKUP_KEY, now.toString());
                    addToast('بررسی خودکار سلامت دیتابیس با موفقیت انجام شد.', 'success');
                } catch (error) {
                    console.error('Auto-Health Check Failed:', error);
                }
            }
        };
        performAutoBackup();
        const backupInterval = setInterval(performAutoBackup, 60000); 
        return () => clearInterval(backupInterval);
    }, []);

    const renderContent = () => {
        switch (currentView) {
            case 'farms': return <FarmManagement />;
            case 'users': return <UserManagement />;
            case 'reports': return <Reports />;
            case 'testing': return <FeatureTesting />;
            default: return <DashboardHome onNavigate={setCurrentView} />;
        }
    };
    
    const getTitle = () => {
        switch(currentView){
            case 'farms': return 'مدیریت فارم‌ها';
            case 'users': return 'مدیریت کاربران';
            case 'reports': return 'گزارشات';
            case 'testing': return 'سنجش ویژگی‌ها';
            default: return 'داشبورد مدیریت';
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
        console.log('🔵 [PWA] Manual install trigger attempted');
        
        if (isInstalled) {
            console.log('ℹ️ [PWA] Status: Already installed');
            addToast('اپلیکیشن قبلاً نصب شده و فعال است.', 'info');
            return;
        }

        if (!deferredPrompt) {
            console.error('❌ [PWA] Error: No deferred prompt found in memory.');
            console.log('🔍 [PWA] DIAGNOSTIC CHECK:');
            console.log('  - Protocol:', window.location.protocol);
            console.log('  - Service Worker:', 'serviceWorker' in navigator ? 'SUPPORTED' : 'NOT SUPPORTED');
            console.log('  - Standalone Mode:', window.matchMedia('(display-mode: standalone)').matches);
            
            const manifestLink = document.querySelector('link[rel="manifest"]');
            console.log('  - Manifest Link:', manifestLink ? (manifestLink as any).href : 'NOT FOUND');

            let errorMsg = 'مرورگر شما رویداد نصب را شلیک نکرده است. لطفا مطمئن شوید فایل‌های PNG آیکون در پوشه public/icons موجود هستند و از HTTPS استفاده می‌کنید.';
            addToast(errorMsg, 'warning');
            return;
        }
        
        console.log('✅ [PWA] Executing deferredPrompt.prompt()...');
        deferredPrompt.prompt();
        
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`✅ [PWA] User Response Outcome: ${outcome}`);
        
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    const getPwaTileConfig = () => {
        if (isInstalled) {
            return {
                title: "اپلیکیشن فعال است",
                icon: Icons.Check,
                color: "bg-green-700",
                count: "نصب شده",
                click: () => addToast('نسخه نصبی فعال است.', 'success')
            };
        }
        if (deferredPrompt) {
            return {
                title: "نصب نسخه PWA",
                icon: Icons.Download,
                color: "bg-metro-teal animate-pulse",
                count: "نصب",
                click: handleInstallClick
            };
        }
        return {
            title: "نصب اپلیکیشن",
            icon: Icons.Globe,
            color: "bg-gray-500",
            count: "تحت وب",
            click: handleInstallClick
        };
    };

    const pwaConfig = getPwaTileConfig();

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 animate-in slide-in-from-bottom-5 duration-500">
            <MetroTile title="مدیریت فارم‌ها" icon={Icons.Home} color="bg-metro-green" size="wide" onClick={() => onNavigate('farms')} />
            <MetroTile title="مدیریت کاربران" icon={Icons.Users} color="bg-metro-purple" size="wide" onClick={() => onNavigate('users')} />
            <MetroTile title="گزارشات" icon={Icons.FileText} color="bg-metro-blue" size="medium" onClick={() => onNavigate('reports')} />
            <MetroTile title="سنجش فنی" icon={Icons.TestTube} color="bg-metro-teal" size="medium" onClick={() => onNavigate('testing')} />
            <MetroTile 
                title={pwaConfig.title}
                icon={pwaConfig.icon}
                color={pwaConfig.color}
                size="medium"
                count={pwaConfig.count}
                onClick={pwaConfig.click}
                className={!isInstalled && !deferredPrompt ? "opacity-80" : ""}
            />
            <div className="col-span-1 h-32 sm:h-40 bg-gray-700 p-4 flex items-end justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-black/20 pattern-grid-lg opacity-20" />
                <span className="text-white text-xs opacity-50 relative z-10 font-mono">v{APP_VERSION}</span>
            </div>
        </div>
    );
};

export default AdminDashboard;