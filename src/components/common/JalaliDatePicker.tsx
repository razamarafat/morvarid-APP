import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Icons } from './Icons';
import { getTodayJalali, toEnglishDigits, toPersianDigits } from '../../utils/dateUtils';
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
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [isMobile, setIsMobile] = useState(false);

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

  const updatePosition = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom,
        left: rect.left
      });
      setIsMobile(window.innerWidth < 1024);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

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
    testDate.setDate(testDate.getDate() - 25);
    for (let i = 0; i < 50; i++) {
      try {
        const parts = formatter.formatToParts(testDate);
        const pYear = parseInt(parts.find(p => p.type === 'year')?.value || '0');
        const pMonth = parseInt(parts.find(p => p.type === 'month')?.value || '0');
        const pDay = parseInt(parts.find(p => p.type === 'day')?.value || '0');
        if (pYear === jy && pMonth === jm && pDay === 1) {
          return (testDate.getDay() + 1) % 7;
        }
      } catch (e) { }
      testDate.setDate(testDate.getDate() + 1);
    }
    return 0;
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const startDay = getStartDayOfMonth(currentYear, currentMonth);
  const slots: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) slots.push(null);
  for (let i = 1; i <= daysInMonth; i++) slots.push(i);

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && <label className="block text-sm lg:text-base font-bold mb-1.5 text-gray-700 dark:text-gray-300 px-1">{label}</label>}
      <div
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center justify-between w-full p-3.5 border-2 rounded-xl bg-white dark:bg-gray-800 dark:text-white cursor-pointer transition-all shadow-sm ${isOpen ? 'border-violet-500 ring-2 ring-violet-500/10' : 'border-gray-200 dark:border-gray-700 hover:border-violet-400'
          }`}
      >
        <span dir="ltr" className="font-mono text-lg font-black tracking-widest">{toPersianDigits(displayValue)}</span>
        <Icons.Calendar className={`w-5 h-5 transition-colors ${isOpen ? 'text-violet-500' : 'text-gray-400'}`} />
      </div>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center lg:block lg:pointer-events-none">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-[2px] lg:hidden pointer-events-auto"
                onClick={() => setIsOpen(false)}
              />

              {/* Picker Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="relative lg:fixed w-[320px] bg-white dark:bg-[#1E1E1E] rounded-[24px] shadow-2xl p-5 border border-gray-100 dark:border-white/5 pointer-events-auto overflow-hidden animate-in fade-in duration-200"
                style={!isMobile ? {
                  top: coords.top + 10,
                  left: Math.min(coords.left, window.innerWidth - 340) // Prevent overflow on right
                } : {}}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-5 px-1">
                  <button onClick={handlePrevMonth} type="button" className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors text-gray-700 dark:text-gray-300">
                    <Icons.ChevronRight className="w-5 h-5" />
                  </button>
                  <span className="font-black text-gray-800 dark:text-gray-100 text-lg">{months[currentMonth - 1]} {toPersianDigits(currentYear)}</span>
                  <button onClick={handleNextMonth} type="button" className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors text-gray-700 dark:text-gray-300">
                    <Icons.ChevronLeft className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-sm mb-3">
                  {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map(dayName => (
                    <div key={dayName} className="text-gray-400 font-bold text-[10px]">{dayName}</div>
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
                          ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                          : 'hover:bg-violet-50 dark:hover:bg-violet-900/30 text-gray-700 dark:text-gray-300'
                        }`}
                    >
                      {d ? toPersianDigits(d) : ''}
                    </button>
                  ))}
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-white/5 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const [ty, tm, td] = today.split('/').map(Number);
                      setCurrentYear(ty);
                      setCurrentMonth(tm);
                      handleDayClick(td, e);
                    }}
                    className="flex-1 py-2.5 bg-violet-50 dark:bg-violet-500/10 rounded-xl text-violet-600 dark:text-violet-400 font-bold text-xs hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-colors"
                  >
                    امروز: {toPersianDigits(today)}
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2.5 bg-gray-50 dark:bg-white/5 rounded-xl text-gray-400 font-bold text-xs hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                  >
                    بستن
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default JalaliDatePicker;
