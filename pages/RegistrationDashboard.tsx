
import React, { useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Icons } from '../components/common/Icons';
import StatisticsForm from '../components/registration/StatisticsForm';
import InvoiceForm from '../components/registration/InvoiceForm';
import RecentRecords from '../components/registration/RecentRecords';
import { useAuthStore } from '../store/authStore';

const RegistrationDashboard: React.FC = () => {
    const [currentView, setCurrentView] = useState('dashboard');
    const { user } = useAuthStore();
    
    // Simplified Header
    const dashboardTitle = 'داشبورد ثبت اطلاعات';

    const renderContent = () => {
        switch (currentView) {
            case 'stats': return <StatisticsForm />;
            case 'invoice': return <InvoiceForm />;
            case 'recent': return <RecentRecords />;
            default: return <DashboardHome onNavigate={setCurrentView} />;
        }
    };

    return (
        <DashboardLayout title={dashboardTitle} onNavigate={setCurrentView}>
            {renderContent()}
        </DashboardLayout>
    );
};

const DashboardHome: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <button onClick={() => onNavigate('stats')} className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg hover:shadow-xl dark:hover:shadow-orange-500/20 transform hover:-translate-y-1 transition-all duration-300 text-center flex flex-col items-center justify-center h-48 border-b-4 border-orange-500">
                    <div className="bg-orange-100 dark:bg-orange-900/30 p-4 rounded-full mb-4">
                        <Icons.BarChart className="w-10 h-10 text-orange-600 dark:text-orange-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">ثبت آمار</h3>
                </button>
                <button onClick={() => onNavigate('invoice')} className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg hover:shadow-xl dark:hover:shadow-orange-500/20 transform hover:-translate-y-1 transition-all duration-300 text-center flex flex-col items-center justify-center h-48 border-b-4 border-orange-500">
                    <div className="bg-orange-100 dark:bg-orange-900/30 p-4 rounded-full mb-4">
                        <Icons.FileText className="w-10 h-10 text-orange-600 dark:text-orange-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">ثبت حواله فروش</h3>
                </button>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-gray-700 dark:text-gray-300">آخرین فعالیت‌ها</h3>
                    <button onClick={() => onNavigate('recent')} className="text-orange-600 text-sm hover:underline">مشاهده همه</button>
                </div>
                <RecentRecords />
            </div>
        </div>
    );
};

export default RegistrationDashboard;
