
import React, { forwardRef } from 'react';
import { toEnglishDigits, toPersianDigits } from '../../utils/dateUtils';

interface PersianNumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string | number;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  inputMode?: 'numeric' | 'decimal' | 'tel';
}

const PersianNumberInput = forwardRef<HTMLInputElement, PersianNumberInputProps>(
  ({ value, onChange, label, className = '', inputMode = 'numeric', ...props }, ref) => {

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      // Convert to English digits for logic
      let englishValue = toEnglishDigits(rawValue);

      // Clean based on inputMode
      if (inputMode === 'numeric' || inputMode === 'tel') {
        englishValue = englishValue.replace(/[^0-9]/g, '');
      } else if (inputMode === 'decimal') {
        englishValue = englishValue.replace(/[^0-9.]/g, '');
      }

      onChange(englishValue);
    };

    return (
      <div className="w-full">
        {label && <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 px-1">{label}</label>}
        <input
          ref={ref}
          type="text"
          inputMode={inputMode}
          dir="ltr"
          className={`w-full persian-nums ${className}`}
          value={toPersianDigits(value)}
          onChange={handleChange}
          {...props}
        />
      </div>
    );
  }
);

PersianNumberInput.displayName = 'PersianNumberInput';

export default PersianNumberInput;