
import React, { useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Icons } from '../components/common/Icons';
import StatisticsForm from '../components/registration/StatisticsForm';
import { InvoiceForm } from '../components/registration/InvoiceForm';
import RecentRecords from '../components/registration/RecentRecords';
import MetroTile from '../components/common/MetroTile';
import { SkeletonTile } from '../components/common/Skeleton';
import { useAuthStore } from '../store/authStore';

const RegistrationDashboard: React.FC = () => {
    const [currentView, setCurrentView] = useState('dashboard');
    const { isLoading } = useAuthStore();
    const dashboardTitle = 'داشبورد ثبت اطلاعات روزانه';

    const renderContent = () => {
        if (isLoading && currentView === 'dashboard') {
            return (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <SkeletonTile size="wide" />
                    <SkeletonTile size="wide" />
                    <SkeletonTile size="wide" />
                </div>
            );
        }

        switch (currentView) {
            case 'stats': return <StatisticsForm onNavigate={setCurrentView} />;
            case 'invoice': return <InvoiceForm />;
            case 'recent': return <RecentRecords />;
            default: return <DashboardHome onNavigate={setCurrentView} />;
        }
    };

    const getTitle = () => {
        switch (currentView) {
            case 'stats': return 'بخش آمار';
            case 'invoice': return 'ثبت حواله فروش';
            case 'recent': return 'سوابق اخیر و ویرایش';
            default: return dashboardTitle;
        }
    }

    return (
        <DashboardLayout title={getTitle()} onNavigate={setCurrentView} currentView={currentView}>
            {renderContent()}
        </DashboardLayout>
    );
};

const DashboardHome: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 animate-in fade-in duration-500">
            <MetroTile 
                title="ثبت آمار تولید" 
                icon={Icons.BarChart} 
                color="bg-metro-orange" 
                size="wide" // CHANGED from 'large' to 'wide' for consistency
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
                title="سوابق اخیر و ویرایش" 
                icon={Icons.Refresh} 
                color="bg-metro-green" 
                size="wide"
                onClick={() => onNavigate('recent')} 
            />

             <div className="col-span-2 bg-metro-dark p-6 text-white flex flex-col justify-end shadow-lg border-l-8 border-metro-orange">
                <h4 className="font-light text-2xl uppercase tracking-tighter">اطلاعیه انبار</h4>
                <p className="text-sm opacity-70 mt-3 leading-relaxed">
                    همکار گرامی، لطفاً پیش از پایان شیفت کاری، تمامی آمارهای تولید و حواله‌های خروج را با دقت نهایی کنید.
                    <br/>
                    <span className="text-orange-400 font-bold">موجود انبار به صورت آنی بروزرسانی می‌شود.</span>
                </p>
            </div>
        </div>
    );
};

export default RegistrationDashboard;
