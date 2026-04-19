import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

// Mock the notification service - must be before imports
const mockIsNotificationSupported = jest.fn();
const mockGetNotificationPermission = jest.fn();
const mockRequestNotificationPermission = jest.fn();
const mockSendSessionNotification = jest.fn();
const mockCloseActiveNotification = jest.fn();

jest.mock('./services/notification', () => ({
  __esModule: true,
  isNotificationSupported: (...args: unknown[]) => mockIsNotificationSupported(...args),
  getNotificationPermission: (...args: unknown[]) => mockGetNotificationPermission(...args),
  requestNotificationPermission: (...args: unknown[]) => mockRequestNotificationPermission(...args),
  sendSessionNotification: (...args: unknown[]) => mockSendSessionNotification(...args),
  closeActiveNotification: (...args: unknown[]) => mockCloseActiveNotification(...args),
}));

describe('App', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Notification global
    Object.defineProperty(window, 'Notification', {
      writable: true,
      value: {
        permission: 'default',
        requestPermission: jest.fn().mockResolvedValue('granted'),
      },
    });
  });

  it('renders tomato clock app', () => {
    mockIsNotificationSupported.mockReturnValue(true);
    mockGetNotificationPermission.mockReturnValue('default');

    render(<App />);
    expect(screen.getByText(/🍅 Tomato Clock/i)).toBeInTheDocument();
  });

  it('shows notification enable button when supported', () => {
    mockIsNotificationSupported.mockReturnValue(true);
    mockGetNotificationPermission.mockReturnValue('default');

    render(<App />);
    expect(screen.getByText(/🔔 Enable Notifications/i)).toBeInTheDocument();
  });

  it('disables notification button when already granted', () => {
    // Set up granted permission
    mockIsNotificationSupported.mockReturnValue(true);
    mockGetNotificationPermission.mockReturnValue('granted');

    Object.defineProperty(window, 'Notification', {
      writable: true,
      value: {
        permission: 'granted',
        requestPermission: jest.fn(),
      },
    });

    render(<App />);

    // The button should show as disabled with "Notifications Enabled" text
    const button = screen.getByRole('button', { name: /✅ Notifications Enabled/i });
    expect(button).toBeDisabled();
  });

  it('starts timer when start button is clicked', () => {
    mockIsNotificationSupported.mockReturnValue(true);
    mockGetNotificationPermission.mockReturnValue('default');

    render(<App />);
    const startButton = screen.getByText(/▶ Start/i);
    fireEvent.click(startButton);
    expect(screen.getByText(/⏸ Pause/i)).toBeInTheDocument();
  });

  it('switches modes when mode tab is clicked', () => {
    mockIsNotificationSupported.mockReturnValue(true);
    mockGetNotificationPermission.mockReturnValue('default');

    render(<App />);
    const shortBreakTab = screen.getByText(/Short Break/i);
    fireEvent.click(shortBreakTab);
    expect(shortBreakTab).toHaveClass('active');
  });
});
