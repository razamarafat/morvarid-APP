
import React, { useState, useRef, useEffect } from 'react';
import { Icons } from './Icons';
import { getTodayJalali, toEnglishDigits } from '../../utils/dateUtils';

interface JalaliDatePickerProps {
  value: string;
  onChange: (date: string) => void;
  label?: string;
}

const JalaliDatePicker: React.FC<JalaliDatePickerProps> = ({ value, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Parse current value or today
  const today = getTodayJalali();
  const displayValue = value ? toEnglishDigits(value) : today;
  const [year, month, day] = displayValue.split('/').map(Number);
  
  const [currentYear, setCurrentYear] = useState(year);
  const [currentMonth, setCurrentMonth] = useState(month);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const months = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
  ];

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleDayClick = (d: number) => {
    const formattedMonth = currentMonth.toString().padStart(2, '0');
    const formattedDay = d.toString().padStart(2, '0');
    onChange(`${currentYear}/${formattedMonth}/${formattedDay}`);
    setIsOpen(false);
  };

  const getDaysInMonth = (y: number, m: number) => {
    if (m <= 6) return 31;
    if (m <= 11) return 30;
    // Simple leap year check for Jalali
    // This is a basic approximation suitable for UI within typical ranges
    const isLeap = (y % 33 % 4 - 1) === ((y % 33 * 0.225) >> 0);
    return isLeap ? 30 : 29;
  };

  // Convert Jalali (Year, Month, 1) to Gregorian to find weekday
  const getStartDayOfMonth = (jy: number, jm: number) => {
      // Approximate Gregorian start for Jalali Month
      // Farvardin starts around March 21
      const gYear = jy + 621;
      let gMonth = 2; // March
      let gDay = 20; 
      
      // Adjust rough month
      if(jm <= 9) { gMonth = 2 + jm; } 
      else { gMonth = jm - 10; } // Late Gregorian year or Next
      
      // Create a date object and search for the exact match
      // This brute-force search (scanning +/- 35 days) is very fast and reliable compared to implementing full calendar math
      const guess = new Date(gYear, gMonth, 15); 
      // Go back 40 days to be safe and scan forward
      guess.setDate(guess.getDate() - 45);

      // Using options instead of locale extension to prevent invalid language tag error
      // @ts-ignore
      const formatter = new Intl.DateTimeFormat('fa-IR', { 
          calendar: 'persian', 
          numberingSystem: 'latn',
          year: 'numeric', 
          month: 'numeric', 
          day: 'numeric' 
      });
      
      for(let i=0; i<90; i++) {
          guess.setDate(guess.getDate() + 1);
          const parts = formatter.formatToParts(guess);
          const pYear = parseInt(parts.find(p => p.type === 'year')?.value || '0');
          const pMonth = parseInt(parts.find(p => p.type === 'month')?.value || '0');
          const pDay = parseInt(parts.find(p => p.type === 'day')?.value || '0');
          
          if(pYear === jy && pMonth === jm && pDay === 1) {
              // Found it!
              // JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat
              // We want 0=Sat, 1=Sun, ..., 6=Fri
              const dayOfWeek = guess.getDay();
              // Map: Sun(0)->1, Mon(1)->2 ... Sat(6)->0
              return (dayOfWeek + 1) % 7;
          }
      }
      return 0; // Fallback
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const startDay = getStartDayOfMonth(currentYear, currentMonth); // 0 = Sat, 6 = Fri
  
  // Generate days array with empty slots
  const slots = [];
  for(let i=0; i<startDay; i++) {
      slots.push(null);
  }
  for(let i=1; i<=daysInMonth; i++) {
      slots.push(i);
  }

  return (
    <div className="relative" ref={containerRef}>
      {label && <label className="block text-sm font-medium mb-1 dark:text-gray-300">{label}</label>}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white cursor-pointer hover:border-violet-500 transition-colors"
      >
        <span dir="ltr" className="font-mono">{displayValue}</span>
        <Icons.Calendar className="w-5 h-5 text-gray-500 dark:text-gray-400" />
      </div>

      {isOpen && (
        <div className="absolute top-full mt-2 w-64 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-xl z-50 p-4">
          <div className="flex justify-between items-center mb-4">
            <button onClick={handlePrevMonth} type="button" className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
              <Icons.ChevronRight className="w-5 h-5 dark:text-gray-300" />
            </button>
            <span className="font-bold text-gray-800 dark:text-gray-200">{months[currentMonth - 1]} {currentYear}</span>
            <button onClick={handleNextMonth} type="button" className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
              <Icons.ChevronLeft className="w-5 h-5 dark:text-gray-300" />
            </button>
          </div>
          
          <div className="grid grid-cols-7 gap-1 text-center text-sm mb-2">
             {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map(dayName => (
                 <div key={dayName} className="text-gray-400 font-bold">{dayName}</div>
             ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
             {slots.map((d, index) => (
               <button
                 key={index}
                 onClick={() => d ? handleDayClick(d) : null}
                 type="button"
                 disabled={!d}
                 className={`p-1 rounded-md transition-colors ${
                    !d ? 'invisible' :
                    d === day && currentMonth === month && currentYear === year
                    ? 'bg-violet-600 text-white'
                    : 'hover:bg-violet-100 dark:hover:bg-violet-900 text-gray-700 dark:text-gray-300'
                 }`}
               >
                 {d || ''}
               </button>
             ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default JalaliDatePicker;
