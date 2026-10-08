# Implementation Plan: Personal Productivity Dashboard

## Overview

Implement a standalone, client-side productivity dashboard delivered as three files (`index.html`, `css/style.css`, `js/app.js`). The codebase uses the IIFE + Namespace pattern (`PPD.*`) for full `file://` protocol compatibility — no ES module imports. All user data is persisted via `localStorage` under `ppd_*` keys. The build is incremental: scaffold first, then each module, then CSS polish, then wiring and integration.

---

## Tasks

- [x] 1. Scaffold project structure and HTML skeleton
  - Create `index.html` at the workspace root with a valid HTML5 doctype, `<head>` metadata, and a single `<body>` layout wrapper `#app`
  - Add placeholder `<section>` elements: `#panel-greeting`, `#panel-timer`, `#panel-tasks`, `#panel-links`
  - Add `<link rel="stylesheet" href="css/style.css">` in `<head>`
  - Add `<script src="js/app.js"></script>` just before `</body>` (no `type="module"`)
  - Create `css/style.css` as an empty file with a header comment
  - Create `js/app.js` as an empty IIFE shell: `(function () { 'use strict'; const PPD = {}; })();`
  - _Requirements: 13.1, 13.2, 13.3_

- [ ] 2. Implement `PPD.Storage` module
  - [-] 2.1 Write the `PPD.Storage` module inside `js/app.js`
    - Implement `get(key)`: JSON.parse from localStorage, return `null` on miss or parse error
    - Implement `set(key, value)`: JSON.stringify and write; return `false` if write fails
    - Implement `remove(key)`: delete key from localStorage
    - Set `PPD.Storage.available` to `false` and fall back to an in-memory `Map` if localStorage is inaccessible
    - Define the `KEYS` constant object with all six `ppd_*` key names
    - _Requirements: 10.1, 10.2, 10.6_

  - [ ]* 2.2 Write property test for `PPD.Storage` key prefix invariant
    - **Property 14: All persistence keys are prefixed with `ppd_`**
    - **Validates: Requirements 10.6**
    - Use fast-check to assert that every key in the `KEYS` object starts with `"ppd_"`

- [ ] 3. Implement `PPD.UI` module
  - [-] 3.1 Write the `PPD.UI` utility module inside `js/app.js`
    - Implement `qs(selector)` and `qsa(selector)` as shorthands for `querySelector` / `querySelectorAll`
    - Implement `showError(el, msg)`: insert or update an `.error-msg` sibling element adjacent to `el`
    - Implement `clearError(el)`: remove `.error-msg` adjacent to `el`
    - Implement `showBanner(msg)`: render a persistent non-blocking top banner (used for localStorage unavailable)
    - Implement `showToast(msg)`: render a brief dismissible notification (used for mid-session save failure)
    - Implement `showAlert(msg, durationMs)`: render a timed on-screen alert overlay (timer completion fallback)
    - _Requirements: 10.4, 10.5, 4.7_

- [ ] 4. Implement `PPD.Theme` module and CSS custom properties
  - [~] 4.1 Write the CSS custom properties and theme selectors in `css/style.css`
    - Define all design tokens under `:root` (light defaults): `--color-bg`, `--color-surface`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-accent-alt`, `--color-error`, `--color-success`, `--color-warning`, `--shadow-card`, `--radius-card`, `--font-family`
    - Define dark overrides under `[data-theme="dark"]`
    - _Requirements: 3.3, 11.3_

  - [~] 4.2 Write the `PPD.Theme` module inside `js/app.js`
    - Implement `detect()`: reads `ppd_theme` from storage → falls back to `prefers-color-scheme` → defaults to `"light"`
    - Implement `apply(theme)`: sets `data-theme` attribute on `<html>`
    - Implement `toggle()`: flips active theme, persists to `ppd_theme`, calls `apply`
    - Implement `current()`: returns the current `data-theme` attribute value
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [~] 4.3 Add inline theme-init `<script>` block in `<head>` of `index.html`
    - Write a minimal self-contained script (no reference to `PPD`) that reads `ppd_theme` from localStorage, detects `prefers-color-scheme`, and sets `data-theme` on `<html>` before the body renders
    - This must appear after `<link rel="stylesheet">` but before `</head>`
    - _Requirements: 3.5_

  - [~] 4.4 Add the theme toggle button to `index.html` and wire its click handler in `PPD.Theme`
    - Add a `<button id="btn-theme-toggle">` inside `index.html`; position it fixed top-right via CSS
    - Wire `onclick` in `PPD.Theme.init()` to call `PPD.Theme.toggle()`
    - _Requirements: 3.1, 3.2_

  - [ ]* 4.5 Write property test for `PPD.Theme` toggle round-trip
    - **Property 4: Theme toggle is a round trip**
    - **Validates: Requirements 3.2**
    - Use fast-check with `fc.constantFrom("light", "dark")` to assert two successive `toggle()` calls restore the original theme

- [ ] 5. Implement `PPD.Greeting` module
  - [~] 5.1 Write pure helper functions in `PPD.Greeting`
    - Implement `getGreetingPrefix(hour)`: returns `"Good morning"` (05–11), `"Good afternoon"` (12–17), `"Good evening"` (18–23 and 00–04)
    - Implement `formatTime(date)`: returns zero-padded `"HH:MM"` string
    - Implement `formatDate(date)`: returns `"Monday, 26 October 2025"` format
    - Implement `buildGreeting(hour, name)`: combines prefix with optional `", Name"` suffix
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [ ]* 5.2 Write property tests for `PPD.Greeting` pure functions
    - **Property 1: Greeting prefix covers all hours** — use `fc.integer({min:0, max:23})` to assert `getGreetingPrefix` always returns one of the three valid strings
    - **Property 2: Greeting with name includes name; without name omits suffix** — use `fc.string({minLength:1, maxLength:50})` and `fc.integer({min:0, max:23})`
    - **Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.7, 1.8**

  - [~] 5.3 Write `PPD.Greeting.saveName` and `PPD.Greeting.init`
    - Implement `saveName(rawInput)`: trim input; if 1–50 chars persist to `ppd_displayName`; if empty remove key; if > 50 return `{ok: false, error: "..."}` without changing storage
    - Implement `render()`: reads current time/date and display name, updates all greeting DOM elements
    - Implement `init()`: reads display name from storage, calls `render()` immediately, starts `setInterval(render, 60_000)`
    - Add the display name input, save button, and greeting text elements to `index.html` inside `#panel-greeting`
    - _Requirements: 1.9, 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 5.4 Write property test for display name validation boundary
    - **Property 3: Display name validation boundary**
    - **Validates: Requirements 2.2, 2.5**
    - Use `fc.string({minLength:1, maxLength:50})` and `fc.string({minLength:51})` to assert accept/reject boundary

- [~] 6. Checkpoint — Ensure Storage, UI, Theme, and Greeting pass all tests and render correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement `PPD.Timer` module
  - [~] 7.1 Write the `PPD.Timer` state machine and `formatDisplay`
    - Implement `formatDisplay(totalSeconds)`: pure function returning `"MM:SS"` zero-padded
    - Define internal state object: `{ state, sessionDuration, remaining, intervalId, audioCtx }`
    - Implement `start()`: transition `idle/paused → running`, start `setInterval(tick, 1000)`
    - Implement `stop()`: transition `running → paused`, clear interval
    - Implement `reset()`: clear interval, restore `remaining` to `sessionDuration`, state → `idle`
    - Implement `tick()`: decrement `remaining`, call `render`, if 0 call `complete`
    - _Requirements: 4.1, 4.3, 4.4, 4.5_

  - [ ]* 7.2 Write property test for `PPD.Timer.formatDisplay`
    - **Property 5: Timer display format covers full range**
    - **Validates: Requirements 4.1**
    - Use `fc.integer({min:0, max:5400})` to assert output matches `/^\d{2}:\d{2}$/`

  - [~] 7.3 Write `PPD.Timer.setDuration`, `complete`, `notify`, and `playBeep`
    - Implement `setDuration(minutes)`: validate 1–90 integer; if timer is running return `{ok: false, error: "..."}`;  persist to `ppd_sessionDuration`; call `reset`
    - Implement `complete()`: set state → `completed`, call `notify`, call `playBeep`
    - Implement `notify()`: request / use `Notification` API; fall back to `PPD.UI.showAlert` if permission denied or unavailable
    - Implement `playBeep()`: synthesise 440 Hz tone ≤ 5 s via `AudioContext`; resume `audioCtx` inside Start button handler to satisfy autoplay policy; no-op if unavailable
    - _Requirements: 4.6, 4.7, 4.8, 4.9, 4.10, 4.11_

  - [ ]* 7.4 Write property test for session duration validation boundary
    - **Property 6: Session duration validation boundary**
    - **Validates: Requirements 4.8, 4.10**
    - Use `fc.integer({min:1, max:90})` and `fc.integer().filter(n => n < 1 || n > 90)` to assert accept/reject boundary

  - [~] 7.5 Add timer HTML controls and wire `PPD.Timer.init`
    - Add timer display (`#timer-display`), Start / Stop / Reset buttons, and duration numeric input to `index.html` inside `#panel-timer`
    - Implement `init()`: load persisted duration (default 25), render display, wire all button click handlers
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

- [ ] 8. Implement `PPD.Tasks` module
  - [~] 8.1 Write `PPD.Tasks` data helpers: `isDuplicate`, `sort`, and `persist`
    - Implement `isDuplicate(text, excludeId?)`: case-insensitive trimmed match against incomplete tasks only
    - Implement `sort(option)`: pure function returning a sorted copy; sort options: `default`, `az`, `za`, `incomplete_first`, `complete_first`; tie-break by `createdAt` ascending
    - Implement `persist()`: write tasks array to `ppd_tasks` via `PPD.Storage.set`; return success boolean
    - Define `SORT_OPTIONS` constant and the Task schema (`id`, `description`, `completed`, `createdAt`)
    - Use `crypto.randomUUID()` for ID generation with fallback for older Safari
    - _Requirements: 5.3, 6.4, 8.2, 8.5_

  - [ ]* 8.2 Write property tests for `PPD.Tasks` duplicate detection and sort invariant
    - **Property 8: Duplicate task descriptions are rejected** — generate an arbitrary task list with at least one incomplete task, assert `isDuplicate` rejects case/whitespace variants
    - **Property 11: Sorting does not mutate persisted task order** — after `setSort(option)`, assert `PPD.Storage.get(KEYS.TASKS)` order is unchanged
    - **Validates: Requirements 5.3, 6.4, 8.2, 8.5**

  - [~] 8.3 Write `PPD.Tasks.add`, `edit`, `toggle`, `delete`, and `render`
    - Implement `add(rawText)`: validate 1–200 chars (reject silently if empty; show error if > 200); check duplicate; append new Task; persist; re-render
    - Implement `edit(id, rawText)`: validate 1–200 chars; check duplicate against other tasks; update description; persist within 500 ms; re-render; on persist failure show error and revert
    - Implement `toggle(id)`: flip `completed`; persist within 500 ms; re-render
    - Implement `delete(id)`: remove by id; persist within 500 ms; re-render
    - Implement `render()`: rebuild task list DOM using `sort()` for display order; apply strikethrough to completed tasks
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.6, 5.7, 5.8, 6.1, 6.2, 6.3, 6.5, 6.6, 6.7, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 8.4 Write property tests for `PPD.Tasks.add` round-trip and length boundary
    - **Property 7: Task addition is a round trip through storage** — use `fc.string({minLength:1, maxLength:200})` filtered to non-empty trimmed values; assert list length increases by 1 and storage contains the entry
    - **Property 9: Task description length boundary** — use `fc.string({minLength:201})` to assert `add` and `edit` return `{ok: false}` and leave list unchanged
    - **Validates: Requirements 5.2, 5.5, 5.6**

  - [ ]* 8.5 Write property test for completion toggle round-trip
    - **Property 10: Completion toggle is a round trip**
    - **Validates: Requirements 7.2**
    - Use `fc.uuid()` or a generated task id; assert two successive `toggle(id)` calls restore the original `completed` value

  - [~] 8.6 Write `PPD.Tasks.init` and `PPD.Tasks.setSort`; add task HTML controls
    - Implement `setSort(option)`: persist sort option to `ppd_sortOption`; re-render
    - Implement `init()`: load tasks from `ppd_tasks` (default `[]` on missing/malformed data); load sort option (default `"default"`); render list
    - Add task input, Add button, sort dropdown, and task list container to `index.html` inside `#panel-tasks`
    - _Requirements: 5.7, 5.8, 8.1, 8.3, 8.4_

- [~] 9. Checkpoint — Ensure Timer and Tasks modules pass all tests and render correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement `PPD.Links` module
  - [~] 10.1 Write `PPD.Links` data helpers: `validateURL`, `persist`, and data model
    - Implement `validateURL(url)`: returns `true` if url starts with `http://` or `https://` and length ≤ 2048; `false` otherwise
    - Implement `persist()`: write links array to `ppd_links` via `PPD.Storage.set`
    - Define the Link schema (`id`, `label`, `url`)
    - Use `crypto.randomUUID()` for ID generation with same fallback as Tasks
    - _Requirements: 9.1, 9.4_

  - [ ]* 10.2 Write property tests for `PPD.Links` URL validation and 50-link cap
    - **Property 12: Quick Link URL validation** — use `fc.string()` filtered to non-http/https strings and strings > 2048 chars; also generate valid http/https URLs; assert `validateURL` returns correct boolean
    - **Property 13: Quick Links 50-link cap** — build a list of exactly 50 links; assert `add` returns `{ok: false}` and list stays at 50
    - **Validates: Requirements 9.4, 9.8**

  - [~] 10.3 Write `PPD.Links.add`, `remove`, `render`, and `init`
    - Implement `add(label, url)`: validate label 1–100 chars and URL; check 50-link cap; append Link; persist within 500 ms; re-render; return `{ok, errors}` with field-level error messages
    - Implement `remove(id)`: remove by id; persist within 500 ms; re-render
    - Implement `render()`: rebuild links DOM; each link renders as a clickable button/card that opens URL in new tab (`target="_blank" rel="noopener noreferrer"`)
    - Implement `init()`: load links from `ppd_links` (default `[]`); render
    - Add label input, URL input, Add Link button, and links container to `index.html` inside `#panel-links`
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 9.6, 9.7, 9.8_

- [ ] 11. Implement `PPD.Init` bootstrap and wire all modules
  - [~] 11.1 Write `PPD.Init.run` and attach to `DOMContentLoaded`
    - Apply theme via `PPD.Theme.apply(PPD.Theme.detect())` as first step
    - Show localStorage unavailability banner via `PPD.UI.showBanner` if `PPD.Storage.available === false`
    - Call `PPD.Greeting.init()`, `PPD.Timer.init()`, `PPD.Tasks.init()`, `PPD.Links.init()` in sequence
    - Attach `document.addEventListener('DOMContentLoaded', PPD.Init.run)`
    - _Requirements: 2.4, 3.5, 10.3, 10.4_

- [ ] 12. Implement CSS layout and visual design
  - [~] 12.1 Write the base layout, grid, and panel styles in `css/style.css`
    - Implement CSS Grid `#app` with a 2×2 panel layout; stack to single column on viewports below 768 px
    - Style panel cards using `var(--color-surface)`, `var(--shadow-card)`, `var(--radius-card)`
    - Position `#btn-theme-toggle` as `position: fixed; top: 1rem; right: 1rem` so it is always reachable
    - _Requirements: 11.3, 12.1_

  - [~] 12.2 Write component-level styles: inputs, buttons, task list, timer display, links grid
    - Style the timer display (`#timer-display`) with a large monospace font
    - Style task items with strikethrough via `.task-completed` class
    - Style error messages (`.error-msg`) using `var(--color-error)`
    - Style the toast, banner, and alert overlay components defined in `PPD.UI`
    - Ensure consistent indentation (2 or 4 spaces, no tabs) throughout `css/style.css` and `js/app.js`
    - _Requirements: 7.2, 10.4, 10.5, 13.4, 13.5, 13.6_

- [ ] 13. Accessibility and browser compatibility pass
  - [~] 13.1 Audit and fix accessibility in `index.html`, `css/style.css`, and `js/app.js`
    - Add `aria-label` or visible `<label>` for every input and interactive control
    - Ensure the theme toggle button has a descriptive `aria-label` that reflects the current mode
    - Ensure dynamically inserted content (errors, toasts, task items) is announced by screen readers using `role="status"` or `aria-live` regions where appropriate
    - Verify all interactive elements are keyboard-focusable and have visible focus styles
    - _Requirements: 12.1_

  - [ ]* 13.2 Write unit tests for edge-case pure functions
    - Test `PPD.Greeting.formatTime`: midnight `00:00`, noon `12:00`, single-digit padding
    - Test `PPD.Greeting.formatDate`: correct weekday and month names for known dates
    - Test `PPD.Timer.formatDisplay`: `0` → `"00:00"`, `3600` → `"60:00"`, `5399` → `"89:59"`
    - Test `PPD.Tasks.sort`: each sort option with tie scenarios
    - Test `PPD.Links.validateURL`: `ftp://`, `javascript:`, empty, 2049-char, valid `http` and `https`
    - Test `PPD.Theme.detect`: persisted value branch, OS preference branch, neither branch
    - _Requirements: 1.1, 1.2, 4.1, 8.1, 9.4, 3.6, 3.7_

- [~] 14. Final checkpoint — Ensure all tests pass and full integration is verified
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical boundaries
- Property tests (Properties 1–14 from the design document) validate universal correctness invariants using fast-check
- Unit tests validate specific examples, edge cases, and error conditions
- The IIFE + Namespace pattern is mandatory — do not use `import`/`export` or `type="module"`
- The inline `<script>` in `<head>` (task 4.3) must be self-contained and must not reference the `PPD` namespace
- `crypto.randomUUID()` fallback must be applied everywhere IDs are generated (Tasks and Links modules)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "4.1", "4.2"] },
    { "id": 3, "tasks": ["4.3", "4.4", "5.1"] },
    { "id": 4, "tasks": ["4.5", "5.2", "5.3"] },
    { "id": 5, "tasks": ["5.4", "7.1"] },
    { "id": 6, "tasks": ["7.2", "7.3", "8.1"] },
    { "id": 7, "tasks": ["7.4", "7.5", "8.2", "8.3"] },
    { "id": 8, "tasks": ["8.4", "8.5", "8.6", "10.1"] },
    { "id": 9, "tasks": ["10.2", "10.3"] },
    { "id": 10, "tasks": ["11.1"] },
    { "id": 11, "tasks": ["12.1"] },
    { "id": 12, "tasks": ["12.2", "13.1"] },
    { "id": 13, "tasks": ["13.2"] }
  ]
}
```
