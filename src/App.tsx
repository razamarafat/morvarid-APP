import React, { Component, useEffect, ErrorInfo, ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import SplashPage from './pages/SplashPage';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import RegistrationDashboard from './pages/RegistrationDashboard';
import SalesDashboard from './components/sales/SalesDashboard';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { useThemeStore } from './store/themeStore';
import { UserRole } from './types';
import { useAuthStore } from './store/authStore';
import { useFarmStore } from './store/farmStore';
import { useStatisticsStore } from './store/statisticsStore';
import { useInvoiceStore } from './store/invoiceStore';
import { useUserStore } from './store/userStore';
import { useAlertStore } from './store/alertStore';
import { usePwaStore } from './store/pwaStore'; 
import { useLogStore } from './store/logStore';
import ConfirmDialog from './components/common/ConfirmDialog';
import ToastContainer from './components/common/Toast';

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    useLogStore.getState().error('UI', 'خطای رندرینگ توسط ErrorBoundary شکار شد', { error, errorInfo });
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
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
    return this.props.children;
  }
}

function App() {
  const { theme } = useThemeStore();
  const { checkSession, user } = useAuthStore();
  const { fetchFarms, fetchProducts } = useFarmStore();
  const { fetchStatistics } = useStatisticsStore();
  const { fetchInvoices } = useInvoiceStore();
  const { fetchUsers } = useUserStore();
  const { initListener } = useAlertStore();
  const { info, syncQueue } = useLogStore();
  const { setIsInstalled, setDeferredPrompt } = usePwaStore();

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  useEffect(() => {
      const init = async () => {
          await checkSession();
          fetchFarms();
          fetchProducts();
          initListener();
          // Ensure background sync starts after a short delay
          setTimeout(() => syncQueue(), 5000);
      };
      init();

      const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
                        || (window.navigator as any).standalone 
                        || document.referrer.includes('android-app://');

      if (isStandalone) {
          setIsInstalled(true);
          info('SYSTEM', 'App running in Standalone Mode', { isStandalone: true });
      }

      const handleAppInstalled = () => {
        info('SYSTEM', 'PWA Installed Successfully');
        setIsInstalled(true);
        setDeferredPrompt(null);
      };

      window.addEventListener('appinstalled', handleAppInstalled);
      return () => window.removeEventListener('appinstalled', handleAppInstalled);
  }, []);

  useEffect(() => {
      if (user) {
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
        <Routes>
          <Route path="/" element={<SplashPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/registration" element={<ProtectedRoute allowedRoles={[UserRole.REGISTRATION]}><RegistrationDashboard /></ProtectedRoute>} />
          <Route path="/sales" element={<ProtectedRoute allowedRoles={[UserRole.SALES]}><SalesDashboard /></ProtectedRoute>} />
          <Route path="/home" element={<HomeRedirect />} />
        </Routes>
      </HashRouter>
      <ConfirmDialog />
      <ToastContainer />
    </ErrorBoundary>
  );
}

export default App;