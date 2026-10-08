(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // KEYS — Central registry of all localStorage key names.
  // All keys are prefixed with "ppd_" to avoid collisions (Requirement 10.6).
  // ---------------------------------------------------------------------------
  const KEYS = {
    DISPLAY_NAME:     'ppd_displayName',
    THEME:            'ppd_theme',
    SESSION_DURATION: 'ppd_sessionDuration',
    TASKS:            'ppd_tasks',
    SORT_OPTION:      'ppd_sortOption',
    LINKS:            'ppd_links',
  };

  const PPD = {};

  // ---------------------------------------------------------------------------
  // PPD.Storage — localStorage abstraction with in-memory fallback.
  // Wraps all localStorage access in try/catch so the app works even in
  // private-browsing modes where localStorage throws on access.
  // ---------------------------------------------------------------------------
  PPD.Storage = (function () {
    let _available = false;
    const _fallback = new Map();

    try {
      const testKey = '__ppd_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      _available = true;
    } catch (e) {
      _available = false;
    }

    return {
      available: _available,

      /** Read and JSON-parse a value from storage. Returns null on miss or error. */
      get(key) {
        try {
          if (!_available) {
            const raw = _fallback.get(key);
            return raw !== undefined ? JSON.parse(raw) : null;
          }
          const raw = localStorage.getItem(key);
          return raw !== null ? JSON.parse(raw) : null;
        } catch (e) {
          return null;
        }
      },

      /** JSON-stringify and write. Returns false on failure (e.g. quota exceeded). */
      set(key, value) {
        try {
          const serialised = JSON.stringify(value);
          if (!_available) {
            _fallback.set(key, serialised);
            return true;
          }
          localStorage.setItem(key, serialised);
          return true;
        } catch (e) {
          return false;
        }
      },

      /** Remove a key from storage. Silently ignores errors. */
      remove(key) {
        try {
          if (!_available) {
            _fallback.delete(key);
          } else {
            localStorage.removeItem(key);
          }
        } catch (e) {
          // Ignore removal errors
        }
      },
    };
  }());

  // ---------------------------------------------------------------------------
  // PPD.UI — Shared DOM helper utilities.
  // Provides shorthand selectors and reusable notification/error rendering
  // so all other modules have a single, consistent way to interact with the DOM.
  // ---------------------------------------------------------------------------
  PPD.UI = {

    /** Shorthand for document.querySelector. */
    qs(selector) {
      return document.querySelector(selector);
    },

    /** Shorthand for document.querySelectorAll. */
    qsa(selector) {
      return document.querySelectorAll(selector);
    },

    /**
     * Inserts or updates an inline .error-msg sibling immediately after el.
     * Creates a <span class="error-msg" role="alert"> if none exists as next sibling.
     */
    showError(el, msg) {
      const next = el.nextElementSibling;
      if (next && next.classList.contains('error-msg')) {
        next.textContent = msg;
      } else {
        const span = document.createElement('span');
        span.className = 'error-msg';
        span.setAttribute('role', 'alert');
        span.textContent = msg;
        el.insertAdjacentElement('afterend', span);
      }
    },

    /** Removes the .error-msg sibling immediately after el, if present. */
    clearError(el) {
      const next = el.nextElementSibling;
      if (next && next.classList.contains('error-msg')) {
        next.remove();
      }
    },

    /**
     * Renders a persistent non-blocking top banner (localStorage unavailable warning).
     * Only one banner is shown at a time.
     */
    showBanner(msg) {
      if (document.getElementById('storage-banner')) return;
      const banner = document.createElement('div');
      banner.id = 'storage-banner';
      banner.setAttribute('role', 'alert');
      banner.textContent = msg;
      document.body.insertBefore(banner, document.body.firstChild);
    },

    /**
     * Renders a brief auto-dismissing toast (4 s) for non-critical failures.
     * Only one toast is shown at a time.
     */
    showToast(msg) {
      const existing = document.querySelector('.toast');
      if (existing) existing.remove();
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.setAttribute('role', 'status');
      toast.textContent = msg;
      document.body.appendChild(toast);
      setTimeout(() => { if (toast.parentNode) toast.remove(); }, 4000);
    },

    /**
     * Renders a timed on-screen alert overlay for durationMs ms.
     * Used as fallback when browser Notification API is unavailable.
     */
    showAlert(msg, durationMs) {
      const existing = document.getElementById('timer-alert');
      if (existing) existing.remove();
      const overlay = document.createElement('div');
      overlay.id = 'timer-alert';
      overlay.setAttribute('role', 'alertdialog');
      overlay.textContent = msg;
      document.body.appendChild(overlay);
      setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, durationMs);
    },
  };

  // ---------------------------------------------------------------------------
  // PPD.Theme — Theme detection, application, and toggling.
  // Manages the light/dark colour scheme via the data-theme attribute on <html>.
  // Persists the user's preference to localStorage under the ppd_theme key.
  // ---------------------------------------------------------------------------
  PPD.Theme = {

    /**
     * Determines which theme to use by checking three sources in priority order:
     * 1. Persisted value in localStorage (ppd_theme)
     * 2. OS/browser prefers-color-scheme media query
     * 3. Default: 'light'
     */
    detect() {
      const stored = PPD.Storage.get(KEYS.THEME);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
      return 'light';
    },

    /** Applies the given theme by setting data-theme on the <html> element. */
    apply(theme) {
      document.documentElement.setAttribute('data-theme', theme);
    },

    /**
     * Toggles between 'light' and 'dark', persists the new value to localStorage,
     * applies it to the DOM, and updates the toggle button's label and aria-label.
     */
    toggle() {
      const current = PPD.Theme.current();
      const newTheme = current === 'dark' ? 'light' : 'dark';
      PPD.Storage.set(KEYS.THEME, newTheme);
      PPD.Theme.apply(newTheme);
      PPD.Theme.updateToggleButton();
    },

    /** Returns the currently active theme from the <html> element. Defaults to 'light'. */
    current() {
      return document.documentElement.getAttribute('data-theme') || 'light';
    },

    /**
     * Wires the theme toggle button click handler and sets the initial button state.
     * The button must exist in the DOM with id="btn-theme-toggle".
     */
    init() {
      const btn = document.getElementById('btn-theme-toggle');
      if (btn) {
        btn.addEventListener('click', function () {
          PPD.Theme.toggle();
        });
      }
      PPD.Theme.updateToggleButton();
    },

    /**
     * Updates the theme toggle button text and aria-label to reflect the action
     * the button will perform (i.e. what theme it will switch TO):
     *   - When dark theme is active → show '☀️ Light' (clicking switches to light)
     *   - When light theme is active → show '🌙 Dark' (clicking switches to dark)
     */
    updateToggleButton() {
      const btn = document.getElementById('btn-theme-toggle');
      if (!btn) return;
      const current = PPD.Theme.current();
      if (current === 'dark') {
        btn.textContent = '☀️ Light';
        btn.setAttribute('aria-label', 'Switch to light theme');
      } else {
        btn.textContent = '🌙 Dark';
        btn.setAttribute('aria-label', 'Switch to dark theme');
      }
    },
  };

  // ---------------------------------------------------------------------------
  // PPD.Greeting — Pure helper functions for time/date formatting and greeting.
  // These functions are stateless and have no DOM or storage side-effects, which
  // makes them straightforward to unit-test and property-test in isolation.
  // ---------------------------------------------------------------------------
  PPD.Greeting = {
    /**
     * Returns the greeting prefix for a given hour (0–23).
     * 05–11 → "Good morning", 12–17 → "Good afternoon", 18–23 and 00–04 → "Good evening"
     */
    getGreetingPrefix(hour) {
      if (hour >= 5 && hour <= 11) return 'Good morning';
      if (hour >= 12 && hour <= 17) return 'Good afternoon';
      return 'Good evening';
    },

    /**
     * Formats a Date object as "HH:MM" (zero-padded, 24-hour clock).
     */
    formatTime(date) {
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    },

    /**
     * Formats a Date object as "Monday, 26 October 2025" (full weekday, day, full month, year).
     */
    formatDate(date) {
      return date.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    },

    /**
     * Builds the full greeting string, appending ", Name" if name is provided.
     * @param {number} hour - Current hour (0–23)
     * @param {string|null} name - Display name or null/empty
     */
    buildGreeting(hour, name) {
      const prefix = PPD.Greeting.getGreetingPrefix(hour);
      const trimmed = name && name.trim();
      return trimmed ? `${prefix}, ${trimmed}` : prefix;
    },

    /**
     * Validates and saves (or clears) the display name.
     * - If rawInput trims to 1–50 chars: persist to ppd_displayName, return {ok: true}
     * - If rawInput trims to empty: remove ppd_displayName key, return {ok: true}
     * - If rawInput exceeds 50 chars: return {ok: false, error: '...'} without touching storage
     * @param {string} rawInput
     * @returns {{ok: boolean, error?: string}}
     */
    saveName(rawInput) {
      const trimmed = rawInput ? rawInput.trim() : '';
      if (trimmed.length > 50) {
        return { ok: false, error: 'Name must be 50 characters or fewer.' };
      }
      if (trimmed.length === 0) {
        PPD.Storage.remove(KEYS.DISPLAY_NAME);
      } else {
        PPD.Storage.set(KEYS.DISPLAY_NAME, trimmed);
      }
      return { ok: true };
    },

    /**
     * Updates all greeting DOM elements with the current time, date, and greeting.
     * Reads the display name from storage on each call so the greeting stays fresh.
     */
    render() {
      const now = new Date();
      const timeEl = document.getElementById('greeting-time');
      const dateEl = document.getElementById('greeting-date');
      const greetEl = document.getElementById('greeting-text');

      if (timeEl) timeEl.textContent = PPD.Greeting.formatTime(now);
      if (dateEl) dateEl.textContent = PPD.Greeting.formatDate(now);
      if (greetEl) {
        const name = PPD.Storage.get(KEYS.DISPLAY_NAME);
        greetEl.textContent = PPD.Greeting.buildGreeting(now.getHours(), name);
      }
    },

    /**
     * Initialises the greeting panel:
     * 1. Pre-fills the name input with the stored display name (Requirement 2.4)
     * 2. Calls render() immediately to show current time/date/greeting
     * 3. Starts setInterval(render, 60000) so the display updates every minute (Requirement 1.1)
     * 4. Wires the name save button click handler and Enter keydown on the input
     */
    init() {
      const nameInput = document.getElementById('input-display-name');
      const saveBtn = document.getElementById('btn-save-name');
      const nameError = document.getElementById('name-error');

      // Pre-fill the input with any previously saved display name
      const stored = PPD.Storage.get(KEYS.DISPLAY_NAME);
      if (nameInput && stored) {
        nameInput.value = stored;
      }

      // Render immediately then refresh every 60 seconds
      PPD.Greeting.render();
      setInterval(PPD.Greeting.render, 60000);

      // Wire save button click
      if (saveBtn && nameInput) {
        saveBtn.addEventListener('click', function () {
          const result = PPD.Greeting.saveName(nameInput.value);
          if (!result.ok) {
            if (nameError) {
              nameError.textContent = result.error;
              nameError.hidden = false;
            }
          } else {
            if (nameError) {
              nameError.textContent = '';
              nameError.hidden = true;
            }
            PPD.Greeting.render();
          }
        });

        // Allow pressing Enter in the name input to trigger the save button
        nameInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') saveBtn.click();
        });
      }
    },
  };

  // ---------------------------------------------------------------------------
  // PPD.Timer — Configurable countdown timer with a 4-state machine.
  // States: idle → running → paused → completed (reset returns to idle).
  // ---------------------------------------------------------------------------

  // Timer internal state — held in a closure object to prevent external mutation
  const _timerState = {
    state: 'idle',            // 'idle' | 'running' | 'paused' | 'completed'
    sessionDuration: 25 * 60, // seconds (default 25 minutes)
    remaining: 25 * 60,       // seconds remaining in current countdown
    intervalId: null,         // setInterval ID while running
    audioCtx: null,           // Web Audio API context (created on first Start click)
  };

  PPD.Timer = {

    /**
     * Pure function. Converts total seconds to "MM:SS" zero-padded string.
     * Works for any value 0–5400 (0–90 minutes).
     * @param {number} totalSeconds - Non-negative integer
     * @returns {string} e.g. "25:00", "01:09"
     */
    formatDisplay(totalSeconds) {
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    },

    /** Renders the timer display element with the current remaining time. */
    renderDisplay() {
      const el = document.getElementById('timer-display');
      if (el) el.textContent = PPD.Timer.formatDisplay(_timerState.remaining);
    },

    /**
     * Starts the countdown. Transitions idle/paused → running.
     * Starts a 1-second interval that calls tick(). No-op if already running.
     */
    start() {
      if (_timerState.state === 'running') return;
      if (_timerState.remaining <= 0) return;
      _timerState.state = 'running';
      PPD.Timer.updateControls();
      _timerState.intervalId = setInterval(PPD.Timer.tick, 1000);
    },

    /**
     * Pauses the countdown. Transitions running → paused.
     * Clears the interval without resetting remaining time. No-op if not running.
     */
    stop() {
      if (_timerState.state !== 'running') return;
      clearInterval(_timerState.intervalId);
      _timerState.intervalId = null;
      _timerState.state = 'paused';
      PPD.Timer.updateControls();
    },

    /**
     * Resets the timer to idle. Clears any active interval, restores
     * remaining to sessionDuration, and updates the display.
     */
    reset() {
      clearInterval(_timerState.intervalId);
      _timerState.intervalId = null;
      _timerState.remaining = _timerState.sessionDuration;
      _timerState.state = 'idle';
      PPD.Timer.renderDisplay();
      PPD.Timer.updateControls();
    },

    /**
     * Called every second while running. Decrements remaining and checks for completion.
     */
    tick() {
      if (_timerState.state !== 'running') return;
      _timerState.remaining -= 1;
      PPD.Timer.renderDisplay();
      if (_timerState.remaining <= 0) {
        clearInterval(_timerState.intervalId);
        _timerState.intervalId = null;
        _timerState.remaining = 0;
        _timerState.state = 'completed';
        PPD.Timer.renderDisplay();
        PPD.Timer.updateControls();
        PPD.Timer.complete();
      }
    },

    /**
     * Updates Start/Stop/Reset button enabled states and aria-labels
     * to reflect the current timer state.
     */
    updateControls() {
      const startBtn = document.getElementById('btn-timer-start');
      const stopBtn = document.getElementById('btn-timer-stop');
      const resetBtn = document.getElementById('btn-timer-reset');
      if (!startBtn) return;

      const isRunning = _timerState.state === 'running';
      const isIdle = _timerState.state === 'idle';
      const isCompleted = _timerState.state === 'completed';

      // Start: enabled when idle or paused; disabled when running or completed
      startBtn.disabled = isRunning || isCompleted;
      // Stop: enabled only when running
      stopBtn.disabled = !isRunning;
      // Reset: always enabled so user can exit any state
      resetBtn.disabled = false;
    },

    /**
     * Placeholder — implemented in task 7.3.
     * Called when countdown reaches 00:00.
     */
    complete() {
      // Implemented in task 7.3
    },
  };

  Object.assign(PPD.Timer, {

    /**
     * Called when the countdown reaches 00:00.
     * Transitions to 'completed', triggers notification and audible beep.
     */
    complete() {
      _timerState.state = 'completed';
      PPD.Timer.notify();
      PPD.Timer.playBeep();
    },

    /**
     * Attempts to notify the user via the browser Notifications API.
     * Falls back to PPD.UI.showAlert for 5 seconds if permission is denied,
     * not granted, or the API is unavailable (e.g. file:// on Safari).
     */
    notify() {
      const msg = 'Focus session complete! Time for a break.';
      if (typeof Notification === 'undefined') {
        // Notifications API not available — use on-screen alert fallback
        PPD.UI.showAlert(msg, 5000);
        return;
      }
      if (Notification.permission === 'granted') {
        new Notification('Timer Complete', { body: msg });
      } else if (Notification.permission !== 'denied') {
        // Request permission, then notify or fall back to on-screen alert
        Notification.requestPermission().then(function (permission) {
          if (permission === 'granted') {
            new Notification('Timer Complete', { body: msg });
          } else {
            PPD.UI.showAlert(msg, 5000);
          }
        }).catch(function () {
          PPD.UI.showAlert(msg, 5000);
        });
      } else {
        // Permission explicitly denied — fall back to on-screen alert
        PPD.UI.showAlert(msg, 5000);
      }
    },

    /**
     * Plays a short 440 Hz synthesised beep (≤ 5 s) via the Web Audio API.
     * The AudioContext is lazily created on the first Start button click to
     * satisfy browser autoplay policies (user gesture required).
     * Silently no-ops if Web Audio API is unavailable.
     */
    playBeep() {
      try {
        // Create AudioContext if not yet created (requires prior user gesture)
        if (!_timerState.audioCtx) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!AudioContext) return; // Web Audio API not available
          _timerState.audioCtx = new AudioContext();
        }
        const ctx = _timerState.audioCtx;
        // Resume context if it was suspended by autoplay policy
        const resumeAndBeep = function () {
          const oscillator = ctx.createOscillator();
          const gainNode = ctx.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(ctx.destination);
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(440, ctx.currentTime); // 440 Hz (concert A)
          gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2); // fade out over 2 s
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 2); // stop after 2 seconds (well under 5 s limit)
        };
        if (ctx.state === 'suspended') {
          ctx.resume().then(resumeAndBeep).catch(function () { /* ignore */ });
        } else {
          resumeAndBeep();
        }
      } catch (e) {
        // Web Audio API unavailable or error — silently no-op
      }
    },

    /**
     * Validates and sets a new session duration.
     * Accepts whole-minute integers in [1, 90].
     * Rejects if the timer is currently running.
     * Persists the new duration and resets the display.
     * @param {number|string} minutes
     * @returns {{ok: boolean, error?: string}}
     */
    setDuration(minutes) {
      // Reject changes while the timer is running
      if (_timerState.state === 'running') {
        return { ok: false, error: 'Stop the timer before changing the duration.' };
      }
      const mins = parseInt(minutes, 10);
      if (isNaN(mins) || mins < 1 || mins > 90) {
        return { ok: false, error: 'Duration must be a whole number between 1 and 90 minutes.' };
      }
      _timerState.sessionDuration = mins * 60;
      PPD.Storage.set(KEYS.SESSION_DURATION, mins);
      PPD.Timer.reset(); // reset restores remaining to sessionDuration and re-renders
      return { ok: true };
    },

    /**
     * Initialises the timer panel: loads persisted duration, renders display,
     * wires Start/Stop/Reset buttons and the duration input.
     * Also initialises the AudioContext on first Start click (user gesture).
     */
    init() {
      // Load persisted session duration (default 25 minutes)
      const stored = PPD.Storage.get(KEYS.SESSION_DURATION);
      if (stored !== null && Number.isInteger(stored) && stored >= 1 && stored <= 90) {
        _timerState.sessionDuration = stored * 60;
        _timerState.remaining = stored * 60;
      }
      PPD.Timer.renderDisplay();
      PPD.Timer.updateControls();

      // Set the duration input to reflect the loaded value
      const durationInput = document.getElementById('input-timer-duration');
      if (durationInput) {
        durationInput.value = Math.round(_timerState.sessionDuration / 60);
      }

      // Wire Start button — also creates/resumes AudioContext (user gesture)
      const startBtn = document.getElementById('btn-timer-start');
      if (startBtn) {
        startBtn.addEventListener('click', function () {
          // Lazily initialise AudioContext on first user gesture
          if (!_timerState.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
              try { _timerState.audioCtx = new AudioContext(); } catch (e) { /* ignore */ }
            }
          }
          PPD.Timer.start();
        });
      }

      // Wire Stop button
      const stopBtn = document.getElementById('btn-timer-stop');
      if (stopBtn) {
        stopBtn.addEventListener('click', function () { PPD.Timer.stop(); });
      }

      // Wire Reset button
      const resetBtn = document.getElementById('btn-timer-reset');
      if (resetBtn) {
        resetBtn.addEventListener('click', function () { PPD.Timer.reset(); });
      }

      // Wire duration Set button
      const setBtn = document.getElementById('btn-timer-set-duration');
      if (setBtn && durationInput) {
        const applyDuration = function () {
          const result = PPD.Timer.setDuration(durationInput.value);
          const errEl = document.getElementById('timer-duration-error');
          if (!result.ok) {
            if (errEl) { errEl.textContent = result.error; errEl.hidden = false; }
          } else {
            if (errEl) { errEl.textContent = ''; errEl.hidden = true; }
            durationInput.value = Math.round(_timerState.sessionDuration / 60);
          }
        };
        setBtn.addEventListener('click', applyDuration);
        durationInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') applyDuration();
        });
      }
    },
  });

  // ---------------------------------------------------------------------------
  // PPD.Tasks — To-do list manager.
  // Task schema: { id: string, description: string, completed: boolean, createdAt: number }
  // ---------------------------------------------------------------------------

  // Sort option constants — must match the options in the HTML sort dropdown
  const SORT_OPTIONS = {
    DEFAULT:          'default',
    AZ:               'az',
    ZA:               'za',
    INCOMPLETE_FIRST: 'incomplete_first',
    COMPLETE_FIRST:   'complete_first',
  };

  // In-memory task store and active sort option
  let _tasks = [];
  let _activeSortOption = SORT_OPTIONS.DEFAULT;

  PPD.Tasks = {

    /**
     * Generates a unique ID for a new task.
     * Uses crypto.randomUUID() when available; falls back to timestamp + random suffix.
     * @returns {string}
     */
    generateId() {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
      // Fallback for older Safari and file:// contexts without crypto.randomUUID
      return Date.now().toString(36) + Math.random().toString(36).slice(2);
    },

    /**
     * Checks whether a given description (trimmed, case-insensitive) matches an
     * existing incomplete task. Optionally excludes a specific task by id (for edits).
     * Duplicate detection only applies to incomplete tasks per Requirement 5.3.
     * @param {string} text - The trimmed description to check
     * @param {string|null} excludeId - Task id to exclude from the check (for edits)
     * @returns {boolean}
     */
    isDuplicate(text, excludeId) {
      const lower = text.toLowerCase();
      return _tasks.some(function (task) {
        if (task.completed) return false;                  // only check incomplete tasks
        if (excludeId && task.id === excludeId) return false; // skip the task being edited
        return task.description.toLowerCase() === lower;
      });
    },

    /**
     * Returns a sorted COPY of the tasks array for display purposes.
     * Never mutates the _tasks store (Requirement 8.2).
     * Tie-breaking is always by createdAt ascending (oldest first) per Requirement 8.5.
     * @param {string} option - One of SORT_OPTIONS values
     * @returns {Array}
     */
    sort(option) {
      const copy = _tasks.slice(); // shallow copy to avoid mutating the store

      switch (option) {
        case SORT_OPTIONS.AZ:
          copy.sort(function (a, b) {
            const cmp = a.description.toLowerCase().localeCompare(b.description.toLowerCase());
            return cmp !== 0 ? cmp : a.createdAt - b.createdAt;
          });
          break;

        case SORT_OPTIONS.ZA:
          copy.sort(function (a, b) {
            const cmp = b.description.toLowerCase().localeCompare(a.description.toLowerCase());
            return cmp !== 0 ? cmp : a.createdAt - b.createdAt;
          });
          break;

        case SORT_OPTIONS.INCOMPLETE_FIRST:
          copy.sort(function (a, b) {
            // false (0) < true (1), so incomplete (false) sorts before complete (true)
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            return a.createdAt - b.createdAt;
          });
          break;

        case SORT_OPTIONS.COMPLETE_FIRST:
          copy.sort(function (a, b) {
            if (a.completed !== b.completed) return a.completed ? -1 : 1;
            return a.createdAt - b.createdAt;
          });
          break;

        case SORT_OPTIONS.DEFAULT:
        default:
          // Default is creation order (oldest first) — already the natural store order
          copy.sort(function (a, b) { return a.createdAt - b.createdAt; });
          break;
      }

      return copy;
    },

    /**
     * Writes the current _tasks array to localStorage.
     * Returns true on success, false if the write fails (e.g. quota exceeded).
     * Shows a toast if the write fails.
     * @returns {boolean}
     */
    persist() {
      const ok = PPD.Storage.set(KEYS.TASKS, _tasks);
      if (!ok) {
        PPD.UI.showToast('Could not save tasks. Changes are in memory only.');
      }
      return ok;
    },
  };

  Object.assign(PPD.Tasks, {

    add(rawText) {
      const addInput = document.getElementById('input-add-task');
      const trimmed = rawText ? rawText.trim() : '';
      if (trimmed.length === 0) return { ok: false };
      if (trimmed.length > 200) {
        if (addInput) PPD.UI.showError(addInput, 'Task must be 200 characters or fewer.');
        return { ok: false };
      }
      if (PPD.Tasks.isDuplicate(trimmed)) {
        if (addInput) {
          PPD.UI.showError(addInput, 'This task already exists.');
          addInput.setAttribute('data-duplicate-warning', 'true');
        }
        return { ok: false };
      }
      if (addInput) PPD.UI.clearError(addInput);
      const newTask = { id: PPD.Tasks.generateId(), description: trimmed, completed: false, createdAt: Date.now() };
      _tasks.push(newTask);
      PPD.Tasks.persist();
      PPD.Tasks.render();
      if (addInput) { addInput.value = ''; addInput.removeAttribute('data-duplicate-warning'); }
      return { ok: true };
    },

    edit(id, rawText) {
      const task = _tasks.find(function (t) { return t.id === id; });
      if (!task) return { ok: false, error: 'Task not found.' };
      const trimmed = rawText ? rawText.trim() : '';
      if (trimmed.length === 0) return { ok: false, error: 'Task description cannot be empty.' };
      if (trimmed.length > 200) return { ok: false, error: 'Task must be 200 characters or fewer.' };
      if (PPD.Tasks.isDuplicate(trimmed, id)) return { ok: false, error: 'Another task with this description already exists.' };
      const prev = task.description;
      task.description = trimmed;
      const saved = PPD.Tasks.persist();
      if (!saved) { task.description = prev; PPD.Tasks.render(); return { ok: false, error: 'Could not save. Changes were not persisted.' }; }
      PPD.Tasks.render();
      return { ok: true };
    },

    toggle(id) {
      const task = _tasks.find(function (t) { return t.id === id; });
      if (!task) return;
      task.completed = !task.completed;
      PPD.Tasks.render();
      if (!PPD.Tasks.persist()) PPD.UI.showToast('Could not save completion status. Change is in memory only.');
    },

    delete(id) {
      const idx = _tasks.findIndex(function (t) { return t.id === id; });
      if (idx === -1) return;
      _tasks.splice(idx, 1);
      PPD.Tasks.render();
      if (!PPD.Tasks.persist()) PPD.UI.showToast('Could not save deletion. Change is in memory only.');
    },

    render() {
      const listEl = document.getElementById('task-list');
      if (!listEl) return;
      const sorted = PPD.Tasks.sort(_activeSortOption);
      listEl.innerHTML = '';
      if (sorted.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'task-empty';
        empty.textContent = 'No tasks yet. Add one above!';
        listEl.appendChild(empty);
        return;
      }
      sorted.forEach(function (task) {
        const li = document.createElement('li');
        li.className = 'task-item' + (task.completed ? ' task-completed' : '');
        li.setAttribute('data-task-id', task.id);
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.className = 'task-checkbox';
        checkbox.setAttribute('aria-label', (task.completed ? 'Mark incomplete: ' : 'Mark complete: ') + task.description);
        checkbox.addEventListener('change', function () { PPD.Tasks.toggle(task.id); });
        const descSpan = document.createElement('span');
        descSpan.className = 'task-description';
        descSpan.textContent = task.description;
        const editBtn = document.createElement('button');
        editBtn.className = 'btn-icon btn-edit';
        editBtn.setAttribute('aria-label', 'Edit task: ' + task.description);
        editBtn.textContent = '✏️';
        editBtn.addEventListener('click', function () { PPD.Tasks.showEditMode(task.id, task.description); });
        const delBtn = document.createElement('button');
        delBtn.className = 'btn-icon btn-delete';
        delBtn.setAttribute('aria-label', 'Delete task: ' + task.description);
        delBtn.textContent = '🗑️';
        delBtn.addEventListener('click', function () { PPD.Tasks.delete(task.id); });
        li.appendChild(checkbox);
        li.appendChild(descSpan);
        li.appendChild(editBtn);
        li.appendChild(delBtn);
        listEl.appendChild(li);
      });
    },

    showEditMode(id, currentDescription) {
      const li = document.querySelector('[data-task-id="' + id + '"]');
      if (!li) return;
      li.innerHTML = '';
      const editInput = document.createElement('input');
      editInput.type = 'text';
      editInput.className = 'form-input task-edit-input';
      editInput.value = currentDescription;
      editInput.maxLength = 200;
      editInput.setAttribute('aria-label', 'Edit task description');
      setTimeout(function () { editInput.focus(); editInput.setSelectionRange(editInput.value.length, editInput.value.length); }, 0);
      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'btn btn-primary btn-sm';
      confirmBtn.textContent = '✓';
      confirmBtn.setAttribute('aria-label', 'Confirm edit');
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-secondary btn-sm';
      cancelBtn.textContent = '✕';
      cancelBtn.setAttribute('aria-label', 'Cancel edit');
      const errorSpan = document.createElement('span');
      errorSpan.className = 'error-msg';
      errorSpan.setAttribute('role', 'alert');
      errorSpan.hidden = true;
      const doConfirm = function () {
        const result = PPD.Tasks.edit(id, editInput.value);
        if (!result.ok) { errorSpan.textContent = result.error; errorSpan.hidden = false; }
      };
      confirmBtn.addEventListener('click', doConfirm);
      cancelBtn.addEventListener('click', function () { PPD.Tasks.render(); });
      editInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') doConfirm(); if (e.key === 'Escape') PPD.Tasks.render(); });
      editInput.addEventListener('input', function () { editInput.removeAttribute('data-duplicate-warning'); errorSpan.hidden = true; });
      li.appendChild(editInput);
      li.appendChild(confirmBtn);
      li.appendChild(cancelBtn);
      li.appendChild(errorSpan);
    },
  });

  Object.assign(PPD.Tasks, {

    /**
     * Sets and persists the active sort option, then re-renders the task list.
     * @param {string} option - One of SORT_OPTIONS values
     */
    setSort(option) {
      _activeSortOption = option;
      PPD.Storage.set(KEYS.SORT_OPTION, option);
      PPD.Tasks.render();
    },

    /**
     * Initialises the task manager:
     * 1. Loads tasks from localStorage (default empty array on miss/malformed data)
     * 2. Loads and applies the persisted sort option (default 'default')
     * 3. Renders the task list
     * 4. Wires the Add button and sort dropdown
     */
    init() {
      // Load tasks from storage — fall back to empty array on missing or malformed data
      const stored = PPD.Storage.get(KEYS.TASKS);
      if (Array.isArray(stored)) {
        _tasks = stored;
      } else {
        _tasks = [];
      }

      // Load persisted sort option
      const storedSort = PPD.Storage.get(KEYS.SORT_OPTION);
      if (storedSort && Object.values(SORT_OPTIONS).includes(storedSort)) {
        _activeSortOption = storedSort;
      } else {
        _activeSortOption = SORT_OPTIONS.DEFAULT;
      }

      PPD.Tasks.render();

      // Set the sort dropdown to the active option
      const sortSelect = document.getElementById('select-task-sort');
      if (sortSelect) {
        sortSelect.value = _activeSortOption;
        sortSelect.addEventListener('change', function () {
          PPD.Tasks.setSort(sortSelect.value);
        });
      }

      // Wire Add button
      const addInput = document.getElementById('input-add-task');
      const addBtn = document.getElementById('btn-add-task');
      if (addBtn && addInput) {
        addBtn.addEventListener('click', function () {
          PPD.Tasks.add(addInput.value);
        });
        addInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') PPD.Tasks.add(addInput.value);
          // Dismiss duplicate warning on next keystroke
          if (addInput.getAttribute('data-duplicate-warning')) {
            PPD.UI.clearError(addInput);
            addInput.removeAttribute('data-duplicate-warning');
          }
        });
      }
    },
  });

}());
