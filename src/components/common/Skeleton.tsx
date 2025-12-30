
import React from 'react';

// A single block skeleton, useful for replacing text lines, buttons, etc.
export const SkeletonBlock: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-gray-200 dark:bg-gray-700 animate-pulse rounded-md ${className}`} />
);

// Skeleton for MetroTile
export const SkeletonTile: React.FC<{ size?: 'small' | 'medium' | 'wide' | 'large' }> = ({ size = 'medium' }) => {
  const sizeClasses = {
    small:  'col-span-1 h-40 md:h-44 lg:h-48',
    medium: 'col-span-1 h-40 md:h-44 lg:h-48',
    wide:   'col-span-2 h-40 md:h-44 lg:h-48', 
    large:  'col-span-2 h-40 md:col-span-2 md:row-span-2 md:h-96 lg:h-[25rem]', 
  };

  return (
    <div className={`${sizeClasses[size]} bg-gray-200 dark:bg-gray-800 rounded-[32px] animate-pulse relative overflow-hidden flex flex-col items-center justify-center`}>
       <div className="w-10 h-10 bg-gray-300 dark:bg-gray-700 rounded-full mb-3" />
       <div className="w-24 h-6 bg-gray-300 dark:bg-gray-700 rounded-md mb-2" />
       <div className="w-16 h-4 bg-gray-300 dark:bg-gray-700 rounded-md" />
    </div>
  );
};

// Skeleton for Table Row
export const SkeletonRow: React.FC<{ cols?: number; height?: string }> = ({ cols = 5, height = "h-16" }) => {
  return (
    <div className={`w-full ${height} flex items-center gap-4 px-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 animate-pulse`}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
      ))}
    </div>
  );
};

// Skeleton for Card (Recent Records)
export const SkeletonCard: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-[24px] p-6 animate-pulse shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-3">
           <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
           <div className="space-y-2">
              <div className="w-32 h-5 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="w-20 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
           </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4">
         <div className="h-16 bg-gray-100 dark:bg-gray-700/50 rounded-2xl" />
         <div className="h-16 bg-gray-100 dark:bg-gray-700/50 rounded-2xl" />
      </div>
    </div>
  );
};
