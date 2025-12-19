
import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import SplashPage from './pages/SplashPage';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import RegistrationDashboard from './pages/RegistrationDashboard';
import SalesDashboard from './pages/SalesDashboard';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { useThemeStore } from './store/themeStore';
import { UserRole } from './types';
import { useAuthStore } from './store/authStore';
import { useFarmStore } from './store/farmStore';
import { useStatisticsStore } from './store/statisticsStore';
import { useInvoiceStore } from './store/invoiceStore';
import { useUserStore } from './store/userStore';
import ConfirmDialog from './components/common/ConfirmDialog';
import ToastContainer from './components/common/Toast';

function App() {
  const { theme } = useThemeStore();
  const { checkSession, user } = useAuthStore();
  const { fetchFarms, fetchProducts } = useFarmStore();
  const { fetchStatistics } = useStatisticsStore();
  const { fetchInvoices } = useInvoiceStore();
  const { fetchUsers } = useUserStore();

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  // Initial Data Load
  useEffect(() => {
      const init = async () => {
          await checkSession();
          // Load public/shared data
          fetchFarms();
          fetchProducts();
      };
      init();
  }, []);

  // Fetch private data when user is logged in
  useEffect(() => {
      if (user) {
          fetchStatistics();
          fetchInvoices();
          if (user.role === UserRole.ADMIN) {
              fetchUsers();
          }
      }
  }, [user]);
  
  const HomeRedirect = () => {
    if (!user) return <Navigate to="/login" />;
    switch (user.role) {
      case UserRole.ADMIN:
        return <Navigate to="/admin" />;
      case UserRole.REGISTRATION:
        return <Navigate to="/registration" />;
      case UserRole.SALES:
        return <Navigate to="/sales" />;
      default:
        return <Navigate to="/login" />;
    }
  };

  return (
    <>
      <HashRouter>
        <Routes>
          <Route path="/" element={<SplashPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/registration" 
            element={
              <ProtectedRoute allowedRoles={[UserRole.REGISTRATION]}>
                <RegistrationDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/sales" 
            element={
              <ProtectedRoute allowedRoles={[UserRole.SALES]}>
                <SalesDashboard />
              </ProtectedRoute>
            } 
          />
          <Route path="/home" element={<HomeRedirect />} />
        </Routes>
      </HashRouter>
      <ConfirmDialog />
      <ToastContainer />
    </>
  );
}

export default App;
