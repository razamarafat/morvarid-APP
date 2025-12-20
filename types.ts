
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
  category: 'network' | 'auth' | 'database' | 'security' | 'frontend';
  message: string;
  timestamp: string;
  userId?: string;
}

export interface Backup {
  id: string;
  filename: string;
  size: string;
  createdAt: string;
  createdBy: string;
}
