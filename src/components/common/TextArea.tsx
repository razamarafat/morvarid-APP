
import React, { forwardRef } from 'react';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  containerClassName?: string;
  /**
   * 20260619 — When true, the textarea's `onChange` handler strips any
   * Latin English letters (a-zA-Z) from the typed value before propagating
   * to the parent. Mirrors the `<Input>` wrapper. Mobile paste, IME
   * composition, and Ctrl+keyboard shortcuts are preserved.
   *
   * DEFAULT: false — backward compatible.
   */
  noLatin?: boolean;
}

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className = '', containerClassName = '', label, error, noLatin = false, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (noLatin) {
        const raw = e.target.value;
        const cleaned = raw.replace(/[a-zA-Z]/g, '');
        if (cleaned !== raw) {
          const start = e.target.selectionStart ?? cleaned.length;
          e.target.value = cleaned;
          try { e.target.setSelectionRange(start, start); } catch (_) { /* ignored */ }
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
        <textarea
          ref={ref}
          className={`w-full p-3 border-2 rounded-xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:border-metro-blue focus:ring-0 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed min-h-[100px] ${error ? 'border-red-500 focus:border-red-500' : ''
            } ${className}`}
          onChange={handleChange}
          {...props}
        />
        {error && <p className="text-red-500 text-xs mt-1 font-bold px-1">{error}</p>}
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';

export default TextArea;
