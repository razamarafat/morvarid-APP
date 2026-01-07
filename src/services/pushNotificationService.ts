import { log } from '../utils/logger';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

// Push notification service for managing subscriptions and sending notifications
class PushNotificationService {
  private vapidPublicKey: string | null = null;
  private subscription: PushSubscription | null = null;
  private registration: ServiceWorkerRegistration | null = null;

  constructor() {
    this.initializeService();
  }

  private async initializeService() {
    try {
      // Get VAPID key from environment
      this.vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || null;

      if (!this.vapidPublicKey) {
        log.warn('[PushService] VAPID public key not configured');
        return;
      }

      // Register service worker if not already registered
      if ('serviceWorker' in navigator) {
        this.registration = await navigator.serviceWorker.ready;
        log.info('[PushService] Service initialized successfully');
      }
    } catch (error) {
      log.error('[PushService] Failed to initialize:', error);
    }
  }

  // Convert VAPID key from base64 to Uint8Array
  private urlB64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Check if push notifications are supported
  public isSupported(): boolean {
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window &&
      this.vapidPublicKey !== null
    );
  }

  // Request notification permission
  public async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('Notifications not supported');
    }

    const permission = await Notification.requestPermission();
    log.info('[PushService] Notification permission:', permission);
    return permission;
  }

  // Subscribe to push notifications
  public async subscribe(): Promise<PushSubscription | null> {
    try {
      if (!this.isSupported()) {
        throw new Error('Push notifications not supported');
      }

      if (!this.registration) {
        throw new Error('Service worker not registered');
      }

      // Request permission first
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Subscribe to push
      const applicationServerKey = this.urlB64ToUint8Array(this.vapidPublicKey!);
      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource
      });

      log.info('[PushService] Successfully subscribed to push notifications');

      // Sync with Supabase
      await this.syncSubscriptionToDb(this.subscription);

      return this.subscription;
    } catch (error) {
      log.error('[PushService] Failed to subscribe:', error);
      throw error;
    }
  }

  // Sync subscription to Supabase
  private async syncSubscriptionToDb(subscription: PushSubscription): Promise<void> {
    try {
      const user = useAuthStore.getState().user;
      if (!user) {
        log.warn('[PushService] Cannot sync subscription: No user logged in');
        return;
      }

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          subscription: subscription.toJSON(),
          user_agent: navigator.userAgent,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id, subscription->>endpoint'
        });

      if (error) {
        log.error('[PushService] Failed to sync subscription to DB:', error);
      } else {
        log.info('[PushService] Subscription synced to DB');
        this.storeSubscription(subscription);
      }
    } catch (error) {
      log.error('[PushService] Error in syncSubscriptionToDb:', error);
    }
  }

  // Unsubscribe from push notifications
  public async unsubscribe(): Promise<boolean> {
    try {
      if (!this.subscription) {
        return true; // Already unsubscribed
      }

      // Remove from DB first
      await this.removeSubscriptionFromDb(this.subscription);

      const result = await this.subscription.unsubscribe();
      this.subscription = null;
      this.removeStoredSubscription();

      log.info('[PushService] Successfully unsubscribed from push notifications');
      return result;
    } catch (error) {
      log.error('[PushService] Failed to unsubscribe:', error);
      return false;
    }
  }

  // Remove subscription from DB
  private async removeSubscriptionFromDb(subscription: PushSubscription): Promise<void> {
    try {
      const user = useAuthStore.getState().user;
      if (!user) return;

      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .match({ user_id: user.id })
        .filter('subscription->>endpoint', 'eq', subscription.endpoint);

      if (error) {
        log.error('[PushService] Failed to remove subscription from DB:', error);
      }
    } catch (error) {
      log.error('[PushService] Error in removeSubscriptionFromDb:', error);
    }
  }


  // Get current subscription
  public async getSubscription(): Promise<PushSubscription | null> {
    try {
      if (!this.registration) {
        return null;
      }

      this.subscription = await this.registration.pushManager.getSubscription();
      return this.subscription;
    } catch (error) {
      log.error('[PushService] Failed to get subscription:', error);
      return null;
    }
  }

  // Send a test notification (client-side only - for development)
  public async sendTestNotification(title: string = 'سامانه مروارید', body: string = 'این یک اعلان آزمایشی است'): Promise<void> {
    try {
      if (!this.subscription) {
        throw new Error('Not subscribed to push notifications');
      }

      // For client-side testing, we can use the service worker to show notifications
      // In production, this would be done server-side
      if (this.registration) {
        await this.registration.showNotification(title, {
          body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-192x192.png',
          dir: 'rtl',
          lang: 'fa-IR',
          tag: 'test-notification',
          requireInteraction: false,
        });
      }

      log.info('[PushService] Test notification sent');
    } catch (error) {
      log.error('[PushService] Failed to send test notification:', error);
      throw error;
    }
  }

  // Send notification for specific events
  public async notifyEvent(eventType: string, data: any): Promise<void> {
    // This is now mainly for local testing or immediate feedback, 
    // real push notifications should come from the server
    try {
      const notifications = {
        'login': { title: 'ورود به سیستم', body: 'با موفقیت وارد شدید' },
        'logout': { title: 'خروج از سیستم', body: 'از سیستم خارج شدید' },
        'sync_complete': { title: 'همگام‌سازی کامل', body: 'داده‌ها با موفقیت همگام‌سازی شدند' },
        'sync_failed': { title: 'خطا در همگام‌سازی', body: 'همگام‌سازی با خطا مواجه شد' },
        'offline_data': { title: 'داده آفلاین', body: `داده جدید در صف همگام‌سازی: ${data?.count || 0} مورد` },
        'farm_update': { title: 'بروزرسانی مزرعه', body: `مزرعه ${data?.name || ''} بروزرسانی شد` },
        'invoice_created': { title: 'فاکتور جدید', body: `فاکتور ${data?.number || ''} ایجاد شد` },
      };

      const notification = notifications[eventType as keyof typeof notifications];
      if (notification) {
        await this.sendTestNotification(notification.title, notification.body);
      }
    } catch (error) {
      log.error('[PushService] Failed to send event notification:', error);
    }
  }

  // Store subscription in localStorage (for demo purposes)
  private storeSubscription(subscription: PushSubscription): void {
    try {
      const subscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: this.arrayBufferToBase64(subscription.getKey('auth')!),
        },
      };
      localStorage.setItem('morvarid_push_subscription', JSON.stringify(subscriptionData));
    } catch (error) {
      log.error('[PushService] Failed to store subscription:', error);
    }
  }

  // Remove stored subscription
  private removeStoredSubscription(): void {
    localStorage.removeItem('morvarid_push_subscription');
  }

  // Utility to convert ArrayBuffer to base64
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const binary = bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
    return btoa(binary);
  }

  // Get stored subscription data
  public getStoredSubscription(): any {
    try {
      const data = localStorage.getItem('morvarid_push_subscription');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  // Check if user is subscribed
  public async isSubscribed(): Promise<boolean> {
    const subscription = await this.getSubscription();
    return subscription !== null;
  }

  // Initialize subscription on app start
  public async initializeSubscription(): Promise<void> {
    try {
      if (!this.isSupported()) {
        return;
      }

      const subscription = await this.getSubscription();
      if (subscription) {
        this.subscription = subscription;
        log.info('[PushService] Existing subscription found');
        // Ensure DB is in sync on startup
        await this.syncSubscriptionToDb(this.subscription);
      } else {
        log.info('[PushService] No existing subscription');
        // Optional: Auto-subscribe if user is logged in? 
        // Better to let user initiate or do it once after login.
      }
    } catch (error) {
      log.error('[PushService] Failed to initialize subscription:', error);
    }
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();

// Utility functions for common use cases
export const initializePushNotifications = () => pushNotificationService.initializeSubscription();
export const subscribeToPushNotifications = () => pushNotificationService.subscribe();
export const unsubscribeFromPushNotifications = () => pushNotificationService.unsubscribe();
export const isPushSupported = () => pushNotificationService.isSupported();
export const notifyEvent = (eventType: string, data?: any) => pushNotificationService.notifyEvent(eventType, data);
