// ============================================================================
// useViewNavigation.ts — URL search-params-backed navigation hook
// ----------------------------------------------------------------------------
// Replaces the duplicated `useSearchParams` + same-view-guard block that
// was repeated across AdminDashboard, RegistrationDashboard, and
// SalesDashboard. Centralises:
//
//   1. Read  currentView from ?view=…  (defaults to homeView when absent)
//   2. Write  setSearchParams({ view }) for forward navigation (PUSH)
//   3. Write  setSearchParams({}, { replace: true }) when navigating
//            back to the homeView — avoids bloating the history stack
//   4. Same-view-click guard — early-return when target view equals the
//            currently active view, preventing duplicate URL entries
//            that would create phantom intermediate history points
//
// Why URL search params (not useState): this is what makes the OS-level
// hardware back button natively synchronise with the UI back button.
// React Router's `useSearchParams` subscribes to popstate internally, so
// the browser's history stack mirrors the user's journey exactly and the
// mobile-hardware back button pops the right entry.
// ============================================================================
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

const DEFAULT_HOME_VIEW = 'dashboard';

export interface ViewNavigation {
  /** Current view derived from `?view=…` search param, falling back to homeView. */
  currentView: string;
  /** Navigate to a named sub-view. No-op when the target view equals currentView. */
  setCurrentView: (view: string) => void;
}

/**
 * Subscription-based navigation state backed by URL search parameters.
 * Returns a `{ currentView, setCurrentView }` pair mirroring the previous
 * `useState` API so call sites don't need to change how they read or write
 * the active view.
 *
 * @param homeView The value returned when no `?view=…` is in the URL.
 *                 Defaults to `'dashboard'`. Going to this view uses
 *                 `history.replaceState` (no new entry) so it doesn't bloat
 *                 the history stack.
 */
export function useViewNavigation(homeView: string = DEFAULT_HOME_VIEW): ViewNavigation {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read once per render — `searchParams.get('view')` is cheap (URLSearchParams
  // backed) and avoids back-and-forth `setSearchParams` calls during render.
  const currentView = searchParams.get('view') || homeView;

  // Stable handler — depend only on the values that matter for memory.
  const setCurrentView = useCallback(
    (view: string) => {
      if (view === currentView) return;
      if (view === homeView) {
        setSearchParams({}, { replace: true });
      } else {
        setSearchParams({ view });
      }
    },
    [currentView, homeView, setSearchParams],
  );

  return { currentView, setCurrentView };
}
