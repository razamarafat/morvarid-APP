// ============================================================================
// PageHeader.tsx — Section-level page header with a localized back button
// ----------------------------------------------------------------------------
// Purpose: a back button placed in immediate visual context of the page
// title. Used at the top of every sub-page in DashboardLayout so that a
// back affordance is immediately visible the moment the user enters a
// section. Resolves UAT failure "button is lost in the global topbar".
//
// RTL design: in Persian RTL flexbox, items flow right-to-left, so the
// FIRST child appears at the visual RIGHT edge. The BackButton comes
// first in DOM order, which places the ArrowRight icon on the visual
// right of the title — exactly where Persian readers expect "back" to
// be. Visual layout (right -> left):
//   [BackButton -> h1 title ...... actions(optional)]
// ============================================================================
import React from 'react';
import BackButton from './BackButton';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /**
   * Optional action buttons (e.g. "ذخیره", "چاپ", "تازه‌سازی") rendered on
   * the OPPOSITE side from the back button. In RTL this means the visual
   * left edge of the line.
   */
  actions?: React.ReactNode;
  /** Extra Tailwind classes. */
  className?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  className = '',
}) => {
  return (
    <header
      className={`flex items-center justify-between gap-2 sm:gap-3 mb-6 pb-4 border-b border-gray-200/70 dark:border-white/10 ${className}`}
      data-testid="page-header"
    >
      {/* RTL: this child appears at the visual RIGHT edge */}
      <BackButton />

      <div className="flex-1 min-w-0">
        <h1 className="text-xl sm:text-2xl font-black text-gray-800 dark:text-white truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
};

export default PageHeader;
