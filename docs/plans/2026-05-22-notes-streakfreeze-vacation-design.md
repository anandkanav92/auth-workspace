# Completion Notes, Streak Freeze, and Vacation Mode Design

**Goal:** Add three features that reduce habit abandonment and enrich completion data: per-completion notes with effort rating, automatic streak freeze (1 per week), and a global vacation mode.

**Architecture:** Extends existing PocketBase collections (completions) and adds one new collection (user_settings). All streak freeze logic is computation-only with no schema changes. Vacation mode uses a user-level settings record.

**Tech Stack:** React 19, Vite 8, PocketBase, inline styles, Firebase Auth (unchanged)

---

## Feature 1: Completion Notes + Effort Slider

### Data Model

Extend PocketBase `completions` collection with two new optional fields:
- `effort` (number, 0-10, default null)
- `notes` (text, default "")

### UX Flow

1. User taps checkbox to complete a habit. Completion is saved immediately (optimistic update, same as today).
2. A bottom sheet slides up with:
   - Habit name + icon as header context
   - Effort slider (0-10). Labels: "0 = No effort" to "10 = Max effort". Horizontal range input with colored fill.
   - Notes textarea (2-3 lines, optional, placeholder: "How did it go?")
   - "Save" button and "Skip" link
3. "Save" patches effort + notes onto the existing completion record via `pb.collection("completions").update(id, { effort, notes })`.
4. "Skip" or backdrop tap closes the sheet. Completion stands, no effort/notes saved.

### Viewing Notes Over Time

In HabitDetail bottom sheet, under RECENT HISTORY:
- Streak dots that have notes/effort show a subtle indicator (small line under the dot)
- Tapping a dot with notes expands inline to show the note text + effort value

### State Change in useHabits

Completions state changes from `{ key: true }` to `{ key: { effort, notes, id } }` so we can:
- Access the PocketBase record ID for updates
- Display effort/notes in UI without extra fetches

---

## Feature 2: Streak Freeze (Auto 1/Week)

### Algorithm

Current streak logic: walk backward day-by-day; if a scheduled day has zero completions, streak breaks.

New logic:
1. Walk backward same as today, but track a weekly freeze budget
2. Each ISO week (Mon-Sun) gets 1 freeze
3. When a scheduled day has no completions, consume the freeze for that week instead of breaking
4. If a second miss happens in the same week, streak breaks
5. Frozen days do NOT count as streak days (streak of 3 = 3 actual completed days)

### No Data Model Changes

Purely a computation change. The freeze is implicit in the algorithm.

### Visual Indicator

In StreakDots, frozen days show as a blue/gray dot (not red) with a snowflake indicator, so users understand why their streak survived. Occurrences gain a third state: `done`, `missed`, or `frozen`.

### Where Streaks Are Calculated

- `useAnalytics.js` lines 57-68 (global currentStreak) and lines 136-145 (per-habit streak)
- `getLast5Occurrences` in `constants.js` needs to return frozen state

---

## Feature 3: Global Vacation Mode

### Data Model

New PocketBase collection `user_settings`:
- `userId` (text, indexed)
- `vacationMode` (boolean, default false)
- `vacationStart` (text, date string, nullable)

This gives a clean place for future user-level settings without new collections each time.

### Behavior When Vacation Is ON

1. Daily view shows banner: "Vacation mode -- habits paused" with a "Resume" button
2. All habit rows are hidden or shown grayed-out
3. Streak calculations skip all days during vacation entirely -- no freezes consumed, no streak broken, no missed days counted
4. Completions are still possible if user explicitly navigates to a habit
5. Analytics exclude vacation days from completion rate calculations

### Toggle Location

Small toggle in the user bar at the top of the daily view (next to sign-out). Tapping shows confirmation: "Pause all habits? Your streaks will be preserved."

### Hook Changes

`useHabits` returns `vacationMode` and `toggleVacation()`. The hook fetches/subscribes to `user_settings` alongside habits/categories/completions.

---

## Files Affected

- `src/hooks/useHabits.js` — completions state shape, toggleCompletion signature, vacation mode, user_settings subscription
- `src/hooks/useAnalytics.js` — streak freeze algorithm, vacation day exclusion
- `src/data/constants.js` — getLast5Occurrences returns frozen state
- `src/components/StreakDots.jsx` — third dot color (frozen), note indicator
- `src/components/HabitDetail.jsx` — expandable notes on dots, effort display
- `src/components/CompletionNotes.jsx` — NEW: bottom sheet for effort + notes after completion
- `src/App.jsx` — wire up completion notes sheet, vacation banner, vacation toggle
- PocketBase schema — extend completions, add user_settings collection
