
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
  isSorted?: boolean; // Smart Sorting: Is this sale from sorted inventory?
  isConverted?: boolean; // Inventory Conversion: Was this converted from another product?
  sourceProductId?: string; // Inventory Conversion: Original product ID before conversion
  convertedAmount?: number; // Inventory Conversion: Amount taken from Source
  createdAt: number;
  createdBy?: string;
  creatorName?: string;
  creatorRole?: string;
  updatedAt?: number;
  updatedBy?: string;
  editorName?: string; // 20260619 — Audit trail: human-readable editor name from profiles!updated_by
  isPending?: boolean; // Optimistic UI Flag
  isOffline?: boolean; // Offline Queue Flag
  isFromSalesVoucher?: boolean; // Sales Voucher Integration: copied from sales voucher
  sourceSalesVoucherId?: string; // Sales Voucher Integration: source voucher ID
  sourceSalesVoucherLineId?: string; // Sale Reconciliation (20260618): per-line source ID — drives the tr_invoice_reconciliation trigger delta math
}

export interface Backup {
  id: string;
  filename: string;
  size: string;
  createdAt: string;
  createdBy: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  type: 'info' | 'warning' | 'error' | 'success';
}

// ============================
// Sales Voucher Types (سیستم حواله فروش)
// STATUS: only 'submitted'. The enum, inventory_applied flag, submitted_at,
// cancelled_by, cancelled_at columns were removed in 20260617 rebuild.
// A voucher simply EXISTS or is DELETED (no draft, no cancel).
// ============================

export type SalesVoucherStatus = 'submitted';

export interface SalesVoucher {
  id: string;
  voucherNumber: string;
  farmId: string;
  voucherDate: string;
  status: SalesVoucherStatus;
  createdBy: string;
  notes?: string;
  totalAmount?: number;
  customerName?: string;
  customerPhone?: string;
  vehiclePlate?: string;
  deliveryAddress?: string;
  driverName?: string;
  driverPhone?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  // Joined fields
  farmName?: string;
  creatorName?: string;
  editorName?: string;
  lines?: SalesVoucherLine[];
  totalItems?: number;
  totalQuantity?: number;
}

export interface SalesVoucherLine {
  id: string;
  voucherId: string;
  productId: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  notes?: string;
  createdAt: string;
  // Joined fields
  productName?: string;
  productUnit?: string;
}

export type SalesVoucherWithLines = SalesVoucher & {
  lines: SalesVoucherLine[];
};

export interface CreateSalesVoucherInput {
  farmId: string;
  voucherDate: string;
  voucherNumber: string;
  notes?: string;
  totalAmount?: number;
  customerName?: string;
  vehiclePlate?: string;
  driverName?: string;
  driverPhone?: string;
  lines: CreateSalesVoucherLineInput[];
}

export interface CreateSalesVoucherLineInput {
  productId: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  notes?: string;
}

export interface UpdateSalesVoucherInput {
  voucherNumber?: string;
  voucherDate?: string;
  notes?: string;
  totalAmount?: number;
  customerName?: string;
  vehiclePlate?: string;
  driverName?: string;
  driverPhone?: string;
  lines?: CreateSalesVoucherLineInput[];
}

export interface SalesVoucherFilter {
  farmId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: SalesVoucherStatus;
  createdBy?: string;
  search?: string;
}

// Inventory Transaction Types (تراکنش‌های انبار)
// 'sale_reconciliation' was added in 20260618_sale_reconciliation_logic.sql —
// posted automatically by tr_invoice_reconciliation when the Operator's daily
// voucher quantity differs from the original Sales Voucher line quantity.
export type InventoryTxnType = 'purchase' | 'sale' | 'sale_reversal' | 'daily_consumption' | 'adjustment' | 'return' | 'sale_reconciliation';

export interface InventoryTransaction {
  id: string;
  farmId: string;
  productId: string;
  txnType: InventoryTxnType;
  txnDate: string;
  qtyIn: number;
  qtyOut: number;
  qtyInKg: number;
  qtyOutKg: number;
  unitPrice?: number;
  totalPrice?: number;
  sourceType?: string;
  sourceId?: string;
  referenceNumber?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  // Joined fields
  productName?: string;
  farmName?: string;
  creatorName?: string;
}
