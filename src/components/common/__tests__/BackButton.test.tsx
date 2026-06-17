// ============================================================================
// BackButton.test.tsx — Vitest unit tests for the universal RTL BackButton
// ----------------------------------------------------------------------------
// Asserts the simplified two-tier safe-fallback routing:
//   1) navigate(-1)  — primary behaviour, step back exactly one in history
//                      (mirrors OS hardware back button semantics)
//   2) navigate(fallbackPath) — last-resort URL jump ONLY when history
//                               stack is empty (deep-link entry edge case)
// ============================================================================
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// vi.hoisted runs before vi.mock so the captured mock fn is shared
// between the mock factory and the assertions below.
const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

import BackButton from '../BackButton';

describe('BackButton Component', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  afterEach(() => {
    // Default to the deep-link worst-case so a test that forgets to override
    // explicitly exercises the safe-fallback branch.
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
      const visibleLabel = screen.queryByText('بازگشت', { selector: 'span' });
      expect(visibleLabel).toBeNull();
    });

    it('renders the label as visible text when showLabel is true', () => {
      render(<BackButton showLabel />);
      expect(screen.getByText('بازگشت', { selector: 'span' })).toBeInTheDocument();
    });

    it('renders an ArrowRight SVG icon (RTL back direction), aria-hidden', () => {
      const { container } = render(<BackButton />);
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Tier 1 — navigate(-1) when history.stack >= 2
  // ─────────────────────────────────────────────────────────────────────────
  describe('Primary: navigate(-1) when history depth >= 2', () => {
    it('calls navigate(-1) at the lower-bound threshold (history.length = 2)', async () => {
      setHistoryLength(2);
      render(<BackButton />);

      await user.click(screen.getByRole('button', { name: 'بازگشت' }));

      expect(navigateMock).toHaveBeenCalledTimes(1);
      expect(navigateMock).toHaveBeenCalledWith(-1);
    });

    it('calls navigate(-1) for any history depth above the threshold', async () => {
      setHistoryLength(7);
      render(<BackButton />);

      await user.click(screen.getByRole('button', { name: 'بازگشت' }));

      expect(navigateMock).toHaveBeenCalledTimes(1);
      expect(navigateMock).toHaveBeenCalledWith(-1);
    });

    it('does NOT consult fallbackPath when history is sufficient', async () => {
      setHistoryLength(3);
      render(<BackButton fallbackPath="/login" />);

      await user.click(screen.getByRole('button', { name: 'بازگشت' }));

      expect(navigateMock).toHaveBeenCalledTimes(1);
      expect(navigateMock).toHaveBeenCalledWith(-1);
      expect(navigateMock).not.toHaveBeenCalledWith('/login');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Tier 2 — navigate(fallbackPath) when history.depth < 2 (deep-link)
  // ─────────────────────────────────────────────────────────────────────────
  describe('Fallback: navigate(fallbackPath) on deep-link entry', () => {
    it('calls navigate("/home") when history.length = 1', async () => {
      setHistoryLength(1);
      render(<BackButton />);

      await user.click(screen.getByRole('button', { name: 'بازگشت' }));

      expect(navigateMock).toHaveBeenCalledTimes(1);
      expect(navigateMock).toHaveBeenCalledWith('/home');
      expect(navigateMock).not.toHaveBeenCalledWith(-1);
    });

    it('uses a custom fallbackPath when provided', async () => {
      setHistoryLength(1);
      render(<BackButton fallbackPath="/login" />);

      await user.click(screen.getByRole('button', { name: 'بازگشت' }));

      expect(navigateMock).toHaveBeenCalledTimes(1);
      expect(navigateMock).toHaveBeenCalledWith('/login');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Keyboard Interaction — matches Button.test.tsx style
  // ─────────────────────────────────────────────────────────────────────────
  describe('Keyboard Interaction', () => {
    it('activates navigate(-1) via Enter on history-rich URL', async () => {
      setHistoryLength(4);
      render(<BackButton />);
      const btn = screen.getByRole('button', { name: 'بازگشت' });
      btn.focus();
      await user.keyboard('{Enter}');
      expect(navigateMock).toHaveBeenCalledTimes(1);
      expect(navigateMock).toHaveBeenCalledWith(-1);
    });

    it('activates fallback via Enter on deep-link entry', async () => {
      setHistoryLength(1);
      render(<BackButton />);
      const btn = screen.getByRole('button', { name: 'بازگشت' });
      btn.focus();
      await user.keyboard('{Enter}');
      expect(navigateMock).toHaveBeenCalledTimes(1);
      expect(navigateMock).toHaveBeenCalledWith('/home');
      expect(navigateMock).not.toHaveBeenCalledWith(-1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Acceptance of arbitrary className passthrough
  // ─────────────────────────────────────────────────────────────────────────
  describe('className passthrough', () => {
    it('applies a custom className to the button element', () => {
      render(<BackButton className="my-custom-class" />);
      const btn = screen.getByRole('button', { name: 'بازگشت' });
      expect(btn).toHaveClass('my-custom-class');
    });
  });
});
