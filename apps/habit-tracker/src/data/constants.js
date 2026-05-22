export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const SHORT_DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export const DEFAULT_CATEGORIES = [
  { id: "fitness", name: "Fitness", color: "#E8453C" },
  { id: "learning", name: "Learning", color: "#3B82F6" },
  { id: "health", name: "Health", color: "#10B981" },
  { id: "work", name: "Work", color: "#F59E0B" },
  { id: "creative", name: "Creative", color: "#8B5CF6" },
  { id: "social", name: "Social", color: "#EC4899" },
  { id: "recovery", name: "Recovery", color: "#8B5CF6" },
];

export const CATEGORY_PALETTE = [
  "#E8453C",
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#F97316",
];

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function toDateStr(date) {
  return date.toISOString().split("T")[0];
}

/** Converts JS day (0=Sun, 1=Mon, ..., 6=Sat) to our day (0=Mon, ..., 6=Sun) */
export function getJsDayToOurDay(jsDay) {
  return (jsDay + 6) % 7;
}

/** Returns "YYYY-WNN" ISO week key for a given date. */
export function getISOWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** Returns a Date for today + offset days */
export function getDateForOffset(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date;
}

/** Formats a date as "Wednesday, 21 May 2025" using en-GB locale */
export function formatDateHeader(date) {
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Walks backwards from the day before viewDate, finds dates where the habit
 * is scheduled (habit.days includes that day index), checks completions for
 * each, and returns up to 5 occurrences within a 90-day lookback window.
 *
 * Returns array of { date: string (YYYY-MM-DD), done: boolean }
 */
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
