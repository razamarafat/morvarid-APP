import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Icons } from './Icons';
import Button from './Button';
import { log } from '../../utils/logger';

interface OfflineState {
  isOnline: boolean;
  lastOnlineTime: number | null;
  retryCount: number;
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  routeName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  offlineState: OfflineState;
}

class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      offlineState: {
        isOnline: navigator.onLine,
        lastOnlineTime: navigator.onLine ? Date.now() : null,
        retryCount: 0,
      },
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // به‌روزرسانی state تا UI خطا نمایش داده شود
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // ثبت خطا در سیستم logging
    log.error(`Route Error in ${this.props.routeName || 'Unknown Route'}`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      isOnline: this.state.offlineState.isOnline,
      userAgent: navigator.userAgent,
    });

    // Detect if this might be a network-related error
    const isNetworkError = this.isNetworkError(error);

    this.setState({
      error,
      errorInfo,
      offlineState: {
        ...this.state.offlineState,
        isOnline: navigator.onLine,
        lastOnlineTime: navigator.onLine ? Date.now() : this.state.offlineState.lastOnlineTime,
      },
    });

    // Set up offline/online listeners if not already done
    if (!this.offlineListenerAttached) {
      this.setupNetworkListeners();
    }
  }

  private offlineListenerAttached = false;

  private setupNetworkListeners() {
    if (this.offlineListenerAttached) return;

    const handleOnline = () => {
      this.setState(prevState => ({
        offlineState: {
          ...prevState.offlineState,
          isOnline: true,
          lastOnlineTime: Date.now(),
          retryCount: 0,
        },
      }));
    };

    const handleOffline = () => {
      this.setState(prevState => ({
        offlineState: {
          ...prevState.offlineState,
          isOnline: false,
        },
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    this.offlineListenerAttached = true;

    // Cleanup function
    this.cleanup = () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }

  private cleanup?: () => void;

  private isNetworkError(error: Error): boolean {
    const networkErrorPatterns = [
      /network/i,
      /fetch/i,
      /connection/i,
      /timeout/i,
      /offline/i,
      /failed to fetch/i,
      /load chunk/i, // Code splitting errors often indicate network issues
    ];

    return networkErrorPatterns.some(pattern =>
      pattern.test(error.message) || (error.stack && pattern.test(error.stack))
    );
  }

  handleRetry = () => {
    // تلاش مجدد برای بارگذاری کامپوننت
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      offlineState: {
        ...prevState.offlineState,
        retryCount: prevState.offlineState.retryCount + 1,
      },
    }));
  };

  handleOfflineRetry = () => {
    // Special handling for offline scenarios
    if (!navigator.onLine) {
      // Show a message that we're waiting for connection
      log.info('User attempted retry while offline', {
        routeName: this.props.routeName,
        retryCount: this.state.offlineState.retryCount,
      });
      return;
    }

    // If back online, attempt retry
    this.handleRetry();
  };

  handleReload = () => {
    // رفرش کل صفحه
    window.location.reload();
  };

  componentWillUnmount() {
    // Cleanup network listeners
    if (this.cleanup) {
      this.cleanup();
    }
  }

  render() {
    if (this.state.hasError) {
      // اگر fallback مشخص شده، آن را نمایش بده
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { offlineState, error } = this.state;
      const isNetworkError = error && this.isNetworkError(error);
      const isOffline = !offlineState.isOnline;
      const showOfflineUI = isNetworkError || isOffline;

      // UI مخصوص حالت آفلاین/شبکه
      if (showOfflineUI) {
        return (
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-[24px] shadow-lg p-8 text-center border border-gray-200 dark:border-gray-700">
              {/* آیکن آفلاین */}
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                  <Icons.Globe className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                </div>
              </div>

              {/* پیام آفلاین */}
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                {isOffline ? 'اتصال اینترنت قطع است' : 'مشکل اتصال شبکه'}
              </h2>

              <p className="text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
                {isOffline
                  ? 'لطفاً اتصال اینترنت خود را بررسی کرده و دوباره تلاش کنید.'
                  : 'مشکلی در اتصال به سرور وجود دارد. لطفاً اتصال خود را بررسی کنید.'
                }
              </p>

              {offlineState.lastOnlineTime && (
                <p className="text-xs text-gray-500 dark:text-gray-500 mb-6">
                  آخرین اتصال: {new Date(offlineState.lastOnlineTime).toLocaleTimeString('fa-IR')}
                </p>
              )}

              {/* وضعیت اتصال */}
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm mb-6 ${
                isOffline
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                  : 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
              }`}>
                <div className={`w-2 h-2 rounded-full ${isOffline ? 'bg-red-500' : 'bg-orange-500 animate-pulse'}`} />
                {isOffline ? 'آفلاین' : 'در حال بررسی اتصال...'}
              </div>

              {/* دکمه‌های عملیات برای حالت آفلاین */}
              <div className="flex flex-col gap-3">
                <Button
                  onClick={this.handleOfflineRetry}
                  disabled={isOffline}
                  className="w-full"
                >
                  <Icons.Refresh className="ml-2 h-4 w-4" />
                  {isOffline ? 'در انتظار اتصال...' : 'تلاش مجدد'}
                </Button>

                <Button
                  onClick={() => window.location.reload()}
                  variant="secondary"
                  className="w-full"
                >
                  <Icons.Refresh className="ml-2 h-4 w-4" />
                  بارگذاری مجدد صفحه
                </Button>
              </div>
            </div>
          </div>
        );
      }

      // UI پیش‌فرض برای خطا
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-[24px] shadow-lg p-8 text-center border border-gray-200 dark:border-gray-700">
            {/* آیکن خطا */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <Icons.AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
            </div>

            {/* پیام خطا */}
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
              خطا در بارگذاری صفحه
            </h2>

            <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
              {this.props.routeName ? (
                <>مشکلی در بارگذاری بخش «{this.props.routeName}» رخ داده است. لطفاً دوباره تلاش کنید.</>
              ) : (
                <>مشکلی در بارگذاری این صفحه رخ داده است. لطفاً دوباره تلاش کنید.</>
              )}
            </p>

            {/* جزئیات خطا در محیط development */}
            {import.meta.env.DEV && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  جزئیات خطا (Development Mode)
                </summary>
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg text-xs font-mono text-red-700 dark:text-red-400 overflow-auto max-h-32">
                  <div className="font-bold mb-1">{this.state.error.name}:</div>
                  <div className="mb-2">{this.state.error.message}</div>
                  {this.state.error.stack && (
                    <div className="whitespace-pre-wrap text-[10px] opacity-75">
                      {this.state.error.stack}
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* دکمه‌های عملیات */}
            <div className="flex flex-col gap-3">
              <Button onClick={this.handleRetry} className="w-full">
                <Icons.Refresh className="ml-2 h-4 w-4" />
                تلاش مجدد
              </Button>
              
              <Button 
                onClick={this.handleReload} 
                variant="secondary" 
                className="w-full"
              >
                <Icons.Refresh className="ml-2 h-4 w-4" />
                بارگذاری مجدد صفحه
              </Button>

              <Button 
                onClick={() => window.history.back()} 
                variant="ghost" 
                className="w-full text-sm"
              >
                <Icons.ArrowLeft className="ml-2 h-4 w-4" />
                بازگشت به صفحه قبل
              </Button>
            </div>

            {/* اطلاعات اضافی */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                اگر مشکل همچنان ادامه دارد، لطفاً با پشتیبانی تماس بگیرید.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RouteErrorBoundary;