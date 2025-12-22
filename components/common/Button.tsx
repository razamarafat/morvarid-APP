
import React from 'react';
import { useLogStore } from '../../store/logStore';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, onClick, ...props }, ref) => {
    
    // FIX: Removed useLogStore() hook to prevent re-renders on log updates.
    // We access the store directly inside the handler.

    const handleInternalClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        // Dynamic logging logic
        let buttonLabel = 'unnamed_button';
        if (typeof children === 'string') {
            buttonLabel = children;
        } else if (props.title) {
            buttonLabel = props.title;
        } else if (props['aria-label']) {
            buttonLabel = props['aria-label'];
        }

        // Direct Access: Highly performant, no re-render trigger
        useLogStore.getState().logAction('info', 'user_action', `کلیک دکمه: [${buttonLabel}]`, { 
            variant, 
            size, 
            class: className 
        });

        if (onClick) {
            onClick(e);
        }
    };

    const baseClasses = 'inline-flex items-center justify-center font-bold transition-all focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]';

    const variantClasses = {
      primary: 'bg-metro-blue text-white hover:bg-metro-cobalt border-2 border-transparent',
      secondary: 'bg-transparent border-2 border-gray-400 text-gray-700 dark:text-gray-200 hover:border-gray-600 dark:hover:border-white',
      danger: 'bg-metro-red text-white hover:bg-red-700 border-2 border-transparent',
      ghost: 'hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200',
    };

    const sizeClasses = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-6 text-sm',
      lg: 'h-12 px-10 text-base',
      icon: 'h-10 w-10',
    };

    return (
      <button
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        ref={ref}
        disabled={isLoading || props.disabled}
        onClick={handleInternalClick}
        {...props}
      >
        {isLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current ml-2"></div>}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
