import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Input from '../Input';

describe('Input Component', () => {
  const user = userEvent.setup();

  describe('Basic Rendering', () => {
    it('renders input element', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      render(<Input className="custom-input" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('custom-input');
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(<Input ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });
  });

  describe('Label', () => {
    it('renders label when provided', () => {
      render(<Input label="Test Label" />);
      const label = screen.getByText('Test Label');
      expect(label).toBeInTheDocument();
      expect(label).toHaveAttribute('for'); // Should be associated with input
    });

    it('does not render label when not provided', () => {
      render(<Input />);
      const label = screen.queryByRole('label');
      expect(label).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('renders error message when error prop is provided', () => {
      render(<Input error="This field is required" />);
      const errorMessage = screen.getByText('This field is required');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveClass('text-red-500');
    });

    it('applies error styling to input when error exists', () => {
      render(<Input error="Error message" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('border-red-500');
    });

    it('does not show error message when no error', () => {
      render(<Input />);
      const errorMessage = screen.queryByText(/error/i);
      expect(errorMessage).not.toBeInTheDocument();
    });
  });

  describe('Input Types', () => {
    it('renders as text input by default', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'text');
    });

    it('renders with specified type', () => {
      render(<Input type="password" />);
      const input = screen.getByDisplayValue(''); // Password inputs don't show as textbox role
      expect(input).toHaveAttribute('type', 'password');
    });

    it('renders with email type', () => {
      render(<Input type="email" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'email');
    });
  });

  describe('Props Forwarding', () => {
    it('forwards standard input props', () => {
      render(
        <Input
          placeholder="Enter text"
          disabled
          required
          maxLength={50}
          data-testid="test-input"
        />
      );
      const input = screen.getByTestId('test-input');
      expect(input).toHaveAttribute('placeholder', 'Enter text');
      expect(input).toBeDisabled();
      expect(input).toBeRequired();
      expect(input).toHaveAttribute('maxlength', '50');
    });

    it('handles value and onChange', async () => {
      const handleChange = vi.fn();
      render(<Input value="test value" onChange={handleChange} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('test value');

      await user.type(input, ' additional text');
      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe('Container Styling', () => {
    it('applies containerClassName to container div', () => {
      render(<Input containerClassName="custom-container" />);
      const container = screen.getByRole('textbox').parentElement;
      expect(container).toHaveClass('custom-container');
    });

    it('has default container classes', () => {
      render(<Input />);
      const container = screen.getByRole('textbox').parentElement;
      expect(container).toHaveClass('w-full');
    });
  });

  describe('Accessibility', () => {
    it('associates label with input via htmlFor', () => {
      render(<Input label="Username" id="username" />);
      const label = screen.getByText('Username');
      const input = screen.getByRole('textbox');
      expect(label).toHaveAttribute('for', 'username');
      expect(input).toHaveAttribute('id', 'username');
    });

    it('has proper ARIA attributes when required', () => {
      render(<Input required aria-describedby="helper-text" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', 'helper-text');
      expect(input).toBeRequired();
    });
  });

  describe('Disabled State', () => {
    it('applies disabled styling', () => {
      render(<Input disabled />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('disabled:opacity-60');
      expect(input).toHaveClass('disabled:cursor-not-allowed');
    });

    it('prevents interaction when disabled', async () => {
      const handleChange = vi.fn();
      render(<Input disabled onChange={handleChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'test');

      expect(handleChange).not.toHaveBeenCalled();
    });
  });
});
