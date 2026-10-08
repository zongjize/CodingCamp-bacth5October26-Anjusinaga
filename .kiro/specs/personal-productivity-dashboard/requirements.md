# Requirements Document

## Introduction

A personal productivity dashboard is a standalone web application built with HTML, CSS, and Vanilla JavaScript. It runs entirely in the browser with no backend server, persisting all user data through the browser's Local Storage API. The dashboard surfaces four core productivity tools — a contextual greeting, a configurable focus timer, a task manager, and a quick-links launcher — alongside interactive enhancements such as light/dark mode, a custom display name, task sorting, and duplicate prevention. The application must load quickly, respond without noticeable lag, and present a clean, visually clear interface that works across all modern browsers.

---

## Glossary

- **Dashboard**: The single-page web application described in this document.
- **User**: The person operating the Dashboard in a browser.
- **LocalStorage**: The browser's `localStorage` Web Storage API used for client-side persistence.
- **Greeting_Panel**: The UI section that displays the current time, date, and a personalised greeting message.
- **Focus_Timer**: The UI section that implements a configurable countdown timer following the Pomodoro technique.
- **Session_Duration**: The countdown duration (in minutes) configured by the User for the Focus_Timer.
- **Task_Manager**: The UI section that allows the User to create, read, update, delete, and sort tasks.
- **Task**: A single to-do item consisting of at least a text description and a completion status.
- **Quick_Links**: The UI section that stores and displays user-defined shortcut links to external websites.
- **Link**: A user-defined record consisting of a label and a URL stored in the Quick_Links section.
- **Theme**: The visual colour scheme of the Dashboard, either "light" or "dark".
- **Display_Name**: A user-configurable name shown in the greeting message.
- **Theme_Toggle**: The UI control that switches the active Theme between light and dark.

---

## Requirements

### Requirement 1: Greeting Panel

**User Story:** As a User, I want to see the current time, date, and a personalised greeting based on the time of day, so that the Dashboard orients me immediately when I open it.

#### Acceptance Criteria

1. THE Greeting_Panel SHALL display the current local time in HH:MM format, updated every 60 seconds without requiring a page reload.
2. THE Greeting_Panel SHALL display the current local date in the format: full weekday name, day number, full month name, and four-digit year (e.g., "Monday, 26 October 2025").
3. WHEN the local hour is between 05:00 and 11:59 inclusive, THE Greeting_Panel SHALL display the greeting prefix "Good morning".
4. WHEN the local hour is between 12:00 and 17:59 inclusive, THE Greeting_Panel SHALL display the greeting prefix "Good afternoon".
5. WHEN the local hour is between 18:00 and 23:59 inclusive, THE Greeting_Panel SHALL display the greeting prefix "Good evening".
6. WHEN the local hour is between 00:00 and 04:59 inclusive, THE Greeting_Panel SHALL display the greeting prefix "Good evening".
7. WHEN a Display_Name of 1 to 50 characters has been saved, THE Greeting_Panel SHALL append ", " followed by the Display_Name to the greeting prefix (e.g., "Good morning, Alex").
8. WHEN no Display_Name has been saved, THE Greeting_Panel SHALL display the greeting prefix without a name suffix.
9. WHEN the local time crosses a period boundary (e.g., 11:59 → 12:00), THE Greeting_Panel SHALL update the greeting prefix to reflect the new period on the next 60-second tick.

---

### Requirement 2: Custom Display Name

**User Story:** As a User, I want to set and update my display name, so that the greeting feels personalised to me.

#### Acceptance Criteria

1. THE Dashboard SHALL provide an input field and a save control that allow the User to enter a Display_Name.
2. WHEN the User submits a non-empty Display_Name of 1 to 50 characters, THE Dashboard SHALL persist the Display_Name in LocalStorage under the key `ppd_displayName` and update the greeting to include the Display_Name.
3. WHEN the User submits an empty string as a Display_Name, THE Dashboard SHALL remove the `ppd_displayName` entry from LocalStorage and revert the greeting to display only "Good [morning/afternoon/evening]" without any name.
4. WHEN the Dashboard loads, THE Dashboard SHALL read the Display_Name from LocalStorage and populate the greeting within 100 milliseconds of the page becoming interactive, without requiring user interaction.
5. IF the User submits a Display_Name exceeding 50 characters, THEN THE Dashboard SHALL reject the input, retain the previously stored Display_Name unchanged in LocalStorage, and display an inline error message indicating the 50-character limit.

---

### Requirement 3: Light / Dark Mode

**User Story:** As a User, I want to toggle between a light and dark colour scheme, so that I can use the Dashboard comfortably in any lighting condition.

#### Acceptance Criteria

1. THE Dashboard SHALL render the Theme_Toggle control in a fixed, consistent position accessible on every page state, such that it remains interactable at all viewport sizes supported by the Dashboard.
2. WHEN the User activates the Theme_Toggle, THE Dashboard SHALL switch the active Theme from "light" to "dark" or from "dark" to "light".
3. WHEN a Theme change occurs, THE Dashboard SHALL apply the new Theme to all visible UI elements within 300 milliseconds, without requiring a page reload.
4. WHEN a Theme is set, THE Dashboard SHALL persist the active Theme value in LocalStorage under the key `ppd_theme`.
5. WHEN the Dashboard loads, THE Dashboard SHALL read the persisted Theme from LocalStorage and apply it before any UI content is painted to the screen.
6. IF no Theme value is found in LocalStorage AND the User's operating system reports a colour-scheme preference via `prefers-color-scheme`, THEN THE Dashboard SHALL apply the matching Theme ("light" or "dark").
7. IF no Theme value is found in LocalStorage AND no operating system colour-scheme preference is detected, THEN THE Dashboard SHALL default to the "light" Theme.
8. IF LocalStorage is unavailable, THEN THE Dashboard SHALL default to the "light" Theme for the session without writing any Theme value to storage.

---

### Requirement 4: Focus Timer

**User Story:** As a User, I want a configurable countdown timer, so that I can work in focused intervals and know when to take a break.

#### Acceptance Criteria

1. THE Focus_Timer SHALL display the remaining time in MM:SS format.
2. WHEN the Dashboard loads, THE Focus_Timer SHALL initialise the countdown to the persisted Session_Duration, defaulting to 25 minutes if no value is stored.
3. WHEN the User activates the Start control, THE Focus_Timer SHALL begin counting down one second per real-world second, accurate to within ±100 milliseconds per minute.
4. WHEN the User activates the Stop control while the Focus_Timer is running, THE Focus_Timer SHALL pause the countdown at the current remaining time.
5. WHEN the User activates the Reset control, THE Focus_Timer SHALL stop any active countdown and restore the remaining time to the configured Session_Duration.
6. WHEN the countdown reaches 00:00, THE Focus_Timer SHALL stop automatically and notify the User with a browser notification and an audible alert lasting no longer than 5 seconds.
7. IF the browser notification permission has not been granted, THEN THE Focus_Timer SHALL fall back to displaying a visible on-screen alert for at least 5 seconds when the countdown reaches 00:00.
8. THE Focus_Timer SHALL provide a numeric input that accepts a Session_Duration between 1 and 90 minutes inclusive, in whole-minute increments.
9. WHEN the User sets a new Session_Duration while the Focus_Timer is not running, THE Focus_Timer SHALL persist the value in LocalStorage under the key `ppd_sessionDuration` and reset the display to the new duration.
10. IF the User enters a Session_Duration outside the range 1–90 minutes, THEN THE Focus_Timer SHALL reject the input and display an inline validation message without altering the current Session_Duration.
11. IF the User attempts to set a new Session_Duration while the Focus_Timer is running, THEN THE Focus_Timer SHALL reject the input and display an inline message indicating the timer must be stopped before changing the duration.

---

### Requirement 5: To-Do List — Task Creation

**User Story:** As a User, I want to add tasks to a list, so that I can track what I need to accomplish.

#### Acceptance Criteria

1. THE Task_Manager SHALL provide a text input accepting up to 200 characters and an "Add" control for creating a new Task.
2. WHEN the User submits a non-empty task description, THE Task_Manager SHALL add a new Task with a completion status of "incomplete" and display it in the task list.
3. WHEN the User submits a task description that, after trimming leading and trailing whitespace, is identical (case-insensitive) to an existing incomplete Task description, THE Task_Manager SHALL reject the submission and set a duplicate_warning_displayed flag, rendering an inline duplicate-warning message adjacent to the input field. WHEN the User subsequently modifies the task description input while duplicate_warning_displayed is set, THE Task_Manager SHALL set the duplicate_warning_dismissed flag and remove the inline duplicate-warning message.
4. WHEN the User submits an empty task description, THE Task_Manager SHALL reject the submission without adding a Task or displaying an error.
5. IF the User submits a task description exceeding 200 characters, THEN THE Task_Manager SHALL reject the submission and display an inline error message indicating the character limit has been exceeded.
6. WHEN a Task is added, THE Task_Manager SHALL persist the updated task list to LocalStorage under the key `ppd_tasks`.
7. WHEN the Dashboard loads, THE Task_Manager SHALL read all persisted Tasks from LocalStorage and render them in the task list.
8. IF LocalStorage is unavailable or contains malformed data when the Dashboard loads, THEN THE Task_Manager SHALL render an empty task list.

---

### Requirement 6: To-Do List — Task Editing

**User Story:** As a User, I want to edit an existing task's description, so that I can correct mistakes or update what needs to be done.

#### Acceptance Criteria

1. THE Task_Manager SHALL provide an edit control for each Task in the task list.
2. WHEN the User activates the edit control for a Task, THE Task_Manager SHALL render an editable input pre-filled with the Task's current description, with the cursor positioned at the end of the text.
3. WHEN the User confirms an edit with a description that, after trimming leading and trailing whitespace, is between 1 and 200 characters and does not match any existing different Task description (case-insensitive), THE Task_Manager SHALL replace the Task's stored description with the trimmed value and persist the updated task list to LocalStorage within 500 milliseconds.
4. WHEN the User confirms an edit with a description that, after trimming leading and trailing whitespace, matches an existing different Task's description (case-insensitive), THE Task_Manager SHALL reject the edit, retain the input field with the rejected text still visible, and display an inline duplicate-warning message adjacent to the input field.
5. IF the User confirms an edit with a description that, after trimming leading and trailing whitespace, is empty (zero characters), THEN THE Task_Manager SHALL reject the edit, retain the input field, and display an inline validation message indicating the description cannot be empty.
6. WHEN the User cancels an edit, THE Task_Manager SHALL discard all changes and restore the Task's display to its original description without modifying LocalStorage.
7. IF the Task_Manager fails to persist the updated task list to LocalStorage, THEN THE Task_Manager SHALL display an error message indicating the save failed and revert the Task's description to its value before the edit.

---

### Requirement 7: To-Do List — Task Completion and Deletion

**User Story:** As a User, I want to mark tasks as done and delete tasks I no longer need, so that I can keep my list current and uncluttered.

#### Acceptance Criteria

1. THE Task_Manager SHALL provide a checkbox or toggle control for each Task to mark it as complete or incomplete.
2. WHEN the User toggles the completion control, THE Task_Manager SHALL update the Task's completion status: completed Tasks SHALL have strikethrough text applied; incomplete Tasks SHALL have strikethrough text removed.
3. WHEN a Task's completion status changes, THE Task_Manager SHALL persist the updated task list to LocalStorage within 500 milliseconds.
4. THE Task_Manager SHALL provide a delete control for each Task.
5. WHEN the User activates the delete control for a Task, THE Task_Manager SHALL remove the Task from the list immediately within the same user interaction.
6. WHEN a Task is deleted, THE Task_Manager SHALL persist the updated task list to LocalStorage within 500 milliseconds.
7. IF LocalStorage is unavailable or a write fails when persisting a completion or deletion change, THEN THE Task_Manager SHALL retain the in-memory UI state of the change (optimistic update) and display an inline error message indicating that the change could not be persisted; THE Task_Manager SHALL NOT revert the displayed task state to the last successfully persisted state.

---

### Requirement 8: To-Do List — Task Sorting

**User Story:** As a User, I want to sort my task list, so that I can view my tasks in the order most useful to me.

#### Acceptance Criteria

1. THE Task_Manager SHALL provide a sort control offering at minimum the following sort options: "Default (creation order)", "A–Z", "Z–A", "Incomplete first", "Complete first".
2. WHEN the User selects a sort option, THE Task_Manager SHALL reorder the displayed task list according to that option without altering the persisted order of Tasks in LocalStorage.
3. WHEN the User selects a sort option, THE Task_Manager SHALL persist the selected sort option to LocalStorage under the key `ppd_sortOption`.
4. WHEN the Dashboard loads, THE Task_Manager SHALL read the sort option from LocalStorage and apply it; IF no persisted sort option is found, THEN THE Task_Manager SHALL default to "Default (creation order)".
5. WHEN two or more Tasks are equal under the selected sort criterion, THE Task_Manager SHALL break ties by creation order (oldest first).

---

### Requirement 9: Quick Links — Managing Links

**User Story:** As a User, I want to add, view, and remove quick-access links to my favourite websites, so that I can open them with a single click from the Dashboard.

#### Acceptance Criteria

1. THE Quick_Links section SHALL provide an input field for a link label (up to 100 characters) and a URL (up to 2048 characters), and an "Add Link" control.
2. WHEN the User submits a label of 1–100 characters and a valid URL of 1–2048 characters beginning with `http://` or `https://`, THE Quick_Links section SHALL add the Link, display it as a clickable button or card, and persist the updated link list to LocalStorage under the key `ppd_links` within 500 milliseconds.
3. WHEN the User clicks a displayed Link, THE Quick_Links section SHALL open the Link's URL in a new browser tab.
4. IF the User submits an empty label, a label exceeding 100 characters, an empty URL, a URL exceeding 2048 characters, or a URL not beginning with `http://` or `https://`, THEN THE Quick_Links section SHALL reject the submission, retain the submitted input values in the fields, and display an inline validation message identifying which field failed.
5. THE Quick_Links section SHALL provide a remove control for each displayed Link.
6. WHEN the User activates the remove control for a Link, THE Quick_Links section SHALL remove it from the display immediately and persist the updated link list to LocalStorage within 500 milliseconds.
7. WHEN the Dashboard loads and LocalStorage contains persisted Links, THE Quick_Links section SHALL read and render all persisted Links; IF no Links are persisted, THE Quick_Links section SHALL render an empty links area.
8. IF the total number of stored Links would exceed 50 after adding a new Link, THEN THE Quick_Links section SHALL reject the submission and display an inline message indicating the maximum of 50 links has been reached.

---

### Requirement 10: Data Persistence Integrity

**User Story:** As a User, I want my data to be reliably saved and restored between sessions, so that I never lose my tasks, links, timer settings, or preferences.

#### Acceptance Criteria

1. THE Dashboard SHALL use LocalStorage as the sole persistence mechanism; no network requests SHALL be made for storing or retrieving user data.
2. WHEN the User modifies any persistent data (tasks, links, timer duration, display name, theme, sort option), THE Dashboard SHALL write the updated value to LocalStorage before the next user interaction is processed.
3. WHEN the Dashboard initialises, THE Dashboard SHALL read all persisted keys from LocalStorage and restore the corresponding application state before the UI becomes interactive.
4. WHEN LocalStorage is unavailable (e.g., private-browsing restrictions), THE Dashboard SHALL display a single, non-blocking warning banner informing the User that data will not be saved; the banner SHALL persist for the full session and SHALL NOT block any feature.
5. IF a LocalStorage write fails mid-session (e.g., storage quota exceeded), THEN THE Dashboard SHALL retain the affected data in memory for the remainder of the session and display a non-blocking notification indicating that the change could not be persisted.
6. THE Dashboard SHALL store all persisted data under keys prefixed with `ppd_` to avoid collisions with other applications sharing the same origin.

---

### Requirement 11: Performance and Responsiveness

**User Story:** As a User, I want the Dashboard to load instantly and respond without lag, so that it does not interrupt my workflow.

#### Acceptance Criteria

1. THE Dashboard SHALL complete initial render and become fully interactive within 3 seconds when loaded over a connection with a minimum download speed of 10 Mbps on a standard desktop browser.
2. WHEN the User interacts with any control (button, input, or toggle), THE Dashboard SHALL reflect the change in the UI within 100 milliseconds of the interaction event.
3. THE Dashboard SHALL be delivered as a single HTML file that references exactly one CSS file and one JavaScript file, with no requests made to external domains or runtime dependency URLs during load.
4. IF the Dashboard does not become fully interactive within 5 seconds of the load event, THEN THE Dashboard SHALL display a loading indicator visible to the User until interactivity is achieved.

---

### Requirement 12: Browser Compatibility

**User Story:** As a User, I want the Dashboard to work in my preferred modern browser, so that I am not restricted to a specific environment.

#### Acceptance Criteria

1. THE Dashboard SHALL render and function correctly in the current stable releases of Chrome, Firefox, Edge, and Safari, where "render and function correctly" means all visual elements are visible without overlapping or clipping, all interactive controls respond to user input, and no JavaScript errors are thrown in the browser console.
2. THE Dashboard SHALL be usable as a standalone web page opened directly from the file system using the `file://` protocol without requiring a web server, where "usable" means all Dashboard features available in the browser-hosted version are also available, and no browser security errors block functionality.
3. WHEN the Dashboard is opened via the `file://` protocol, THE Dashboard SHALL load all required assets (scripts, styles, and data files) using relative paths, such that no asset request fails due to an absolute or origin-based URL.

---

### Requirement 13: Code Structure and Maintainability

**User Story:** As a developer, I want the project to follow a clear folder structure with minimal, well-organised files, so that the codebase is easy to read and extend.

#### Acceptance Criteria

1. THE Dashboard project SHALL contain exactly one CSS file located in a `css/` directory.
2. THE Dashboard project SHALL contain exactly one JavaScript file located in a `js/` directory.
3. THE Dashboard SHALL be composed of a single root `index.html` file.
4. THE Dashboard codebase SHALL use consistent indentation of 2 or 4 spaces (no tab characters) throughout all files.
5. THE Dashboard codebase SHALL use descriptive variable and function names of at least 3 characters that reflect their purpose, with no single-letter names outside of loop counters.
6. IF a code block's behaviour is not inferrable from its name and structure alone, THEN THE Dashboard codebase SHALL include an inline comment of at least 5 words on that block explaining its purpose.
