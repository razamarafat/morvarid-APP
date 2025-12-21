
import React, { useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Icons } from '../components/common/Icons';
import StatisticsForm from '../components/registration/StatisticsForm';
import InvoiceForm from '../components/registration/InvoiceForm';
import RecentRecords from '../components/registration/RecentRecords';
import MetroTile from '../components/common/MetroTile';

const RegistrationDashboard: React.FC = () => {
    const [currentView, setCurrentView] = useState('dashboard');
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
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            <MetroTile 
                title="ثبت آمار تولید" 
                icon={Icons.BarChart} 
                color="bg-metro-orange" 
                size="large"
                onClick={() => onNavigate('stats')} 
            />
            
            <MetroTile 
                title="ثبت حواله فروش" 
                icon={Icons.FileText} 
                color="bg-metro-blue" 
                size="wide"
                onClick={() => onNavigate('invoice')} 
            />
            
            <MetroTile 
                title="سوابق اخیر" 
                icon={Icons.Refresh} 
                color="bg-metro-green" 
                size="wide"
                onClick={() => onNavigate('recent')} 
            />

             <div className="col-span-2 bg-metro-dark p-4 text-white flex flex-col justify-end">
                <h4 className="font-light text-2xl">اطلاعیه</h4>
                <p className="text-sm opacity-70 mt-2">لطفا قبل از پایان شیفت آمار را نهایی کنید.</p>
            </div>
        </div>
    );
};

export default RegistrationDashboard;
