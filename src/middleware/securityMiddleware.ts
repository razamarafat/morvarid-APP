/**
 * 🛡️ ENTERPRISE SECURITY MIDDLEWARE
 * ══════════════════════════════════════
 * 
 * لایه میانی امنیتی برای تمام درخواست‌ها و عملیات
 */

import { log } from '../utils/logger';
import { securityEngine } from '../security/enterprise-security';
import { sanitizeString } from '../utils/sanitizers';

// 🔐 CSRF Protection Token Management
export class CSRFProtection {
  private static tokens: Map<string, { token: string; expires: number }> = new Map();
  
  static generateToken(sessionId: string): string {
    const token = crypto.randomUUID();
    const expires = Date.now() + (30 * 60 * 1000); // 30 minutes
    
    this.tokens.set(sessionId, { token, expires });
    
    // Cleanup expired tokens
    setTimeout(() => this.cleanupExpired(), 60000);
    
    return token;
  }
  
  static validateToken(sessionId: string, token: string): boolean {
    const stored = this.tokens.get(sessionId);
    if (!stored) return false;
    
    if (Date.now() > stored.expires) {
      this.tokens.delete(sessionId);
      return false;
    }
    
    return stored.token === token;
  }
  
  private static cleanupExpired(): void {
    const now = Date.now();
    for (const [sessionId, data] of this.tokens) {
      if (now > data.expires) {
        this.tokens.delete(sessionId);
      }
    }
  }
}

// 🔒 Request Sanitization & Validation
export class RequestSanitizer {
  /**
   * پاکسازی و اعتبارسنجی کامل درخواست
   */
  static sanitizeRequest(data: any, context: 'form' | 'api' | 'upload' = 'form'): {
    sanitized: any;
    violations: string[];
    riskScore: number;
  } {
    const violations: string[] = [];
    let riskScore = 0;
    const sanitized: any = {};

    if (!data || typeof data !== 'object') {
      return { sanitized: {}, violations: ['Invalid data structure'], riskScore: 100 };
    }

    for (const [key, value] of Object.entries(data)) {
      const fieldResult = this.sanitizeField(key, value, context);
      sanitized[key] = fieldResult.sanitized;
      violations.push(...fieldResult.violations);
      riskScore += fieldResult.riskScore;
    }

    // Additional context-specific checks
    if (context === 'api') {
      const apiCheck = this.validateAPIPayload(sanitized);
      violations.push(...apiCheck.violations);
      riskScore += apiCheck.riskScore;
    }

    return { sanitized, violations, riskScore: Math.min(riskScore, 100) };
  }

  private static sanitizeField(key: string, value: any, context: string): {
    sanitized: any;
    violations: string[];
    riskScore: number;
  } {
    const violations: string[] = [];
    let riskScore = 0;
    let sanitized = value;

    // Key validation
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      violations.push(`Invalid field name: ${key}`);
      riskScore += 15;
    }

    // Type-specific sanitization
    if (typeof value === 'string') {
      const stringResult = this.sanitizeString(value, key);
      sanitized = stringResult.sanitized;
      violations.push(...stringResult.violations);
      riskScore += stringResult.riskScore;
    } else if (Array.isArray(value)) {
      const arrayResult = this.sanitizeArray(value, key);
      sanitized = arrayResult.sanitized;
      violations.push(...arrayResult.violations);
      riskScore += arrayResult.riskScore;
    } else if (value && typeof value === 'object') {
      const objectResult = this.sanitizeRequest(value, context);
      sanitized = objectResult.sanitized;
      violations.push(...objectResult.violations.map(v => `${key}.${v}`));
      riskScore += objectResult.riskScore;
    }

    return { sanitized, violations, riskScore };
  }

  private static sanitizeString(value: string, fieldName: string): {
    sanitized: string;
    violations: string[];
    riskScore: number;
  } {
    const violations: string[] = [];
    let riskScore = 0;

    // Length validation
    if (value.length > 10000) {
      violations.push(`Field ${fieldName} exceeds maximum length`);
      riskScore += 20;
      value = value.substring(0, 10000);
    }

    // Security scan
    const securityCheck = securityEngine.monitor.scanForThreats(value, 'input_field');
    if (!securityCheck.isSafe) {
      violations.push(`Security threats detected in ${fieldName}: ${securityCheck.threats.join(', ')}`);
      riskScore += securityCheck.riskScore;
    }

    // Sanitize the string
    const sanitized = sanitizeString(value);

    // Special field validations
    if (fieldName.toLowerCase().includes('email')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(sanitized)) {
        violations.push(`Invalid email format in ${fieldName}`);
        riskScore += 10;
      }
    }

    if (fieldName.toLowerCase().includes('phone')) {
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      if (!phoneRegex.test(sanitized.replace(/[\s\-\(\)]/g, ''))) {
        violations.push(`Invalid phone format in ${fieldName}`);
        riskScore += 5;
      }
    }

    return { sanitized, violations, riskScore };
  }

  private static sanitizeArray(value: any[], fieldName: string): {
    sanitized: any[];
    violations: string[];
    riskScore: number;
  } {
    const violations: string[] = [];
    let riskScore = 0;

    // Array length validation
    if (value.length > 1000) {
      violations.push(`Array ${fieldName} exceeds maximum length`);
      riskScore += 15;
      value = value.slice(0, 1000);
    }

    const sanitized = value.map((item, index) => {
      if (typeof item === 'string') {
        const stringResult = this.sanitizeString(item, `${fieldName}[${index}]`);
        violations.push(...stringResult.violations);
        riskScore += stringResult.riskScore;
        return stringResult.sanitized;
      } else if (item && typeof item === 'object') {
        const objectResult = this.sanitizeRequest(item, 'form');
        violations.push(...objectResult.violations.map(v => `${fieldName}[${index}].${v}`));
        riskScore += objectResult.riskScore;
        return objectResult.sanitized;
      }
      return item;
    });

    return { sanitized, violations, riskScore };
  }

  private static validateAPIPayload(data: any): { violations: string[]; riskScore: number } {
    const violations: string[] = [];
    let riskScore = 0;

    // Check for common API attack patterns
    const jsonString = JSON.stringify(data);
    
    if (jsonString.includes('__proto__')) {
      violations.push('Prototype pollution attempt detected');
      riskScore += 50;
    }

    if (jsonString.includes('constructor')) {
      violations.push('Constructor manipulation attempt detected');
      riskScore += 30;
    }

    // Size validation
    if (jsonString.length > 100000) { // 100KB
      violations.push('Payload size exceeds limit');
      riskScore += 25;
    }

    return { violations, riskScore };
  }
}

// 🔐 Rate Limiting System
export class AdvancedRateLimit {
  private static requests: Map<string, { count: number; window: number; blocked: boolean }> = new Map();
  private static rules: Map<string, { maxRequests: number; windowMs: number; blockDuration: number }> = new Map([
    ['login', { maxRequests: 5, windowMs: 15 * 60 * 1000, blockDuration: 30 * 60 * 1000 }],
    ['api', { maxRequests: 100, windowMs: 60 * 1000, blockDuration: 5 * 60 * 1000 }],
    ['upload', { maxRequests: 10, windowMs: 60 * 1000, blockDuration: 10 * 60 * 1000 }]
  ]);

  static checkLimit(identifier: string, action: string = 'api'): {
    allowed: boolean;
    remainingRequests?: number;
    resetTime?: number;
    reason?: string;
  } {
    const rule = this.rules.get(action);
    if (!rule) {
      return { allowed: true };
    }

    const key = `${action}:${identifier}`;
    const now = Date.now();
    let record = this.requests.get(key);

    // Initialize or reset if window expired
    if (!record || (now - record.window) > rule.windowMs) {
      record = { count: 0, window: now, blocked: false };
      this.requests.set(key, record);
    }

    // Check if currently blocked
    if (record.blocked) {
      const blockExpires = record.window + rule.blockDuration;
      if (now < blockExpires) {
        return {
          allowed: false,
          reason: 'Temporarily blocked due to rate limit violation',
          resetTime: blockExpires
        };
      } else {
        // Block expired, reset
        record.blocked = false;
        record.count = 0;
        record.window = now;
      }
    }

    // Check rate limit
    if (record.count >= rule.maxRequests) {
      record.blocked = true;
      log.warn('Rate limit exceeded', { identifier, action, count: record.count });
      
      return {
        allowed: false,
        reason: 'Rate limit exceeded',
        resetTime: record.window + rule.blockDuration
      };
    }

    // Allow request
    record.count++;
    const remainingRequests = rule.maxRequests - record.count;
    const resetTime = record.window + rule.windowMs;

    return { allowed: true, remainingRequests, resetTime };
  }

  static addCustomRule(action: string, maxRequests: number, windowMs: number, blockDuration?: number): void {
    this.rules.set(action, {
      maxRequests,
      windowMs,
      blockDuration: blockDuration || windowMs * 2
    });
  }
}

// 🔍 Security Headers Enforcement
export class SecurityHeaders {
  static getSecureHeaders(): Record<string, string> {
    return {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'wasm-unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "block-all-mixed-content",
        "upgrade-insecure-requests",
        "trusted-types default"
      ].join('; '),
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': [
        'camera=(),',
        'microphone=(),',
        'geolocation=(self),',
        'payment=()',
        'usb=()'
      ].join(' ')
    };
  }

  static validateHeaders(headers: Headers): { valid: boolean; violations: string[] } {
    const violations: string[] = [];
    const requiredHeaders = this.getSecureHeaders();

    for (const [name, expectedValue] of Object.entries(requiredHeaders)) {
      const actualValue = headers.get(name);
      if (!actualValue) {
        violations.push(`Missing security header: ${name}`);
      } else if (name === 'Content-Security-Policy' && !this.validateCSP(actualValue)) {
        violations.push(`Weak CSP configuration detected`);
      }
    }

    return { valid: violations.length === 0, violations };
  }

  private static validateCSP(csp: string): boolean {
    const dangerous = [
      "'unsafe-eval'",
      "'unsafe-inline'",
      "*",
      "data: script-src",
      "javascript:"
    ];

    return !dangerous.some(danger => csp.includes(danger));
  }
}

// Export middleware functions
export const securityMiddleware = {
  csrf: CSRFProtection,
  sanitizer: RequestSanitizer,
  rateLimit: AdvancedRateLimit,
  headers: SecurityHeaders
};

export default securityMiddleware;