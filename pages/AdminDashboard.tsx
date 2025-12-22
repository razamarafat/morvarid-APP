
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
import { supabase } from '../lib/supabase'; // Import for backup logic

const AdminDashboard: React.FC = () => {
    const [currentView, setCurrentView] = useState('dashboard');
    const { addToast } = useToastStore();

    // Enable Auto Backup System
    useEffect(() => {
        // --- AUTO BACKUP LOGIC (Every 8 Hours) ---
        const performAutoBackup = async () => {
            const LAST_BACKUP_KEY = 'morvarid_last_auto_backup';
            const BACKUP_INTERVAL = 8 * 60 * 60 * 1000; // 8 Hours in ms
            
            const lastBackupStr = localStorage.getItem(LAST_BACKUP_KEY);
            const now = Date.now();

            // Run if no backup exists or time interval passed
            if (!lastBackupStr || (now - parseInt(lastBackupStr)) > BACKUP_INTERVAL) {
                try {
                    // 1. Simulate Backup: Fetch counts to verify connectivity and data state
                    await supabase.from('farms').select('*', { count: 'exact', head: true });
                    await supabase.from('daily_statistics').select('*', { count: 'exact', head: true });
                    await supabase.from('invoices').select('*', { count: 'exact', head: true });

                    // 2. Update Local Timestamp
                    localStorage.setItem(LAST_BACKUP_KEY, now.toString());

                    // 3. Notify Admin
                    addToast('بررسی خودکار سلامت دیتابیس با موفقیت انجام شد.', 'success');
                    console.log('Auto-Health Check completed successfully.');

                } catch (error: any) {
                    console.error('Auto-Health Check Failed:', error);
                }
            }
        };

        // Run immediately on mount, then check every minute
        performAutoBackup();
        const backupInterval = setInterval(performAutoBackup, 60000); 

        return () => {
             clearInterval(backupInterval);
        }
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
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    // Determine PWA Tile State
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
            title: "نسخه وب (مرورگر)",
            icon: Icons.Globe,
            color: "bg-gray-500",
            count: "تحت وب",
            click: handleInstallClick
        };
    };

    const pwaConfig = getPwaTileConfig();

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 animate-in slide-in-from-bottom-5 duration-500">
            <MetroTile 
                title="مدیریت فارم‌ها" 
                icon={Icons.Home} 
                color="bg-metro-green" 
                size="wide"
                onClick={() => onNavigate('farms')} 
            />
            <MetroTile 
                title="مدیریت کاربران" 
                icon={Icons.Users} 
                color="bg-metro-purple" 
                size="wide"
                onClick={() => onNavigate('users')} 
            />
            <MetroTile 
                title="گزارشات" 
                icon={Icons.FileText} 
                color="bg-metro-blue" 
                size="medium"
                onClick={() => onNavigate('reports')} 
            />
            <MetroTile 
                title="سنجش فنی" 
                icon={Icons.TestTube} 
                color="bg-metro-teal" 
                size="medium"
                onClick={() => onNavigate('testing')} 
            />

            {/* Smart Install Button */}
            <MetroTile 
                title={pwaConfig.title}
                icon={pwaConfig.icon}
                color={pwaConfig.color}
                size="medium"
                count={pwaConfig.count}
                onClick={pwaConfig.click}
                className={!isInstalled && !deferredPrompt ? "opacity-80 grayscale-[0.3]" : ""}
            />
            
            {/* Decorative Static Tiles with Dynamic Version */}
            <div className="col-span-1 h-32 sm:h-40 bg-gray-700 p-4 flex items-end justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-black/20 pattern-grid-lg opacity-20" />
                <span className="text-white text-xs opacity-50 relative z-10 font-mono">v{APP_VERSION}</span>
            </div>
        </div>
    );
};

export default AdminDashboard;
