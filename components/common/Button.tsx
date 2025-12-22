
import React from 'react';
import { useLogStore } from '../../store/logStore.ts';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, onClick, ...props }, ref) => {
    
    const { logClick } = useLogStore();

    const handleInternalClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        // Automatic logging of button click with context
        let label = props.title || props['aria-label'] || 'Button';
        if (typeof children === 'string') {
            label = children;
        } else if (React.isValidElement(children)) {
            // Try to extract text from simple children
            label = (children as any).props?.children || 'Icon Button';
        }

        logClick(label, { 
            variant, 
            size,
            component: 'CommonButton',
            timestamp: Date.now()
        });

        if (onClick) onClick(e);
    };

    const baseClasses = 'inline-flex items-center justify-center font-bold transition-all focus:outline-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97]';

    const variantClasses = {
      primary: 'bg-metro-blue text-white hover:bg-metro-cobalt shadow-sm',
      secondary: 'bg-white border-2 border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 hover:border-metro-blue',
      danger: 'bg-metro-red text-white hover:bg-red-700 shadow-sm',
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
