
import React, { useEffect, ErrorInfo, ReactNode, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import SplashPage from './pages/SplashPage';
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
import { useAutoUpdate } from './hooks/useAutoUpdate';
import { useOfflineSync } from './hooks/useOfflineSync';
import { useAutoTheme } from './hooks/useAutoTheme';
import { APP_VERSION } from './constants';

// Helper to safely load lazy components and handle default export issues
const safeLazy = (importFunc: () => Promise<any>, fallbackName: string) => {
  return lazy(() => 
    importFunc().then(module => {
      if (module.default) return { default: module.default };
      console.error(`Module ${fallbackName} missing default export. Available:`, Object.keys(module));
      // Fallback if named export matches the file name context (common mistake)
      // or return a dummy component to prevent crash #306
      return { default: () => <div className="p-4 text-red-500 font-bold">Error: Failed to load {fallbackName}</div> };
    }).catch(err => {
      console.error(`Failed to load ${fallbackName}:`, err);
      return { default: () => <div className="p-4 text-red-500 font-bold">Network Error loading {fallbackName}</div> };
    })
  );
};

// Lazy Load Pages with Safe Wrapper
const LoginPage = safeLazy(() => import('./pages/LoginPage'), 'LoginPage');
const AdminDashboard = safeLazy(() => import('./pages/AdminDashboard'), 'AdminDashboard');
const RegistrationDashboard = safeLazy(() => import('./pages/RegistrationDashboard'), 'RegistrationDashboard');
const SalesDashboard = safeLazy(() => import('./components/sales/SalesDashboard'), 'SalesDashboard');

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
    console.error("Uncaught error:", error);
    console.error("Component Stack:", errorInfo.componentStack);
    
    // Global Error Logging to Supabase
    useLogStore.getState().logError(error, errorInfo.componentStack);
  }

  handleHardReset = () => {
      localStorage.clear();
      sessionStorage.clear();
      if ('caches' in window) {
          caches.keys().then(names => {
              for (let name of names) caches.delete(name);
          });
      }
      if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(registrations => {
              for(let registration of registrations) registration.unregister();
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
                    ? 'خطای داخلی رابط کاربری رخ داده است (306/185). لطفا کنسول را بررسی کنید.' 
                    : 'متأسفانه برنامه با مشکل مواجه شده است.'}
                  <br/>
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

const PageLoader = () => (
  <div className="flex flex-col items-center justify-center h-screen bg-[#F3F3F3] dark:bg-[#1D1D1D]">
    <div className="w-12 h-12 border-4 border-metro-blue border-t-transparent rounded-full animate-spin"></div>
    <p className="mt-4 text-gray-500 font-bold text-sm">در حال بارگذاری...</p>
  </div>
);

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
    // Restore Point Marker: v3.9.35 - Post UI Refactor
    console.log(`[App] Initializing Morvarid System v${APP_VERSION}`);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    const init = async () => {
        await checkSession();
        initListener();
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
      <PermissionModal />
      <ToastContainer />
    </ErrorBoundary>
  );
}

export default App;
