
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

const MetroTile: React.FC<MetroTileProps> = React.memo(({ 
  title, 
  count, 
  icon: Icon, 
  color, 
  size = 'medium', 
  onClick,
  className = '' 
}) => {
  // Enforce consistent height on mobile for ALL tiles to ensure equality.
  const sizeClasses = {
    small:  'col-span-1 h-40 md:h-44 lg:h-48',
    medium: 'col-span-1 h-40 md:h-44 lg:h-48',
    wide:   'col-span-2 h-40 md:h-44 lg:h-48', 
    large:  'col-span-2 h-40 md:col-span-2 md:row-span-2 md:h-96 lg:h-[25rem]', 
  };

  return (
    <motion.div
      whileHover={{ scale: 0.98, y: -2 }}
      whileTap={{ scale: 0.96 }}
      transition={{ 
        type: 'tween', 
        duration: 0.15, 
        ease: [0.4, 0, 0.2, 1] 
      }}
      onClick={onClick}
      className={`${sizeClasses[size]} ${color} relative p-4 flex flex-col justify-center items-center text-center cursor-pointer select-none overflow-hidden group rounded-[32px] shadow-lg hover:shadow-2xl transition-all border-b-4 border-black/10 active:border-b-0 active:translate-y-1 transform-gpu ${className}`}
    >
        {/* Strong Shine Effect */}
        <div className="strong-shine-overlay" />
        
        {/* Background Decorative Icon */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 group-hover:opacity-20 transition-opacity duration-500 scale-150">
             <Icon className="w-32 h-32 md:w-40 md:h-40 lg:w-56 lg:h-56 animate-wiggle" />
        </div>

        {/* Content Wrapper */}
        <div className="relative z-10 flex flex-col items-center gap-2 w-full">
             <div className="bg-white/20 p-3 rounded-full shadow-inner mb-1 backdrop-blur-sm">
                <Icon className="w-8 h-8 md:w-10 md:h-10 text-white drop-shadow-md" />
             </div>
             
             {count !== undefined && (
                 <span className="text-3xl md:text-4xl lg:text-5xl font-black text-white drop-shadow-lg tracking-tight my-1">
                    {count}
                 </span>
             )}
             
             <h3 className="text-white font-black text-lg md:text-xl lg:text-2xl leading-tight drop-shadow-md tracking-wide px-2">
                {title}
             </h3>
        </div>
    </motion.div>
  );
});

MetroTile.displayName = 'MetroTile';

export default MetroTile;
