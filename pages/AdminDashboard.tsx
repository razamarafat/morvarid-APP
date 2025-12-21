
import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Icons } from '../components/common/Icons';
import FarmManagement from '../components/admin/FarmManagement';
import UserManagement from '../components/admin/UserManagement';
import BackupManagement from '../components/admin/BackupManagement';
import SystemLogs from '../components/admin/SystemLogs';
import FeatureTesting from '../components/admin/FeatureTesting';
import Reports from '../components/admin/Reports';
import MetroTile from '../components/common/MetroTile';
import { useLogStore } from '../store/logStore';
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
            
            {/* Decorative Static Tiles with Dynamic Version */}
            <div className="col-span-1 h-32 sm:h-40 bg-gray-700 p-4 flex items-end justify-center">
                <span className="text-white text-xs opacity-50">v{APP_VERSION}</span>
            </div>
        </div>
    );
};

export default AdminDashboard;
