// src/services/notification.ts

type SessionType = 'work' | 'shortBreak' | 'longBreak';

interface NotificationMessages {
  title: string;
  body: string;
  icon?: string;
}

const MESSAGES: Record<SessionType, NotificationMessages> = {
  work: {
    title: '🍅 Focus Session Complete!',
    body: 'Time to take a break. Great work staying focused!',
  },
  shortBreak: {
    title: '☕ Short Break Over',
    body: 'Ready to get back to work?',
  },
  longBreak: {
    title: '🌴 Long Break Finished',
    body: 'Feeling refreshed? Let\'s start another productive session!',
  },
};

// Track active notification for cleanup
let activeNotification: Notification | null = null;

/**
 * Close any active notification
 */
export function closeActiveNotification(): void {
  if (activeNotification) {
    activeNotification.close();
    activeNotification = null;
  }
}

/**
 * Check if browser notifications are supported
 */
export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) {
    return 'default';
  }
  return Notification.permission;
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    return 'default';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'default';
  }
}

/**
 * Send a notification for session completion
 */
export function sendSessionNotification(sessionType: SessionType): void {
  if (!isNotificationSupported()) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  const message = MESSAGES[sessionType];

  try {
    // Close any existing notification first
    closeActiveNotification();

    // logo192.png is expected to exist in the public folder per create-react-app default
    // If hosting in a subdirectory, update this path accordingly
    activeNotification = new Notification(message.title, {
      body: message.body,
      icon: '/logo192.png',
    });

    // Auto-close after 10 seconds
    setTimeout(() => {
      if (activeNotification) {
        activeNotification.close();
        activeNotification = null;
      }
    }, 10000);
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}
