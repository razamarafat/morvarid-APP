
import React, { useEffect, ErrorInfo, ReactNode, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import SplashPage from './pages/SplashPage'; // Keep SplashPage static for immediate load
import ProtectedRoute from './components/auth/ProtectedRoute';
import { useThemeStore } from './store/themeStore';
import { UserRole } from './types';
import { useAuthStore, STORAGE_KEYS } from './store/authStore';
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
import UpdatePrompt from './components/common/UpdatePrompt';
import { useOfflineSync } from './hooks/useOfflineSync';
import { useAutoUpdate } from './hooks/useAutoUpdate';
import { useAutoTheme } from './hooks/useAutoTheme';
import { initializePushNotifications } from './services/pushNotificationService';

// Deliberately no global popstate toast: internal sub-page back-navigation
// (e.g. /admin?view=farms -> /admin) must stay completely silent. The OS
// hardware back button already mirrors the UI back button via React Router's
// useSearchParams, so the user experience stays smooth without a
// "press back again to exit" interrupt. Reintroducing any popstate toast
// would break that — see git history if you're tempted to add one back.
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

// Page-hide handler: when "Remember Me" was NOT ticked on the last login,
// scrub Supabase's JWT from localStorage so the next visit shows the login
// screen instead of silently re-authenticating. HashRouter routes do not
// fire pagehide for in-app navigation, only for tab close / window close /
// full reload — which is exactly the behavior we want.
const handlePageHide = () => {
  if (typeof localStorage === 'undefined') return;
  const rememberMe = localStorage.getItem(STORAGE_KEYS.REMEMBER_ME_SESSION);
  if (rememberMe === '1') return; // user opted in: keep session
  // User did NOT tick Remember Me: scrub Supabase auth tokens so the next
  // page load boots the login screen. Only `sb-*-auth-token` is scrubbed —
  // NOT the activity stamp, NOT the rememberMe sentinel, NOT anything else.
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // localStorage may be unavailable (private mode, quota, etc.); nothing more we can do.
  }
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


  useOfflineSync();
  useAutoUpdate(); // Activated: Checks version.json every 30s for auto-updates
  useAutoTheme();

  // 20260619 — GLOBAL Persian-Only Input Enforcer
  // Hard-blocks Latin English letters (a-z, A-Z) at the keystroke and
  // paste level on standard text-bearing inputs / textareas across the
  // ENTIRE application. The Morvarid app is Persian-only, so any Latin
  // letter typed into a free-text field is a data-entry mistake that
  // would corrupt names, notes, descriptions, and search strings.
  //
  // Opt-out mechanisms (any of these skip the filter):
  //   1. Element has `data-allow-latin="true"` directly or on an ancestor
  //      (use ESD's `closest()` for ancestor matching).
  //   2. Element is NOT a text-bearing input — we ONLY block:
  //        * <textarea>
  //        * <input> with type="" / type="text" / type="search"
  //      Password, email, url, tel, number, date, time, etc. are NEVER
  //      blocked because the user may legitimately type Latin there.
  //   3. Event is an IME composition in progress (`isComposing` or
  //      keyCode 229) — we MUST allow Persian IME input to commit.
  //
  // The handler is mounted on `document` with capture=true so it sees
  // keystrokes BEFORE any inner React onChange (which lets us call
  // preventDefault and have it actually take effect). Pair this with
  // the wrapper-level `noLatin` filter on <Input> and <TextArea>.
  useEffect(() => {
    const isLatinChar = (key: string): boolean =>
      typeof key === 'string' && key.length === 1 && /^[a-zA-Z]$/.test(key);

    const isTextInput = (el: EventTarget | null): el is HTMLElement => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === 'TEXTAREA') return true;
      if (tag !== 'INPUT') return false;
      const rawType = (el.getAttribute('type') || 'text').toLowerCase();
      return rawType === '' || rawType === 'text' || rawType === 'search';
    };

    const isOptedOut = (el: HTMLElement | null): boolean => {
      if (!el) return false;
      if (el.hasAttribute('data-allow-latin')) return true;
      return !!el.closest('[data-allow-latin="true"]');
    };

    const isComposingEvent = (e: KeyboardEvent): boolean =>
      e.isComposing === true || e.keyCode === 229 || (e as any).key === 'Process';

    const handleKeydown = (e: KeyboardEvent) => {
      if (isComposingEvent(e)) return; // IME composing — let it through
      if (!isLatinChar(e.key)) return; // non-letter keys (Tab, Enter, Backspace, ArrowKeys, ...)
      const target = e.target as HTMLElement | null;
      if (!isTextInput(target)) return;
      if (isOptedOut(target)) return;
      // Hard block + stopPropagation so no inner listener can re-add it
      e.preventDefault();
      e.stopPropagation();
    };

    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!isTextInput(target)) return;
      if (isOptedOut(target)) return;
      const raw = e.clipboardData?.getData('text') || '';
      const cleaned = raw.replace(/[a-zA-Z]/g, '');
      if (cleaned === raw) return; // nothing to clean
      e.preventDefault();
      const t = target as HTMLInputElement | HTMLTextAreaElement;
      const start = t.selectionStart ?? t.value.length;
      const end = t.selectionEnd ?? start;
      t.value = t.value.slice(0, start) + cleaned + t.value.slice(end);
      // Manually dispatch input event so React's controlled state picks it up
      t.dispatchEvent(new Event('input', { bubbles: true }));
    };

    document.addEventListener('keydown', handleKeydown, true);
    document.addEventListener('paste', handlePaste, true);
    log.info('[GlobalPersianEnforcer] active — Latin letters blocked on text inputs');
    return () => {
      document.removeEventListener('keydown', handleKeydown, true);
      document.removeEventListener('paste', handlePaste, true);
    };
  }, []);

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

    // SECURITY (2026-06): scrub Supabase JWT on tab close when Remember Me
    // is OFF. Listens to BOTH pagehide (primary) AND beforeunload (fallback
    // for older mobile browsers that don't reliably fire pagehide).
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

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
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
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
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
              <ProtectedRoute allowedRoles={[UserRole.SALES, UserRole.ADMIN]}>
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
      <UpdatePrompt />
    </ErrorBoundary>
  );
}

export default App;
