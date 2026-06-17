import React, { useState, useEffect } from 'react';
import { useViewNavigation } from '../hooks/useViewNavigation';
import DashboardLayout from '../components/layout/DashboardLayout';
import { Icons } from '../components/common/Icons';
import StatisticsForm from '../components/registration/StatisticsForm';
import { InvoiceForm } from '../components/registration/InvoiceForm';
import RecentRecords from '../components/registration/RecentRecords';
import MetroTile from '../components/common/MetroTile';
import { SkeletonTile } from '../components/common/Skeleton';
import { useAuthStore } from '../store/authStore';
import { useInvoiceStore } from '../store/invoiceStore';
import { useExpirationAlert } from '../hooks/useExpirationAlert';
import { SalesVoucherList } from '../components/sales/SalesVoucherList';
import SalesVoucherDetail from '../components/sales/SalesVoucherDetail';

const RegistrationDashboard: React.FC = () => {
    // URL-driven navigation state via the shared hook — see
    // src/hooks/useViewNavigation.ts for the contract (history-stack
    // mirror, homeView replace, same-view click guard, etc.).
    const { currentView, setCurrentView } = useViewNavigation();
    const { isLoading } = useAuthStore();
    const dashboardTitle = 'میز کار ثبت اطلاعات روزانه';

    // TASK 4: Enable Expiration Alert
    useExpirationAlert();

    // 20260619 fix: cross-dashboard "Copy to daily voucher" handoff —
    // removed the buggy `window.dispatchEvent('copy-sales-voucher-to-
    // invoice', …)` global CustomEvent chain (anyone could forge the
    // event; no type safety) AND removed the parent-state callback
    // chain. The new flow consumes the typed `copiedSalesVoucher` slot
    // from the invoice store via a zustand selector. When non-null, we
    // switch to the 'invoice' view so <InvoiceForm> mounts; the form
    // itself reads the slot, pre-fills, and clears it.
    const copiedSalesVoucher = useInvoiceStore(s => s.copiedSalesVoucher);
    useEffect(() => {
        if (copiedSalesVoucher) {
            setCurrentView('invoice');
        }
    }, [copiedSalesVoucher, setCurrentView]);

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
            case currentView === 'invoice': return <InvoiceForm />;
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
