
/**
 * MORVARID SYSTEM: MONITORING UTILITY
 * Lightweight internal error tracking and performance monitoring.
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    stack?: string;
    context?: any;
    version: string;
}

class Monitor {
    private static instance: Monitor;
    private readonly MAX_LOGS = 50;
    private readonly STORAGE_KEY = 'morvarid_monitor_logs';

    private constructor() {
        this.captureGlobalErrors();
    }

    public static getInstance(): Monitor {
        if (!Monitor.instance) {
            Monitor.instance = new Monitor();
        }
        return Monitor.instance;
    }

    /**
     * Log an error to the monitoring system
     */
    public logError(error: Error | string, context?: any): void {
        const message = error instanceof Error ? error.message : error;
        const stack = error instanceof Error ? error.stack : undefined;

        this.saveLog({
            level: 'error',
            message,
            stack,
            context,
            timestamp: new Date().toISOString(),
            version: '3.4.0' // Will stay in sync via constants
        });

        console.error(`[Monitor] 🔴 ${message}`, { context, stack });
    }

    /**
     * Log informational data
     */
    public logInfo(message: string, context?: any): void {
        this.saveLog({
            level: 'info',
            message,
            context,
            timestamp: new Date().toISOString(),
            version: '3.4.0'
        });

        if (import.meta.env.DEV) {
            console.log(`[Monitor] 🔵 ${message}`, context);
        }
    }

    /**
     * Captures uncaught exceptions and unhandled promise rejections
     */
    private captureGlobalErrors(): void {
        window.addEventListener('error', (event) => {
            this.logError(event.error || event.message, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.logError('Unhandled Rejection', {
                reason: event.reason
            });
        });
    }

    /**
     * Internal: Save log to localStorage for persistence
     */
    private saveLog(entry: LogEntry): void {
        try {
            const logs = this.getLogs();
            logs.unshift(entry);

            // Keep only latest logs
            const trimmedLogs = logs.slice(0, this.MAX_LOGS);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmedLogs));
        } catch (e) {
            console.warn('[Monitor] Failed to save log to storage', e);
        }
    }

    /**
     * Retrieve all stored logs
     */
    public getLogs(): LogEntry[] {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    }

    /**
     * Clear all logs
     */
    public clearLogs(): void {
        localStorage.removeItem(this.STORAGE_KEY);
    }
}

export const monitor = Monitor.getInstance();
