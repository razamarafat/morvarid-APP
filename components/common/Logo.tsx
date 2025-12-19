import React from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = "w-24 h-24" }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" className={className}>
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.1"/>
        </filter>
      </defs>
      {/* Egg Shape with theme-aware stroke */}
      <path 
        className="fill-white dark:fill-gray-700 stroke-gray-300 dark:stroke-gray-500" 
        strokeWidth="6" 
        d="M100 20c-40 0-70 50-70 100 0 45 30 75 70 75s70-30 70-75c0-50-30-100-70-100z"
        style={{ filter: 'url(#shadow)' }}
      />
      {/* Chicken Head */}
      <circle cx="70" cy="120" r="35" className="fill-red-300 dark:fill-red-400" />
      <circle cx="60" cy="110" r="6" fill="#fff" />
      <circle cx="60" cy="110" r="2.5" fill="#0f172a" />
      <path d="M80 115 l15 5 l-15 5 z" className="fill-amber-500" />
      <path d="M70 85 q5 -10 15 0" className="stroke-red-500 dark:stroke-red-600" strokeWidth="3" fill="none"/>
      {/* Broken Shell */}
      <path 
        className="fill-white dark:fill-gray-700 stroke-gray-300 dark:stroke-gray-500" 
        strokeWidth="4" 
        d="M35 130 l20 20 l20 -10 l25 25 l30 -20 l25 30 c-5 15 -25 20 -55 20 s-60 -20 -65 -65" 
      />
    </svg>
  );
};

export default Logo;