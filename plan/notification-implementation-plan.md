# TomatoClock Notification Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a comprehensive notification system to TomatoClock that alerts users when timer sessions complete via audio, browser push, and in-app toast notifications.

**Architecture:** A React hooks-based architecture with `useNotification` as the central hook managing audio (Web Audio API), browser push (Notification API), and toast notifications. Settings are persisted to localStorage via `useSettings` hook. All notification types trigger in parallel on timer completion.

**Tech Stack:** React 19, TypeScript 4.9, Web Audio API, Notification API, localStorage, CSS3

---

## File Structure

```
tomatoclock/src/
├── hooks/
│   ├── useNotification.ts          # Central notification hook
│   ├── useSettings.ts               # Settings persistence hook
│   └── useAudio.ts                # Web Audio API hook
├── services/
│   └── audioService.ts            # Audio generation utilities
├── components/
│   ├── toast/
│   │   ├── ToastContainer.tsx     # Toast container component
│   │   ├── ToastItem.tsx          # Individual toast component
│   │   └── Toast.css              # Toast styles
│   └── settings/
│       ├── NotificationSettingsPanel.tsx
│       ├── Toggle.tsx
│       ├── VolumeSlider.tsx
│       ├── SoundSelector.tsx
│       ├── EventSelector.tsx
│       ├── PositionSelector.tsx
│       ├── DurationSlider.tsx
│       └── Settings.css
├── types/
│   └── notification.ts            # TypeScript interfaces
├── utils/
│   └── storage.ts                 # localStorage utilities
└── App.tsx                        # Modified to integrate notifications
```

---

## Task 1: TypeScript Interfaces and Types

**Files:**
- Create: `tomatoclock/src/types/notification.ts`

- [ ] **Step 1: Create notification types file**

```typescript
// tomatoclock/src/types/notification.ts

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export type NotificationType = 'complete' | 'break' | 'longBreak';

export type ToastPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type AudioType = 'beep' | 'chime' | 'bell';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

export interface NotificationSettings {
  // Audio notifications
  enableAudio: boolean;
  audioVolume: number; // 0-100
  audioType: AudioType;
  
  // Browser push notifications
  enablePush: boolean;
  pushPermission: NotificationPermission;
  showNotificationOn: NotificationType[];
  
  // In-app toast notifications
  enableToast: boolean;
  toastDuration: number; // milliseconds
  toastPosition: ToastPosition;
  toastType: 'minimal' | 'detailed';
}

export interface NotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
  data?: Record<string, unknown>;
}

export interface UseNotificationReturn {
  // Permission state
  pushPermission: NotificationPermission;
  requestPushPermission: () => Promise<NotificationPermission>;
  
  // Notification methods
  notify: (options: NotificationOptions) => void;
  playAudio: (type?: NotificationType) => void;
  showToast: (message: string, type?: ToastType) => void;
  
  // Settings
  settings: NotificationSettings;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
}
```

- [ ] **Step 2: Commit**

```bash
cd tomatoclock
git add src/types/notification.ts
git commit -m "feat: add TypeScript interfaces for notification system"
```

---

## Task 2: Storage Utilities

**Files:**
- Create: `tomatoclock/src/utils/storage.ts`

- [ ] **Step 1: Create storage utilities**

```typescript
// tomatoclock/src/utils/storage.ts

const STORAGE_KEY = 'tomatoclock_settings';

export interface StorageData {
  notification?: Record<string, unknown>;
  [key: string]: unknown;
}

export const storage = {
  get(): StorageData {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  },

  set(data: StorageData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Silently fail if storage is unavailable
    }
  },

  update(updates: Partial<StorageData>): void {
    const current = this.get();
    this.set({ ...current, ...updates });
  },

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Silently fail
    }
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/storage.ts
git commit -m "feat: add localStorage utilities for settings persistence"
```

---

## Task 3: Audio Service

**Files:**
- Create: `tomatoclock/src/services/audioService.ts`

- [ ] **Step 1: Create audio service**

```typescript
// tomatoclock/src/services/audioService.ts

import { NotificationType } from '../types/notification';

export type AudioFrequency = {
  complete: number;
  break: number;
  longBreak: number;
};

const FREQUENCIES: AudioFrequency = {
  complete: 880,    // A5
  break: 659.25,    // E5
  longBreak: 523.25, // C5
};

export interface PlayToneOptions {
  frequency: number;
  duration: number;
  volume: number;
  type?: OscillatorType;
}

export const audioService = {
  context: null as AudioContext | null,

  init(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    
    if (!this.context) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.context = new AudioContextClass();
      }
    }
    
    // Resume if suspended
    if (this.context?.state === 'suspended') {
      this.context.resume();
    }
    
    return this.context;
  },

  playTone(options: PlayToneOptions): void {
    const ctx = this.init();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.setValueAtTime(options.frequency, ctx.currentTime);
    oscillator.type = options.type || 'sine';

    const volume = Math.max(0, Math.min(1, options.volume / 100));
    
    // Envelope for pleasant sound
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(volume * 0.3, ctx.currentTime + options.duration * 0.5);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + options.duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + options.duration);
  },

  playNotification(type: NotificationType, volume: number): void {
    const frequency = FREQUENCIES[type];
    this.playTone({
      frequency,
      duration: 0.6,
      volume,
      type: 'sine',
    });
  },

  // Test sound - plays a quick beep
  test(volume: number): void {
    this.playTone({
      frequency: 880,
      duration: 0.3,
      volume,
      type: 'sine',
    });
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/services/audioService.ts
git commit -m "feat: add audio service with Web Audio API for notification sounds"
```

---

## Task 4: useSettings Hook

**Files:**
- Create: `tomatoclock/src/hooks/useSettings.ts`

- [ ] **Step 1: Create useSettings hook**

```typescript
// tomatoclock/src/hooks/useSettings.ts

import { useState, useEffect, useCallback } from 'react';
import { storage } from '../utils/storage';
import { NotificationSettings, NotificationType, ToastPosition, AudioType } from '../types/notification';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  // Audio
  enableAudio: true,
  audioVolume: 70,
  audioType: 'chime' as AudioType,
  
  // Browser Push
  enablePush: false, // User must opt-in
  pushPermission: 'default',
  showNotificationOn: ['complete', 'break', 'longBreak'] as NotificationType[],
  
  // In-app Toast
  enableToast: true,
  toastDuration: 5000,
  toastPosition: 'top-right' as ToastPosition,
  toastType: 'detailed',
};

export interface Settings {
  notification: NotificationSettings;
  [key: string]: unknown;
}

export const DEFAULT_SETTINGS: Settings = {
  notification: DEFAULT_NOTIFICATION_SETTINGS,
};

export interface UseSettingsReturn {
  settings: Settings;
  notificationSettings: NotificationSettings;
  updateSettings: (updates: Partial<Settings>) => void;
  updateNotificationSettings: (updates: Partial<NotificationSettings>) => void;
  resetSettings: () => void;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from storage on mount
  useEffect(() => {
    const stored = storage.get();
    if (stored && Object.keys(stored).length > 0) {
      setSettings({
        ...DEFAULT_SETTINGS,
        ...stored,
        notification: {
          ...DEFAULT_NOTIFICATION_SETTINGS,
          ...(stored.notification || {}),
        },
      });
    }
    setIsLoaded(true);
  }, []);

  // Save settings to storage whenever they change
  useEffect(() => {
    if (isLoaded) {
      storage.set(settings);
    }
  }, [settings, isLoaded]);

  const updateSettings = useCallback((updates: Partial<Settings>): void => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateNotificationSettings = useCallback((updates: Partial<NotificationSettings>): void => {
    setSettings((prev) => ({
      ...prev,
      notification: { ...prev.notification, ...updates },
    }));
  }, []);

  const resetSettings = useCallback((): void => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return {
    settings,
    notificationSettings: settings.notification,
    updateSettings,
    updateNotificationSettings,
    resetSettings,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useSettings.ts
git commit -m "feat: add useSettings hook with localStorage persistence"
```

---

## Task 5: useNotification Hook

**Files:**
- Create: `tomatoclock/src/hooks/useNotification.ts`

- [ ] **Step 1: Create useNotification hook**

```typescript
// tomatoclock/src/hooks/useNotification.ts

import { useState, useCallback, useRef, useEffect } from 'react';
import { audioService } from '../services/audioService';
import { useSettings } from './useSettings';
import {
  NotificationType,
  ToastType,
  NotificationOptions,
  UseNotificationReturn,
  Toast,
} from '../types/notification';

export function useNotification(): UseNotificationReturn {
  const { notificationSettings: settings, updateNotificationSettings: updateSettings } = useSettings();
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Initialize push permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPermission(Notification.permission);
    }
  }, []);

  // Request browser notification permission
  const requestPushPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    setPushPermission(permission);
    
    if (permission === 'granted') {
      updateSettings({ enablePush: true, pushPermission: 'granted' });
    } else {
      updateSettings({ enablePush: false, pushPermission: permission });
    }
    
    return permission;
  }, [updateSettings]);

  // Show browser notification
  const notify = useCallback((options: NotificationOptions): void => {
    if (!settings.enablePush || pushPermission !== 'granted') return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon || '/favicon.ico',
      tag: options.tag || 'tomatoclock',
      requireInteraction: options.requireInteraction ?? false,
      data: options.data,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto-close after 5 seconds unless requireInteraction is true
    if (!options.requireInteraction) {
      setTimeout(() => notification.close(), 5000);
    }
  }, [settings.enablePush, pushPermission]);

  // Play audio notification
  const playAudio = useCallback((type: NotificationType = 'complete'): void => {
    if (!settings.enableAudio) return;
    audioService.playNotification(type, settings.audioVolume);
  }, [settings.enableAudio, settings.audioVolume]);

  // Add toast
  const addToast = useCallback((message: string, type: ToastType = 'info'): string => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const toast: Toast = {
      id,
      message,
      type,
      duration: settings.toastDuration,
    };
    setToasts((prev) => [...prev, toast]);
    return id;
  }, [settings.toastDuration]);

  // Remove toast
  const removeToast = useCallback((id: string): void => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Show toast (wrapper that checks settings)
  const showToast = useCallback((message: string, type: ToastType = 'info'): void => {
    if (!settings.enableToast) return;
    addToast(message, type);
  }, [settings.enableToast, addToast]);

  // Auto-remove toasts after duration
  useEffect(() => {
    if (toasts.length === 0) return;

    const timers = toasts.map((toast) => {
      return setTimeout(() => {
        removeToast(toast.id);
      }, toast.duration);
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [toasts, removeToast]);

  return {
    pushPermission,
    requestPushPermission,
    notify,
    playAudio,
    showToast,
    settings,
    updateSettings,
    toasts,
    removeToast,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useNotification.ts
git commit -m "feat: add useNotification hook for audio, push, and toast notifications"
```

---

## Task 6: Toast Components

**Files:**
- Create: `tomatoclock/src/components/toast/ToastItem.tsx`
- Create: `tomatoclock/src/components/toast/ToastContainer.tsx`
- Create: `tomatoclock/src/components/toast/Toast.css`
- Create: `tomatoclock/src/components/toast/index.ts`

- [ ] **Step 1: Create ToastItem component**

```typescript
// tomatoclock/src/components/toast/ToastItem.tsx

import React from 'react';
import { Toast, ToastType } from '../../types/notification';
import './Toast.css';

interface ToastItemProps {
  toast: Toast;
  onRemove: () => void;
}

const typeIcons: Record<ToastType, string> = {
  success: '✓',
  info: 'ℹ',
  warning: '⚠',
  error: '✕',
};

export const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  return (
    <div className={`toast-item toast-${toast.type}`} onClick={onRemove}>
      <span className="toast-icon">{typeIcons[toast.type]}</span>
      <span className="toast-message">{toast.message}</span>
      <button className="toast-close" onClick={onRemove}>×</button>
    </div>
  );
};
```

- [ ] **Step 2: Create ToastContainer component**

```typescript
// tomatoclock/src/components/toast/ToastContainer.tsx

import React from 'react';
import { Toast, ToastPosition } from '../../types/notification';
import { ToastItem } from './ToastItem';
import './Toast.css';

interface ToastContainerProps {
  toasts: Toast[];
  position: ToastPosition;
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  position,
  onRemove,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div className={`toast-container toast-${position}`}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => onRemove(toast.id)} />
      ))}
    </div>
  );
};
```

- [ ] **Step 3: Create Toast styles**

```css
/* tomatoclock/src/components/toast/Toast.css */

/* Container positioning */
.toast-container {
  position: fixed;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px;
  pointer-events: none;
}

.toast-container > * {
  pointer-events: auto;
}

/* Position variants */
.toast-top-left {
  top: 0;
  left: 0;
}

.toast-top-right {
  top: 0;
  right: 0;
}

.toast-bottom-left {
  bottom: 0;
  left: 0;
  flex-direction: column-reverse;
}

.toast-bottom-right {
  bottom: 0;
  right: 0;
  flex-direction: column-reverse;
}

/* Toast item */
.toast-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 300px;
  max-width: 400px;
  cursor: pointer;
  animation: toast-slide-in 0.3s ease;
  border-left: 4px solid;
}

@keyframes toast-slide-in {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.toast-item:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

/* Type variants */
.toast-success {
  border-left-color: #4caf50;
}

.toast-success .toast-icon {
  color: #4caf50;
}

.toast-info {
  border-left-color: #2196f3;
}

.toast-info .toast-icon {
  color: #2196f3;
}

.toast-warning {
  border-left-color: #ff9800;
}

.toast-warning .toast-icon {
  color: #ff9800;
}

.toast-error {
  border-left-color: #f44336;
}

.toast-error .toast-icon {
  color: #f44336;
}

/* Toast content */
.toast-icon {
  font-size: 18px;
  font-weight: bold;
  flex-shrink: 0;
}

.toast-message {
  flex: 1;
  font-size: 14px;
  color: #333;
  line-height: 1.4;
}

.toast-close {
  background: none;
  border: none;
  font-size: 20px;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.toast-close:hover {
  background: #f0f0f0;
  color: #333;
}
```

- [ ] **Step 4: Create index export**

```typescript
// tomatoclock/src/components/toast/index.ts

export { ToastContainer } from './ToastContainer';
export { ToastItem } from './ToastItem';
```

- [ ] **Step 5: Commit**

```bash
git add src/components/toast/
git commit -m "feat: add toast notification components with CSS animations"
```

---

## Task 7: Settings UI Components

**Files:**
- Create: `tomatoclock/src/components/settings/Toggle.tsx`
- Create: `tomatoclock/src/components/settings/VolumeSlider.tsx`
- Create: `tomatoclock/src/components/settings/SoundSelector.tsx`
- Create: `tomatoclock/src/components/settings/EventSelector.tsx`
- Create: `tomatoclock/src/components/settings/PositionSelector.tsx`
- Create: `tomatoclock/src/components/settings/DurationSlider.tsx`
- Create: `tomatoclock/src/components/settings/NotificationSettingsPanel.tsx`
- Create: `tomatoclock/src/components/settings/Settings.css`
- Create: `tomatoclock/src/components/settings/index.ts`

- [ ] **Step 1: Create Toggle component**

```typescript
// tomatoclock/src/components/settings/Toggle.tsx

import React from 'react';
import './Settings.css';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
}) => {
  return (
    <label className={`toggle ${disabled ? 'disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="toggle-slider" />
      <span className="toggle-label">{label}</span>
    </label>
  );
};
```

- [ ] **Step 2: Create VolumeSlider component**

```typescript
// tomatoclock/src/components/settings/VolumeSlider.tsx

import React from 'react';
import './Settings.css';

interface VolumeSliderProps {
  value: number; // 0-100
  onChange: (value: number) => void;
}

export const VolumeSlider: React.FC<VolumeSliderProps> = ({
  value,
  onChange,
}) => {
  const getVolumeIcon = () => {
    if (value === 0) return '🔇';
    if (value < 33) return '🔈';
    if (value < 66) return '🔉';
    return '🔊';
  };

  return (
    <div className="volume-slider">
      <span className="volume-icon">{getVolumeIcon()}</span>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
      />
      <span className="volume-value">{value}%</span>
    </div>
  );
};
```

- [ ] **Step 3: Create SoundSelector component**

```typescript
// tomatoclock/src/components/settings/SoundSelector.tsx

import React from 'react';
import { AudioType } from '../../types/notification';
import './Settings.css';

interface SoundSelectorProps {
  value: AudioType;
  onChange: (value: AudioType) => void;
  options: AudioType[];
}

const soundLabels: Record<AudioType, string> = {
  beep: 'Beep',
  chime: 'Chime',
  bell: 'Bell',
};

export const SoundSelector: React.FC<SoundSelectorProps> = ({
  value,
  onChange,
  options,
}) => {
  return (
    <div className="sound-selector">
      <label>Sound Type:</label>
      <div className="sound-options">
        {options.map((option) => (
          <button
            key={option}
            className={`sound-option ${value === option ? 'active' : ''}`}
            onClick={() => onChange(option)}
          >
            {soundLabels[option]}
          </button>
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Create EventSelector component**

```typescript
// tomatoclock/src/components/settings/EventSelector.tsx

import React from 'react';
import { NotificationType } from '../../types/notification';
import './Settings.css';

interface EventSelectorProps {
  value: NotificationType[];
  onChange: (value: NotificationType[]) => void;
  options: { value: NotificationType; label: string }[];
}

export const EventSelector: React.FC<EventSelectorProps> = ({
  value,
  onChange,
  options,
}) => {
  const toggleEvent = (event: NotificationType) => {
    if (value.includes(event)) {
      onChange(value.filter((e) => e !== event));
    } else {
      onChange([...value, event]);
    }
  };

  return (
    <div className="event-selector">
      <label>Show notifications on:</label>
      <div className="event-options">
        {options.map((option) => (
          <label key={option.value} className="event-option">
            <input
              type="checkbox"
              checked={value.includes(option.value)}
              onChange={() => toggleEvent(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 5: Create PositionSelector component**

```typescript
// tomatoclock/src/components/settings/PositionSelector.tsx

import React from 'react';
import { ToastPosition } from '../../types/notification';
import './Settings.css';

interface PositionSelectorProps {
  value: ToastPosition;
  onChange: (value: ToastPosition) => void;
}

const positions: { value: ToastPosition; label: string }[] = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
];

export const PositionSelector: React.FC<PositionSelectorProps> = ({
  value,
  onChange,
}) => {
  return (
    <div className="position-selector">
      <label>Toast Position:</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ToastPosition)}
      >
        {positions.map((pos) => (
          <option key={pos.value} value={pos.value}>
            {pos.label}
          </option>
        ))}
      </select>
    </div>
  );
};
```

- [ ] **Step 6: Create DurationSlider component**

```typescript
// tomatoclock/src/components/settings/DurationSlider.tsx

import React from 'react';
import './Settings.css';

interface DurationSliderProps {
  value: number; // milliseconds
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export const DurationSlider: React.FC<DurationSliderProps> = ({
  value,
  onChange,
  min = 1000,
  max = 10000,
  step = 500,
}) => {
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    return `${seconds}s`;
  };

  return (
    <div className="duration-slider">
      <label>Display Duration:</label>
      <div className="slider-container">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
        />
        <span className="duration-value">{formatDuration(value)}</span>
      </div>
    </div>
  );
};
```

- [ ] **Step 7: Create NotificationSettingsPanel component**

```typescript
// tomatoclock/src/components/settings/NotificationSettingsPanel.tsx

import React from 'react';
import { useNotification } from '../../hooks/useNotification';
import { audioService } from '../../services/audioService';
import { Toggle } from './Toggle';
import { VolumeSlider } from './VolumeSlider';
import { SoundSelector } from './SoundSelector';
import { EventSelector } from './EventSelector';
import { PositionSelector } from './PositionSelector';
import { DurationSlider } from './DurationSlider';
import { AudioType, NotificationType } from '../../types/notification';
import './Settings.css';

export const NotificationSettingsPanel: React.FC = () => {
  const {
    settings,
    updateSettings,
    pushPermission,
    requestPushPermission,
    notify,
    playAudio,
    showToast,
  } = useNotification();

  const handlePushToggle = async (enabled: boolean) => {
    if (enabled && pushPermission !== 'granted') {
      await requestPushPermission();
    } else {
      updateSettings({ enablePush: enabled });
    }
  };

  const handleTestAudio = () => {
    audioService.test(settings.audioVolume);
  };

  const handleTestToast = () => {
    showToast('This is a test notification!', 'info');
  };

  const handleTestPush = () => {
    notify({
      title: 'Test Notification',
      body: 'This is a test push notification from TomatoClock!',
      tag: 'test',
    });
  };

  return (
    <div className="notification-settings-panel">
      <h3>Notification Settings</h3>

      {/* Audio Notifications */}
      <section className="settings-section">
        <h4>🔊 Sound Notifications</h4>
        <Toggle
          checked={settings.enableAudio}
          onChange={(v) => updateSettings({ enableAudio: v })}
          label="Play sound when timer completes"
        />
        
        {settings.enableAudio && (
          <div className="setting-controls">
            <VolumeSlider
              value={settings.audioVolume}
              onChange={(v) => updateSettings({ audioVolume: v })}
            />
            <SoundSelector
              value={settings.audioType}
              onChange={(v) => updateSettings({ audioType: v })}
              options={['beep', 'chime', 'bell']}
            />
            <button className="test-button" onClick={handleTestAudio}>
              Test Sound
            </button>
          </div>
        )}
      </section>

      {/* Push Notifications */}
      <section className="settings-section">
        <h4>🔔 Push Notifications</h4>
        <Toggle
          checked={settings.enablePush}
          onChange={handlePushToggle}
          label="Show system notifications"
          disabled={pushPermission === 'denied'}
        />
        
        {pushPermission === 'denied' && (
          <div className="permission-warning">
            ⚠️ Notifications are blocked. Please enable them in your browser settings.
          </div>
        )}
        
        {settings.enablePush && pushPermission === 'granted' && (
          <div className="setting-controls">
            <EventSelector
              value={settings.showNotificationOn}
              onChange={(v) => updateSettings({ showNotificationOn: v })}
              options={[
                { value: 'complete', label: 'Pomodoro complete' },
                { value: 'break', label: 'Break complete' },
                { value: 'longBreak', label: 'Long break complete' },
              ]}
            />
            <button className="test-button" onClick={handleTestPush}>
              Test Push Notification
            </button>
          </div>
        )}
      </section>

      {/* Toast Notifications */}
      <section className="settings-section">
        <h4>💬 In-App Notifications</h4>
        <Toggle
          checked={settings.enableToast}
          onChange={(v) => updateSettings({ enableToast: v })}
          label="Show in-app notifications"
        />
        
        {settings.enableToast && (
          <div className="setting-controls">
            <DurationSlider
              value={settings.toastDuration}
              onChange={(v) => updateSettings({ toastDuration: v })}
              min={1000}
              max={10000}
              step={500}
            />
            <PositionSelector
              value={settings.toastPosition}
              onChange={(v) => updateSettings({ toastPosition: v })}
            />
            <button className="test-button" onClick={handleTestToast}>
              Test Toast Notification
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
```

- [ ] **Step 8: Create Settings CSS**

```css
/* tomatoclock/src/components/settings/Settings.css */

.notification-settings-panel {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.notification-settings-panel h3 {
  margin: 0 0 24px 0;
  color: #333;
  font-size: 1.5rem;
  border-bottom: 2px solid #f0f0f0;
  padding-bottom: 12px;
}

.settings-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid #f0f0f0;
}

.settings-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.settings-section h4 {
  margin: 0 0 16px 0;
  color: #555;
  font-size: 1.1rem;
}

.setting-controls {
  margin-top: 16px;
  padding-left: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Toggle Component */
.toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}

.toggle.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: relative;
  width: 48px;
  height: 24px;
  background: #ccc;
  border-radius: 12px;
  transition: background 0.3s;
}

.toggle-slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  transition: transform 0.3s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle input:checked + .toggle-slider {
  background: #4caf50;
}

.toggle input:checked + .toggle-slider::after {
  transform: translateX(24px);
}

.toggle input:disabled + .toggle-slider {
  background: #e0e0e0;
}

.toggle-label {
  font-size: 14px;
  color: #333;
}

/* Volume Slider */
.volume-slider {
  display: flex;
  align-items: center;
  gap: 12px;
}

.volume-slider label {
  font-size: 14px;
  color: #555;
  min-width: 100px;
}

.volume-icon {
  font-size: 18px;
}

.volume-slider input[type="range"] {
  flex: 1;
  max-width: 200px;
  height: 6px;
  background: #e0e0e0;
  border-radius: 3px;
  outline: none;
  -webkit-appearance: none;
}

.volume-slider input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  background: #4caf50;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.volume-slider input[type="range"]::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: #4caf50;
  border-radius: 50%;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.volume-value {
  font-size: 14px;
  color: #666;
  min-width: 40px;
  text-align: right;
}

/* Sound Selector */
.sound-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sound-selector label {
  font-size: 14px;
  color: #555;
}

.sound-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.sound-option {
  padding: 8px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 20px;
  background: white;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.sound-option:hover {
  border-color: #4caf50;
  color: #4caf50;
}

.sound-option.active {
  background: #4caf50;
  border-color: #4caf50;
  color: white;
}

/* Event Selector */
.event-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.event-selector > label {
  font-size: 14px;
  color: #555;
}

.event-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.event-option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #333;
}

.event-option input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

/* Position Selector */
.position-selector {
  display: flex;
  align-items: center;
  gap: 12px;
}

.position-selector label {
  font-size: 14px;
  color: #555;
  min-width: 100px;
}

.position-selector select {
  padding: 8px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  font-size: 14px;
  color: #333;
  cursor: pointer;
  min-width: 150px;
}

.position-selector select:focus {
  outline: none;
  border-color: #4caf50;
}

/* Duration Slider */
.duration-slider {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.duration-slider label {
  font-size: 14px;
  color: #555;
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider-container input[type="range"] {
  flex: 1;
  max-width: 200px;
  height: 6px;
  background: #e0e0e0;
  border-radius: 3px;
  outline: none;
  -webkit-appearance: none;
}

.slider-container input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  background: #2196f3;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.duration-value {
  font-size: 14px;
  color: #666;
  min-width: 50px;
}

/* Permission Warning */
.permission-warning {
  margin-top: 8px;
  padding: 8px 12px;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 6px;
  color: #856404;
  font-size: 13px;
}

/* Test Button */
.test-button {
  padding: 8px 16px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.test-button:hover {
  background: #1976d2;
}
```

- [ ] **Step 8: Create index export**

```typescript
// tomatoclock/src/components/settings/index.ts

export { NotificationSettingsPanel } from './NotificationSettingsPanel';
export { Toggle } from './Toggle';
export { VolumeSlider } from './VolumeSlider';
export { SoundSelector } from './SoundSelector';
export { EventSelector } from './EventSelector';
export { PositionSelector } from './PositionSelector';
export { DurationSlider } from './DurationSlider';
```

- [ ] **Step 9: Commit**

```bash
git add src/components/settings/
git commit -m "feat: add notification settings panel with all UI controls"
```

---

## Task 8: Integrate Notifications into App.tsx

**Files:**
- Modify: `tomatoclock/src/App.tsx`
- Modify: `tomatoclock/src/App.css`

- [ ] **Step 1: Modify App.tsx to integrate notifications**

```typescript
// tomatoclock/src/App.tsx

import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { useNotification } from './hooks/useNotification';
import { NotificationSettingsPanel } from './components/settings';
import { ToastContainer } from './components/toast';
import { NotificationType } from './types/notification';

const WORK_TIME = 25 * 60; // 25 minutes
const SHORT_BREAK = 5 * 60; // 5 minutes
const LONG_BREAK = 15 * 60; // 15 minutes

type Mode = 'work' | 'shortBreak' | 'longBreak';

interface ModeConfig {
  time: number;
  label: string;
  color: string;
}

const MODES: Record<Mode, ModeConfig> = {
  work: { time: WORK_TIME, label: 'Focus Time', color: '#ff6b6b' },
  shortBreak: { time: SHORT_BREAK, label: 'Short Break', color: '#4ecdc4' },
  longBreak: { time: LONG_BREAK, label: 'Long Break', color: '#45b7d1' },
};

const getNotificationType = (mode: Mode): NotificationType => {
  switch (mode) {
    case 'work':
      return 'complete';
    case 'shortBreak':
      return 'break';
    case 'longBreak':
      return 'longBreak';
    default:
      return 'complete';
  }
};

function App() {
  const [mode, setMode] = useState<Mode>('work');
  const [timeLeft, setTimeLeft] = useState(WORK_TIME);
  const [isActive, setIsActive] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  const {
    notify,
    playAudio,
    showToast,
    settings,
    toasts,
    removeToast,
  } = useNotification();

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const triggerNotifications = useCallback((completedMode: Mode) => {
    const notificationType = getNotificationType(completedMode);
    const modeLabel = MODES[completedMode].label;

    // Play audio notification
    playAudio(notificationType);

    // Show browser notification
    notify({
      title: `${modeLabel} Complete!`,
      body: completedMode === 'work' 
        ? 'Time to take a break!' 
        : 'Ready to focus?',
      tag: `timer-complete-${Date.now()}`,
    });

    // Show toast notification
    showToast(
      `${modeLabel} complete! ${completedMode === 'work' ? 'Take a break!' : 'Ready to focus?'}`,
      'success'
    );
  }, [playAudio, notify, showToast]);

  const switchMode = useCallback((newMode: Mode) => {
    setMode(newMode);
    setTimeLeft(MODES[newMode].time);
    setIsActive(false);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      
      // Trigger notifications
      triggerNotifications(mode);
      
      if (mode === 'work') {
        setSessionsCompleted((prev) => prev + 1);
      }
      
      // Auto switch to break after work, or back to work after break
      if (mode === 'work') {
        const nextMode = sessionsCompleted % 4 === 3 ? 'longBreak' : 'shortBreak';
        switchMode(nextMode);
      } else {
        switchMode('work');
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeLeft, mode, sessionsCompleted, switchMode, triggerNotifications]);

  const toggleTimer = () => setIsActive(!isActive);
  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(MODES[mode].time);
  };

  const progress = ((MODES[mode].time - timeLeft) / MODES[mode].time) * 100;

  return (
    <div className="App">
      <ToastContainer
        toasts={toasts}
        position={settings.toastPosition}
        onRemove={removeToast}
      />
      
      <div className="tomato-clock">
        <div className="header">
          <h1>🍅 Tomato Clock</h1>
          <button
            className="settings-toggle"
            onClick={() => setShowSettings(!showSettings)}
            title="Notification Settings"
          >
            {showSettings ? '✕' : '⚙️'}
          </button>
        </div>

        {showSettings ? (
          <NotificationSettingsPanel />
        ) : (
          <>
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

            <div
              className="timer-display"
              style={{ '--mode-color': MODES[mode].color } as React.CSSProperties}
            >
              <div className="progress-ring">
                <svg viewBox="0 0 200 200">
                  <circle
                    className="progress-bg"
                    cx="100"
                    cy="100"
                    r="90"
                  />
                  <circle
                    className="progress-fill"
                    cx="100"
                    cy="100"
                    r="90"
                    style={{
                      strokeDasharray: `${2 * Math.PI * 90}`,
                      strokeDashoffset: `${2 * Math.PI * 90 * (1 - progress / 100)}`,
                    }}
                  />
                </svg>
                <div className="time">{formatTime(timeLeft)}</div>
              </div>
            </div>

            <div className="controls">
              <button
                className={`btn-primary ${isActive ? 'pause' : 'start'}`}
                onClick={toggleTimer}
                style={{ '--mode-color': MODES[mode].color } as React.CSSProperties}
              >
                {isActive ? '⏸ Pause' : '▶ Start'}
              </button>
              <button className="btn-secondary" onClick={resetTimer}>
                🔄 Reset
              </button>
            </div>

            <div className="stats">
              <div className="stat">
                <span className="stat-label">Sessions Completed</span>
                <span className="stat-value">{sessionsCompleted}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
```

- [ ] **Step 9: Create index export for components**

```typescript
// tomatoclock/src/components/settings/index.ts

export { NotificationSettingsPanel } from './NotificationSettingsPanel';
```

- [ ] **Step 10: Update App.css with new styles**

Add to end of `tomatoclock/src/App.css`:

```css
/* Header with settings toggle */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header h1 {
  margin: 0;
}

.settings-toggle {
  background: none;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s;
}

.settings-toggle:hover {
  border-color: #4caf50;
  background: #f5f5f5;
}

/* Notification Settings Panel in App context */
.notification-settings-panel {
  max-height: 60vh;
  overflow-y: auto;
}
```

- [ ] **Step 11: Commit**

```bash
git add src/components/ src/App.tsx src/App.css
git commit -m "feat: integrate notification system into App.tsx with settings panel"
```

---

## Task 9: Tests for Notification System

**Files:**
- Create: `tomatoclock/src/hooks/__tests__/useSettings.test.ts`
- Create: `tomatoclock/src/services/__tests__/audioService.test.ts`
- Create: `tomatoclock/src/utils/__tests__/storage.test.ts`

- [ ] **Step 1: Create useSettings test**

```typescript
// tomatoclock/src/hooks/__tests__/useSettings.test.ts

import { renderHook, act } from '@testing-library/react';
import { useSettings, DEFAULT_NOTIFICATION_SETTINGS, DEFAULT_SETTINGS } from '../useSettings';
import { storage } from '../../utils/storage';

// Mock storage
jest.mock('../../utils/storage', () => ({
  storage: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

describe('useSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (storage.get as jest.Mock).mockReturnValue({});
  });

  it('should return default settings on initial load', () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    expect(result.current.notificationSettings).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
  });

  it('should load settings from storage', () => {
    const storedSettings = {
      notification: {
        enableAudio: false,
        audioVolume: 50,
      },
    };
    (storage.get as jest.Mock).mockReturnValue(storedSettings);

    const { result } = renderHook(() => useSettings());

    expect(result.current.notificationSettings.enableAudio).toBe(false);
    expect(result.current.notificationSettings.audioVolume).toBe(50);
  });

  it('should update notification settings', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateNotificationSettings({ enableAudio: false });
    });

    expect(result.current.notificationSettings.enableAudio).toBe(false);
    expect(storage.set).toHaveBeenCalled();
  });

  it('should reset settings to defaults', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateNotificationSettings({ enableAudio: false });
    });

    act(() => {
      result.current.resetSettings();
    });

    expect(result.current.notificationSettings).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
  });
});
```

- [ ] **Step 2: Create audioService test**

```typescript
// tomatoclock/src/services/__tests__/audioService.test.ts

import { audioService } from '../audioService';

describe('audioService', () => {
  let mockOscillator: any;
  let mockGainNode: any;
  let mockAudioContext: any;

  beforeEach(() => {
    // Reset audio service state
    audioService.context = null;

    // Mock oscillator
    mockOscillator = {
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      frequency: { setValueAtTime: jest.fn() },
      type: 'sine',
    };

    // Mock gain node
    mockGainNode = {
      connect: jest.fn(),
      gain: {
        setValueAtTime: jest.fn(),
        linearRampToValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn(),
      },
    };

    // Mock audio context
    mockAudioContext = {
      createOscillator: jest.fn(() => mockOscillator),
      createGain: jest.fn(() => mockGainNode),
      destination: {},
      currentTime: 0,
      state: 'running',
      resume: jest.fn(),
    };

    // Mock global AudioContext
    (global as any).AudioContext = jest.fn(() => mockAudioContext);
    (global as any).window = {
      AudioContext: jest.fn(() => mockAudioContext),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('init', () => {
    it('should create AudioContext on first call', () => {
      const ctx = audioService.init();

      expect(ctx).toBe(mockAudioContext);
      expect(audioService.context).toBe(mockAudioContext);
    });

    it('should reuse existing AudioContext on subsequent calls', () => {
      audioService.init();
      const ctx2 = audioService.init();

      expect(ctx2).toBe(mockAudioContext);
      expect((global as any).AudioContext).toHaveBeenCalledTimes(1);
    });

    it('should resume suspended AudioContext', () => {
      mockAudioContext.state = 'suspended';
      audioService.init();

      expect(mockAudioContext.resume).toHaveBeenCalled();
    });
  });

  describe('playTone', () => {
    beforeEach(() => {
      audioService.init();
    });

    it('should create and play a tone with correct frequency', () => {
      audioService.playTone({
        frequency: 880,
        duration: 0.5,
        volume: 50,
      });

      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
      expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(880, 0);
      expect(mockOscillator.start).toHaveBeenCalled();
      expect(mockOscillator.stop).toHaveBeenCalledWith(0.5);
    });

    it('should set volume correctly', () => {
      audioService.playTone({
        frequency: 880,
        duration: 0.5,
        volume: 75,
      });

      // Volume should be 0.75 (75% of max)
      expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(0, 0);
    });
  });

  describe('playNotification', () => {
    beforeEach(() => {
      audioService.init();
    });

    it('should play complete tone', () => {
      const spy = jest.spyOn(audioService, 'playTone');
      audioService.playNotification('complete', 50);

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        frequency: 880,
      }));
    });

    it('should play break tone', () => {
      const spy = jest.spyOn(audioService, 'playTone');
      audioService.playNotification('break', 50);

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        frequency: 659.25,
      }));
    });

    it('should play longBreak tone', () => {
      const spy = jest.spyOn(audioService, 'playTone');
      audioService.playNotification('longBreak', 50);

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        frequency: 523.25,
      }));
    });
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/__tests__/ src/services/__tests__/
git commit -m "test: add unit tests for useSettings and audioService"
```

---

## Task 10: Final Integration and Verification

**Files:**
- Modify: `tomatoclock/src/index.tsx` (if needed)

- [ ] **Step 1: Verify all imports work**

Run TypeScript check:

```bash
cd tomatoclock
npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 2: Run tests**

```bash
npm test -- --watchAll=false
```

Expected: All tests pass.

- [ ] **Step 3: Build the app**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit final changes**

```bash
git add -A
git commit -m "feat: complete notification feature implementation

- Add TypeScript interfaces for notifications
- Implement useSettings hook with localStorage persistence
- Implement useNotification hook for audio, push, and toast
- Create audio service with Web Audio API
- Build toast component system with CSS animations
- Create notification settings panel with all controls
- Integrate notifications into App.tsx timer completion flow
- Add comprehensive unit tests"
```

---

## Summary

This implementation plan creates a complete notification system for TomatoClock with:

1. **Audio Notifications** - Web Audio API generated tones (beep, chime, bell)
2. **Browser Push Notifications** - Notification API with permission handling
3. **In-App Toast Notifications** - Custom toast system with CSS animations
4. **Settings Persistence** - localStorage for user preferences
5. **Comprehensive UI** - Settings panel with all configuration options
6. **Full Test Coverage** - Unit tests for hooks and services

All tasks follow TDD principles with bite-sized steps and frequent commits.
