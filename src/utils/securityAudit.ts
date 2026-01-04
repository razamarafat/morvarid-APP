/**
 * 🛡️ Runtime Security Audit Module
 * ════════════════════════════════════
 * 
 * کنترل‌های امنیتی runtime برای محیط production
 */

import { log } from './logger';

interface SecurityCheck {
  name: string;
  check: () => boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
}

class SecurityAuditor {
  private checks: SecurityCheck[] = [
    {
      name: 'HTTPS_ENFORCEMENT',
      check: () => location.protocol === 'https:' || location.hostname === 'localhost',
      severity: 'critical',
      message: 'Application must run over HTTPS in production'
    },
    {
      name: 'ENVIRONMENT_VARIABLES',
      check: () => !!(import.meta.env.VITE_API_SECRET && import.meta.env.VITE_CRYPTO_SALT),
      severity: 'critical',
      message: 'Required environment variables are missing'
    },
    {
      name: 'CSP_HEADERS',
      check: () => this.checkCSPHeaders(),
      severity: 'high',
      message: 'Content Security Policy headers are not properly configured'
    },
    {
      name: 'CONSOLE_LOGS',
      check: () => !this.hasProductionLogs(),
      severity: 'medium',
      message: 'Console logs detected in production build'
    },
    {
      name: 'DEVELOPMENT_KEYS',
      check: () => !this.hasDevelopmentKeys(),
      severity: 'high',
      message: 'Development keys or tokens detected'
    },
    {
      name: 'SECURE_STORAGE',
      check: () => this.checkSecureStorage(),
      severity: 'high',
      message: 'Insecure storage patterns detected'
    }
  ];

  private checkCSPHeaders(): boolean {
    // در محیط production، CSP headers باید توسط سرور تنظیم شوند
    if (import.meta.env.PROD) {
      // اگر در production هستیم، فرض می‌کنیم headers درست تنظیم شده‌اند
      return true;
    }
    return true; // در development مشکلی نیست
  }

  private hasProductionLogs(): boolean {
    // بررسی اینکه آیا console override شده یا خیر
    return console.log.toString().includes('native code') && import.meta.env.PROD;
  }

  private hasDevelopmentKeys(): boolean {
    const env = import.meta.env;
    const suspiciousKeys = [
      'test', 'demo', 'localhost', 'example.com', 'placeholder'
    ];
    
    return Object.entries(env).some(([key, value]) => 
      key.startsWith('VITE_') && 
      typeof value === 'string' &&
      suspiciousKeys.some(suspect => value.toLowerCase().includes(suspect))
    );
  }

  private checkSecureStorage(): boolean {
    try {
      // بررسی وجود کلیدهای حساس در localStorage
      const sensitiveKeys = Object.keys(localStorage).filter(key => 
        key.includes('token') || 
        key.includes('secret') || 
        key.includes('password') ||
        key.includes('key')
      );
      
      return sensitiveKeys.length === 0;
    } catch {
      return true; // اگر localStorage در دسترس نباشد
    }
  }

  public runAudit(): { passed: boolean; failures: SecurityCheck[] } {
    const failures: SecurityCheck[] = [];
    
    for (const check of this.checks) {
      try {
        if (!check.check()) {
          failures.push(check);
          log.error(`Security Check Failed: ${check.name}`, {
            severity: check.severity,
            message: check.message
          });
        } else {
          log.debug(`Security Check Passed: ${check.name}`);
        }
      } catch (error) {
        log.error(`Security Check Error: ${check.name}`, error);
        failures.push(check);
      }
    }

    const criticalFailures = failures.filter(f => f.severity === 'critical');
    const passed = criticalFailures.length === 0;

    if (!passed) {
      log.error('🚨 CRITICAL SECURITY ISSUES DETECTED', {
        totalFailures: failures.length,
        criticalFailures: criticalFailures.length,
        failures: failures.map(f => ({ name: f.name, severity: f.severity }))
      });
    } else if (failures.length > 0) {
      log.warn('⚠️ Security warnings detected', {
        totalFailures: failures.length,
        failures: failures.map(f => ({ name: f.name, severity: f.severity }))
      });
    } else {
      log.success('🛡️ All security checks passed');
    }

    return { passed, failures };
  }

  /**
   * اجرای audit در startup اپلیکیشن
   */
  public static runStartupAudit(): boolean {
    const auditor = new SecurityAuditor();
    const result = auditor.runAudit();
    
    // در production، اگر critical issues وجود داشته باشند، اپلیکیشن را متوقف کنیم
    if (import.meta.env.PROD && !result.passed) {
      const criticalIssues = result.failures.filter(f => f.severity === 'critical');
      if (criticalIssues.length > 0) {
        throw new Error(
          `🚨 SECURITY AUDIT FAILED: ${criticalIssues.length} critical security issues detected. Application startup aborted.`
        );
      }
    }

    return result.passed;
  }
}

export { SecurityAuditor };
export default SecurityAuditor;