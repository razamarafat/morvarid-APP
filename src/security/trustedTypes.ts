// Trusted Types API implementation for enhanced security
// This prevents XSS attacks by ensuring only trusted content is inserted into DOM

interface TrustedTypesPolicy {
  createHTML: (input: string) => TrustedHTML;
  createScript: (input: string) => TrustedScript;
  createScriptURL: (input: string) => TrustedScriptURL;
}

declare global {
  interface Window {
    trustedTypes: {
      createPolicy: (name: string, rules: Partial<TrustedTypesPolicy>) => TrustedTypesPolicy;
      defaultPolicy?: TrustedTypesPolicy;
    };
  }
}

class TrustedTypesManager {
  private policy: TrustedTypesPolicy | null = null;
  private readonly POLICY_NAME = 'morvarid-policy';

  constructor() {
    this.initializePolicy();
  }

  private initializePolicy(): void {
    // Check if Trusted Types is supported
    if (!this.isSupported()) {
      console.warn('[TrustedTypes] Not supported in this browser');
      return;
    }

    try {
      this.policy = window.trustedTypes.createPolicy(this.POLICY_NAME, {
        createHTML: (input: string) => {
          // Sanitize HTML input
          const sanitized = this.sanitizeHTML(input);
          return sanitized as unknown as TrustedHTML;
        },
        createScript: (input: string) => {
          // Only allow specific safe scripts
          if (this.isSafeScript(input)) {
            return input as unknown as TrustedScript;
          }
          throw new Error('Unsafe script blocked by Trusted Types');
        },
        createScriptURL: (input: string) => {
          // Only allow specific safe script URLs
          if (this.isSafeScriptURL(input)) {
            return input as unknown as TrustedScriptURL;
          }
          throw new Error('Unsafe script URL blocked by Trusted Types');
        }
      });

      console.log('[TrustedTypes] Policy initialized successfully');
    } catch (error) {
      console.error('[TrustedTypes] Failed to initialize policy:', error);
    }
  }

  private sanitizeHTML(input: string): string {
    // Basic HTML sanitization - remove dangerous tags and attributes
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = input;

    // Remove dangerous elements
    const dangerousElements = tempDiv.querySelectorAll('script, iframe, object, embed, form[action], meta[http-equiv]');
    dangerousElements.forEach(el => el.remove());

    // Remove dangerous attributes
    const allElements = tempDiv.querySelectorAll('*');
    allElements.forEach(el => {
      const element = el as HTMLElement;
      // Remove event handlers and dangerous attributes
      Array.from(element.attributes).forEach(attr => {
        if (attr.name.startsWith('on') ||
            attr.name === 'href' && attr.value.startsWith('javascript:') ||
            attr.name === 'src' && attr.value.startsWith('javascript:')) {
          element.removeAttribute(attr.name);
        }
      });
    });

    return tempDiv.innerHTML;
  }

  private isSafeScript(script: string): boolean {
    // Only allow specific safe scripts
    const safePatterns = [
      /^console\./,
      /^\/\/.*$/, // Comments
      /^\s*$/, // Empty/whitespace
    ];

    return safePatterns.some(pattern => pattern.test(script.trim()));
  }

  private isSafeScriptURL(url: string): boolean {
    // Only allow same-origin script URLs
    try {
      const scriptUrl = new URL(url, window.location.origin);
      return scriptUrl.origin === window.location.origin;
    } catch {
      return false;
    }
  }

  public isSupported(): boolean {
    return 'trustedTypes' in window;
  }

  public createHTML(input: string): string | TrustedHTML {
    if (!this.policy) {
      // Fallback to basic sanitization
      return this.sanitizeHTML(input);
    }

    try {
      return this.policy.createHTML(input);
    } catch (error) {
      console.error('[TrustedTypes] Failed to create trusted HTML:', error);
      return '';
    }
  }

  public createScript(input: string): string | TrustedScript {
    if (!this.policy) {
      throw new Error('Trusted Types not supported');
    }

    try {
      return this.policy.createScript(input);
    } catch (error) {
      console.error('[TrustedTypes] Failed to create trusted script:', error);
      throw error;
    }
  }

  public createScriptURL(input: string): string | TrustedScriptURL {
    if (!this.policy) {
      throw new Error('Trusted Types not supported');
    }

    try {
      return this.policy.createScriptURL(input);
    } catch (error) {
      console.error('[TrustedTypes] Failed to create trusted script URL:', error);
      throw error;
    }
  }

  // Utility method to safely set innerHTML
  public setInnerHTML(element: HTMLElement, html: string): void {
    if (this.isSupported() && this.policy) {
      element.innerHTML = this.policy.createHTML(html) as unknown as string;
    } else {
      // Fallback with sanitization
      element.innerHTML = this.sanitizeHTML(html);
    }
  }

  // Utility method to safely execute scripts
  public executeScript(script: string): void {
    if (!this.isSafeScript(script)) {
      throw new Error('Script execution blocked by Trusted Types');
    }

    try {
      // eslint-disable-next-line no-eval
      eval(script);
    } catch (error) {
      console.error('[TrustedTypes] Script execution failed:', error);
    }
  }
}

// Export singleton instance
export const trustedTypes = new TrustedTypesManager();

// Utility functions for common use cases
export const sanitizeHTML = (input: string): string => {
  return trustedTypes.createHTML(input) as string;
};

export const setInnerHTMLSafely = (element: HTMLElement, html: string): void => {
  trustedTypes.setInnerHTML(element, html);
};

// React-specific utilities
export const createTrustedJSX = (htmlString: string): { __html: string } => {
  return { __html: sanitizeHTML(htmlString) };
};
