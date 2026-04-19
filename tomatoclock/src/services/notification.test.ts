import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  sendSessionNotification,
  closeActiveNotification,
} from './notification';

describe('Notification Service', () => {
  let originalNotification: typeof window.Notification;

  beforeEach(() => {
    originalNotification = window.Notification;
    // Reset module-level state before each test
    closeActiveNotification();
  });

  afterEach(() => {
    window.Notification = originalNotification;
    jest.clearAllMocks();
  });

  describe('isNotificationSupported', () => {
    it('should return true when Notification API is available', () => {
      window.Notification = jest.fn() as unknown as typeof window.Notification;
      expect(isNotificationSupported()).toBe(true);
    });

    it('should return false when Notification API is not available', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).Notification;
      expect(isNotificationSupported()).toBe(false);
    });
  });

  describe('getNotificationPermission', () => {
    it('should return current permission status', () => {
      window.Notification = {
        permission: 'granted',
      } as unknown as typeof window.Notification;

      expect(getNotificationPermission()).toBe('granted');
    });

    it('should return default when not supported', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).Notification;
      expect(getNotificationPermission()).toBe('default');
    });
  });

  describe('requestNotificationPermission', () => {
    it('should request permission and return result', async () => {
      const mockRequestPermission = jest.fn().mockResolvedValue('granted');
      window.Notification = {
        permission: 'default',
        requestPermission: mockRequestPermission,
      } as unknown as typeof window.Notification;

      const result = await requestNotificationPermission();

      expect(mockRequestPermission).toHaveBeenCalled();
      expect(result).toBe('granted');
    });

    it('should return default when not supported', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).Notification;
      const result = await requestNotificationPermission();
      expect(result).toBe('default');
    });
  });

  describe('sendSessionNotification', () => {
    beforeEach(() => {
      // Reset activeNotification before each test in this block
      closeActiveNotification();
    });

    it('should send notification when permission is granted', () => {
      const mockClose = jest.fn();
      const mockNotificationInstance = { close: mockClose };
      const mockNotification = jest.fn().mockImplementation(() => mockNotificationInstance);
      window.Notification = mockNotification as unknown as typeof window.Notification;
      Object.defineProperty(window.Notification, 'permission', {
        value: 'granted',
        writable: true,
      });

      sendSessionNotification('work');

      expect(mockNotification).toHaveBeenCalledWith(
        '🍅 Focus Session Complete!',
        expect.objectContaining({
          body: expect.stringContaining('Time to take a break'),
          icon: '/logo192.png',
        })
      );
    });

    it('should not send notification when permission is denied', () => {
      // Clear any previous notification state
      closeActiveNotification();

      const mockClose = jest.fn();
      const mockNotification = jest.fn().mockImplementation(() => ({
        close: mockClose,
      }));
      window.Notification = mockNotification as unknown as typeof window.Notification;
      Object.defineProperty(window.Notification, 'permission', {
        value: 'denied',
        writable: true,
      });

      sendSessionNotification('work');

      expect(mockNotification).not.toHaveBeenCalled();
    });

    it('should handle different session types with appropriate messages', () => {
      const mockNotification = jest.fn();
      window.Notification = mockNotification as unknown as typeof window.Notification;
      Object.defineProperty(window.Notification, 'permission', {
        value: 'granted',
        writable: true,
      });

      // Test work session
      sendSessionNotification('work');
      expect(mockNotification).toHaveBeenCalledWith(
        '🍅 Focus Session Complete!',
        expect.any(Object)
      );

      mockNotification.mockClear();

      // Test short break session
      sendSessionNotification('shortBreak');
      expect(mockNotification).toHaveBeenCalledWith(
        '☕ Short Break Over',
        expect.any(Object)
      );

      mockNotification.mockClear();

      // Test long break session
      sendSessionNotification('longBreak');
      expect(mockNotification).toHaveBeenCalledWith(
        '🌴 Long Break Finished',
        expect.any(Object)
      );
    });

    it('should close existing notification before showing new one', () => {
      const mockClose = jest.fn();
      const mockNotification = jest.fn().mockImplementation(() => ({
        close: mockClose,
      }));
      window.Notification = mockNotification as unknown as typeof window.Notification;
      Object.defineProperty(window.Notification, 'permission', {
        value: 'granted',
        writable: true,
      });

      // Send first notification
      sendSessionNotification('work');
      expect(mockNotification).toHaveBeenCalledTimes(1);

      // Send second notification - should close first
      sendSessionNotification('shortBreak');
      expect(mockClose).toHaveBeenCalled();
      expect(mockNotification).toHaveBeenCalledTimes(2);
    });
  });

  describe('closeActiveNotification', () => {
    it('should close active notification and clear reference', () => {
      const mockClose = jest.fn();
      const mockNotification = jest.fn().mockImplementation(() => ({
        close: mockClose,
      }));
      window.Notification = mockNotification as unknown as typeof window.Notification;
      Object.defineProperty(window.Notification, 'permission', {
        value: 'granted',
        writable: true,
      });

      // Create a notification
      sendSessionNotification('work');
      expect(mockNotification).toHaveBeenCalled();

      // Close it manually
      closeActiveNotification();
      expect(mockClose).toHaveBeenCalled();

      // Calling close again should not throw
      expect(() => closeActiveNotification()).not.toThrow();
    });
  });
});
