
import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Icons } from '../components/common/Icons';
import StatisticsForm from '../components/registration/StatisticsForm';
import { InvoiceForm } from '../components/registration/InvoiceForm';
import RecentRecords from '../components/registration/RecentRecords';
import MetroTile from '../components/common/MetroTile';
import { SkeletonTile } from '../components/common/Skeleton';
import { useAuthStore } from '../store/authStore';
import { useExpirationAlert } from '../hooks/useExpirationAlert';
import { SalesVoucherList } from '../components/sales/SalesVoucherList';
import SalesVoucherDetail from '../components/sales/SalesVoucherDetail';

const RegistrationDashboard: React.FC = () => {
    const [currentView, setCurrentView] = useState('dashboard');
    const [copyFromSalesVoucherId, setCopyFromSalesVoucherId] = useState<string | null>(null);
    const { isLoading } = useAuthStore();
    const dashboardTitle = 'میز کار ثبت اطلاعات روزانه';

    // TASK 4: Enable Expiration Alert
    useExpirationAlert();

    // Listen for copy-from-sales-voucher events
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.voucherId) {
                setCopyFromSalesVoucherId(detail.voucherId);
                setCurrentView('invoice');
            }
        };
        window.addEventListener('copy-sales-voucher-to-invoice', handler);
        return () => window.removeEventListener('copy-sales-voucher-to-invoice', handler);
    }, []);

    const handleCopyToInvoice = useCallback((voucherId: string) => {
        setCopyFromSalesVoucherId(voucherId);
        setCurrentView('invoice');
    }, []);

    const renderContent = () => {
        if (isLoading && currentView === 'dashboard') {
            return (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <SkeletonTile size="wide" />
                    <SkeletonTile size="wide" />
                    <SkeletonTile size="wide" />
                    <SkeletonTile size="wide" />
                </div>
            );
        }

        switch (true) {
            case currentView === 'stats': return <StatisticsForm onNavigate={setCurrentView} />;
            case currentView === 'invoice': return <InvoiceForm copyFromSalesVoucherId={copyFromSalesVoucherId} onCopyComplete={() => setCopyFromSalesVoucherId(null)} />;
            case currentView === 'recent': return <RecentRecords />;
            case currentView === 'sales-vouchers': return (
                <SalesVoucherList
                    onNavigate={setCurrentView}
                    readOnly={true}
                />
            );
            case currentView.startsWith('sales-vouchers-view-'): {
                const viewId = currentView.replace('sales-vouchers-view-', '');
                return (
                    <SalesVoucherDetail
                        voucherId={viewId}
                        onBack={() => setCurrentView('sales-vouchers')}
                        readOnly={true}
                        onCopyToInvoice={handleCopyToInvoice}
                    />
                );
            }
            default: return <DashboardHome onNavigate={setCurrentView} />;
        }
    };

    const getTitle = () => {
        switch (true) {
            case currentView === 'stats': return 'بخش آمار';
            case currentView === 'invoice': return 'ثبت حواله فروش';
            case currentView === 'recent': return 'سوابق اخیر و ویرایش';
            case currentView === 'sales-vouchers': return 'مشاهده حواله‌های فروش';
            case currentView.startsWith('sales-vouchers-view-'): return 'جزئیات حواله فروش';
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
                size="wide"
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
                title="مشاهده حواله‌های فروش" 
                icon={Icons.Eye} 
                color="bg-gradient-to-br from-violet-500 to-purple-600" 
                size="wide"
                onClick={() => onNavigate('sales-vouchers')} 
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
