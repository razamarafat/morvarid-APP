
import React, { useEffect, ErrorInfo, ReactNode, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import SplashPage from '../pages/SplashPage';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { useThemeStore } from '../store/themeStore';
import { UserRole } from '../types';
import { useAuthStore } from '../store/authStore';
import { useFarmStore } from '../store/farmStore';
import { useStatisticsStore } from '../store/statisticsStore';
import { useInvoiceStore } from '../store/invoiceStore';
import { useUserStore } from '../store/userStore';
import { useAlertStore } from '../store/alertStore';
import { usePwaStore } from '../store/pwaStore'; 
import ConfirmDialog from '../components/common/ConfirmDialog';
import ToastContainer from '../components/common/Toast';
// بعد از سایر import ها اضافه کنید:
import UpdateNotification from '../components/common/UpdateNotification';

// Lazy Load Pages to reduce initial bundle size
const LoginPage = lazy(() => import('../pages/LoginPage'));
const AdminDashboard = lazy(() => import('../pages/AdminDashboard'));
const RegistrationDashboard = lazy(() => import('../pages/RegistrationDashboard'));
// Corrected path for SalesDashboard
const SalesDashboard = lazy(() => import('../components/sales/SalesDashboard'));

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Fix: Explicitly using React.Component and a constructor ensures TypeScript correctly identifies 'props' and 'state' as inherited members.
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Explicitly declaring state and props members to satisfy the TypeScript compiler when inheritance inference fails.
  public state: ErrorBoundaryState;
  public props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render(): ReactNode {
    // Accessing props and state from the instance with destructuring via 'this'
    const { hasError } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-100 dark:bg-gray-900 text-center p-4">
          <h1 className="text-2xl font-bold text-red-600 mb-2">خطای سیستمی رخ داده است</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">لطفا صفحه را رفرش کنید.</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            بارگذاری مجدد
          </button>
        </div>
      );
    }
    
    return children;
  }
}

// Simple Loading Component for Suspense
const PageLoader = () => (
  <div className="flex flex-col items-center justify-center h-screen bg-[#F3F3F3] dark:bg-[#1D1D1D]">
    <div className="w-16 h-16 border-4 border-metro-blue border-t-transparent rounded-full animate-spin"></div>
    <p className="mt-4 text-gray-500 font-bold text-sm">در حال بارگذاری...</p>
  </div>
);

function App() {
  const { theme } = useThemeStore();
  const { checkSession, user } = useAuthStore();
  const { fetchFarms, fetchProducts } = useFarmStore();
  const { fetchStatistics } = useStatisticsStore();
  const { fetchInvoices } = useInvoiceStore();
  const { fetchUsers } = useUserStore();
  const { initListener, checkAndRequestPermission } = useAlertStore();
  const { setIsInstalled, logEvent } = usePwaStore();

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  // Initial System Setup
  useEffect(() => {
      const init = async () => {
          await checkSession();
          initListener();
          checkAndRequestPermission(); 
      };
      init();

      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      logEvent('Checking standalone mode', { isStandalone });
      setIsInstalled(isStandalone);

      const handleAppInstalled = () => {
          logEvent('App installed event fired');
          setIsInstalled(true);
      };
      window.addEventListener('appinstalled', handleAppInstalled);
      return () => window.removeEventListener('appinstalled', handleAppInstalled);
  }, []);

  // Unified Data Fetching Trigger
  useEffect(() => {
      if (user) {
          fetchFarms();
          fetchProducts();
          fetchStatistics();
          fetchInvoices();
          if (user.role === UserRole.ADMIN) fetchUsers();
      }
  }, [user]);
  
  const HomeRedirect = () => {
    if (!user) return <Navigate to="/login" />;
    switch (user.role) {
      case UserRole.ADMIN: return <Navigate to="/admin" />;
      case UserRole.REGISTRATION: return <Navigate to="/registration" />;
      case UserRole.SALES: return <Navigate to="/sales" />;
      default: return <Navigate to="/login" />;
    }
  };

  return (
    <ErrorBoundary>
      <HashRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<SplashPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admin" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/registration" element={<ProtectedRoute allowedRoles={[UserRole.REGISTRATION]}><RegistrationDashboard /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute allowedRoles={[UserRole.SALES]}><SalesDashboard /></ProtectedRoute>} />
            <Route path="/home" element={<HomeRedirect />} />
            <Route path="*" element={<Navigate to="/home" />} />
          </Routes>
        </Suspense>
      </HashRouter>
      <ConfirmDialog />
      <ToastContainer />
      <UpdateNotification />
    </ErrorBoundary>
  );
}

export default App;
