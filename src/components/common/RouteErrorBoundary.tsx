import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Icons } from './Icons';
import Button from './Button';
import { log } from '../../utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  routeName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
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
    });

    this.setState({
      error,
      errorInfo,
    });
  }

  handleRetry = () => {
    // تلاش مجدد برای بارگذاری کامپوننت
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    // رفرش کل صفحه
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // اگر fallback مشخص شده، آن را نمایش بده
      if (this.props.fallback) {
        return this.props.fallback;
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