
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

export interface DeviceInfo {
  userAgent: string;
  screenResolution: string;
  language: string;
  platform: string;
  connection?: string;
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

// Logging Types
export type LogLevel = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export type LogCategory = 
  | 'AUTH' 
  | 'DATABASE' 
  | 'NETWORK' 
  | 'SYSTEM' 
  | 'UI' 
  | 'USER_ACTION' 
  | 'FEATURE_TEST';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: any;
  synced: boolean;
}
