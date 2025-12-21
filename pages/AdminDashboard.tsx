
import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Icons } from '../components/common/Icons';
import FarmManagement from '../components/admin/FarmManagement';
import UserManagement from '../components/admin/UserManagement';
import BackupManagement from '../components/admin/BackupManagement';
import SystemLogs from '../components/admin/SystemLogs';
import FeatureTesting from '../components/admin/FeatureTesting';
import Reports from '../components/admin/Reports';
import GlobalRecordManager from '../components/admin/GlobalRecordManager';
import MetroTile from '../components/common/MetroTile';
import { useLogStore } from '../store/logStore';
import { usePwaStore } from '../store/pwaStore';
import { useToastStore } from '../store/toastStore';
import { APP_VERSION } from '../constants';

const AdminDashboard: React.FC = () => {
    const [currentView, setCurrentView] = useState('dashboard');
    const { fetchLogs, subscribeToLogs } = useLogStore();

    // Enable Live Logs
    useEffect(() => {
        fetchLogs();
        const unsubscribe = subscribeToLogs();
        return () => {
             if (typeof unsubscribe === 'function') unsubscribe();
        }
    }, []);

    const renderContent = () => {
        switch (currentView) {
            case 'farms': return <FarmManagement />;
            case 'users': return <UserManagement />;
            case 'reports': return <Reports />;
            case 'records': return <GlobalRecordManager />;
            case 'backup': return <BackupManagement />;
            case 'logs': return <SystemLogs />;
            case 'testing': return <FeatureTesting />;
            default: return <DashboardHome onNavigate={setCurrentView} />;
        }
    };
    
    const getTitle = () => {
        switch(currentView){
            case 'farms': return 'مدیریت فارم‌ها';
            case 'users': return 'مدیریت کاربران';
            case 'reports': return 'گزارشات';
            case 'records': return 'مدیریت جامع داده‌ها';
            case 'backup': return 'پشتیبان‌گیری';
            case 'logs': return 'لاگ‌های سیستم';
            case 'testing': return 'سنجش ویژگی‌ها';
            default: return 'داشبورد مدیریت';
        }
    }

  return (
    <DashboardLayout title={getTitle()} onNavigate={setCurrentView}>
        {renderContent()}
    </DashboardLayout>
  );
};

const DashboardHome: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
    const { deferredPrompt, setDeferredPrompt, isInstalled } = usePwaStore();
    const { addToast } = useToastStore();
    const { addLog } = useLogStore();

    const handleInstallClick = async () => {
        if (isInstalled) {
            addToast('این اپلیکیشن قبلاً نصب شده است.', 'info');
            return;
        }

        if (!deferredPrompt) {
            const isHttps = window.location.protocol === 'https:';
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            
            let errorMsg = 'امکان نصب وجود ندارد.';
            if (!isHttps && !isLocal) errorMsg += ' (عدم استفاده از HTTPS)';
            else errorMsg += ' (مرورگر پشتیبانی نمی‌کند یا قبلا نصب شده)';

            addToast(errorMsg, 'warning');
            addLog('warn', 'frontend', `PWA Install Failed: Prompt is null. HTTPS: ${isHttps}, Local: ${isLocal}, Installed: ${isInstalled}`, 'USER');
            return;
        }
        
        addLog('info', 'frontend', 'PWA: User clicked install button. Prompting...', 'USER');
        deferredPrompt.prompt();
        
        const { outcome } = await deferredPrompt.userChoice;
        addLog('info', 'frontend', `PWA: Install prompt outcome: ${outcome}`, 'USER');
        
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

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
                title="مدیریت جامع داده‌ها" 
                icon={Icons.HardDrive} 
                color="bg-indigo-600" 
                size="large"
                onClick={() => onNavigate('records')} 
            />
            <MetroTile 
                title="گزارشات" 
                icon={Icons.FileText} 
                color="bg-metro-blue" 
                size="medium"
                onClick={() => onNavigate('reports')} 
            />
            <MetroTile 
                title="پشتیبان‌گیری" 
                icon={Icons.HardDrive} 
                color="bg-metro-orange" 
                size="medium"
                onClick={() => onNavigate('backup')} 
            />
            <MetroTile 
                title="لاگ‌های سیستم" 
                icon={Icons.AlertCircle} 
                color="bg-metro-red" 
                size="medium"
                onClick={() => onNavigate('logs')} 
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
                title={isInstalled ? "اپلیکیشن نصب شده" : deferredPrompt ? "نصب اپلیکیشن" : "وضعیت PWA"} 
                icon={isInstalled ? Icons.Check : Icons.Download} 
                color={isInstalled ? "bg-green-700" : deferredPrompt ? "bg-teal-600" : "bg-gray-500"} 
                size="medium"
                onClick={handleInstallClick}
                className={deferredPrompt && !isInstalled ? "animate-pulse" : "opacity-90"}
            />
            
            {/* Decorative Static Tiles with Dynamic Version */}
            <div className="col-span-1 h-32 sm:h-40 bg-gray-700 p-4 flex items-end justify-center">
                <span className="text-white text-xs opacity-50">v{APP_VERSION}</span>
            </div>
        </div>
    );
};

export default AdminDashboard;
