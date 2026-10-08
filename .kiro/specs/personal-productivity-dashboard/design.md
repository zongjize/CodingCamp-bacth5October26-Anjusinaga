# Design Document — Personal Productivity Dashboard

## Overview

The Personal Productivity Dashboard is a standalone, client-side web application delivered as three files: `index.html`, `css/style.css`, and `js/app.js`. It runs entirely in the browser with no server, no build step, and no external dependencies. All user data is persisted through the browser's `localStorage` API under `ppd_*` keys.

The four core panels — Greeting, Focus Timer, Task Manager, and Quick Links — are rendered as a single-page layout. Light/dark theming, a custom display name, task sorting, and duplicate prevention round out the feature set.

### Key Research Findings

- **`file://` protocol and ES modules**: Browsers block `type="module"` scripts loaded via `file://` due to CORS policy (origin `null`). The single JS file **must not** use ES module `import/export` syntax. Instead, the codebase uses the **IIFE + Namespace pattern** to organise code while remaining a single `<script>` tag with no `type="module"` attribute. ([MDN – JavaScript Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules))
- **Web Notifications API**: Requires explicit permission and does not work on Safari when served from `file://` (permission is always denied because there is no domain). The timer completion flow always tries the Notifications API first, then falls back to a visible on-screen alert.
- **Web Audio API**: `AudioContext` must be created or resumed inside a user-gesture handler (the Start button satisfies this). A short synthesised beep is generated programmatically — no audio file assets are needed.
- **Theme flash prevention**: The theme CSS class must be applied to `<html>` via a tiny inline `<script>` block in `<head>` (before the `<body>` renders) so there is no flash of the wrong theme on page load.

---

## Architecture

The application follows a **single-page, event-driven architecture** with a clear namespace hierarchy. All code lives in one IIFE that exposes nothing to the global scope except the top-level `PPD` namespace used for cross-module event wiring.

```
index.html
  │
  ├── <head>
  │     ├── <link rel="stylesheet" href="css/style.css">
  │     └── <script>   ← inline theme-init block (prevents flash)
  │
  └── <body>
        ├── #app  (root layout)
        │     ├── #panel-greeting
        │     ├── #panel-timer
        │     ├── #panel-tasks
        │     └── #panel-links
        └── <script src="js/app.js">   ← single JS file (no type="module")
```

### Module Organisation Inside `js/app.js`

All modules are plain IIFE-scoped objects (namespaces). There are no ES module imports.

```
(function () {
  'use strict';

  const PPD = {};

  PPD.Storage   — LocalStorage read/write abstraction
  PPD.Theme     — theme detection, apply, toggle
  PPD.Greeting  — clock, date, greeting text, display name
  PPD.Timer     — countdown logic, Web Audio beep, Notifications
  PPD.Tasks     — task CRUD, sorting, duplicate detection
  PPD.Links     — link CRUD, URL validation
  PPD.UI        — shared DOM helpers (show/hide elements, render error messages)
  PPD.Init      — bootstrap: wires all modules together on DOMContentLoaded

})();
```

Each namespace module is a plain object literal with init, render, and handler functions. Modules communicate by calling each other's public methods — there is no event bus.

---

## Components and Interfaces

### PPD.Storage

Wraps `localStorage` with a try/catch guard. If `localStorage` is unavailable it falls back to an in-memory map and sets `PPD.Storage.available = false` so other modules can display the warning banner.

| Function | Signature | Description |
|---|---|---|
| `get` | `(key) → value\|null` | Parse JSON from `localStorage[key]`; return `null` on miss or parse error |
| `set` | `(key, value) → boolean` | JSON-stringify and store; return `false` if write fails (quota exceeded etc.) |
| `remove` | `(key) → void` | Delete key from storage |
| `available` | `boolean` | `true` if `localStorage` is accessible |

All keys passed to `PPD.Storage` are already prefixed — callers use the constant `KEYS` object defined once at the top of `app.js`:

```js
const KEYS = {
  DISPLAY_NAME:    'ppd_displayName',
  THEME:           'ppd_theme',
  SESSION_DURATION:'ppd_sessionDuration',
  TASKS:           'ppd_tasks',
  SORT_OPTION:     'ppd_sortOption',
  LINKS:           'ppd_links',
};
```

---

### PPD.Theme

| Function | Signature | Description |
|---|---|---|
| `detect` | `() → 'light'\|'dark'` | Returns persisted value → OS `prefers-color-scheme` → `'light'` |
| `apply` | `(theme) → void` | Sets `data-theme` attribute on `<html>` element |
| `toggle` | `() → void` | Flips between `'light'` and `'dark'`, persists, calls `apply` |
| `current` | `() → 'light'\|'dark'` | Returns the currently active theme |

Theme is stored as a `data-theme="light|dark"` attribute on `<html>`. CSS variables are defined under `[data-theme="light"]` and `[data-theme="dark"]` selectors. The inline `<script>` in `<head>` calls a minimal, self-contained version of `apply(detect())` before the body renders.

---

### PPD.Greeting

| Function | Signature | Description |
|---|---|---|
| `getGreetingPrefix` | `(hour: number) → string` | Pure function; returns `"Good morning"`, `"Good afternoon"`, or `"Good evening"` |
| `formatTime` | `(date: Date) → string` | Returns `"HH:MM"` zero-padded string |
| `formatDate` | `(date: Date) → string` | Returns `"Monday, 26 October 2025"` |
| `buildGreeting` | `(hour, name) → string` | Combines prefix + optional `", Name"` suffix |
| `render` | `() → void` | Updates all greeting DOM elements with current time/date/greeting |
| `init` | `() → void` | Calls `render()` immediately; starts `setInterval(render, 60_000)` |
| `saveName` | `(rawInput) → {ok, error}` | Validates, trims, persists or clears display name; returns result object |

---

### PPD.Timer

**State machine** with four states: `idle`, `running`, `paused`, `completed`.

```
idle ──[start]──► running ──[stop]──► paused ──[start]──► running
  ▲                  │                                          │
  │               [reset]                                   [tick=0]
  └──────────────────┘◄─────────────────────────────────── completed
```

| Function | Signature | Description |
|---|---|---|
| `init` | `() → void` | Load persisted duration; render display; wire controls |
| `start` | `() → void` | Transition `idle/paused → running`; start `setInterval(tick, 1000)` |
| `stop` | `() → void` | Transition `running → paused`; clear interval |
| `reset` | `() → void` | Clear interval; restore `remaining` to `sessionDuration`; state → `idle` |
| `tick` | `() → void` | Decrement `remaining`; call `render`; if 0, call `complete` |
| `complete` | `() → void` | State → `completed`; call `notify`; call `playBeep` |
| `notify` | `() → void` | Try `Notification` API; fall back to `PPD.UI.showAlert` |
| `playBeep` | `() → void` | Synthesise a 440 Hz tone for ≤ 5 s via `AudioContext`; no-op if unavailable |
| `setDuration` | `(minutes) → {ok, error}` | Validate 1–90; persist; reset display if not running |
| `formatDisplay` | `(totalSeconds) → string` | Pure function; returns `"MM:SS"` |

Internal state held in a plain object: `{ state, sessionDuration, remaining, intervalId, audioCtx }`.

---

### PPD.Tasks

Data model: an array of `Task` objects persisted as JSON under `ppd_tasks`.

```js
// Task schema
{
  id:          string,   // crypto.randomUUID() or Date.now().toString()
  description: string,   // trimmed, 1–200 chars
  completed:   boolean,
  createdAt:   number    // Unix timestamp ms, for sort tie-breaking
}
```

| Function | Signature | Description |
|---|---|---|
| `init` | `() → void` | Load tasks; apply persisted sort; render list |
| `add` | `(rawText) → {ok, error}` | Validate, duplicate-check, append, persist, re-render |
| `edit` | `(id, rawText) → {ok, error}` | Validate, duplicate-check (against other tasks), update, persist |
| `toggle` | `(id) → void` | Flip `completed`; persist; re-render |
| `delete` | `(id) → void` | Remove by id; persist; re-render |
| `sort` | `(option) → Task[]` | Pure function; returns a sorted copy without mutating the store |
| `setSort` | `(option) → void` | Persist sort option; re-render |
| `isDuplicate` | `(text, excludeId?) → boolean` | Case-insensitive trimmed match against incomplete tasks |
| `render` | `() → void` | Rebuild task list DOM from current store + active sort |
| `persist` | `() → boolean` | Write tasks array to LocalStorage; return success flag |

Sort options are defined as a constant map:

```js
const SORT_OPTIONS = {
  DEFAULT:           'default',
  AZ:                'az',
  ZA:                'za',
  INCOMPLETE_FIRST:  'incomplete_first',
  COMPLETE_FIRST:    'complete_first',
};
```

Sorting never mutates the stored array — `sort()` always returns a copy, and `render()` calls `sort()` to obtain the display order.

---

### PPD.Links

Data model: an array of `Link` objects persisted under `ppd_links`, maximum 50 entries.

```js
// Link schema
{
  id:    string,  // crypto.randomUUID() or Date.now().toString()
  label: string,  // 1–100 chars
  url:   string   // 1–2048 chars, must start with http:// or https://
}
```

| Function | Signature | Description |
|---|---|---|
| `init` | `() → void` | Load links; render |
| `add` | `(label, url) → {ok, errors}` | Validate both fields; check 50-link cap; persist; re-render |
| `remove` | `(id) → void` | Remove by id; persist; re-render |
| `validateURL` | `(url) → boolean` | Returns `true` if url starts with `http://` or `https://` and length ≤ 2048 |
| `render` | `() → void` | Rebuild links DOM |
| `persist` | `() → boolean` | Write links array to LocalStorage |

---

### PPD.UI

Shared utility layer for DOM manipulation.

| Function | Signature | Description |
|---|---|---|
| `showError` | `(el, msg) → void` | Insert/update an `.error-msg` element adjacent to `el` |
| `clearError` | `(el) → void` | Remove `.error-msg` adjacent to `el` |
| `showAlert` | `(msg, durationMs) → void` | Render a timed on-screen alert overlay (timer completion fallback) |
| `showBanner` | `(msg) → void` | Render a persistent non-blocking top banner (LocalStorage unavailable) |
| `showToast` | `(msg) → void` | Render a brief dismissible notification (e.g., save failed) |
| `qs` | `(selector) → Element` | Shorthand for `document.querySelector` |
| `qsa` | `(selector) → NodeList` | Shorthand for `document.querySelectorAll` |

---

### PPD.Init

```js
PPD.Init = {
  run() {
    // 1. Apply theme (also done inline in <head> for flash prevention)
    PPD.Theme.apply(PPD.Theme.detect());

    // 2. Show LocalStorage warning banner if unavailable
    if (!PPD.Storage.available) {
      PPD.UI.showBanner('Data will not be saved in this session.');
    }

    // 3. Boot each panel module
    PPD.Greeting.init();
    PPD.Timer.init();
    PPD.Tasks.init();
    PPD.Links.init();
  }
};

document.addEventListener('DOMContentLoaded', PPD.Init.run);
```

---

## Data Models

### LocalStorage Schema

| Key | Type | Description |
|---|---|---|
| `ppd_displayName` | `string` | Display name, 1–50 chars. Absent = no name set. |
| `ppd_theme` | `"light" \| "dark"` | Active theme. Absent = auto-detect. |
| `ppd_sessionDuration` | `number` | Focus timer duration in minutes (1–90). Absent = 25. |
| `ppd_tasks` | `Task[]` (JSON) | Array of Task objects. Absent or invalid = `[]`. |
| `ppd_sortOption` | `string` | One of the SORT_OPTIONS values. Absent = `"default"`. |
| `ppd_links` | `Link[]` (JSON) | Array of Link objects, max 50. Absent = `[]`. |

### Task Object

```jsonc
{
  "id": "1698765432100",         // string timestamp or UUID
  "description": "Write tests",  // trimmed, 1–200 chars
  "completed": false,            // boolean
  "createdAt": 1698765432100     // ms timestamp for tie-breaking sort
}
```

### Link Object

```jsonc
{
  "id": "1698765499000",
  "label": "MDN Web Docs",
  "url": "https://developer.mozilla.org"
}
```

---

## UI Layout

The dashboard uses a **CSS Grid** layout. On wide screens, the four panels are arranged in a 2×2 grid; on narrow viewports they stack vertically.

```
┌──────────────────────────────────────────────────────┐
│  [☀/🌙 Theme Toggle]              [Dashboard Title]  │
├─────────────────────────┬────────────────────────────┤
│                         │                            │
│   Greeting Panel        │   Focus Timer Panel        │
│   ─────────────────     │   ──────────────────────   │
│   Monday, 26 Oct 2025   │       25:00                │
│   14:32                 │   [Start] [Stop] [Reset]   │
│   Good afternoon, Alex  │   Duration: [25] min [Set] │
│   Name: [_______] [Save]│                            │
│                         │                            │
├─────────────────────────┼────────────────────────────┤
│                         │                            │
│   Task Manager          │   Quick Links              │
│   ─────────────────     │   ──────────────────────   │
│   [Sort: ▼] [Default]   │   [Label___] [URL______]   │
│   [New task…] [Add]     │   [Add Link]               │
│   ─────────────────     │                            │
│   □ Buy milk        ✏🗑 │   [MDN]  [GitHub]  [+]     │
│   ☑ ~~Write tests~~ ✏🗑│                            │
│                         │                            │
└─────────────────────────┴────────────────────────────┘
```

The theme toggle is fixed at the top-right corner via CSS `position: fixed` so it remains accessible at all scroll positions and viewport sizes.

### CSS Custom Properties (Design Tokens)

```css
/* Defined on :root, overridden by [data-theme="dark"] */
:root {
  --color-bg:         #f5f5f5;
  --color-surface:    #ffffff;
  --color-border:     #e0e0e0;
  --color-text:       #1a1a1a;
  --color-text-muted: #666666;
  --color-accent:     #4a6fa5;
  --color-accent-alt: #e8edf5;
  --color-error:      #c0392b;
  --color-success:    #27ae60;
  --color-warning:    #e67e22;
  --shadow-card:      0 2px 8px rgba(0,0,0,0.08);
  --radius-card:      12px;
  --font-family:      system-ui, -apple-system, sans-serif;
}

[data-theme="dark"] {
  --color-bg:         #1a1a2e;
  --color-surface:    #16213e;
  --color-border:     #2a2a4a;
  --color-text:       #e8e8f0;
  --color-text-muted: #9090b0;
  --color-accent:     #7b9ccf;
  --color-accent-alt: #1f2f4a;
  --shadow-card:      0 2px 8px rgba(0,0,0,0.4);
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Greeting prefix covers all hours

*For any* integer hour in [0, 23], `PPD.Greeting.getGreetingPrefix(hour)` shall return exactly one of `"Good morning"` (05–11), `"Good afternoon"` (12–17), or `"Good evening"` (18–23, 00–04), and no other string.

**Validates: Requirements 1.3, 1.4, 1.5, 1.6**

---

### Property 2: Greeting with name includes name; without name omits suffix

*For any* valid display name (1–50 printable characters) and any hour, `PPD.Greeting.buildGreeting(hour, name)` shall contain `", " + name`; when name is null or empty, the result shall contain no `","`.

**Validates: Requirements 1.7, 1.8**

---

### Property 3: Display name validation boundary

*For any* string of length 1–50, `PPD.Greeting.saveName` shall return `{ok: true}` and persist the value; for any string of length > 50, it shall return `{ok: false}` and leave the previously stored value unchanged.

**Validates: Requirements 2.2, 2.5**

---

### Property 4: Theme toggle is a round trip

*For any* starting theme (`"light"` or `"dark"`), calling `PPD.Theme.toggle()` twice in succession shall return the theme to the original value.

**Validates: Requirements 3.2**

---

### Property 5: Timer display format covers full range

*For any* integer number of seconds in [0, 5400] (0–90 minutes), `PPD.Timer.formatDisplay(seconds)` shall return a string matching the pattern `/^\d{2}:\d{2}$/` where the minute part is in [00, 90] and the second part is in [00, 59].

**Validates: Requirements 4.1**

---

### Property 6: Session duration validation boundary

*For any* integer in [1, 90], `PPD.Timer.setDuration` shall accept the value and return `{ok: true}`; for any integer outside [1, 90] or any non-integer, it shall return `{ok: false}` and leave the current duration unchanged.

**Validates: Requirements 4.8, 4.10**

---

### Property 7: Task addition is a round trip through storage

*For any* task description of 1–200 non-whitespace-only characters that does not match any existing incomplete task (case-insensitive, trimmed), calling `PPD.Tasks.add(description)` shall return `{ok: true}`, the task list length shall increase by exactly 1, and `PPD.Storage.get(KEYS.TASKS)` shall contain an entry with that trimmed description.

**Validates: Requirements 5.2, 5.6**

---

### Property 8: Duplicate task descriptions are rejected

*For any* task list containing at least one incomplete task with description D, submitting D in any combination of leading/trailing whitespace or case variation shall be rejected by both `PPD.Tasks.add` and `PPD.Tasks.edit` (when editing a different task to match D), returning `{ok: false}`.

**Validates: Requirements 5.3, 6.4**

---

### Property 9: Task description length boundary

*For any* string exceeding 200 characters, `PPD.Tasks.add` and `PPD.Tasks.edit` shall return `{ok: false}` and leave the task list unchanged.

**Validates: Requirements 5.5**

---

### Property 10: Completion toggle is a round trip

*For any* task, calling `PPD.Tasks.toggle(id)` twice in succession shall return the task's `completed` field to its original value.

**Validates: Requirements 7.2**

---

### Property 11: Sorting does not mutate persisted task order

*For any* task list and any sort option, calling `PPD.Tasks.setSort(option)` shall not change the order of tasks returned by `PPD.Storage.get(KEYS.TASKS)`; only the rendered display order shall change.

**Validates: Requirements 8.2, 8.5**

---

### Property 12: Quick Link URL validation

*For any* string that does not begin with `http://` or `https://`, or that exceeds 2048 characters, `PPD.Links.validateURL` shall return `false`; for any string beginning with `http://` or `https://` and of length ≤ 2048, it shall return `true`.

**Validates: Requirements 9.4**

---

### Property 13: Quick Links 50-link cap

*For any* link list of exactly 50 entries, calling `PPD.Links.add` with any valid label and URL shall return `{ok: false}` and leave the list at 50 entries.

**Validates: Requirements 9.8**

---

### Property 14: All persistence keys are prefixed with `ppd_`

*For any* storage write performed by any PPD module, the key used shall start with `"ppd_"`.

**Validates: Requirements 10.6**

---

## Error Handling

| Scenario | Handling |
|---|---|
| `localStorage` unavailable on page load | `PPD.Storage.available = false`; in-memory fallback; persistent top banner shown |
| `localStorage` write fails mid-session (quota exceeded) | `PPD.Storage.set` returns `false`; calling module shows non-blocking toast; data kept in memory |
| `localStorage` contains malformed JSON on load | `PPD.Storage.get` catches JSON parse error, returns `null`; module treats as empty/default |
| Task add/edit: empty description | Silent rejection (no error shown per requirement 5.4) |
| Task add/edit: duplicate description | Inline duplicate-warning adjacent to input; dismissed on next keystroke |
| Task add/edit: description > 200 chars | Inline error message showing limit |
| Display name > 50 chars | Inline error; previously saved name retained |
| Timer running when duration change attempted | Inline message: "Stop the timer before changing the duration." |
| Notification permission denied / Safari file:// | Fall through to `PPD.UI.showAlert` overlay for ≥ 5 s |
| AudioContext autoplay policy | `audioCtx.resume()` called inside user-gesture handler (Start button); `playBeep` is no-op if context suspended |
| Quick Link invalid URL | Inline validation message identifying the failing field |
| Quick Links cap (50) reached | Inline message: "Maximum of 50 links reached." |
| `crypto.randomUUID` unavailable (older Safari) | Fall back to `Date.now().toString() + Math.random().toString(36).slice(2)` |

---

## Testing Strategy

> **Note:** The requirements specify no test setup is required (NFR-1). The properties and strategy below document how the pure-function logic *should* be tested for any future maintainer who chooses to add tests. No test files are included in the initial deliverable.

### Dual Testing Approach

**Unit tests (example-based):** Verify specific scenarios, edge cases, and error conditions for each module function.

**Property-based tests:** Verify universal invariants across randomly generated inputs. The properties above (1–14) are the target test suite.

### Recommended Property-Based Testing Library

[**fast-check**](https://fast-check.dev/) is the recommended PBT library for JavaScript. It generates structured random inputs, shrinks failing examples to the minimal counterexample, and works without a build step via CDN.

Each property test should:
- Run a minimum of **100 iterations** per property
- Be tagged with a comment in the format:  
  `// Feature: personal-productivity-dashboard, Property N: <property_text>`
- Cover the arbitraries (generators) matching each input domain (e.g., `fc.integer({min:0, max:23})` for hour, `fc.string({minLength:1, maxLength:50})` for display name)

### Unit Test Focus Areas

| Module | Priority Test Cases |
|---|---|
| `PPD.Greeting.formatTime` | Midnight (00:00), noon (12:00), single-digit hours/minutes |
| `PPD.Greeting.formatDate` | Correct weekday/month names for known dates |
| `PPD.Timer.formatDisplay` | 0 s → `"00:00"`, 3600 s → `"60:00"`, 5399 s → `"89:59"` |
| `PPD.Timer.setDuration` | Boundary values: 1, 90, 0, 91 |
| `PPD.Tasks.isDuplicate` | Case variations, whitespace, completed vs incomplete tasks |
| `PPD.Tasks.sort` | Each sort option with tie scenarios |
| `PPD.Links.validateURL` | `ftp://`, `javascript:`, empty, 2049-char URL, valid http and https |
| `PPD.Storage` | Simulated quota-exceeded error, malformed JSON |
| `PPD.Theme.detect` | Three branches: persisted value, OS preference, neither |

### Integration / Smoke Tests (Manual)

The following must be verified manually across Chrome, Firefox, Edge, and Safari:

1. Dashboard loads in < 3 s on a local file (`file://`) — no console errors.
2. Theme toggle switches visual scheme and persists across reload.
3. Timer counts down, plays beep (or shows alert), and resets correctly.
4. Tasks add, edit, complete, delete, and sort without data loss across reload.
5. Quick Links add and open in new tab; cap at 50 enforced.
6. LocalStorage banner appears when storage is blocked (test in private-browsing mode in Firefox which blocks `localStorage`).
7. No overlapping or clipping of panels at 1280 × 800, 1024 × 768, and 375 × 812 (mobile).
