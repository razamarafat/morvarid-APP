// ============================================================================
// BackButton.tsx — Universal RTL "Back" button
// ----------------------------------------------------------------------------
// Primary behavior: step back exactly one entry in the browser history
// stack via React Router's useNavigate(-1). This is what the OS-level
// hardware back button does, so the UI button and the hardware button
// are perfectly synchronized — both pop the same history entry.
//
// Fallback: ONLY when the SPA was entered via a deep-link and has no prior
// history entry (window.history.length < 2). In that case, navigate(-1)
// would exit the SPA, so we fall back to /home (which routes the user
// back into their role-specific dashboard via HomeRedirect). This is
// the only situation in which we route to a named URL.
//
// RTL: back goes RIGHT — we render a right-pointing ArrowRight icon.
// ============================================================================
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from './Icons';

export interface BackButtonProps {
  /**
   * URL basename to push to when the browser history stack is empty/short
   * (deep-link entry). Defaults to '/home', which dispatches back into
   * the role-specific dashboard via the existing HomeRedirect route.
   */
  fallbackPath?: string;
  /**
   * Accessible label / tooltip. Defaults to Persian "بازگشت".
   */
  label?: string;
  /**
   * Visible label next to the icon (icon-only by default to keep the
   * page header compact on mobile).
   */
  showLabel?: boolean;
  /** Extra Tailwind classes for layout positioning. */
  className?: string;
}

/**
 * A history stack depth of 1 means there is no prior entry to pop to
 * within the SPA. After one in-app navigation (e.g. login → /admin,
 * or /admin → /admin?view=farms), the stack is at least 2 entries
 * deep and safe to pop.
 */
const MIN_HISTORY_FOR_BACK = 2;

const BackButton: React.FC<BackButtonProps> = ({
  fallbackPath = '/home',
  label = 'بازگشت',
  showLabel = false,
  className = '',
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    // PRIMARY: step back exactly one navigation in the user's journey.
    // This mirrors the OS-level hardware back button semantics.
    if (typeof window !== 'undefined' && window.history.length >= MIN_HISTORY_FOR_BACK) {
      navigate(-1);
      return;
    }

    // EDGE CASE: SPA entered via deep-link, no prior history entry to
    // pop. Route through the role dispatcher rather than exit the SPA.
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
