
import React from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = "w-24 h-24" }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" className={className}>
      {/* Egg Shape */}
      <path fill="#fff" stroke="#e5e7eb" strokeWidth="4" d="M100 20c-40 0-70 50-70 100 0 45 30 75 70 75s70-30 70-75c0-50-30-100-70-100z"/>
      {/* Chicken Head Peeking */}
      <circle cx="70" cy="120" r="35" fill="#fca5a5" />
      <circle cx="60" cy="110" r="5" fill="#fff" />
      <circle cx="60" cy="110" r="2" fill="#000" />
      <path d="M80 115 l15 5 l-15 5 z" fill="#f59e0b" />
      <path d="M70 85 q5 -10 15 0" stroke="#ef4444" strokeWidth="3" fill="none"/>
      {/* Broken Shell */}
      <path fill="#fff" stroke="#e5e7eb" strokeWidth="4" d="M35 130 l20 20 l20 -10 l25 25 l30 -20 l25 30 c-5 15 -25 20 -55 20 s-60 -20 -65 -65" />
    </svg>
  );
};

export default Logo;
