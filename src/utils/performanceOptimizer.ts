/**
 * 🚀 Performance Optimizer & Monitor
 * ═════════════════════════════════════
 * 
 * ابزار نظارت و بهینه‌سازی عملکرد runtime
 */

import { log } from './logger';

interface PerformanceMetric {
  name: string;
  value: number;
  threshold: number;
  unit: string;
}

class PerformanceOptimizer {
  private observer: PerformanceObserver | null = null;
  private metrics: Map<string, PerformanceMetric> = new Map();

  constructor() {
    this.initializeObserver();
  }

  private initializeObserver() {
    if ('PerformanceObserver' in window) {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.processPerformanceEntry(entry);
        }
      });

      // مانیتور انواع مختلف performance entries
      try {
        this.observer.observe({ entryTypes: ['navigation', 'resource', 'paint', 'largest-contentful-paint'] });
      } catch (error) {
        log.warn('Performance observer initialization failed', error);
      }
    }
  }

  private processPerformanceEntry(entry: PerformanceEntry) {
    switch (entry.entryType) {
      case 'navigation':
        this.processNavigationTiming(entry as PerformanceNavigationTiming);
        break;
      case 'paint':
        this.processPaintTiming(entry);
        break;
      case 'largest-contentful-paint':
        this.processLCPTiming(entry);
        break;
      case 'resource':
        this.processResourceTiming(entry as PerformanceResourceTiming);
        break;
    }
  }

  private processNavigationTiming(entry: PerformanceNavigationTiming) {
    const metrics = {
      dns: { value: entry.domainLookupEnd - entry.domainLookupStart, threshold: 100, unit: 'ms' },
      tcp: { value: entry.connectEnd - entry.connectStart, threshold: 100, unit: 'ms' },
      ssl: { value: entry.connectEnd - entry.secureConnectionStart, threshold: 200, unit: 'ms' },
      ttfb: { value: entry.responseStart - entry.requestStart, threshold: 200, unit: 'ms' },
      domContentLoaded: { value: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart, threshold: 100, unit: 'ms' },
      loadComplete: { value: entry.loadEventEnd - entry.loadEventStart, threshold: 500, unit: 'ms' }
    };

    Object.entries(metrics).forEach(([name, metric]) => {
      this.metrics.set(name, { name, ...metric });
      if (metric.value > metric.threshold) {
        log.warn(`Performance issue detected: ${name}`, { 
          value: metric.value, 
          threshold: metric.threshold, 
          unit: metric.unit 
        });
      }
    });
  }

  private processPaintTiming(entry: PerformanceEntry) {
    const threshold = entry.name === 'first-paint' ? 1000 : 1800; // FP: 1s, FCP: 1.8s
    this.metrics.set(entry.name, {
      name: entry.name,
      value: entry.startTime,
      threshold,
      unit: 'ms'
    });

    if (entry.startTime > threshold) {
      log.warn(`Paint performance issue: ${entry.name}`, {
        value: entry.startTime,
        threshold,
        unit: 'ms'
      });
    }
  }

  private processLCPTiming(entry: PerformanceEntry) {
    const threshold = 2500; // LCP should be under 2.5s
    this.metrics.set('lcp', {
      name: 'largest-contentful-paint',
      value: entry.startTime,
      threshold,
      unit: 'ms'
    });

    if (entry.startTime > threshold) {
      log.warn('LCP performance issue detected', {
        value: entry.startTime,
        threshold,
        unit: 'ms'
      });
    }
  }

  private processResourceTiming(entry: PerformanceResourceTiming) {
    // فقط منابع بزرگ را بررسی کنیم
    if (entry.transferSize > 100000) { // بیش از 100KB
      const loadTime = entry.responseEnd - entry.requestStart;
      if (loadTime > 1000) { // بیش از 1 ثانیه
        log.warn('Slow resource loading detected', {
          resource: entry.name,
          size: entry.transferSize,
          loadTime,
          unit: 'ms'
        });
      }
    }
  }

  /**
   * اندازه‌گیری عملکرد JavaScript
   */
  public measureJSPerformance<T>(name: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    if (duration > 16) { // بیش از یک فریم (16ms)
      log.warn(`Slow JavaScript execution: ${name}`, {
        duration,
        unit: 'ms'
      });
    }

    return result;
  }

  /**
   * اندازه‌گیری عملکرد async operations
   */
  public async measureAsyncPerformance<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;

    this.metrics.set(`async-${name}`, {
      name: `async-${name}`,
      value: duration,
      threshold: 1000, // 1 second threshold for async operations
      unit: 'ms'
    });

    if (duration > 1000) {
      log.warn(`Slow async operation: ${name}`, {
        duration,
        unit: 'ms'
      });
    }

    return result;
  }

  /**
   * بررسی memory usage
   */
  public checkMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const memoryUsage = {
        used: Math.round(memory.usedJSHeapSize / 1048576), // MB
        total: Math.round(memory.totalJSHeapSize / 1048576), // MB
        limit: Math.round(memory.jsHeapSizeLimit / 1048576) // MB
      };

      const usagePercentage = (memoryUsage.used / memoryUsage.limit) * 100;

      if (usagePercentage > 70) {
        log.warn('High memory usage detected', {
          ...memoryUsage,
          usagePercentage: Math.round(usagePercentage),
          unit: 'MB'
        });
      }

      this.metrics.set('memory-usage', {
        name: 'memory-usage',
        value: usagePercentage,
        threshold: 70,
        unit: '%'
      });
    }
  }

  /**
   * گزارش کامل performance
   */
  public generateReport(): { metrics: PerformanceMetric[]; issues: PerformanceMetric[]; score: number } {
    this.checkMemoryUsage();
    
    const metrics = Array.from(this.metrics.values());
    const issues = metrics.filter(metric => metric.value > metric.threshold);
    
    // محاسبه امتیاز کلی (0-100)
    const totalMetrics = metrics.length;
    const problemMetrics = issues.length;
    const score = Math.max(0, Math.round(((totalMetrics - problemMetrics) / totalMetrics) * 100));

    log.info('Performance Report Generated', {
      totalMetrics,
      issues: problemMetrics,
      score
    });

    return { metrics, issues, score };
  }

  /**
   * پاکسازی observer
   */
  public destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

// Global instance
let performanceOptimizer: PerformanceOptimizer | null = null;

export const getPerformanceOptimizer = (): PerformanceOptimizer => {
  if (!performanceOptimizer) {
    performanceOptimizer = new PerformanceOptimizer();
  }
  return performanceOptimizer;
};

export { PerformanceOptimizer };
export default PerformanceOptimizer;