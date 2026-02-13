
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../types';
import { log } from '../../utils/logger';

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRoles?: UserRole[]; // Make optional for general auth check
  requireActive?: boolean;   // Check if user is active
  fallbackPath?: string;     // Custom redirect path
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles = [],
  requireActive = true,
  fallbackPath = "/login"
}) => {
  const { user, isLoading } = useAuthStore();
  const location = useLocation();

  // Show loading state during auth check
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    log.warn('Unauthorized access attempt', { path: location.pathname });
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user account is active
  if (requireActive && !user.isActive) {
    log.warn('Inactive user access attempt', { userId: user.id, path: location.pathname });
    return <Navigate to="/login" state={{ error: 'account_inactive' }} replace />;
  }

  // Check role-based access if roles are specified
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    log.error('Insufficient permissions', {
      userId: user.id,
      userRole: user.role,
      requiredRoles: allowedRoles,
      path: location.pathname
    });

    // Better UX: Redirect to appropriate dashboard instead of login
    const redirectMap: Record<UserRole, string> = {
      [UserRole.ADMIN]: '/admin',
      [UserRole.REGISTRATION]: '/registration',
      [UserRole.SALES]: '/sales'
    };

    const userDashboard = redirectMap[user.role] || '/login';
    return <Navigate to={userDashboard} replace />;
  }

  return children;
};

export default ProtectedRoute;
