
import React, { useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Icons } from '../components/common/Icons';
import FarmManagement from '../components/admin/FarmManagement';
import UserManagement from '../components/admin/UserManagement';
import BackupManagement from '../components/admin/BackupManagement';
import SystemLogs from '../components/admin/SystemLogs';
import FeatureTesting from '../components/admin/FeatureTesting';
import Reports from '../components/admin/Reports';

const AdminDashboard: React.FC = () => {
    const [currentView, setCurrentView] = useState('dashboard');

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
            default: return 'داشبورد مدیر';
        }
    }

  return (
    <DashboardLayout title={getTitle()} onNavigate={setCurrentView}>
        {renderContent()}
    </DashboardLayout>
  );
};

const DashboardHome: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
    const cards = [
        { title: 'مدیریت فارم‌ها', icon: Icons.Home, view: 'farms' },
        { title: 'مدیریت کاربران', icon: Icons.Users, view: 'users' },
        { title: 'گزارشات', icon: Icons.FileText, view: 'reports' },
        { title: 'پشتیبان‌گیری', icon: Icons.HardDrive, view: 'backup' },
        { title: 'لاگ‌های سیستم', icon: Icons.AlertCircle, view: 'logs' },
        { title: 'سنجش ویژگی‌ها', icon: Icons.TestTube, view: 'testing' },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((card, index) => (
                <button
                    key={index}
                    onClick={() => onNavigate(card.view)}
                    className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl dark:hover:shadow-violet-500/20 transform hover:-translate-y-1 transition-all duration-300 text-center"
                >
                    <card.icon className="w-12 h-12 mx-auto text-violet-500 dark:text-violet-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{card.title}</h3>
                </button>
            ))}
        </div>
    );
};

export default AdminDashboard;
