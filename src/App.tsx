
import React, { useEffect, ErrorInfo, ReactNode, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import SplashPage from './pages/SplashPage'; // Keep SplashPage static for immediate load
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
import PermissionModal from './components/common/PermissionModal';
import OfflineIndicator from './components/common/OfflineIndicator';
import RouteErrorBoundary from './components/common/RouteErrorBoundary';
import { useAutoUpdate } from './hooks/useAutoUpdate';
import { useOfflineSync } from './hooks/useOfflineSync';
import { useAutoTheme } from './hooks/useAutoTheme';
import { useDoubleBackExit } from './hooks/useDoubleBackExit';
import { initializePushNotifications } from './services/pushNotificationService';
import { APP_VERSION } from './constants';
import { log } from './utils/logger';

// --- Role-Based Lazy Loading ---
// Split code by user roles to reduce initial bundle size
const LoginPage = lazy(() => import('./pages/LoginPage'));

// Admin role chunk - includes admin-specific components and logic
const AdminDashboard = lazy(() =>
  import(/* webpackChunkName: "admin-chunk" */ './pages/AdminDashboard')
);

// Registration role chunk - includes registration-specific components
const RegistrationDashboard = lazy(() =>
  import(/* webpackChunkName: "registration-chunk" */ './pages/RegistrationDashboard')
);

// Sales role chunk - includes sales-specific components
const SalesDashboard = lazy(() =>
  import(/* webpackChunkName: "sales-chunk" */ './components/sales/SalesDashboard')
);

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState;
  public props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    log.error("Uncaught application error", { error, componentStack: errorInfo.componentStack });

    // Global Error Logging to Supabase
    useLogStore.getState().logError(error, errorInfo.componentStack || undefined);
  }

  handleHardReset = () => {
    localStorage.clear();
    sessionStorage.clear();
    if ('caches' in window) {
      caches.keys().then(names => {
        for (const name of names) caches.delete(name);
      });
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (const registration of registrations) registration.unregister();
      });
    }
    window.location.reload();
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-100 dark:bg-gray-900 text-center p-6">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl max-w-sm w-full border border-gray-200 dark:border-gray-700">
            <h1 className="text-2xl font-black text-red-600 mb-2">خطای سیستمی</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
              {error?.message?.includes('Minified React error')
                ? 'خطای داخلی رابط کاربری رخ داده است. (Lazy Load Error)'
                : 'متأسفانه برنامه با مشکل مواجه شده است.'}
              <br />
              <span className="text-xs text-gray-400 mt-2 block">(گزارش خطا برای تیم فنی ارسال شد)</span>
            </p>

            <div className="space-y-3">
              <button onClick={() => window.location.reload()} className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all active:scale-95">
                تلاش مجدد
              </button>
              <button onClick={this.handleHardReset} className="w-full px-6 py-3 bg-red-100 text-red-600 border border-red-200 rounded-xl font-bold text-sm hover:bg-red-200 transition-all">
                بازنشانی کامل (رفع خرابی)
              </button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

// Minimal Loader for Suspense Fallback
const PageLoader = () => (
  <div className="flex flex-col items-center justify-center h-screen bg-[#F3F3F3] dark:bg-[#1D1D1D] transition-colors duration-300">
    <div className="relative w-16 h-16">
      <div className="absolute top-0 left-0 w-full h-full border-4 border-gray-200 dark:border-gray-700 rounded-full"></div>
      <div className="absolute top-0 left-0 w-full h-full border-4 border-metro-blue border-t-transparent rounded-full animate-spin"></div>
    </div>
    <p className="mt-6 text-gray-500 dark:text-gray-400 font-bold text-sm animate-pulse">در حال بارگذاری...</p>
  </div>
);

const NavigationManager = () => {
  useDoubleBackExit();
  return null;
};

function App() {
  const { theme } = useThemeStore();
  const { checkSession, user, updateActivity, checkInactivity } = useAuthStore();
  const { fetchFarms, fetchProducts } = useFarmStore();
  const { fetchStatistics } = useStatisticsStore();
  const { fetchInvoices } = useInvoiceStore();
  const { fetchUsers } = useUserStore();
  const { initListener } = useAlertStore();
  const { setIsInstalled } = usePwaStore();

  useAutoUpdate();
  useOfflineSync();
  useAutoTheme();

  useEffect(() => {
    // Restore Point Marker: v2.9.56 - Lazy Loading Implemented
    log.info(`Initializing Morvarid System v${APP_VERSION}`);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    const init = async () => {
      await checkSession();
      initListener();
      // Initialize push notifications
      await initializePushNotifications();
    };
    init();

    let activityTimeout: ReturnType<typeof setTimeout> | null = null;
    const handleUserActivity = () => {
      if (!activityTimeout) {
        activityTimeout = setTimeout(() => {
          updateActivity();
          activityTimeout = null;
        }, 10000);
      }
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);

    const inactivityInterval = setInterval(() => {
      checkInactivity();
    }, 60 * 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkInactivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsInstalled(isStandalone);

    const handleAppInstalled = () => {
      setIsInstalled(true);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
      window.removeEventListener('appinstalled', handleAppInstalled);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(inactivityInterval);
    };
  }, []);

  useEffect(() => {
    if (user) {
      // Optimistic pre-fetching of data can happen here while dashboard chunk loads
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
        <NavigationManager />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<SplashPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                <RouteErrorBoundary routeName="پنل مدیریت">
                  <AdminDashboard />
                </RouteErrorBoundary>
              </ProtectedRoute>
            } />
            <Route path="/registration" element={
              <ProtectedRoute allowedRoles={[UserRole.REGISTRATION]}>
                <RouteErrorBoundary routeName="مدیریت ثبت آمار">
                  <RegistrationDashboard />
                </RouteErrorBoundary>
              </ProtectedRoute>
            } />
            <Route path="/sales" element={
              <ProtectedRoute allowedRoles={[UserRole.SALES]}>
                <RouteErrorBoundary routeName="مدیریت فروش">
                  <SalesDashboard />
                </RouteErrorBoundary>
              </ProtectedRoute>
            } />
            <Route path="/home" element={<HomeRedirect />} />
            <Route path="*" element={<Navigate to="/home" />} />
          </Routes>
        </Suspense>
      </HashRouter>
      <ConfirmDialog />
      <PermissionModal />
      <ToastContainer />
      <OfflineIndicator />
    </ErrorBoundary>
  );
}

export default App;
