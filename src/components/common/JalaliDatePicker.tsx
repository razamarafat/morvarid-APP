import React, { useState, useRef, useEffect } from 'react';
import { Icons } from './Icons';
import { getTodayJalali, toEnglishDigits, toPersianDigits, normalizeDate } from '../../utils/dateUtils';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

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

  const months = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
  ];

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleDayClick = (d: number, e: React.MouseEvent) => {
    e.stopPropagation();
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
    const formatter = new Intl.DateTimeFormat('en-US', {
      calendar: 'persian',
      numberingSystem: 'latn',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });

    let gYear = jy + 621;
    let gMonth = jm + 1;
    if (gMonth > 11) {
      gYear += Math.floor(gMonth / 12);
      gMonth = gMonth % 12;
    }

    const testDate = new Date(gYear, gMonth, 1);
    testDate.setDate(testDate.getDate() - 20);

    for (let i = 0; i < 40; i++) {
      const parts = formatter.formatToParts(testDate);
      const pYear = parseInt(parts.find(p => p.type === 'year')?.value || '0');
      const pMonth = parseInt(parts.find(p => p.type === 'month')?.value || '0');
      const pDay = parseInt(parts.find(p => p.type === 'day')?.value || '0');

      if (pYear === jy && pMonth === jm && pDay === 1) {
        return (testDate.getDay() + 1) % 7;
      }
      testDate.setDate(testDate.getDate() + 1);
    }
    return 0;
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const startDay = getStartDayOfMonth(currentYear, currentMonth);

  const slots = [];
  for (let i = 0; i < startDay; i++) {
    slots.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    slots.push(i);
  }

  // Modal behavior on mobile, Relative on desktop
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
    }
    return () => {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [isOpen]);

  const renderPicker = () => (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 lg:p-0 lg:block lg:absolute lg:inset-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm lg:hidden"
        onClick={() => setIsOpen(false)}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-[320px] lg:max-w-none bg-[#FDFBFF] dark:bg-[#1E1E1E] rounded-[24px] shadow-2xl p-4 border border-gray-100 dark:border-white/5 lg:absolute lg:mt-2 lg:w-72"
        style={window.innerWidth >= 1024 ? { top: coords.top, left: coords.left } : {}}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 px-1">
          <button onClick={handlePrevMonth} type="button" className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors text-gray-700 dark:text-gray-300">
            <Icons.ChevronRight className="w-5 h-5" />
          </button>
          <span className="font-black text-gray-800 dark:text-gray-100 text-lg">{months[currentMonth - 1]} {toPersianDigits(currentYear)}</span>
          <button onClick={handleNextMonth} type="button" className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors text-gray-700 dark:text-gray-300">
            <Icons.ChevronLeft className="w-5 h-5" />
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
              onClick={(e) => d ? handleDayClick(d, e) : null}
              type="button"
              disabled={!d}
              className={`w-9 h-9 flex items-center justify-center rounded-full text-sm font-bold transition-all mx-auto ${!d ? 'invisible' :
                d === day && currentMonth === month && currentYear === year
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-500/30'
                  : 'hover:bg-violet-50 dark:hover:bg-violet-900/30 text-gray-700 dark:text-gray-300'
                }`}
            >
              {d ? toPersianDigits(d) : ''}
            </button>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const [ty, tm, td] = today.split('/').map(Number);
              setCurrentYear(ty);
              setCurrentMonth(tm);
              handleDayClick(td, e);
            }}
            className="w-full py-2 bg-gray-50 dark:bg-white/5 rounded-xl text-violet-600 dark:text-violet-400 font-bold text-sm hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors"
          >
            انتخاب امروز
          </button>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="relative" ref={containerRef}>
      {label && <label className="block text-sm lg:text-base font-bold mb-1.5 text-gray-700 dark:text-gray-300 px-1">{label}</label>}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full p-3.5 border-2 rounded-xl bg-white dark:bg-gray-800 dark:text-white cursor-pointer transition-all shadow-sm ${isOpen ? 'border-violet-500 ring-2 ring-violet-500/10' : 'border-gray-200 dark:border-gray-700 hover:border-violet-400'
          }`}
      >
        <span dir="ltr" className="font-mono text-lg font-black tracking-widest">{toPersianDigits(displayValue)}</span>
        <Icons.Calendar className={`w-5 h-5 transition-colors ${isOpen ? 'text-violet-500' : 'text-gray-400'}`} />
      </div>

      <AnimatePresence>
        {isOpen && createPortal(renderPicker(), document.body)}
      </AnimatePresence>
    </div>
  );
};

export default JalaliDatePicker;
