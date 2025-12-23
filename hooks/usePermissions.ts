
import { useAuthStore } from '../store/authStore';
import { UserRole } from '../types';

export function usePermissions() {
  const { user } = useAuthStore();
  
  const isAdmin = user?.role === UserRole.ADMIN;
  
  return {
    // STATISTICS (آمارها) PERMISSIONS
    canEditStatistics: isAdmin,
    canDeleteStatistics: isAdmin,
    
    // INVOICES (حواله‌ها) PERMISSIONS  
    canEditInvoices: isAdmin,
    canDeleteInvoices: isAdmin,
    
    // OPERATIONS COLUMN VISIBILITY
    canSeeOperationsColumn: isAdmin,
    
    // General flag
    isAdmin,
  };
}
