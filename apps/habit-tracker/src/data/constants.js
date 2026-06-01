export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const SHORT_DAYS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * Warm Energetic design system — single source of truth for app chrome.
 * Coral accent on a cream background with warm neutrals.
 * Category colors (DEFAULT_CATEGORIES / CATEGORY_PALETTE) remain for habit data.
 */
export const THEME = {
  accent: "#FB7185",        // coral — primary brand accent
  accentHover: "#F43F5E",   // deeper coral for hover/press
  accentGradient: "linear-gradient(135deg, #FB7185, #F43F5E)", // primary buttons / FAB
  accentSoft: "#FFE4E6",    // light coral wash (selected backgrounds)
  accentTint: "#FFF1F2",    // faintest coral (today column / hover rows)
  accentText: "#BE123C",    // coral-dark text on light surfaces

  bg: "#FFFBF6",            // cream app background
  bgGradient: "linear-gradient(160deg, #FFFBF6 0%, #FFFFFF 55%, #FFF4EC 100%)",
  surface: "#FFFFFF",       // cards
  surfaceAlt: "#FBF7F2",    // subtle alt surface (gutters, headers)

  border: "#F0E6DE",        // warm hairline border
  borderStrong: "#E7D8CE",  // stronger warm border

  text: "#2A1F1A",          // warm near-black
  textMuted: "#8A7E76",     // warm gray
  textFaint: "#BDB1A8",     // faint warm gray

  done: "#FB7185",          // completion fill = coral (per chosen direction)
  doneSoft: "#FFE4E6",      // completed row background wash

  mono: "'Space Mono', monospace",
  sans: "'DM Sans', 'Segoe UI', sans-serif",
};

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
  // Use LOCAL date parts, not toISOString() (UTC). A Date at local midnight
  // would otherwise roll back a day in any UTC+ timezone, so the weekly view
  // (built from local-midnight dates) and the daily view (built from the
  // current local time) produced different keys for the same calendar day —
  // breaking completion sync between the two views.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

/** Returns the Monday of the week containing the given date */
export function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns array of 7 Date objects [Mon..Sun] for the week containing the given date */
export function getWeekDates(date) {
  const monday = getWeekStart(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/** Parse "HH:MM" into hour number (e.g. "09:30" -> 9) */
export function getHourFromTime(timeStr) {
  if (!timeStr) return null;
  return parseInt(timeStr.split(":")[0], 10);
}

/** Format "HH:MM" for display (e.g. "09:30" -> "9:30") */
export function formatTime(timeStr) {
  if (!timeStr) return "All day";
  const [h, m] = timeStr.split(":");
  return `${parseInt(h, 10)}:${m}`;
}

/** Generate hour labels from startHour to endHour */
export function getHourLabels(startHour = 6, endHour = 22) {
  return Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
}
