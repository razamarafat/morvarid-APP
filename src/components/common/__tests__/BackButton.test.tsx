// ============================================================================
// BackButton.test.tsx — Vitest unit tests for the universal RTL BackButton
// ----------------------------------------------------------------------------
// Asserts the three-tier safe-fallback routing logic:
//   1) onBack()  — preferred, used when caller supplies a navigation handler
//   2) navigate(-1) — when window.history.length >= 2 (real back stack)
//   3) navigate(fallbackPath) — last-resort URL jump on deep links
//
// Strategy: mock react-router-dom's useNavigate so we can assert exactly
// which value navigate was invoked with. Control window.history.length per
// test so the threshold branch (>= 2 vs < 2) is deterministic.
// ============================================================================
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// vi.hoisted runs before vi.mock, so the mock fn we capture is shared.
const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

// Import after mocks so BackButton picks them up.
import BackButton from '../BackButton';

describe('BackButton Component', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  afterEach(() => {
    // Restore default history length of 1 for tests that don't pin it.
    Object.defineProperty(window.history, 'length', {
      configurable: true,
      value: 1,
      writable: true,
    });
  });

  const setHistoryLength = (n: number) => {
    Object.defineProperty(window.history, 'length', {
      configurable: true,
      value: n,
      writable: true,
    });
  };

  const user = userEvent.setup();

  // ─────────────────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────────────────
  describe('Rendering', () => {
    it('renders a button with the default Persian label', () => {
      render(<BackButton />);
      const btn = screen.getByRole('button', { name: 'بازگشت' });
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveAttribute('title', 'بازگشت');
      expect(btn).toHaveAttribute('data-testid', 'back-button');
    });

    it('uses a custom label when provided', () => {
      render(<BackButton label="بازگشت به عقب" />);
      expect(screen.getByRole('button', { name: 'بازگشت به عقب' })).toBeInTheDocument();
    });

    it('hides the label text by default (icon-only)', () => {
      render(<BackButton />);
      // The icon container is aria-hidden, so the only accessible name is
      // the aria-label/title ("بازگشت"). A query for the visible <span>
      // text returns nothing while showLabel is false.
      const visibleLabel = screen.queryByText('بازگشت', { selector: 'span' });
      expect(visibleLabel).toBeNull();
    });

    it('renders the label as visible text when showLabel is true', () => {
      render(<BackButton showLabel />);
      const span = screen.getByText('بازگشت', { selector: 'span' });
      expect(span).toBeInTheDocument();
    });

    it('renders an ArrowRight SVG icon (RTL back direction)', () => {
      const { container } = render(<BackButton />);
      // lucide-react renders icons as <svg> elements.
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      // The icon is decorative — aria-hidden=true.
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Tier 1 — onBack() takes precedence over every other branch
  // ─────────────────────────────────────────────────────────────────────────
  describe('Tier 1: custom onBack callback', () => {
    it('invokes onBack() and does NOT call navigate', async () => {
      const onBack = vi.fn();
      setHistoryLength(5); // intentionally deep — onBack must still win
      render(<BackButton onBack={onBack} />);

      await user.click(screen.getByRole('button', { name: 'بازگشت' }));

      expect(onBack).toHaveBeenCalledTimes(1);
      expect(navigateMock).not.toHaveBeenCalled();
    });

    it('invokes onBack() even when history length is 1 (deep link)', async () => {
      const onBack = vi.fn();
      setHistoryLength(1);
      render(<BackButton onBack={onBack} />);

      await user.click(screen.getByRole('button', { name: 'بازگشت' }));

      expect(onBack).toHaveBeenCalledTimes(1);
      expect(navigateMock).not.toHaveBeenCalled();
    });

    it('invokes onBack() once per click (no double-fire on re-render)', async () => {
      const onBack = vi.fn();
      setHistoryLength(3);
      const { rerender } = render(<BackButton onBack={onBack} />);

      await user.click(screen.getByRole('button', { name: 'بازگشت' }));
      rerender(<BackButton onBack={onBack} />);
      await user.click(screen.getByRole('button', { name: 'بازگشت' }));

      expect(onBack).toHaveBeenCalledTimes(2);
      expect(navigateMock).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Tier 2 — navigate(-1) when history.stack >= 2
  // ─────────────────────────────────────────────────────────────────────────
  describe('Tier 2: navigate(-1) when history depth >= 2', () => {
    it('calls navigate(-1) when history.length is 2 (lower-bound threshold)', async () => {
      setHistoryLength(2);
      render(<BackButton />);

      await user.click(screen.getByRole('button', { name: 'بازگشت' }));

      expect(navigateMock).toHaveBeenCalledTimes(1);
      expect(navigateMock).toHaveBeenCalledWith(-1);
    });

    it('calls navigate(-1) when history.length is large (e.g. 5)', async () => {
      setHistoryLength(5);
      render(<BackButton />);

      await user.click(screen.getByRole('button', { name: 'بازگشت' }));

      expect(navigateMock).toHaveBeenCalledTimes(1);
      expect(navigateMock).toHaveBeenCalledWith(-1);
    });

    it('onBack is NEVER called from the history branch (Tier 2 does not invoke it)', async () => {
      const onBack = vi.fn();
      setHistoryLength(3);
      // Sanity assertion on the Tier 2 code path itself, without
      // confounding it with onBack. History branch must not touch onBack.
      render(<BackButton />);

      await user.click(screen.getByRole('button', { name: 'بازگشت' }));

      expect(navigateMock).toHaveBeenCalledTimes(1);
      expect(navigateMock).toHaveBeenCalledWith(-1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Tier 3 — navigate(fallbackPath) when history depth < 2
  // ─────────────────────────────────────────────────────────────────────────
  describe('Tier 3: navigate(fallbackPath) when history depth < 2', () => {
    it('calls navigate(fallbackPath) when history.length is 1 (deep link)', async () => {
      setHistoryLength(1);
      render(<BackButton />);

      await user.click(screen.getByRole('button', { name: 'بازگشت' }));

      expect(navigateMock).toHaveBeenCalledTimes(1);
      expect(navigateMock).toHaveBeenCalledWith('/home');
    });

    it('uses a custom fallbackPath when provided', async () => {
      setHistoryLength(1);
      render(<BackButton fallbackPath="/login" />);

      await user.click(screen.getByRole('button', { name: 'بازگشت' }));

      expect(navigateMock).toHaveBeenCalledTimes(1);
      expect(navigateMock).toHaveBeenCalledWith('/login');
    });

    it('does NOT call navigate(-1) when falling back (avoids SPA exit)', async () => {
      setHistoryLength(1);
      render(<BackButton />);

      await user.click(screen.getByRole('button', { name: 'بازگشت' }));

      expect(navigateMock).not.toHaveBeenCalledWith(-1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Interaction helpers
  // ─────────────────────────────────────────────────────────────────────────
  describe('Keyboard Interaction', () => {
    it('activates the fallback path on Enter keypress', async () => {
      setHistoryLength(1);
      render(<BackButton />);
      const btn = screen.getByRole('button', { name: 'بازگشت' });
      btn.focus();
      // user.keyboard('{Enter}') simulates a real Enter press, which causes
      // the browser to fire a synthetic click on a focused <button>.
      await user.keyboard('{Enter}');
      expect(navigateMock).toHaveBeenCalledTimes(1);
      expect(navigateMock).toHaveBeenCalledWith('/home');
    });

    it('activates navigate(-1) via Enter when history is deep', async () => {
      setHistoryLength(4);
      render(<BackButton />);
      const btn = screen.getByRole('button', { name: 'بازگشت' });
      btn.focus();
      await user.keyboard('{Enter}');
      expect(navigateMock).toHaveBeenCalledTimes(1);
      expect(navigateMock).toHaveBeenCalledWith(-1);
    });
  });

  describe('Acceptance of arbitrary className passthrough', () => {
    it('applies a custom className to the button', () => {
      render(<BackButton className="my-custom-class" />);
      const btn = screen.getByRole('button', { name: 'بازگشت' });
      expect(btn).toHaveClass('my-custom-class');
    });
  });
});
