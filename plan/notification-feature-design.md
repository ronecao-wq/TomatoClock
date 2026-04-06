# TomatoClock Notification Feature Design Plan

## 1. Overview

### Purpose
Add a comprehensive notification system to TomatoClock that alerts users when timer sessions complete, improving user experience and productivity.

### Scope
- Browser push notifications (Notification API)
- Audio notifications (Web Audio API with extensible architecture)
- In-app toast notifications
- Configuration panel for user preferences
- Permission management for browser notifications

### Out of Scope
- Mobile push notifications (requires service worker and PWA setup)
- Email notifications
- SMS notifications
- Custom sound file uploads (Phase 2)

---

## 2. Architecture

### 2.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         TomatoClock App                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐ │
│  │   Timer Hook    │───▶│ Notification Hook│    │  UI Toast   │ │
│  │   (useTimer)    │    │ (useNotification)│◀──▶│  Component  │ │
│  └─────────────────┘    └──────────────────┘    └─────────────┘ │
│            │                     │                             │
│            ▼                     ▼                             │
│  ┌─────────────────┐    ┌──────────────────┐                   │
│  │  Audio Service  │    │ Browser Push API │                   │
│  │ (Web Audio API) │    │ (Notification)   │                   │
│  └─────────────────┘    └──────────────────┘                   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Settings Context (useSettings)               │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │  │
│  │  │ enableAudio  │  │ enablePush   │  │ enableToast  │  │  │
│  │  │ audioVolume  │  │ askPermission│  │ toastDuration│  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
Timer Completion Flow:
─────────────────────
1. Timer reaches 00:00
   │
2. useTimer hook triggers onComplete callback
   │
3. useNotification hook receives completion event
   │
4. Check user settings:
   ├─ If enableAudio: playAudioNotification()
   ├─ If enablePush:  showBrowserNotification()
   └─ If enableToast: showToastNotification()
   │
5. All notifications trigger in parallel (non-blocking)
```

---

## 3. Component Design

### 3.1 useNotification Hook

**Purpose:** Central hook for managing all notification types

**Interface:**
```typescript
interface UseNotificationReturn {
  // Permission state
  pushPermission: NotificationPermission;
  requestPushPermission: () => Promise<NotificationPermission>;
  
  // Notification methods
  notify: (options: NotificationOptions) => void;
  playAudio: (type?: 'complete' | 'break' | 'longBreak') => void;
  showToast: (message: string, type?: ToastType) => void;
  
  // Settings
  settings: NotificationSettings;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
}

interface NotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
  data?: Record<string, unknown>;
}

type ToastType = 'success' | 'info' | 'warning' | 'error';

interface NotificationSettings {
  enableAudio: boolean;
  audioVolume: number;
  enablePush: boolean;
  enableToast: boolean;
  toastDuration: number;
  toastPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}
```

**Implementation Details:**
```typescript
export function useNotification(): UseNotificationReturn {
  const { settings, updateSettings } = useSettings();
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window 
      ? Notification.permission 
      : 'default'
  );

  // Audio context ref for Web Audio API
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize AudioContext on user interaction
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, []);

  // Play notification sound using Web Audio API
  const playAudio = useCallback((type: 'complete' | 'break' | 'longBreak' = 'complete') => {
    if (!settings.enableAudio) return;

    initAudioContext();
    const ctx = audioContextRef.current;
    if (!ctx) return;

    // Create oscillator for tone
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Different tones for different notification types
    const frequencies = {
      complete: 880,    // A5
      break: 659.25,  // E5
      longBreak: 523.25, // C5
    };

    oscillator.frequency.setValueAtTime(frequencies[type], ctx.currentTime);
    oscillator.type = 'sine';

    // Envelope for pleasant sound
    const volume = settings.audioVolume / 100;
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(volume * 0.3, ctx.currentTime + 0.3);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.6);
  }, [settings.enableAudio, settings.audioVolume, initAudioContext]);

  // Request browser notification permission
  const requestPushPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      return 'denied' as NotificationPermission;
    }
    
    const permission = await Notification.requestPermission();
    setPushPermission(permission);
    return permission;
  }, []);

  // Show browser notification
  const notify = useCallback((options: NotificationOptions) => {
    if (!settings.enablePush || pushPermission !== 'granted') return;

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
  }, [settings.enablePush, pushPermission]);

  // Toast notification state and methods would go here
  // (implementation using React state or context)
  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    if (!settings.enableToast) return;
    // Toast implementation
    console.log(`[${type}] ${message}`);
  }, [settings.enableToast]);

  return {
    pushPermission,
    requestPushPermission,
    notify,
    playAudio,
    showToast,
    settings,
    updateSettings: (newSettings: Partial<NotificationSettings>) => {
      updateSettings({ notification: newSettings });
    },
  };
}
```

---

## 4. Configuration & Storage Strategy

### 4.1 Notification Settings Schema

```typescript
// Extended from existing Settings type
interface Settings {
  // ... existing settings
  notification: NotificationSettings;
}

interface NotificationSettings {
  // Audio notifications
  enableAudio: boolean;
  audioVolume: number; // 0-100
  audioType: 'beep' | 'chime' | 'bell' | 'custom';
  
  // Browser push notifications
  enablePush: boolean;
  pushPermission: NotificationPermission;
  showNotificationOn: ('complete' | 'break' | 'longBreak')[];
  
  // In-app toast notifications
  enableToast: boolean;
  toastDuration: number; // milliseconds
  toastPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  toastType: 'minimal' | 'detailed';
}
```

### 4.2 Storage Strategy

```typescript
// Storage keys
const STORAGE_KEYS = {
  SETTINGS: 'tomatoclock_settings',
};

// Storage service extension
export const storageService = {
  // ... existing methods
  
  getSettings(): Settings {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!data) return getDefaultSettings();
    
    try {
      return { ...getDefaultSettings(), ...JSON.parse(data) };
    } catch {
      return getDefaultSettings();
    }
  },
  
  saveSettings(settings: Settings): void {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },
};

// Default settings factory
function getDefaultSettings(): Settings {
  return {
    // ... other defaults
    notification: {
      enableAudio: true,
      audioVolume: 70,
      audioType: 'chime',
      
      enablePush: false, // User must opt-in
      pushPermission: 'default',
      showNotificationOn: ['complete', 'break', 'longBreak'],
      
      enableToast: true,
      toastDuration: 5000,
      toastPosition: 'top-right',
      toastType: 'detailed',
    },
  };
}
```

---

## 5. UI Components

### 5.1 NotificationSettingsPanel Component

```typescript
interface NotificationSettingsPanelProps {
  settings: NotificationSettings;
  onSettingsChange: (settings: Partial<NotificationSettings>) => void;
}

export const NotificationSettingsPanel: React.FC<NotificationSettingsPanelProps> = ({
  settings,
  onSettingsChange,
}) => {
  const { requestPushPermission, pushPermission } = useNotification();
  
  const handlePushToggle = async (enabled: boolean) => {
    if (enabled && pushPermission !== 'granted') {
      const permission = await requestPushPermission();
      onSettingsChange({ enablePush: permission === 'granted' });
    } else {
      onSettingsChange({ enablePush: enabled });
    }
  };
  
  return (
    <div className="notification-settings">
      <h3>Notifications</h3>
      
      {/* Audio Notifications */}
      <section className="setting-group">
        <h4>Sound</h4>
        <Toggle
          checked={settings.enableAudio}
          onChange={(v) => onSettingsChange({ enableAudio: v })}
          label="Play sound when timer completes"
        />
        {settings.enableAudio && (
          <>
            <VolumeSlider
              value={settings.audioVolume}
              onChange={(v) => onSettingsChange({ audioVolume: v })}
            />
            <SoundSelector
              value={settings.audioType}
              onChange={(v) => onSettingsChange({ audioType: v })}
              options={['beep', 'chime', 'bell']}
            />
            <TestSoundButton />
          </>
        )}
      </section>
      
      {/* Push Notifications */}
      <section className="setting-group">
        <h4>Push Notifications</h4>
        <Toggle
          checked={settings.enablePush}
          onChange={handlePushToggle}
          label="Show system notifications"
        />
        {pushPermission === 'denied' && (
          <Alert type="warning">
            Notifications are blocked. Please enable them in your browser settings.
          </Alert>
        )}
        {settings.enablePush && (
          <EventSelector
            value={settings.showNotificationOn}
            onChange={(v) => onSettingsChange({ showNotificationOn: v })}
            options={[
              { value: 'complete', label: 'Pomodoro complete' },
              { value: 'break', label: 'Break complete' },
              { value: 'longBreak', label: 'Long break complete' },
            ]}
          />
        )}
      </section>
      
      {/* Toast Notifications */}
      <section className="setting-group">
        <h4>In-App Notifications</h4>
        <Toggle
          checked={settings.enableToast}
          onChange={(v) => onSettingsChange({ enableToast: v })}
          label="Show in-app notifications"
        />
        {settings.enableToast && (
          <>
            <DurationSlider
              value={settings.toastDuration}
              onChange={(v) => onSettingsChange({ toastDuration: v })}
              min={1000}
              max={10000}
              step={500}
            />
            <PositionSelector
              value={settings.toastPosition}
              onChange={(v) => onSettingsChange({ toastPosition: v })}
            />
          </>
        )}
      </section>
    </div>
  );
};
```

### 5.2 Toast Component

```typescript
interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  duration: number;
}

interface ToastContainerProps {
  toasts: Toast[];
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  position,
  onRemove,
}) => {
  return (
    <div className={`toast-container ${position}`}>
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
};
```

---

## 6. Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
1. Create `useNotification` hook with TypeScript interfaces
2. Implement audio service with Web Audio API
3. Set up notification context/provider
4. Add settings persistence layer

### Phase 2: Browser Notifications (Week 1-2)
1. Implement Notification API integration
2. Create permission request flow
3. Add permission state management
4. Handle notification clicks (focus window)

### Phase 3: UI Components (Week 2)
1. Build Toast component system
2. Create NotificationSettingsPanel
3. Add visual feedback for settings changes
4. Implement test buttons for audio/notifications

### Phase 4: Integration & Polish (Week 3)
1. Integrate with existing Timer component
2. Add comprehensive error handling
3. Cross-browser testing
4. Performance optimization

---

## 7. Testing Strategy

### Unit Tests
- `useNotification` hook: permission states, notification methods
- Audio service: frequency generation, volume control
- Settings persistence: localStorage interactions

### Integration Tests
- Timer completion → notification flow
- Permission request → notification display
- Settings change → persistence → restoration

### E2E Tests
- Complete user flow: enable notifications → complete pomodoro → verify notification
- Settings panel: modify all settings → refresh → verify persistence

---

## 8. Configuration Schema

```typescript
// Default notification settings
const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  // Audio
  enableAudio: true,
  audioVolume: 70,
  audioType: 'chime',
  
  // Browser Push
  enablePush: false, // User must opt-in
  pushPermission: 'default',
  showNotificationOn: ['complete', 'break', 'longBreak'],
  
  // In-app Toast
  enableToast: true,
  toastDuration: 5000,
  toastPosition: 'top-right',
  toastType: 'detailed',
};
```

---

## 9. Success Criteria

- [ ] Audio notifications play on all major browsers (Chrome, Firefox, Safari, Edge)
- [ ] Browser notifications request permission gracefully
- [ ] Notifications work when tab is inactive or minimized
- [ ] All settings persist across page refreshes
- [ ] Users can test audio/notifications from settings panel
- [ ] No console errors or permission denials without user action
- [ ] Test coverage > 80% for notification-related code

---

## 10. Future Enhancements (Phase 2)

- Custom sound file uploads
- Vibration API for mobile devices
- Rich notifications with action buttons ("Start Break", "Skip Break")
- Notification history/log
- Quiet hours (disable notifications during certain times)
- Per-task notification settings

---

*Document Version: 1.0*
*Created: 2026-04-06*
*Status: Ready for Implementation*
