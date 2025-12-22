
import React from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = "w-full h-16" }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100" className={className}>
      <defs>
        <filter id="shadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3"/>
        </filter>
      </defs>
      <text 
        x="0" 
        y="60" 
        fontFamily="Arial, sans-serif" 
        fontWeight="900" 
        fontSize="64" 
        fill="white" 
        letterSpacing="8"
        filter="url(#shadow)"
      >
        MORVARID
      </text>
      <rect x="0" y="75" width="375" height="4" fill="#E60000" />
      <circle cx="385" cy="77" r="6" fill="#E60000" />
      <text 
        x="375" 
        y="95" 
        fontFamily="Vazir, sans-serif" 
        fontSize="14" 
        fill="#999" 
        textAnchor="end"
      >
        INTEGRATED MANAGEMENT SYSTEM
      </text>
    </svg>
  );
};

export default Logo;
