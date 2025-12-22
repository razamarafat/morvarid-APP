
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
  const sizeClasses = {
    small:  'col-span-1 h-28 md:h-32 lg:h-40',
    medium: 'col-span-1 h-28 md:h-40 lg:h-48',
    wide:   'col-span-2 h-28 md:h-40 lg:h-48', 
    large:  'col-span-2 h-32 md:col-span-2 md:row-span-2 md:h-80 lg:h-96', 
  };

  return (
    <motion.div
      whileHover={{ scale: 0.98 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`${sizeClasses[size]} ${color} relative p-4 lg:p-6 flex flex-col justify-between cursor-pointer select-none overflow-hidden group ${className}`}
    >
        <div className="metro-flow-overlay" />
        <div className="metro-shine-overlay" />
        <div className="absolute -right-6 -bottom-6 opacity-10 group-hover:opacity-20 transition-opacity duration-500 z-0">
             <Icon className="w-28 h-28 md:w-32 md:h-32 lg:w-48 lg:h-48 animate-wiggle" />
        </div>
        <div className="relative z-10 flex justify-between items-start">
             <Icon className="w-6 h-6 md:w-8 md:h-8 lg:w-12 lg:h-12 text-white drop-shadow-md" />
             {count !== undefined && (
                 <span className="text-xl md:text-2xl lg:text-4xl font-black text-white drop-shadow-md tracking-tight">{count}</span>
             )}
        </div>
        <div className="relative z-10 mt-auto">
            <h3 className="text-white font-bold text-sm md:text-lg lg:text-2xl leading-tight drop-shadow-sm">
                {title}
            </h3>
        </div>
    </motion.div>
  );
};

export default MetroTile;
