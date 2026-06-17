// ============================================================================
// BackButton.tsx — Smart RTL "Back" button used across the app
// ----------------------------------------------------------------------------
// DRY: imported into the shared Header (top-right corner). Visibility is
// controlled by the parent layout via the conditional `showBackButton` prop.
//
// RTL convention: in Persian/Farsi apps, "back" points to the RIGHT, so we
// render a right-pointing ArrowRight icon. In RTL flexbox this icon appears
// on the visual right edge.
//
// Safe-fallback: prefers a custom `onBack` callback (used by sub-view
// state machines that don't change the URL). Falls back to `navigate(-1)`
// only when the browser history stack is non-trivial; otherwise navigates
// to `fallbackPath` to prevent kicking the user out of the SPA.
// ============================================================================
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from './Icons';

interface BackButtonProps {
  /**
   * Called first if provided. Use this when navigating between in-app
   * "view" states (e.g. setCurrentView('dashboard')) that don't update
   * the URL. Most call sites in this app go through this path.
   */
  onBack?: () => void;
  /**
   * URL basename to push to when the browser history stack is empty/short
   * (e.g. deep links or first page-load). Defaults to '/home'.
   */
  fallbackPath?: string;
  /**
   * Accessible label / tooltip. Defaults to Persian "بازگشت".
   */
  label?: string;
  /**
   * If true, the Persian label renders next to the icon. Mobile-first
   * call sites typically hide the label to save horizontal space.
   */
  showLabel?: boolean;
  /**
   * Optional extra Tailwind classnames for layout overrides.
   */
  className?: string;
}

/**
 * Minimum history depth required to confidently call navigate(-1).
 * A length of 1 means the SPA was opened directly on this URL — calling
 * -1 would exit the app in HashRouter contexts where the router mounted
 * its first route from '/'.
 */
const MIN_HISTORY_FOR_BACK = 2;

const BackButton: React.FC<BackButtonProps> = ({
  onBack,
  fallbackPath = '/home',
  label = 'بازگشت',
  showLabel = false,
  className = '',
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    // 1) Preferred path: caller supplies a navigation handler, which keeps
    //    in-app view state in sync (RootDashboard uses this for
    //    currentView-based sub-page navigation).
    if (onBack) {
      onBack();
      return;
    }

    // 2) Safe fallback — check the browser history stack before calling
    //    navigate(-1). If the user landed on this URL via a deep link,
    //    history.length can be 1, which would otherwise bounce them out
    //    of the SPA.
    if (typeof window !== 'undefined' && window.history.length >= MIN_HISTORY_FOR_BACK) {
      navigate(-1);
      return;
    }

    // 3) Last resort — push to the fallback path.
    navigate(fallbackPath);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-full text-sm font-bold transition-all hover:bg-black/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-metro-blue/40 ${className}`}
      data-testid="back-button"
    >
      {/* Right-pointing arrow: visually correct for RTL ("back goes right") */}
      <Icons.ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
      {showLabel && <span className="leading-none">{label}</span>}
    </button>
  );
};

export default BackButton;
