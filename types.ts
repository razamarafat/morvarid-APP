
export enum UserRole {
  ADMIN = 'ADMIN',
  REGISTRATION = 'REGISTRATION',
  SALES = 'SALES',
}

export enum FarmType {
  MORVARIDI = 'MORVARIDI',
  MOTEFEREGHE = 'MOTEFEREGHE',
}

export enum ProductUnit {
  CARTON = 'CARTON',
  KILOGRAM = 'KILOGRAM',
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  phoneNumber?: string;
  role: UserRole;
  isActive: boolean;
  lastVisit?: string;
  createdAt?: string;
  assignedFarms?: Farm[];
  notificationsEnabled?: boolean;
  password?: string;
}

export interface Product {
    id: string;
    name: string;
    description?: string;
    nameEnglish?: string;
    unit: ProductUnit;
    hasKilogramUnit: boolean;
    isDefault: boolean;
    isCustom: boolean;
}

export interface Farm {
  id: string;
  name: string;
  type: FarmType;
  isActive: boolean;
  productIds: string[];
}

export interface SystemLog {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: 'network' | 'auth' | 'database' | 'security' | 'frontend' | 'alert' | 'user_action';
  message: string; // Persian Summary
  details?: any;   // Technical JSON
  timestamp: string;
  userId?: string;
  user_full_name?: string; // Virtual field for display
}

export interface Invoice {
    id: string;
    farmId: string;
    date: string;
    invoiceNumber: string;
    totalCartons: number;
    totalWeight: number;
    productId?: string;
    driverName?: string;
    driverPhone?: string;
    plateNumber?: string;
    description?: string;
    isYesterday: boolean;
    createdAt: number;
    createdBy?: string;
    updatedAt?: number;
    updatedBy?: string;
}

export interface Backup {
  id: string;
  filename: string;
  size: string;
  createdAt: string;
  createdBy: string;
}
