
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
  // Updated sizes for consistency - All standard tiles are h-44
  const sizeClasses = {
    small: 'col-span-1 h-44',
    medium: 'col-span-1 h-44',
    wide: 'col-span-2 h-44',
    large: 'col-span-2 h-44 md:col-span-2 md:row-span-2 md:h-96 lg:h-[23rem]',
  };

  return (
    <div
      onClick={onClick}
      className={`${sizeClasses[size]} relative p-5 flex flex-col justify-between cursor-pointer select-none overflow-hidden group rounded-[32px] shadow-lg hover:shadow-2xl transition-all duration-300 transform-gpu hover:-translate-y-1 active:scale-[0.98] ${color.replace('bg-', 'bg-gradient-to-br from-').replace('text-', '')} to-black/20 ${className}`}
    >
      {/* Glass Effect Overlay */}
      <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Decorative Background Icon */}
      <Icon className="absolute -right-6 -bottom-6 w-32 h-32 opacity-[0.15] transform-gpu rotate-12 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6 text-white" />

      <div className="relative z-10 flex justify-between items-start w-full">
        <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md shadow-inner border border-white/20">
          <Icon className="w-6 h-6 text-white" />
        </div>
        {count !== undefined && (
          <span className="text-3xl font-black text-white drop-shadow-md tracking-tight">
            {count}
          </span>
        )}
      </div>

      <div className="relative z-10">
        <h3 className="text-white font-black text-lg leading-tight drop-shadow-sm tracking-wide">
          {title}
        </h3>
      </div>
    </div>
  );
});

MetroTile.displayName = 'MetroTile';

export default MetroTile;
