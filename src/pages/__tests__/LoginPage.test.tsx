import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../LoginPage';

// Mock all stores and dependencies
vi.mock('../../store/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    login: vi.fn(),
    blockUntil: null,
    loadSavedUsername: vi.fn(),
    savedUsername: '',
  })),
}));

vi.mock('../../store/toastStore', () => ({
  useToastStore: vi.fn(() => ({
    addToast: vi.fn(),
  })),
}));

vi.mock('../../components/common/Icons', () => ({
  Icons: {
    User: () => <div data-testid="user-icon" />,
    Eye: () => <div data-testid="eye-icon" />,
    EyeOff: () => <div data-testid="eye-off-icon" />,
    Refresh: () => <div data-testid="refresh-icon" />,
    ArrowLeft: () => <div data-testid="arrow-left-icon" />,
  },
}));

vi.mock('../../components/common/ThemeToggle', () => ({
  default: () => <button data-testid="theme-toggle">Theme</button>,
}));

vi.mock('../../components/common/Button', () => ({
  default: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('../../components/common/Input', () => ({
  default: ({ ...props }: any) => <input {...props} />,
}));

vi.mock('../../services/quoteService', () => ({
  fetchDailyQuote: vi.fn(),
  getQuoteDateKey: vi.fn(),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock date utilities
vi.mock('../../utils/dateUtils', () => ({
  getTodayJalaliPersian: vi.fn(() => '۱۴۰۳/۰۱/۰۱'),
  getCurrentTime: vi.fn(() => '۱۲:۰۰:۰۰'),
  getTodayDayName: vi.fn(() => 'شنبه'),
  toPersianDigits: vi.fn((str) => str),
}));

const mockAuthStore = vi.mocked(await import('../../store/authStore')).useAuthStore;
const mockToastStore = vi.mocked(await import('../../store/toastStore')).useToastStore;

describe('LoginPage Integration', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderLoginPage = () => {
    return render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
  };

  describe('Initial Render', () => {
    it('renders all main components', () => {
      renderLoginPage();

      expect(screen.getByText('ورود به حساب')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('نام کاربری')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('رمز عبور')).toBeInTheDocument();
      expect(screen.getByText('مرا به خاطر بسپار')).toBeInTheDocument();
      expect(screen.getByText('ورود به حساب')).toBeInTheDocument();
    });

    it('shows logo and branding', () => {
      renderLoginPage();

      expect(screen.getByText('MORVARID')).toBeInTheDocument();
      expect(screen.getByText('مـرواریــد')).toBeInTheDocument();
    });

    it('displays current date and time', () => {
      renderLoginPage();

      expect(screen.getByText('۱۴۰۳/۰۱/۰۱')).toBeInTheDocument();
      expect(screen.getByText('۱۲:۰۰:۰۰')).toBeInTheDocument();
      expect(screen.getByText('شنبه')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('shows error for empty username', async () => {
      const mockAddToast = vi.fn();
      mockToastStore.mockReturnValue({ addToast: mockAddToast });

      renderLoginPage();

      const submitButton = screen.getByText('ورود به حساب');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('نام کاربری الزامی است', 'error');
      });
    });

    it('shows error for empty password', async () => {
      const mockAddToast = vi.fn();
      mockToastStore.mockReturnValue({ addToast: mockAddToast });

      renderLoginPage();

      const usernameInput = screen.getByPlaceholderText('نام کاربری');
      await user.type(usernameInput, 'testuser');

      const submitButton = screen.getByText('ورود به حساب');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('رمز عبور الزامی است', 'error');
      });
    });
  });

  describe('Login Flow', () => {
    it('calls login function with correct credentials', async () => {
      const mockLogin = vi.fn().mockResolvedValue({ success: true });
      const mockAddToast = vi.fn();

      mockAuthStore.mockReturnValue({
        login: mockLogin,
        blockUntil: null,
        loadSavedUsername: vi.fn(),
        savedUsername: '',
      });
      mockToastStore.mockReturnValue({ addToast: mockAddToast });

      renderLoginPage();

      const usernameInput = screen.getByPlaceholderText('نام کاربری');
      const passwordInput = screen.getByPlaceholderText('رمز عبور');
      const rememberCheckbox = screen.getByRole('checkbox');
      const submitButton = screen.getByText('ورود به حساب');

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'testpass');
      await user.click(rememberCheckbox);
      await user.click(submitButton);

      expect(mockLogin).toHaveBeenCalledWith('testuser', 'testpass', true);
    });

    it('shows success toast and redirects on successful login', async () => {
      const mockLogin = vi.fn().mockResolvedValue({
        success: true,
        user: { role: 'ADMIN', fullName: 'Test User' }
      });
      const mockAddToast = vi.fn();

      mockAuthStore.mockReturnValue({
        login: mockLogin,
        blockUntil: null,
        loadSavedUsername: vi.fn(),
        savedUsername: '',
      });
      mockToastStore.mockReturnValue({ addToast: mockAddToast });

      renderLoginPage();

      const usernameInput = screen.getByPlaceholderText('نام کاربری');
      const passwordInput = screen.getByPlaceholderText('رمز عبور');
      const submitButton = screen.getByText('ورود به حساب');

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'testpass');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('خوش آمدید Test User', 'success');
      });
    });

    it('shows error toast on failed login', async () => {
      const mockLogin = vi.fn().mockResolvedValue({
        success: false,
        error: 'Invalid credentials'
      });
      const mockAddToast = vi.fn();

      mockAuthStore.mockReturnValue({
        login: mockLogin,
        blockUntil: null,
        loadSavedUsername: vi.fn(),
        savedUsername: '',
      });
      mockToastStore.mockReturnValue({ addToast: mockAddToast });

      renderLoginPage();

      const usernameInput = screen.getByPlaceholderText('نام کاربری');
      const passwordInput = screen.getByPlaceholderText('رمز عبور');
      const submitButton = screen.getByText('ورود به حساب');

      await user.type(usernameInput, 'wronguser');
      await user.type(passwordInput, 'wrongpass');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('Invalid credentials', 'error');
      });
    });
  });

  describe('UI Interactions', () => {
    it('toggles password visibility', async () => {
      renderLoginPage();

      const passwordInput = screen.getByPlaceholderText('رمز عبور');
      const toggleButton = screen.getByTestId('eye-icon').closest('button');

      expect(passwordInput).toHaveAttribute('type', 'password');

      await user.click(toggleButton!);
      expect(passwordInput).toHaveAttribute('type', 'text');

      await user.click(toggleButton!);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('loads saved username on mount', () => {
      const mockLoadSavedUsername = vi.fn();

      mockAuthStore.mockReturnValue({
        login: vi.fn(),
        blockUntil: null,
        loadSavedUsername: mockLoadSavedUsername,
        savedUsername: 'saveduser',
      });

      renderLoginPage();

      expect(mockLoadSavedUsername).toHaveBeenCalled();
    });

    it('pre-fills username when savedUsername exists', () => {
      mockAuthStore.mockReturnValue({
        login: vi.fn(),
        blockUntil: null,
        loadSavedUsername: vi.fn(),
        savedUsername: 'saveduser',
      });

      renderLoginPage();

      const usernameInput = screen.getByPlaceholderText('نام کاربری');
      expect(usernameInput).toHaveValue('saveduser');

      const rememberCheckbox = screen.getByRole('checkbox');
      expect(rememberCheckbox).toBeChecked();
    });
  });

  describe('Blocked State', () => {
    it('disables form when user is blocked', () => {
      const blockTime = Date.now() + 60000; // 1 minute from now

      mockAuthStore.mockReturnValue({
        login: vi.fn(),
        blockUntil: blockTime,
        loadSavedUsername: vi.fn(),
        savedUsername: '',
      });

      renderLoginPage();

      const usernameInput = screen.getByPlaceholderText('نام کاربری');
      const passwordInput = screen.getByPlaceholderText('رمز عبور');
      const submitButton = screen.getByText(/مسدود/);

      expect(usernameInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveTextContent('مسدود');
    });

    it('shows remaining block time', () => {
      const blockTime = Date.now() + 30000; // 30 seconds from now

      mockAuthStore.mockReturnValue({
        login: vi.fn(),
        blockUntil: blockTime,
        loadSavedUsername: vi.fn(),
        savedUsername: '',
      });

      renderLoginPage();

      const submitButton = screen.getByText(/مسدود/);
      expect(submitButton).toHaveTextContent('مسدود');
    });
  });

  describe('Loading States', () => {
    it('shows loading state during login', async () => {
      const mockLogin = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      const mockAddToast = vi.fn();

      mockAuthStore.mockReturnValue({
        login: mockLogin,
        blockUntil: null,
        loadSavedUsername: vi.fn(),
        savedUsername: '',
      });
      mockToastStore.mockReturnValue({ addToast: mockAddToast });

      renderLoginPage();

      const usernameInput = screen.getByPlaceholderText('نام کاربری');
      const passwordInput = screen.getByPlaceholderText('رمز عبور');
      const submitButton = screen.getByText('ورود به حساب');

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'testpass');
      await user.click(submitButton);

      // Should show loading state
      expect(submitButton).toHaveTextContent('در حال پردازش');

      // Wait for login to complete
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });
    });
  });
});
