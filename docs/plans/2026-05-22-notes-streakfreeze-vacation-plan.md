# Completion Notes, Streak Freeze & Vacation Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-completion notes with effort slider, automatic streak freeze (1 miss/week forgiven), and global vacation mode to the habit tracker.

**Architecture:** Extends PocketBase `completions` collection with `effort`/`notes` fields, adds new `user_settings` collection for vacation state. Streak freeze is computation-only (no schema change). Completions state changes from `{ key: true }` to `{ key: { id, effort, notes } }` throughout the app.

**Tech Stack:** React 19, Vite 8, PocketBase, all inline styles, Firebase Auth via `@myorg/auth-google`

**Design doc:** `docs/plans/2026-05-22-notes-streakfreeze-vacation-design.md`

---

### Task 1: Change completions state shape in useHabits

The completions map currently stores `{ "habitId-YYYY-MM-DD": true }`. Change it to store `{ "habitId-YYYY-MM-DD": { id, effort, notes } }` so we have the PocketBase record ID (needed to update effort/notes later) and the data itself.

**Files:**
- Modify: `src/hooks/useHabits.js`

**Step 1: Update init() — completions map builder (line 122-124)**

Replace:
```js
const compsMap = {};
compsRes.forEach(r => { compsMap[`${r.habitId}-${r.dateStr}`] = true; });
setCompletions(compsMap);
```

With:
```js
const compsMap = {};
compsRes.forEach(r => {
  compsMap[`${r.habitId}-${r.dateStr}`] = {
    id: r.id,
    effort: r.effort ?? null,
    notes: r.notes || "",
  };
});
setCompletions(compsMap);
```

**Step 2: Update realtime subscription for completions (line 149-158)**

Replace:
```js
pb.collection("completions").subscribe("*", (e) => {
  if (e.record.userId !== userId) return;
  const key = `${e.record.habitId}-${e.record.dateStr}`;
  setCompletions(prev => {
    const next = { ...prev };
    if (e.action === "delete") { delete next[key]; }
    else { next[key] = true; }
    return next;
  });
});
```

With:
```js
pb.collection("completions").subscribe("*", (e) => {
  if (e.record.userId !== userId) return;
  const key = `${e.record.habitId}-${e.record.dateStr}`;
  setCompletions(prev => {
    const next = { ...prev };
    if (e.action === "delete") { delete next[key]; }
    else {
      next[key] = {
        id: e.record.id,
        effort: e.record.effort ?? null,
        notes: e.record.notes || "",
      };
    }
    return next;
  });
});
```

**Step 3: Update toggleCompletion (line 206-237)**

The optimistic update currently sets `next[key] = true`. Change it to set a placeholder object, and capture the created record's ID.

Replace the entire `toggleCompletion` callback:
```js
const toggleCompletion = useCallback(async (habitId, dateStr) => {
  const key = `${habitId}-${dateStr}`;
  const existing = completions[key];
  const isDone = !!existing;

  // Optimistic update
  setCompletions(prev => {
    const next = { ...prev };
    if (isDone) { delete next[key]; }
    else { next[key] = { id: "__pending__", effort: null, notes: "" }; }
    return next;
  });

  try {
    if (isDone) {
      const recordId = existing.id;
      if (recordId && recordId !== "__pending__") {
        await pb.collection("completions").delete(recordId);
      } else {
        const records = await pb.collection("completions").getList(1, 1, {
          filter: `userId="${userId}" && habitId="${habitId}" && dateStr="${dateStr}"`,
        });
        if (records.items.length > 0) {
          await pb.collection("completions").delete(records.items[0].id);
        }
      }
    } else {
      const record = await pb.collection("completions").create({ userId, habitId, dateStr });
      // Update with real record ID (realtime sub may also do this, but be safe)
      setCompletions(prev => {
        const next = { ...prev };
        if (next[key]) {
          next[key] = { ...next[key], id: record.id };
        }
        return next;
      });
    }
  } catch (err) {
    // Revert optimistic update on failure
    setCompletions(prev => {
      const next = { ...prev };
      if (isDone) { next[key] = existing; } else { delete next[key]; }
      return next;
    });
    console.error("toggleCompletion failed:", err);
  }
}, [userId, completions]);
```

**Step 4: Add updateCompletion function after toggleCompletion**

This patches effort/notes onto an existing completion record.

```js
const updateCompletion = useCallback(async (habitId, dateStr, data) => {
  const key = `${habitId}-${dateStr}`;
  const existing = completions[key];
  if (!existing || !existing.id || existing.id === "__pending__") return;

  // Optimistic update
  setCompletions(prev => ({
    ...prev,
    [key]: { ...prev[key], ...data },
  }));

  try {
    await pb.collection("completions").update(existing.id, data);
  } catch (err) {
    // Revert
    setCompletions(prev => ({
      ...prev,
      [key]: existing,
    }));
    console.error("updateCompletion failed:", err);
  }
}, [completions]);
```

**Step 5: Update the safety filter (line 251-260)**

The filter currently does `userCompletions[key] = completions[key]` — this still works since it copies the object value. No change needed, but verify.

**Step 6: Add updateCompletion to the return object (line 262-273)**

Add `updateCompletion` to the returned object.

**Step 7: Fix all places that read completions as truthy**

Throughout `App.jsx`, completions are checked as `!!completions[key]`. Since the value is now an object (truthy) or absent, `!!completions[key]` still works — no changes needed in App.jsx for truthiness checks.

**Step 8: Verify and commit**

Run: `cd /Users/kanava/ai_projects/auth-workspace && pnpm --filter habit-tracker run build`
Expected: Build succeeds with no errors.

```bash
git add apps/habit-tracker/src/hooks/useHabits.js
git commit -m "feat: change completions state to store id/effort/notes object"
```

---

### Task 2: CompletionNotes bottom sheet component

Create the bottom sheet that appears after completing a habit, showing effort slider + notes textarea.

**Files:**
- Create: `src/components/CompletionNotes.jsx`

**Step 1: Create the component**

```jsx
import { useState } from "react";

const EFFORT_LABELS = ["None", "", "", "", "", "Medium", "", "", "", "", "Max"];
const EFFORT_COLORS = [
  "#10B981", "#22c55e", "#84cc16", "#a3e635", "#eab308",
  "#f59e0b", "#f97316", "#ef4444", "#dc2626", "#b91c1c", "#991b1b",
];

export default function CompletionNotes({ habit, onSave, onSkip }) {
  const [effort, setEffort] = useState(5);
  const [notes, setNotes] = useState("");

  return (
    <div
      onClick={onSkip}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
        zIndex: 1100, display: "flex", alignItems: "flex-end", justifyContent: "center",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#ffffff", borderRadius: "20px 20px 0 0",
          width: "100%", maxWidth: 600,
          padding: "24px 20px 40px", position: "relative",
          border: "1px solid #e0e0eb", borderBottom: "none",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.08)",
        }}
      >
        <style>{`
          @keyframes slideUpNotes {
            from { transform: translateY(40px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          .notes-inner { animation: slideUpNotes 0.25s ease; }
        `}</style>
        <div className="notes-inner">
          {/* Drag handle */}
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "#d0d0e0", margin: "0 auto 16px" }} />

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{habit.icon || "✅"}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e" }}>
              {habit.name}
            </div>
            <div style={{
              fontSize: 11, color: "#10B981", fontWeight: 600,
              fontFamily: "'Space Mono', monospace", marginTop: 2,
            }}>
              COMPLETED
            </div>
          </div>

          {/* Effort slider */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              marginBottom: 8,
            }}>
              <span style={{
                fontSize: 11, fontWeight: 700, color: "#888",
                fontFamily: "'Space Mono', monospace", letterSpacing: "1px",
              }}>
                EFFORT
              </span>
              <span style={{
                fontSize: 20, fontWeight: 700,
                color: EFFORT_COLORS[effort],
              }}>
                {effort}
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={10}
              value={effort}
              onChange={(e) => setEffort(Number(e.target.value))}
              style={{
                width: "100%", height: 6, appearance: "none",
                background: `linear-gradient(to right, #10B981, #eab308, #dc2626)`,
                borderRadius: 3, outline: "none",
                cursor: "pointer",
              }}
            />
            <div style={{
              display: "flex", justifyContent: "space-between", marginTop: 4,
            }}>
              <span style={{ fontSize: 9, color: "#aaa", fontFamily: "'Space Mono', monospace" }}>
                No effort
              </span>
              <span style={{ fontSize: 9, color: "#aaa", fontFamily: "'Space Mono', monospace" }}>
                Max effort
              </span>
            </div>
          </div>

          {/* Notes textarea */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: "#888",
              fontFamily: "'Space Mono', monospace", letterSpacing: "1px",
              marginBottom: 8,
            }}>
              NOTES
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it go?"
              rows={3}
              style={{
                width: "100%", padding: "10px 12px",
                borderRadius: 10, border: "1px solid #e0e0eb",
                background: "#f9f9fc", fontSize: 13,
                fontFamily: "'DM Sans', sans-serif",
                color: "#333", resize: "none", outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onSkip}
              style={{
                flex: 1, padding: "12px 0", borderRadius: 10,
                border: "1px solid #e0e0eb", background: "#f9f9fc",
                fontSize: 13, fontWeight: 600, color: "#999",
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Skip
            </button>
            <button
              onClick={() => onSave({ effort, notes })}
              style={{
                flex: 2, padding: "12px 0", borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, #3B82F6, #2563EB)",
                fontSize: 13, fontWeight: 600, color: "#fff",
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                boxShadow: "0 2px 8px rgba(59,130,246,0.3)",
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify and commit**

Run: `cd /Users/kanava/ai_projects/auth-workspace && pnpm --filter habit-tracker run build`
Expected: Build succeeds (component is created but not imported yet).

```bash
git add apps/habit-tracker/src/components/CompletionNotes.jsx
git commit -m "feat: add CompletionNotes bottom sheet component"
```

---

### Task 3: Wire CompletionNotes into App.jsx

When the user completes a habit (checkbox tap), show the CompletionNotes sheet. If they save, patch the completion record.

**Files:**
- Modify: `src/App.jsx`

**Step 1: Add import (after line 11)**

Add:
```js
import CompletionNotes from "./components/CompletionNotes";
```

**Step 2: Add state for the notes sheet (after line 64)**

Add:
```js
const [completionNotesHabit, setCompletionNotesHabit] = useState(null);
const [completionNotesDateStr, setCompletionNotesDateStr] = useState(null);
```

**Step 3: Extract updateCompletion from useHabits (line 46-57)**

Add `updateCompletion` to the destructured return:
```js
const {
  habits,
  categories,
  completions,
  loading: dataLoading,
  addHabit,
  updateHabit,
  deleteHabit,
  toggleCompletion,
  updateCompletion,
  addCategory,
  getCategory,
} = useHabits(user.uid);
```

**Step 4: Replace checkbox onClick handler (around line 448-452)**

The current handler:
```js
onClick={(e) => {
  e.stopPropagation();
  toggleCompletion(habit.id, dateStr);
}}
```

Replace with:
```js
onClick={(e) => {
  e.stopPropagation();
  const key = `${habit.id}-${dateStr}`;
  const isDone = !!completions[key];
  toggleCompletion(habit.id, dateStr);
  // Show notes sheet only when completing (not uncompleting)
  if (!isDone) {
    setCompletionNotesHabit(habit);
    setCompletionNotesDateStr(dateStr);
  }
}}
```

**Step 5: Add CompletionNotes sheet to the render (after HabitForm, before the closing `</div>` of the root)**

Add before `</div>` at line 699:
```jsx
{/* Completion notes sheet */}
{completionNotesHabit && (
  <CompletionNotes
    habit={completionNotesHabit}
    onSave={({ effort, notes }) => {
      updateCompletion(completionNotesHabit.id, completionNotesDateStr, { effort, notes });
      setCompletionNotesHabit(null);
      setCompletionNotesDateStr(null);
    }}
    onSkip={() => {
      setCompletionNotesHabit(null);
      setCompletionNotesDateStr(null);
    }}
  />
)}
```

**Step 6: Verify and commit**

Run: `cd /Users/kanava/ai_projects/auth-workspace && pnpm --filter habit-tracker run build`
Expected: Build succeeds.

```bash
git add apps/habit-tracker/src/App.jsx
git commit -m "feat: wire CompletionNotes sheet into daily view checkbox flow"
```

---

### Task 4: Show effort/notes in HabitDetail

When viewing a habit's recent history, dots that have effort/notes should show an indicator, and tapping expands them.

**Files:**
- Modify: `src/components/StreakDots.jsx`
- Modify: `src/components/HabitDetail.jsx`
- Modify: `src/data/constants.js` (getLast5Occurrences)

**Step 1: Extend getLast5Occurrences to include effort/notes (constants.js, line 62-86)**

Replace the `getLast5Occurrences` function:
```js
export function getLast5Occurrences(habit, completions, viewDate) {
  const results = [];
  const maxOccurrences = 5;
  const maxLookbackDays = 90;

  const cursor = new Date(viewDate);
  cursor.setDate(cursor.getDate() - 1);

  for (let i = 0; i < maxLookbackDays && results.length < maxOccurrences; i++) {
    const ourDay = getJsDayToOurDay(cursor.getDay());

    if (habit.days.includes(ourDay)) {
      const dateStr = toDateStr(cursor);
      const key = `${habit.id}-${dateStr}`;
      const completion = completions[key];
      results.push({
        date: dateStr,
        done: !!completion,
        effort: completion ? (completion.effort ?? null) : null,
        notes: completion ? (completion.notes || "") : "",
      });
    }

    cursor.setDate(cursor.getDate() - 1);
  }

  return results;
}
```

**Step 2: Update StreakDots to show note indicator (StreakDots.jsx)**

Replace the entire component:
```jsx
import { useState } from "react";

export default function StreakDots({ occurrences, size = "small", onToggle }) {
  const isLarge = size === "large";
  const dotSize = isLarge ? 16 : 8;
  const gap = isLarge ? 12 : 4;
  const [expandedIdx, setExpandedIdx] = useState(null);

  // Show most recent on right — occurrences come newest-first, reverse for display
  const display = [...occurrences].reverse();

  const formatShortDate = (dateStr) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap }}>
        {display.map((occ, i) => {
          const hasNotes = occ.notes || occ.effort !== null;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div
                onClick={isLarge ? () => {
                  if (hasNotes) setExpandedIdx(expandedIdx === i ? null : i);
                  if (onToggle) onToggle(occ.date);
                } : undefined}
                style={{
                  width: dotSize, height: dotSize, borderRadius: "50%",
                  background: occ.done ? "#10B981" : "#E8453C",
                  cursor: isLarge ? "pointer" : "default",
                  transition: "background 0.2s ease",
                }}
              />
              {/* Note indicator line */}
              {isLarge && hasNotes && (
                <div style={{
                  width: 8, height: 2, borderRadius: 1,
                  background: "#3B82F6", marginTop: -2,
                }} />
              )}
              {isLarge && !hasNotes && <div style={{ height: 2 }} />}
              {isLarge && (
                <span style={{ fontSize: 9, color: "#aaa", fontFamily: "'Space Mono', monospace", whiteSpace: "nowrap" }}>
                  {formatShortDate(occ.date)}
                </span>
              )}
            </div>
          );
        })}
        {display.length === 0 && (
          <span style={{ fontSize: isLarge ? 12 : 10, color: "#ccc" }}>
            {isLarge ? "No history yet" : ""}
          </span>
        )}
      </div>

      {/* Expanded note card */}
      {isLarge && expandedIdx !== null && display[expandedIdx] && (display[expandedIdx].notes || display[expandedIdx].effort !== null) && (
        <div style={{
          padding: "8px 12px", background: "#f9f9fc", borderRadius: 8,
          border: "1px solid #e8e8f0", fontSize: 12, color: "#555",
        }}>
          {display[expandedIdx].effort !== null && (
            <div style={{
              fontSize: 11, fontWeight: 600, color: "#888",
              fontFamily: "'Space Mono', monospace", marginBottom: display[expandedIdx].notes ? 4 : 0,
            }}>
              Effort: {display[expandedIdx].effort}/10
            </div>
          )}
          {display[expandedIdx].notes && (
            <div style={{ lineHeight: 1.5, whiteSpace: "pre-line" }}>
              {display[expandedIdx].notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Add hint text in HabitDetail (HabitDetail.jsx, line 88-91)**

Replace the "Tap a dot to toggle" paragraph:
```jsx
<p style={{ margin: "8px 0 0", fontSize: 10, color: "#ccc", fontFamily: "'Space Mono', monospace" }}>
  Tap a dot to toggle · blue line = has notes
</p>
```

**Step 4: Verify and commit**

Run: `cd /Users/kanava/ai_projects/auth-workspace && pnpm --filter habit-tracker run build`
Expected: Build succeeds.

```bash
git add apps/habit-tracker/src/data/constants.js apps/habit-tracker/src/components/StreakDots.jsx apps/habit-tracker/src/components/HabitDetail.jsx
git commit -m "feat: show effort/notes indicators on streak dots with expandable cards"
```

---

### Task 5: Streak freeze algorithm

Update streak calculations to forgive 1 missed scheduled day per ISO week. Also update `getLast5Occurrences` to return a `frozen` state.

**Files:**
- Modify: `src/data/constants.js`
- Modify: `src/hooks/useAnalytics.js`

**Step 1: Add getISOWeekKey helper to constants.js**

Add after the `getJsDayToOurDay` function (after line 36):
```js
/** Returns "YYYY-WNN" ISO week key for a given date. */
export function getISOWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
```

**Step 2: Update getLast5Occurrences to include frozen state (constants.js)**

This replaces the version from Task 4. We add streak-freeze awareness to the occurrence list so StreakDots can display frozen dots.

Replace `getLast5Occurrences`:
```js
export function getLast5Occurrences(habit, completions, viewDate) {
  const results = [];
  const maxOccurrences = 5;
  const maxLookbackDays = 90;

  // Track freezes used per ISO week
  const freezeUsed = {};

  const cursor = new Date(viewDate);
  cursor.setDate(cursor.getDate() - 1);

  for (let i = 0; i < maxLookbackDays && results.length < maxOccurrences; i++) {
    const ourDay = getJsDayToOurDay(cursor.getDay());

    if (habit.days.includes(ourDay)) {
      const dateStr = toDateStr(cursor);
      const key = `${habit.id}-${dateStr}`;
      const completion = completions[key];
      const done = !!completion;

      let status = "missed";
      if (done) {
        status = "done";
      } else {
        const weekKey = getISOWeekKey(cursor);
        if (!freezeUsed[weekKey]) {
          freezeUsed[weekKey] = true;
          status = "frozen";
        }
      }

      results.push({
        date: dateStr,
        done,
        status, // "done" | "missed" | "frozen"
        effort: completion ? (completion.effort ?? null) : null,
        notes: completion ? (completion.notes || "") : "",
      });
    }

    cursor.setDate(cursor.getDate() - 1);
  }

  return results;
}
```

**Step 3: Update StreakDots to handle frozen state (StreakDots.jsx)**

In the dot's `background` style, change from:
```js
background: occ.done ? "#10B981" : "#E8453C",
```
to:
```js
background: occ.status === "done" ? "#10B981" : occ.status === "frozen" ? "#93c5fd" : "#E8453C",
```

Also update the hint text check — for frozen dots, add a ❄️ indicator. Update the note indicator section: after the blue-line div, add for frozen dots:
```jsx
{isLarge && occ.status === "frozen" && (
  <div style={{ fontSize: 8, marginTop: -2 }}>❄️</div>
)}
```

**Step 4: Update currentStreak in useAnalytics.js (line 57-68)**

Replace:
```js
let currentStreak = 0;
for (let i = 0; i < 365; i++) {
  const d = new Date();
  d.setDate(d.getDate() - i);
  const ourDay = getJsDayToOurDay(d.getDay());
  const dateStr = toDateStr(d);
  const todaysHabits = habits.filter(h => h.days.includes(ourDay));
  if (todaysHabits.length === 0) continue; // skip days with nothing scheduled
  const anyDone = todaysHabits.some(h => completions[`${h.id}-${dateStr}`]);
  if (anyDone) currentStreak++;
  else break;
}
```

With:
```js
let currentStreak = 0;
const freezeUsedGlobal = {};
for (let i = 0; i < 365; i++) {
  const d = new Date();
  d.setDate(d.getDate() - i);
  const ourDay = getJsDayToOurDay(d.getDay());
  const dateStr = toDateStr(d);
  const todaysHabits = habits.filter(h => h.days.includes(ourDay));
  if (todaysHabits.length === 0) continue;
  const anyDone = todaysHabits.some(h => completions[`${h.id}-${dateStr}`]);
  if (anyDone) {
    currentStreak++;
  } else {
    const weekKey = getISOWeekKey(d);
    if (!freezeUsedGlobal[weekKey]) {
      freezeUsedGlobal[weekKey] = true;
      // Frozen day — don't count, don't break
    } else {
      break;
    }
  }
}
```

Add `getISOWeekKey` to the imports at the top of useAnalytics.js:
```js
import { toDateStr, getJsDayToOurDay, getISOWeekKey } from "../data/constants";
```

**Step 5: Update per-habit streak in useAnalytics.js (line 136-145)**

Replace:
```js
let streak = 0;
for (let i = 0; i < 90; i++) {
  const d = new Date();
  d.setDate(d.getDate() - i);
  const ourDay = getJsDayToOurDay(d.getDay());
  if (!habit.days.includes(ourDay)) continue;
  const dateStr = toDateStr(d);
  if (completions[`${habit.id}-${dateStr}`]) streak++;
  else break;
}
```

With:
```js
let streak = 0;
const habitFreezeUsed = {};
for (let i = 0; i < 90; i++) {
  const d = new Date();
  d.setDate(d.getDate() - i);
  const ourDay = getJsDayToOurDay(d.getDay());
  if (!habit.days.includes(ourDay)) continue;
  const dateStr = toDateStr(d);
  if (completions[`${habit.id}-${dateStr}`]) {
    streak++;
  } else {
    const weekKey = getISOWeekKey(d);
    if (!habitFreezeUsed[weekKey]) {
      habitFreezeUsed[weekKey] = true;
    } else {
      break;
    }
  }
}
```

**Step 6: Verify and commit**

Run: `cd /Users/kanava/ai_projects/auth-workspace && pnpm --filter habit-tracker run build`
Expected: Build succeeds.

```bash
git add apps/habit-tracker/src/data/constants.js apps/habit-tracker/src/hooks/useAnalytics.js apps/habit-tracker/src/components/StreakDots.jsx
git commit -m "feat: add streak freeze algorithm (1 auto-forgive per ISO week)"
```

---

### Task 6: Vacation mode — useHabits hook changes

Add `user_settings` collection support: fetch vacation state, provide toggle function, subscribe to realtime updates.

**Files:**
- Modify: `src/hooks/useHabits.js`

**Step 1: Add vacation state (after line 84)**

Add:
```js
const [vacationMode, setVacationMode] = useState(false);
const [vacationStart, setVacationStart] = useState(null);
const [settingsRecordId, setSettingsRecordId] = useState(null);
```

**Step 2: Fetch user_settings in init() (inside the Promise.all, line 96-100)**

Add `user_settings` to the parallel fetch. Replace the Promise.all:
```js
const [habitsRes, catsRes, compsRes, settingsRes] = await Promise.all([
  pb.collection("habits").getFullList({ filter: `userId="${userId}"`, sort: "created" }),
  pb.collection("categories").getFullList({ filter: `userId="${userId}"`, sort: "created" }),
  pb.collection("completions").getFullList({ filter: `userId="${userId}" && dateStr>="${cutoff}"` }),
  pb.collection("user_settings").getList(1, 1, { filter: `userId="${userId}"` }).catch(() => ({ items: [] })),
]);
```

**Step 3: Process settings result (after `setLoading(false)`, around line 125)**

Add before `setLoading(false)`:
```js
// Load vacation state
if (settingsRes.items.length > 0) {
  const s = settingsRes.items[0];
  setSettingsRecordId(s.id);
  setVacationMode(!!s.vacationMode);
  setVacationStart(s.vacationStart || null);
}
```

**Step 4: Add realtime subscription for user_settings (after completions subscription, around line 158)**

Add:
```js
pb.collection("user_settings").subscribe("*", (e) => {
  if (e.record.userId !== userId) return;
  if (e.action === "delete") {
    setVacationMode(false);
    setVacationStart(null);
    setSettingsRecordId(null);
  } else {
    setSettingsRecordId(e.record.id);
    setVacationMode(!!e.record.vacationMode);
    setVacationStart(e.record.vacationStart || null);
  }
});
```

**Step 5: Unsubscribe on cleanup (line 166-171)**

Add to the cleanup function:
```js
pb.collection("user_settings").unsubscribe("*");
```

**Step 6: Add toggleVacation callback (after updateCompletion)**

```js
const toggleVacation = useCallback(async () => {
  const newMode = !vacationMode;
  const newStart = newMode ? toDateStr(new Date()) : null;

  // Optimistic
  setVacationMode(newMode);
  setVacationStart(newStart);

  try {
    if (settingsRecordId) {
      await pb.collection("user_settings").update(settingsRecordId, {
        vacationMode: newMode,
        vacationStart: newStart,
      });
    } else {
      const record = await pb.collection("user_settings").create({
        userId,
        vacationMode: newMode,
        vacationStart: newStart,
      });
      setSettingsRecordId(record.id);
    }
  } catch (err) {
    // Revert
    setVacationMode(!newMode);
    setVacationStart(newMode ? null : vacationStart);
    console.error("toggleVacation failed:", err);
  }
}, [userId, vacationMode, vacationStart, settingsRecordId]);
```

**Step 7: Add to return object (line 262-273)**

Add `vacationMode`, `vacationStart`, `toggleVacation` to the return.

**Step 8: Verify and commit**

Run: `cd /Users/kanava/ai_projects/auth-workspace && pnpm --filter habit-tracker run build`
Expected: Build succeeds.

```bash
git add apps/habit-tracker/src/hooks/useHabits.js
git commit -m "feat: add vacation mode state, toggle, and realtime subscription"
```

---

### Task 7: Vacation mode — UI in App.jsx

Add the vacation banner, toggle button in user bar, and confirmation dialog.

**Files:**
- Modify: `src/App.jsx`

**Step 1: Extract vacationMode from useHabits (line 46-57)**

Add to the destructured return:
```js
vacationMode,
vacationStart,
toggleVacation,
```

**Step 2: Add confirmation state (after completionNotesDateStr state)**

Add:
```js
const [showVacationConfirm, setShowVacationConfirm] = useState(false);
```

**Step 3: Add vacation toggle button in user bar (after the sign-out button, around line 262-272)**

Add between the sign-out button and the closing `</div>` of the user bar flex container. Replace the entire user bar actions area (the div containing sign-out):

Replace sign-out button with a div containing both buttons:
```jsx
<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
  <button
    onClick={() => {
      if (vacationMode) {
        toggleVacation(); // Resume immediately, no confirmation needed
      } else {
        setShowVacationConfirm(true);
      }
    }}
    style={{
      background: vacationMode ? "#fef3c7" : "none",
      border: `1px solid ${vacationMode ? "#f59e0b" : "#e0e0eb"}`,
      borderRadius: 8, padding: "4px 10px",
      fontSize: 12, color: vacationMode ? "#d97706" : "#999",
      cursor: "pointer", fontFamily: "'Space Mono', monospace",
    }}
  >
    {vacationMode ? "🏖️ On" : "🏖️"}
  </button>
  <button
    onClick={() => signOut()}
    style={{
      background: "none", border: "1px solid #e0e0eb",
      borderRadius: 8, padding: "4px 12px",
      fontSize: 12, color: "#999", cursor: "pointer",
      fontFamily: "'Space Mono', monospace",
    }}
  >
    Sign out
  </button>
</div>
```

**Step 4: Add vacation banner at top of daily view (after the user bar, before Date Header, around line 275)**

Add after the user bar closing `</div>` and before the Date Header `<div>`:
```jsx
{/* Vacation banner */}
{vacationMode && (
  <div style={{
    background: "linear-gradient(135deg, #fef3c7, #fde68a)",
    border: "1px solid #f59e0b40",
    borderRadius: 12, padding: "12px 16px",
    marginBottom: 12, textAlign: "center",
  }}>
    <div style={{ fontSize: 20, marginBottom: 4 }}>🏖️</div>
    <div style={{
      fontSize: 13, fontWeight: 600, color: "#92400e",
    }}>
      Vacation mode — habits paused
    </div>
    <div style={{
      fontSize: 11, color: "#a16207",
      fontFamily: "'Space Mono', monospace", marginTop: 2,
    }}>
      Streaks are preserved · since {vacationStart || "today"}
    </div>
    <button
      onClick={() => toggleVacation()}
      style={{
        marginTop: 8, padding: "6px 20px", borderRadius: 8,
        border: "none", background: "#92400e", color: "#fff",
        fontSize: 12, fontWeight: 600, cursor: "pointer",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      Resume habits
    </button>
  </div>
)}
```

**Step 5: Gray out habit rows during vacation**

In the habit row container (the `<div>` with `key={habit.id}`, around line 432), add an opacity style when vacation is on:
```js
opacity: vacationMode ? 0.4 : 1,
pointerEvents: vacationMode ? "none" : "auto",
```

Add these two properties to the existing style object on the habit row.

**Step 6: Add vacation confirmation dialog (after the CompletionNotes block)**

Add:
```jsx
{/* Vacation confirmation */}
{showVacationConfirm && (
  <div
    onClick={() => setShowVacationConfirm(false)}
    style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
      zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(4px)",
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: "#fff", borderRadius: 16, padding: "24px 20px",
        maxWidth: 320, width: "90%", textAlign: "center",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 8 }}>🏖️</div>
      <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#1a1a2e" }}>
        Enable vacation mode?
      </h3>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "#888", lineHeight: 1.5 }}>
        All habits will be paused. Your streaks will be preserved until you resume.
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => setShowVacationConfirm(false)}
          style={{
            flex: 1, padding: "10px 0", borderRadius: 8,
            border: "1px solid #e0e0eb", background: "#f9f9fc",
            fontSize: 13, fontWeight: 600, color: "#999", cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => {
            toggleVacation();
            setShowVacationConfirm(false);
          }}
          style={{
            flex: 1, padding: "10px 0", borderRadius: 8,
            border: "none", background: "#f59e0b",
            fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer",
          }}
        >
          Enable
        </button>
      </div>
    </div>
  </div>
)}
```

**Step 7: Verify and commit**

Run: `cd /Users/kanava/ai_projects/auth-workspace && pnpm --filter habit-tracker run build`
Expected: Build succeeds.

```bash
git add apps/habit-tracker/src/App.jsx
git commit -m "feat: add vacation mode UI — banner, toggle, confirmation dialog"
```

---

### Task 8: Vacation-aware streak calculations

Update useAnalytics to skip vacation days when calculating streaks and completion rates.

**Files:**
- Modify: `src/hooks/useAnalytics.js`

**Step 1: Accept vacationMode and vacationStart as parameters**

Change the function signature:
```js
export function useAnalytics(habits, completions, categories, vacationMode, vacationStart) {
```

**Step 2: Add vacation date range check helper inside useMemo**

Add at the start of the useMemo callback:
```js
// Helper: is a given date during a vacation period?
function isDuringVacation(dateStr) {
  if (!vacationMode || !vacationStart) return false;
  return dateStr >= vacationStart; // vacation is ongoing from start to today
}
```

**Step 3: Update currentStreak to skip vacation days**

In the currentStreak loop (the one with `freezeUsedGlobal` from Task 5), add a vacation check right after computing `dateStr`:
```js
if (isDuringVacation(dateStr)) continue; // skip vacation days entirely
```

Add this line after `const dateStr = toDateStr(d);` and before `const todaysHabits = ...`.

**Step 4: Update computeRates to exclude vacation days**

Inside the `computeRates` function, add a vacation check:
```js
function computeRates(habits, completions, dates, vacationCheck) {
  let scheduled = 0;
  let completed = 0;
  for (const date of dates) {
    const dateStr = toDateStr(date);
    if (vacationCheck && vacationCheck(dateStr)) continue;
    const ourDay = getJsDayToOurDay(date.getDay());
    for (const habit of habits) {
      if (habit.days.includes(ourDay)) {
        scheduled++;
        if (completions[`${habit.id}-${dateStr}`]) completed++;
      }
    }
  }
  return { scheduled, completed, pct: scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0 };
}
```

Then update all calls to `computeRates` to pass `isDuringVacation` as the fourth argument.

**Step 5: Update per-habit streak to skip vacation days**

In the per-habit streak loop (the one with `habitFreezeUsed` from Task 5), add:
```js
if (isDuringVacation(dateStr)) continue;
```

after `const dateStr = toDateStr(d);`.

**Step 6: Update the heatmap to mark vacation days**

In the heatmap data generation, add a `vacation` flag:
```js
const heatmapData = last84.map(date => {
  const ourDay = getJsDayToOurDay(date.getDay());
  const dateStr = toDateStr(date);
  if (isDuringVacation(dateStr)) {
    return { date: dateStr, pct: -2, month: date.toLocaleDateString("en-GB", { month: "short" }), dayOfWeek: ourDay };
  }
  // ... rest unchanged
});
```

**Step 7: Update useMemo dependencies**

Add `vacationMode` and `vacationStart` to the dependency array:
```js
}, [habits, completions, categories, vacationMode, vacationStart]);
```

**Step 8: Update App.jsx to pass vacation params to useAnalytics**

In `App.jsx`, change:
```js
const analytics = useAnalytics(habits, completions, categories);
```
to:
```js
const analytics = useAnalytics(habits, completions, categories, vacationMode, vacationStart);
```

**Step 9: Verify and commit**

Run: `cd /Users/kanava/ai_projects/auth-workspace && pnpm --filter habit-tracker run build`
Expected: Build succeeds.

```bash
git add apps/habit-tracker/src/hooks/useAnalytics.js apps/habit-tracker/src/App.jsx
git commit -m "feat: exclude vacation days from streak and analytics calculations"
```

---

### Task 9: PocketBase schema migration script

Create a script to add the new fields to PocketBase collections. This runs against the PocketBase admin API.

**Files:**
- Create: `scripts/pb-migrate.js`

**Step 1: Create the migration script**

```js
#!/usr/bin/env node
/**
 * PocketBase schema migration for completion notes + vacation mode.
 *
 * Usage:
 *   PB_URL=http://localhost:8090 PB_ADMIN_EMAIL=admin@example.com PB_ADMIN_PASSWORD=secret node scripts/pb-migrate.js
 *
 * What it does:
 *   1. Adds `effort` (number) and `notes` (text) fields to the `completions` collection
 *   2. Creates a `user_settings` collection with `userId`, `vacationMode`, `vacationStart`
 */

const PB_URL = process.env.PB_URL || "http://localhost:8090";
const EMAIL = process.env.PB_ADMIN_EMAIL;
const PASSWORD = process.env.PB_ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error("Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD env vars");
  process.exit(1);
}

async function main() {
  // Authenticate as admin
  const authRes = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: EMAIL, password: PASSWORD }),
  });
  if (!authRes.ok) throw new Error(`Auth failed: ${await authRes.text()}`);
  const { token } = await authRes.json();
  const headers = { "Content-Type": "application/json", Authorization: token };

  // 1. Get completions collection schema
  const colRes = await fetch(`${PB_URL}/api/collections/completions`, { headers });
  if (!colRes.ok) throw new Error(`Failed to get completions collection: ${await colRes.text()}`);
  const completions = await colRes.json();

  const existingNames = completions.schema.map(f => f.name);

  if (!existingNames.includes("effort")) {
    completions.schema.push({
      name: "effort",
      type: "number",
      required: false,
      options: { min: 0, max: 10 },
    });
    console.log("Adding 'effort' field to completions");
  }

  if (!existingNames.includes("notes")) {
    completions.schema.push({
      name: "notes",
      type: "text",
      required: false,
      options: { maxSize: 2000 },
    });
    console.log("Adding 'notes' field to completions");
  }

  if (!existingNames.includes("effort") || !existingNames.includes("notes")) {
    const updateRes = await fetch(`${PB_URL}/api/collections/completions`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ schema: completions.schema }),
    });
    if (!updateRes.ok) throw new Error(`Failed to update completions: ${await updateRes.text()}`);
    console.log("completions collection updated");
  } else {
    console.log("completions collection already has effort + notes fields");
  }

  // 2. Create user_settings collection (if it doesn't exist)
  const settingsCheck = await fetch(`${PB_URL}/api/collections/user_settings`, { headers });
  if (settingsCheck.ok) {
    console.log("user_settings collection already exists");
  } else {
    const createRes = await fetch(`${PB_URL}/api/collections`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "user_settings",
        type: "base",
        schema: [
          { name: "userId", type: "text", required: true, options: {} },
          { name: "vacationMode", type: "bool", required: false, options: {} },
          { name: "vacationStart", type: "text", required: false, options: {} },
        ],
        indexes: ["CREATE INDEX idx_user_settings_userId ON user_settings (userId)"],
        listRule: 'userId = @request.auth.id || @request.auth.id != ""',
        viewRule: 'userId = @request.auth.id || @request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: 'userId = @request.auth.id',
        deleteRule: 'userId = @request.auth.id',
      }),
    });
    if (!createRes.ok) throw new Error(`Failed to create user_settings: ${await createRes.text()}`);
    console.log("user_settings collection created");
  }

  console.log("Migration complete!");
}

main().catch(err => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
```

**Step 2: Verify and commit**

```bash
git add scripts/pb-migrate.js
git commit -m "feat: add PocketBase schema migration script for notes + vacation"
```

---

### Task 10: Visual test in browser

Start the dev server and verify all three features work end-to-end.

**Files:** None (manual testing)

**Step 1: Start the dev server**

```bash
cd /Users/kanava/ai_projects/auth-workspace/apps/habit-tracker && pnpm run dev
```

**Step 2: Test completion notes flow**

1. Log in
2. Tap a habit checkbox to complete it
3. Verify the CompletionNotes bottom sheet appears
4. Set effort slider to 7, type a note
5. Tap "Save" — sheet closes
6. Tap the same habit name to open HabitDetail
7. Verify the most recent dot has a blue indicator line
8. Tap the dot — verify note text and effort expand inline

**Step 3: Test streak freeze**

1. In HabitDetail, look at the streak dots
2. If there's a single missed day in the last week, verify it shows as blue/gray (❄️) not red
3. Verify the streak count in analytics reflects the freeze (1 miss per week is forgiven)

**Step 4: Test vacation mode**

1. Tap the 🏖️ button in the user bar
2. Verify confirmation dialog appears
3. Tap "Enable"
4. Verify yellow vacation banner appears at top
5. Verify habit rows are grayed out and not interactive
6. Tap "Resume habits" on the banner
7. Verify habits return to normal

**Step 5: Commit any fixes**

If anything needed tweaking:
```bash
git add -A
git commit -m "fix: adjustments from visual testing"
```
