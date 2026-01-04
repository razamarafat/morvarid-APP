/**
 * Production-Safe Logging System
 * جایگزین امن console.log برای محیط production
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogConfig {
  enabled: boolean;
  level: LogLevel;
  includeTimestamp: boolean;
  includeStackTrace: boolean;
}

class Logger {
  private config: LogConfig;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = import.meta.env.DEV || import.meta.env.VITE_DEBUG_MODE === 'true';
    
    this.config = {
      enabled: this.isDevelopment,
      level: this.isDevelopment ? 'debug' : 'error',
      includeTimestamp: true,
      includeStackTrace: false
    };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevel = levels.indexOf(level);
    
    return messageLevel >= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, context?: any): string {
    let formatted = `[${level.toUpperCase()}]`;
    
    if (this.config.includeTimestamp) {
      const timestamp = new Date().toLocaleString('fa-IR');
      formatted = `${timestamp} ${formatted}`;
    }
    
    return `${formatted} ${message}`;
  }

  private logToConsole(level: LogLevel, message: string, context?: any) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, context);
    
    switch (level) {
      case 'debug':
        console.log(`%c${formattedMessage}`, 'color: #6B7280;', context);
        break;
      case 'info':
        console.log(`%c${formattedMessage}`, 'color: #3B82F6;', context);
        break;
      case 'warn':
        console.warn(`%c${formattedMessage}`, 'color: #F59E0B;', context);
        break;
      case 'error':
        console.error(`%c${formattedMessage}`, 'color: #DC2626;', context);
        break;
    }
  }

  /**
   * اطلاعات عمومی سیستم
   */
  public info(message: string, context?: any) {
    this.logToConsole('info', message, context);
  }

  /**
   * اطلاعات debug فقط در development
   */
  public debug(message: string, context?: any) {
    this.logToConsole('debug', message, context);
  }

  /**
   * هشدارها
   */
  public warn(message: string, context?: any) {
    this.logToConsole('warn', message, context);
  }

  /**
   * خطاهای مهم
   */
  public error(message: string, error?: Error | any) {
    this.logToConsole('error', message, error);
    
    // در production، خطاها را به سرویس مانیتورینگ ارسال کنید
    if (!this.isDevelopment && error) {
      this.sendToMonitoring(message, error);
    }
  }

  /**
   * موفقیت عملیات
   */
  public success(message: string, context?: any) {
    if (this.isDevelopment) {
      console.log(`%c✅ ${message}`, 'color: #10B981; font-weight: bold;', context);
    }
  }

  /**
   * شروع عملیات
   */
  public start(operation: string) {
    this.debug(`🚀 Starting: ${operation}`);
  }

  /**
   * پایان عملیات
   */
  public end(operation: string, duration?: number) {
    const durationText = duration ? ` (${duration}ms)` : '';
    this.debug(`✅ Completed: ${operation}${durationText}`);
  }

  private async sendToMonitoring(message: string, error: any) {
    try {
      // اینجا می‌توانید به سرویس مانیتورینگ مثل Sentry ارسال کنید
      // await sendToSentry({ message, error, timestamp: Date.now() });
    } catch (monitoringError) {
      // اگر ارسال به مانیتورینگ خراب شد، حداقل در console ثبت کنید
      console.error('Failed to send error to monitoring:', monitoringError);
    }
  }

  /**
   * تغییر تنظیمات logger
   */
  public configure(config: Partial<LogConfig>) {
    this.config = { ...this.config, ...config };
  }
}

// ایجاد instance واحد برای استفاده در کل اپلیکیشن
export const logger = new Logger();

// Helper functions برای سهولت استفاده
export const log = {
  info: (message: string, context?: any) => logger.info(message, context),
  debug: (message: string, context?: any) => logger.debug(message, context),
  warn: (message: string, context?: any) => logger.warn(message, context),
  error: (message: string, error?: any) => logger.error(message, error),
  success: (message: string, context?: any) => logger.success(message, context),
  start: (operation: string) => logger.start(operation),
  end: (operation: string, duration?: number) => logger.end(operation, duration)
};

export default logger;