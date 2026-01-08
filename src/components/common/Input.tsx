
import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  containerClassName?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', containerClassName = '', label, error, ...props }, ref) => {
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
          {...props}
        />
        {error && <p className="text-red-500 text-xs mt-1 font-bold px-1">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
