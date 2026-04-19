# Browser Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add browser notifications that trigger when a Pomodoro session completes (work, short break, long break).

**Architecture:** Create a reusable notification service module that wraps the browser Notification API, handles permission requests, and displays contextual messages based on which session completed. The service will be integrated into the existing timer completion logic in App.tsx.

**Tech Stack:** React 19, TypeScript, Browser Notification API (native)

---

## File Structure

| File | Purpose |
|------|---------|
| `src/services/notification.ts` | New - Notification service with permission handling, notification creation |
| `src/App.tsx` | Modify - Integrate notification trigger when timer completes |
| `src/App.test.tsx` | Modify - Add tests for notification functionality |

---

### Task 1: Create Notification Service

**Files:**
- Create: `src/services/notification.ts`

- [ ] **Step 1: Write the notification service**

```typescript
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
```

- [ ] **Step 2: Create services directory if needed**

```bash
mkdir -p src/services
```

- [ ] **Step 3: Commit notification service**

```bash
git add src/services/notification.ts
git commit -m "feat: add browser notification service"
```

---

### Task 2: Integrate Notifications into Timer

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import notification service at the top of App.tsx**

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import {
  isNotificationSupported,
  requestNotificationPermission,
  sendSessionNotification,
} from './services/notification';
```

- [ ] **Step 2: Add notification permission button in the UI**

Add this button section after the mode tabs, around line 90 (after the closing `</div>` of mode-tabs):

```tsx
        <div className="mode-tabs">
          {(Object.keys(MODES) as Mode[]).map((m) => (
            <button
              key={m}
              className={`mode-tab ${mode === m ? 'active' : ''}`}
              onClick={() => switchMode(m)}
              style={{ '--mode-color': MODES[m].color } as React.CSSProperties}
            >
              {MODES[m].label}
            </button>
          ))}
        </div>

        {isNotificationSupported() && (
          <div className="notification-permission">
            <button
              className="btn-notify"
              onClick={requestNotificationPermission}
              disabled={Notification.permission === 'granted'}
            >
              {Notification.permission === 'granted'
                ? '✅ Notifications Enabled'
                : '🔔 Enable Notifications'}
            </button>
          </div>
        )}
```

- [ ] **Step 3: Add notification trigger when timer completes**

Modify the useEffect that handles timer completion (around line 47-58). The notification should be sent when timeLeft === 0, before switching modes:

```typescript
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
  } else if (timeLeft === 0) {
      setIsActive(false);

      // Capture completed session type BEFORE any state changes or mode switches
      const completedSessionType = mode;

      // Send notification for completed session
      sendSessionNotification(completedSessionType);

      if (completedSessionType === 'work') {
        const newSessionsCompleted = sessionsCompleted + 1;
        setSessionsCompleted(newSessionsCompleted);

        // Determine next mode based on whether this was the 4th work session (index 3, 7, 11...)
        const nextMode = newSessionsCompleted % 4 === 0 ? 'longBreak' : 'shortBreak';
        switchMode(nextMode);
      } else {
        // After any break, switch back to work
        switchMode('work');
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeLeft, mode, sessionsCompleted, switchMode]);
```

- [ ] **Step 4: Add CSS for notification button**

Add to `src/App.css` after the existing `.mode-tabs` styles:

```css
.notification-permission {
  margin: 1rem 0;
  text-align: center;
}

.btn-notify {
  padding: 0.5rem 1rem;
  border: 2px solid #4ecdc4;
  background: transparent;
  color: #4ecdc4;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s ease;
}

.btn-notify:hover:not(:disabled) {
  background: #4ecdc4;
  color: white;
}

.btn-notify:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  border-color: #2ecc71;
  color: #2ecc71;
}
```

- [ ] **Step 5: Add cleanup on component unmount**

Add a useEffect in `App.tsx` to close any active notifications when the component unmounts:

```typescript
import { closeActiveNotification } from './services/notification';

// Add this useEffect in App component:
useEffect(() => {
  return () => {
    closeActiveNotification();
  };
}, []);
```

- [ ] **Step 6: Commit timer integration**

```bash
git add src/App.tsx src/App.css
git commit -m "feat: integrate notifications into timer completion"
```

---

### Task 3: Add Tests for Notification Service

**Files:**
- Create: `src/services/notification.test.ts`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write tests for notification service**

Create `src/services/notification.test.ts`:

```typescript
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  sendSessionNotification,
} from './notification';

describe('Notification Service', () => {
  let originalNotification: typeof window.Notification;

  beforeEach(() => {
    originalNotification = window.Notification;
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
    it('should send notification when permission is granted', () => {
      const mockNotification = jest.fn();
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
      const mockNotification = jest.fn();
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
  });
});
```

- [ ] **Step 2: Update App tests to include notification flow**

Add tests to `src/App.test.tsx` after existing tests:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

// Mock the notification service
jest.mock('./services/notification', () => ({
  isNotificationSupported: jest.fn().mockReturnValue(true),
  requestNotificationPermission: jest.fn().mockResolvedValue('granted'),
  sendSessionNotification: jest.fn(),
  getNotificationPermission: jest.fn().mockReturnValue('default'),
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
    render(<App />);
    expect(screen.getByText(/🍅 Tomato Clock/i)).toBeInTheDocument();
  });

  it('shows notification enable button when supported', () => {
    render(<App />);
    expect(screen.getByText(/Enable Notifications/i)).toBeInTheDocument();
  });

  it('disables notification button when already granted', () => {
    Object.defineProperty(window, 'Notification', {
      writable: true,
      value: {
        permission: 'granted',
        requestPermission: jest.fn(),
      },
    });

    render(<App />);
    expect(screen.getByText(/Notifications Enabled/i)).toBeDisabled();
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
cd tomatoclock
npm test -- --watchAll=false
```

Expected: All tests pass.

- [ ] **Step 4: Commit tests**

```bash
git add src/services/notification.test.ts src/App.test.tsx
git commit -m "test: add notification service tests"
```

---

## Summary

This plan adds browser notifications for session completion:

1. **Notification Service** (`src/services/notification.ts`) - Handles permission requests, permission status checking, and sending contextual notifications for each session type.

2. **UI Integration** (`src/App.tsx`, `src/App.css`) - Adds a button to request notification permissions and triggers notifications when the timer completes.

3. **Tests** - Unit tests for the notification service and integration tests for the UI components.

---

## How to Test Manually

1. Run the app: `npm start`
2. Click "Enable Notifications" button
3. Allow notifications in the browser permission prompt
4. Start a timer and wait for it to complete (or temporarily change `WORK_TIME` to 2 seconds for testing)
5. Verify you receive a browser notification when the session ends

---

## Workflow

This plan follows the **superpowers:executing-plans** workflow:

1. **Planning** (complete) - Plan document created and reviewed
2. **Execution** - Run `superpowers:executing-plans` with this plan document
3. **Verification** - After execution, run `npm test` and manual verification per "How to Test Manually" section
4. **Alignment Review** - Compare implementation against plan invariants

No user authorization override required for this bounded feature.

---

**Plan complete and saved to `docs/plans/2026-04-19-browser-notifications.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach would you prefer?

---

## Revision Log

### 2026-04-19 - Plan Review Changes
- **Source:** Plan review by reviewer agent
- **Changes:**
  - Task 1, Step 1: Added notification instance tracking with `activeNotification` variable and `closeActiveNotification()` function (F-002)
  - Task 1, Step 1: Added icon path comment explaining `/logo192.png` assumption (F-004)
  - Task 1, Step 1: Updated `sendSessionNotification` to use `activeNotification` tracking, auto-close after 10 seconds, and call `closeActiveNotification()` before creating new notification
  - Task 2, Step 3: Fixed race condition by capturing `completedSessionType = mode` before any state changes (F-001)
  - Task 2, Step 3: Improved `sessionsCompleted` handling to use `newSessionsCompleted` variable for clarity (F-005)
  - Task 2: Added new Step 5 with cleanup useEffect calling `closeActiveNotification()` on unmount
  - Task 2: Renumbered commit step from Step 5 to Step 6
  - Added new "Workflow" section specifying `superpowers:executing-plans` workflow (F-003)
- **Reason:** Address race conditions, add cleanup boundaries, clarify ownership, and satisfy reviewer specification requirements
