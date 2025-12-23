
import React, { forwardRef, useEffect, useRef } from 'react';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  indeterminate?: boolean;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, indeterminate, ...props }, ref) => {
    const defaultRef = useRef<HTMLInputElement>(null);
    const resolvedRef = ref || defaultRef;

    useEffect(() => {
      if (typeof resolvedRef === 'object' && resolvedRef.current) {
        resolvedRef.current.indeterminate = !!indeterminate;
      }
    }, [resolvedRef, indeterminate]);

    return (
      <input
        type="checkbox"
        ref={resolvedRef}
        className={`
          h-5 w-5 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-900 
          text-metro-blue focus:ring-metro-blue focus:ring-2 focus:ring-offset-0 
          cursor-pointer transition-all
          disabled:cursor-not-allowed disabled:opacity-50
          ${className || ''}
        `.trim()}
        {...props}
      />
    );
  }
);

Checkbox.displayName = 'Checkbox';

export default Checkbox;
