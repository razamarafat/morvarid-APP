
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
    const isLeap = (y % 33 % 4 - 1) === ((y % 33 * 0.225) >> 0);
    return isLeap ? 30 : 29;
  };

  const getStartDayOfMonth = (jy: number, jm: number) => {
      const gYear = jy + 621;
      let gMonth = 2; 
      if(jm <= 9) { gMonth = 2 + jm; } 
      else { gMonth = jm - 10; } 
      
      const guess = new Date(gYear, gMonth, 15); 
      guess.setDate(guess.getDate() - 45);

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
              const dayOfWeek = guess.getDay();
              return (dayOfWeek + 1) % 7;
          }
      }
      return 0; 
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const startDay = getStartDayOfMonth(currentYear, currentMonth); 
  
  const slots = [];
  for(let i=0; i<startDay; i++) {
      slots.push(null);
  }
  for(let i=1; i<=daysInMonth; i++) {
      slots.push(i);
  }

  return (
    <div className="relative group" ref={containerRef}>
      {label && <label className="block text-xs font-bold mb-1.5 text-gray-700 dark:text-gray-300 px-1">{label}</label>}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-3 lg:p-4 border-2 border-gray-200 rounded-xl bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white cursor-pointer hover:border-violet-500 transition-all shadow-sm"
      >
        <span dir="ltr" className="font-mono text-lg font-bold">{displayValue}</span>
        <Icons.Calendar className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-violet-500 transition-colors" />
      </div>

      {isOpen && (
        <div className="absolute top-full mt-2 w-72 bg-[#FDFBFF] dark:bg-[#2B2930] rounded-[24px] shadow-2xl z-50 p-4 border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-4 px-1">
            <button onClick={handlePrevMonth} type="button" className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors">
              <Icons.ChevronRight className="w-5 h-5 dark:text-gray-200" />
            </button>
            <span className="font-black text-gray-800 dark:text-gray-100 text-lg">{months[currentMonth - 1]} {currentYear}</span>
            <button onClick={handleNextMonth} type="button" className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors">
              <Icons.ChevronLeft className="w-5 h-5 dark:text-gray-200" />
            </button>
          </div>
          
          <div className="grid grid-cols-7 gap-1 text-center text-sm mb-2">
             {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map(dayName => (
                 <div key={dayName} className="text-gray-400 font-bold text-xs">{dayName}</div>
             ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
             {slots.map((d, index) => (
               <button
                 key={index}
                 onClick={() => d ? handleDayClick(d) : null}
                 type="button"
                 disabled={!d}
                 className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold transition-all mx-auto ${
                    !d ? 'invisible' :
                    d === day && currentMonth === month && currentYear === year
                    ? 'bg-violet-600 text-white shadow-md'
                    : 'hover:bg-violet-100 dark:hover:bg-violet-900/50 text-gray-700 dark:text-gray-300'
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
