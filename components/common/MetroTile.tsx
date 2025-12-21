
import React from 'react';
import { motion } from 'framer-motion';

interface MetroTileProps {
  title: string;
  count?: string | number;
  icon: React.ElementType;
  color: string;
  size?: 'small' | 'medium' | 'wide' | 'large';
  onClick?: () => void;
  className?: string;
}

const MetroTile: React.FC<MetroTileProps> = ({ 
  title, 
  count, 
  icon: Icon, 
  color, 
  size = 'medium', 
  onClick,
  className = '' 
}) => {
  
  // MOBILE OPTIMIZATION:
  // On mobile (default), 'large' and 'wide' behave like 'medium' or 'wide' but with constrained height
  // 'md:' prefix applies the intended desktop layout.
  
  const sizeClasses = {
    small:  'col-span-1 h-28 md:h-32',
    medium: 'col-span-1 h-28 md:h-40',
    // Wide on mobile stays wide but shorter, full height on desktop
    wide:   'col-span-2 h-28 md:h-40', 
    // Large on mobile becomes Wide (2 cols, 1 row) to save space, Large (2x2) on desktop
    large:  'col-span-2 h-32 md:col-span-2 md:row-span-2 md:h-80', 
  };

  return (
    <motion.div
      whileHover={{ scale: 0.98 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`${sizeClasses[size]} ${color} relative p-4 flex flex-col justify-between cursor-pointer select-none overflow-hidden group ${className}`}
    >
        {/* Animated Icon Background */}
        <div className="absolute -right-6 -bottom-6 opacity-10 group-hover:opacity-20 transition-opacity duration-500">
             <Icon className="w-28 h-28 md:w-32 md:h-32 animate-[wiggle_6s_ease-in-out_infinite]" />
        </div>
        
        {/* Main Content */}
        <div className="relative z-10 flex justify-between items-start">
             <Icon className="w-6 h-6 md:w-8 md:h-8 text-white drop-shadow-md" />
             {count !== undefined && (
                 <span className="text-xl md:text-2xl font-black text-white drop-shadow-md">{count}</span>
             )}
        </div>

        <div className="relative z-10 mt-auto">
            <h3 className="text-white font-bold text-sm md:text-lg leading-tight drop-shadow-sm">
                {title}
            </h3>
        </div>
    </motion.div>
  );
};

export default MetroTile;
