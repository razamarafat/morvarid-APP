
import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  containerClassName?: string;
  /**
   * 20260619 — When true, the input's `onChange` handler strips any Latin
   * English letters (a-zA-Z) from the typed value before propagating to
   * the parent. Keystrokes like Shift, Backspace, Arrow keys, Ctrl
   * shortcuts, smart-paste composition, and IME composing events are NOT
   * stripped — only character values. Pair this with the global Persian
   * enforcer in App.tsx (which uses `data-allow-latin="true"` opt-out).
   *
   * DEFAULT: false — backward compatible. Most call-sites already wrap
   * non-Persian fields in `cleanPersianText` for stricter filtering
   * (driverName, description) or rely on PersianNumberInput for numeric
   * fields. The wrapper opt-in is for future text fields that should
   * behave like the global rule.
   */
  noLatin?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', containerClassName = '', label, error, noLatin = false, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (noLatin) {
        // Strip Latin letters from the immediately-typed value, then sync
        // the input element's value so React's controlled-form contract
        // does not complain. We preserve the caret position.
        const raw = e.target.value;
        const cleaned = raw.replace(/[a-zA-Z]/g, '');
        if (cleaned !== raw) {
          const start = e.target.selectionStart ?? cleaned.length;
          e.target.value = cleaned;
          // Restore caret, accounting for any letters stripped before it.
          try { e.target.setSelectionRange(start, start); } catch (_) { /* read-only inputs */ }
        }
      }
      onChange?.(e);
    };

    return (
      <div className={`w-full ${containerClassName}`}>
        {label && (
          <label className="block text-sm font-bold mb-1.5 px-1 text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:border-metro-blue focus:ring-0 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed ${error ? 'border-red-500 focus:border-red-500' : ''
            } ${className}`}
          onChange={handleChange}
          {...props}
        />
        {error && <p className="text-red-500 text-xs mt-1 font-bold px-1">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
