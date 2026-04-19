import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import {
  isNotificationSupported,
  requestNotificationPermission,
  sendSessionNotification,
  closeActiveNotification,
} from './services/notification';

const WORK_TIME = 1 * 60; // 25 minutes
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

function App() {
  const [mode, setMode] = useState<Mode>('work');
  const [timeLeft, setTimeLeft] = useState(WORK_TIME);
  const [isActive, setIsActive] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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

  const toggleTimer = () => setIsActive(!isActive);
  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(MODES[mode].time);
  };

  // Cleanup active notification on unmount
  useEffect(() => {
    return () => {
      closeActiveNotification();
    };
  }, []);

  const progress = ((MODES[mode].time - timeLeft) / MODES[mode].time) * 100;

  return (
    <div className="App">
      <div className="tomato-clock">
        <h1>🍅 Tomato Clock</h1>

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
      </div>
    </div>
  );
}

export default App;
