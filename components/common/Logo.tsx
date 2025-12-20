
import React from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = "w-24 h-24" }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" className={className}>
      <defs>
        <linearGradient id="orangeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FB923C" /> {/* Orange-400 */}
          <stop offset="50%" stopColor="#F97316" /> {/* Orange-500 */}
          <stop offset="100%" stopColor="#C2410C" /> {/* Orange-700 */}
        </linearGradient>
        <linearGradient id="combGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FCA5A5" />
          <stop offset="100%" stopColor="#EF4444" />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Main Container Group */}
      <g transform="translate(10, 10) scale(0.9)">
        
        {/* The Abstract Egg/Pearl Shape */}
        <path 
          d="M100 10 C 50 10, 10 70, 10 120 C 10 170, 50 195, 100 195 C 150 195, 190 170, 190 120 C 190 70, 150 10, 100 10 Z" 
          fill="url(#orangeGradient)"
          style={{ filter: 'drop-shadow(0px 10px 15px rgba(249, 115, 22, 0.4))' }}
        />

        {/* Shine/Reflection on the Pearl */}
        <path 
          d="M60 40 Q 90 25, 120 40 Q 100 50, 60 40" 
          fill="rgba(255,255,255,0.4)" 
        />

        {/* The "Logotype" Concept: Letter 'Mim' (م) stylized as a Chicken Head inside the egg */}
        {/* Using Negative Space (White) to carve out the bird */}
        <g transform="translate(45, 55)">
           {/* The Body/Neck Curve (Abstracting the letters 'ر' and 'و') */}
           <path 
             d="M 10 100 Q 10 120, 40 125 Q 90 130, 110 90 Q 120 70, 100 60 Q 80 50, 70 70 Q 65 80, 50 80 Q 35 80, 35 60 C 35 30, 60 20, 80 20 L 80 5 C 40 5, 0 30, 10 100 Z" 
             fill="white" 
           />
           
           {/* The Eye (Pearl within the bird) */}
           <circle cx="85" cy="45" r="6" fill="#C2410C" />

           {/* The Comb (Red accent) */}
           <path 
             d="M 85 18 Q 95 5, 105 15 Q 110 5, 120 20 L 115 25 Q 100 35, 90 25 Z" 
             fill="url(#combGradient)"
           />

           {/* The Beak (Yellow accent) */}
           <path 
             d="M 115 55 L 135 60 L 112 70 Z" 
             fill="#F59E0B"
           />
        </g>

        {/* Text "MORVARID" integrated below (Optional, but adds to the logotype feel) */}
        {/* Represented as abstract lines to ensure it works without font loading issues in SVG */}
      </g>
    </svg>
  );
};

export default Logo;
