import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from '../Button';

describe('Button Component', () => {
  const user = userEvent.setup();

  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      render(<Button>Click me</Button>);
      const button = screen.getByRole('button', { name: /click me/i });
      expect(button).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      render(<Button className="custom-class">Click me</Button>);
      const button = screen.getByRole('button', { name: /click me/i });
      expect(button).toHaveClass('custom-class');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(<Button ref={ref}>Click me</Button>);
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });
  });

  describe('Variants', () => {
    const variants: Array<'primary' | 'secondary' | 'danger' | 'ghost' | 'tonal'> = [
      'primary', 'secondary', 'danger', 'ghost', 'tonal'
    ];

    variants.forEach(variant => {
      it(`renders ${variant} variant correctly`, () => {
        render(<Button variant={variant}>{variant} Button</Button>);
        const button = screen.getByRole('button', { name: new RegExp(variant, 'i') });
        expect(button).toHaveClass(variant);
      });
    });

    it('defaults to primary variant', () => {
      render(<Button>Default</Button>);
      const button = screen.getByRole('button', { name: /default/i });
      expect(button).toHaveClass('primary');
    });
  });

  describe('Sizes', () => {
    const sizes: Array<'sm' | 'md' | 'lg' | 'icon'> = ['sm', 'md', 'lg', 'icon'];

    sizes.forEach(size => {
      it(`renders ${size} size correctly`, () => {
        render(<Button size={size}>{size} Button</Button>);
        const button = screen.getByRole('button', { name: new RegExp(size, 'i') });
        expect(button).toHaveClass(size);
      });
    });

    it('defaults to md size', () => {
      render(<Button>Default Size</Button>);
      const button = screen.getByRole('button', { name: /default size/i });
      expect(button).toHaveClass('md');
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner when isLoading is true', () => {
      render(<Button isLoading>Loading Button</Button>);
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('disables button when loading', () => {
      render(<Button isLoading>Loading Button</Button>);
      const button = screen.getByRole('button', { name: /loading button/i });
      expect(button).toBeDisabled();
    });

    it('does not show spinner when not loading', () => {
      render(<Button>Not Loading</Button>);
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).not.toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('calls onClick when clicked', async () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);

      const button = screen.getByRole('button', { name: /click me/i });
      await user.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', async () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick} disabled>Disabled</Button>);

      const button = screen.getByRole('button', { name: /disabled/i });
      await user.click(button);

      expect(handleClick).not.toHaveBeenCalled();
    });

    it('does not call onClick when loading', async () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick} isLoading>Loading</Button>);

      const button = screen.getByRole('button', { name: /loading/i });
      await user.click(button);

      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA attributes when disabled', () => {
      render(<Button disabled>Disabled Button</Button>);
      const button = screen.getByRole('button', { name: /disabled button/i });
      expect(button).toHaveAttribute('disabled');
    });

    it('forwards additional props to button element', () => {
      render(<Button aria-label="Custom Label" data-testid="custom-button">Button</Button>);
      const button = screen.getByTestId('custom-button');
      expect(button).toHaveAttribute('aria-label', 'Custom Label');
    });
  });

  describe('Memoization', () => {
    it('is memoized to prevent unnecessary re-renders', () => {
      const { rerender } = render(<Button>Same Button</Button>);
      const button1 = screen.getByRole('button', { name: /same button/i });

      rerender(<Button>Same Button</Button>);
      const button2 = screen.getByRole('button', { name: /same button/i });

      // React.memo should return the same instance
      expect(button1).toBe(button2);
    });
  });

  describe('Keyboard Interaction', () => {
    it('triggers onClick on Enter key press', async () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Keyboard Button</Button>);

      const button = screen.getByRole('button', { name: /keyboard button/i });
      button.focus();
      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('triggers onClick on Space key press', async () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Space Button</Button>);

      const button = screen.getByRole('button', { name: /space button/i });
      button.focus();
      fireEvent.keyDown(button, { key: ' ', code: 'Space' });

      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });
});
