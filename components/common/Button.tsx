
import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'tonal';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, onClick, ...props }, ref) => {
    
    // M3 Base: rounded-full (pill shape) for most buttons
    const baseClasses = 'inline-flex items-center justify-center font-bold transition-all focus:outline-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] rounded-full';

    const variantClasses = {
      primary: 'bg-metro-blue text-white hover:shadow-lg shadow-md hover:bg-metro-cobalt',
      secondary: 'bg-transparent border border-gray-400 text-metro-blue dark:text-gray-200 dark:border-gray-500 hover:bg-blue-50 dark:hover:bg-white/10',
      danger: 'bg-metro-red text-white hover:bg-red-700 shadow-md hover:shadow-lg',
      ghost: 'hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200',
      tonal: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100 hover:shadow-md'
    };

    const sizeClasses = {
      sm: 'h-8 px-4 text-xs',
      md: 'h-10 px-6 text-sm',
      lg: 'h-12 px-8 text-base',
      icon: 'h-10 w-10 p-2', // Icons stay circular
    };

    return (
      <button
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        ref={ref}
        disabled={isLoading || props.disabled}
        onClick={onClick}
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
