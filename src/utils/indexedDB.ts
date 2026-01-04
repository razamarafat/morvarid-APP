/**
 * 🗄️ IndexedDB Wrapper for Performance-Critical Storage
 * ════════════════════════════════════════════════════
 * 
 * مخصوص داده‌هایی که نیاز به سرعت بالا و حجم زیاد دارند
 * جایگزین localStorage برای بهبود performance موبایل
 */

import { STORAGE } from '../constants/config';
import { log } from './logger';

export interface IDBConfig {
  dbName: string;
  version: number;
  stores: Record<string, IDBObjectStoreParameters>;
}

class IndexedDBWrapper {
  private db: IDBDatabase | null = null;
  private config: IDBConfig;

  constructor(config: IDBConfig) {
    this.config = config;
  }

  /**
   * اتصال به دیتابیس
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.version);

      request.onerror = () => {
        log.error('IndexedDB connection failed', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        log.success('IndexedDB connected successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // ایجاد store های مورد نیاز
        Object.entries(this.config.stores).forEach(([storeName, params]) => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, params);
            log.debug(`Created IndexedDB store: ${storeName}`);
          }
        });
      };
    });
  }

  /**
   * ذخیره داده
   */
  async setItem(storeName: string, key: string, value: any): Promise<void> {
    if (!this.db) await this.connect();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(value, key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * خواندن داده
   */
  async getItem<T>(storeName: string, key: string): Promise<T | null> {
    if (!this.db) await this.connect();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  /**
   * حذف داده
   */
  async removeItem(storeName: string, key: string): Promise<void> {
    if (!this.db) await this.connect();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * پاک کردن کل store
   */
  async clear(storeName: string): Promise<void> {
    if (!this.db) await this.connect();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * بستن اتصال
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// پیکربندی مروارید
const morvariDConfig: IDBConfig = {
  dbName: STORAGE.IDB_NAME,
  version: STORAGE.IDB_VERSION,
  stores: {
    [STORAGE.IDB_STORES.STATISTICS]: { keyPath: 'id' },
    [STORAGE.IDB_STORES.INVOICES]: { keyPath: 'id' },
    [STORAGE.IDB_STORES.FARMS]: { keyPath: 'id' },
    [STORAGE.IDB_STORES.DRAFTS]: {} // ساده با key دلخواه
  }
};

// Instance واحد برای کل اپلیکیشن
export const idb = new IndexedDBWrapper(morvariDConfig);

/**
 * Storage Strategy - انتخاب هوشمند بین localStorage و IndexedDB
 */
export class SmartStorage {
  /**
   * ذخیره داده با انتخاب خودکار روش
   */
  static async setItem(key: string, value: any, preferIDB = false): Promise<void> {
    const serialized = JSON.stringify(value);
    const sizeKB = new Blob([serialized]).size / 1024;

    // اگر داده بزرگ باشد یا ترجیح IDB داده شده، از IndexedDB استفاده کن
    if (sizeKB > 50 || preferIDB) {
      await idb.setItem(STORAGE.IDB_STORES.DRAFTS, key, value);
      log.debug(`Stored ${key} in IndexedDB (${sizeKB.toFixed(1)}KB)`);
    } else {
      localStorage.setItem(key, serialized);
      log.debug(`Stored ${key} in localStorage (${sizeKB.toFixed(1)}KB)`);
    }
  }

  /**
   * خواندن داده با fallback automatic
   */
  static async getItem<T>(key: string): Promise<T | null> {
    try {
      // ابتدا IndexedDB را چک کن
      const idbResult = await idb.getItem<T>(STORAGE.IDB_STORES.DRAFTS, key);
      if (idbResult) return idbResult;

      // سپس localStorage را چک کن
      const lsResult = localStorage.getItem(key);
      return lsResult ? JSON.parse(lsResult) : null;
    } catch (error) {
      log.error('Smart storage retrieval failed', error);
      return null;
    }
  }

  /**
   * حذف از هر دو storage
   */
  static async removeItem(key: string): Promise<void> {
    try {
      await idb.removeItem(STORAGE.IDB_STORES.DRAFTS, key);
    } catch (error) {
      log.debug('Item not found in IndexedDB', error);
    }
    
    localStorage.removeItem(key);
  }
}

export default idb;