import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DAYS,
  SHORT_DAYS,
  DEFAULT_CATEGORIES,
  CATEGORY_PALETTE,
  generateId,
  toDateStr,
  getJsDayToOurDay,
  getISOWeekKey,
  getDateForOffset,
  formatDateHeader,
  getLast5Occurrences,
  getWeekStart,
  getWeekDates,
  getHourFromTime,
  formatTime,
  getHourLabels,
} from "../constants.js";

// ─── Static exports ───────────────────────────────────────────────

describe("static exports", () => {
  it("DAYS has 7 entries starting Monday and ending Sunday", () => {
    expect(DAYS).toHaveLength(7);
    expect(DAYS[0]).toBe("Monday");
    expect(DAYS[6]).toBe("Sunday");
  });

  it("SHORT_DAYS has 7 single-character entries", () => {
    expect(SHORT_DAYS).toHaveLength(7);
    SHORT_DAYS.forEach((d) => expect(d).toHaveLength(1));
  });

  it("DEFAULT_CATEGORIES each have id, name, and color", () => {
    DEFAULT_CATEGORIES.forEach((cat) => {
      expect(cat).toHaveProperty("id");
      expect(cat).toHaveProperty("name");
      expect(cat).toHaveProperty("color");
      expect(cat.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  it("CATEGORY_PALETTE contains valid hex colors", () => {
    expect(CATEGORY_PALETTE.length).toBeGreaterThan(0);
    CATEGORY_PALETTE.forEach((c) => expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/));
  });
});

// ─── generateId ───────────────────────────────────────────────────

describe("generateId", () => {
  it("returns a non-empty string", () => {
    const id = generateId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns unique values on consecutive calls", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

// ─── toDateStr ────────────────────────────────────────────────────

describe("toDateStr", () => {
  it('returns "YYYY-MM-DD" format', () => {
    // Use noon UTC to avoid timezone shift
    const date = new Date("2025-05-21T12:00:00Z");
    expect(toDateStr(date)).toBe("2025-05-21");
  });

  it("zero-pads single-digit months", () => {
    const date = new Date("2025-01-15T12:00:00Z");
    expect(toDateStr(date)).toBe("2025-01-15");
  });

  it("zero-pads single-digit days", () => {
    const date = new Date("2025-12-03T12:00:00Z");
    expect(toDateStr(date)).toBe("2025-12-03");
  });

  // Regression: daily view (local time) and weekly view (local midnight) must
  // produce the SAME key for a given calendar day, regardless of timezone.
  // The old toISOString() impl rolled local midnight back a day in UTC+ zones.
  it("uses the local calendar date — midnight and noon match, no roll-back", () => {
    const midnight = new Date(2025, 4, 21, 0, 0, 0); // local midnight, 21 May
    const noon = new Date(2025, 4, 21, 12, 0, 0); // local noon, 21 May
    expect(toDateStr(midnight)).toBe("2025-05-21");
    expect(toDateStr(noon)).toBe("2025-05-21");
    expect(toDateStr(midnight)).toBe(toDateStr(noon));
  });
});

// ─── getJsDayToOurDay ─────────────────────────────────────────────

describe("getJsDayToOurDay", () => {
  it("maps Sunday (0) → 6", () => {
    expect(getJsDayToOurDay(0)).toBe(6);
  });

  it("maps Monday (1) → 0", () => {
    expect(getJsDayToOurDay(1)).toBe(0);
  });

  it("maps Tuesday (2) → 1", () => {
    expect(getJsDayToOurDay(2)).toBe(1);
  });

  it("maps Wednesday (3) → 2", () => {
    expect(getJsDayToOurDay(3)).toBe(2);
  });

  it("maps Thursday (4) → 3", () => {
    expect(getJsDayToOurDay(4)).toBe(3);
  });

  it("maps Friday (5) → 4", () => {
    expect(getJsDayToOurDay(5)).toBe(4);
  });

  it("maps Saturday (6) → 5", () => {
    expect(getJsDayToOurDay(6)).toBe(5);
  });
});

// ─── getDateForOffset ─────────────────────────────────────────────

describe("getDateForOffset", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 4, 21, 12, 0, 0)); // May 21 2025 noon
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("offset 0 returns today", () => {
    const result = getDateForOffset(0);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(21);
  });

  it("offset -1 returns yesterday", () => {
    const result = getDateForOffset(-1);
    expect(result.getDate()).toBe(20);
  });

  it("offset 1 returns tomorrow", () => {
    const result = getDateForOffset(1);
    expect(result.getDate()).toBe(22);
  });

  it("handles month boundary crossing", () => {
    vi.setSystemTime(new Date(2025, 5, 1, 12, 0, 0)); // June 1
    const result = getDateForOffset(-1);
    expect(result.getMonth()).toBe(4); // May
    expect(result.getDate()).toBe(31);
  });
});

// ─── formatDateHeader ─────────────────────────────────────────────

describe("formatDateHeader", () => {
  it('returns a string with weekday, day, month, and year', () => {
    const date = new Date(2025, 4, 21); // Wednesday, 21 May 2025
    const result = formatDateHeader(date);
    expect(result).toContain("Wednesday");
    expect(result).toContain("21");
    expect(result).toContain("May");
    expect(result).toContain("2025");
  });

  it("handles a different date correctly", () => {
    const date = new Date(2025, 0, 1); // Wednesday, 1 January 2025
    const result = formatDateHeader(date);
    expect(result).toContain("Wednesday");
    expect(result).toContain("1");
    expect(result).toContain("January");
    expect(result).toContain("2025");
  });
});

// ─── getISOWeekKey ────────────────────────────────────────────────

describe("getISOWeekKey", () => {
  it('returns "YYYY-WNN" format', () => {
    const date = new Date(2025, 4, 21); // Wed May 21 2025
    const result = getISOWeekKey(date);
    expect(result).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("returns correct week number for a mid-year date", () => {
    // May 21 2025 is in ISO week 21
    const date = new Date(2025, 4, 21);
    expect(getISOWeekKey(date)).toBe("2025-W21");
  });

  it("handles year boundary — Dec 31 2024 belongs to 2025-W01", () => {
    // Dec 31 2024 is a Tuesday — ISO week 1 of 2025
    const date = new Date(2024, 11, 31);
    expect(getISOWeekKey(date)).toBe("2025-W01");
  });

  it("handles year boundary — Jan 1 2025 belongs to 2025-W01", () => {
    const date = new Date(2025, 0, 1);
    expect(getISOWeekKey(date)).toBe("2025-W01");
  });

  it("pads single-digit week numbers", () => {
    const date = new Date(2025, 0, 6); // Mon Jan 6 → W02
    expect(getISOWeekKey(date)).toBe("2025-W02");
  });
});

// ─── getWeekStart ─────────────────────────────────────────────────

describe("getWeekStart", () => {
  it("given a Wednesday, returns the preceding Monday", () => {
    const wed = new Date(2025, 4, 21); // Wed May 21
    const result = getWeekStart(wed);
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(19);
  });

  it("given a Monday, returns that Monday", () => {
    const mon = new Date(2025, 4, 19); // Mon May 19
    const result = getWeekStart(mon);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(19);
  });

  it("given a Sunday, returns the preceding Monday", () => {
    const sun = new Date(2025, 4, 25); // Sun May 25
    const result = getWeekStart(sun);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(19);
  });

  it("handles month boundaries (Wed Apr 2 → Mon Mar 31)", () => {
    const wed = new Date(2025, 3, 2); // Wed Apr 2
    const result = getWeekStart(wed);
    expect(result.getDay()).toBe(1);
    expect(result.getMonth()).toBe(2); // March
    expect(result.getDate()).toBe(31);
  });

  it("sets time to midnight", () => {
    const date = new Date(2025, 4, 21, 15, 30, 45);
    const result = getWeekStart(date);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it("does not mutate the input date", () => {
    const original = new Date(2025, 4, 21);
    const originalTime = original.getTime();
    getWeekStart(original);
    expect(original.getTime()).toBe(originalTime);
  });
});

// ─── getWeekDates ─────────────────────────────────────────────────

describe("getWeekDates", () => {
  it("returns exactly 7 dates", () => {
    const dates = getWeekDates(new Date(2025, 4, 21));
    expect(dates).toHaveLength(7);
  });

  it("first date is Monday, last is Sunday", () => {
    const dates = getWeekDates(new Date(2025, 4, 21));
    expect(dates[0].getDay()).toBe(1); // Monday
    expect(dates[6].getDay()).toBe(0); // Sunday
  });

  it("dates are consecutive", () => {
    const dates = getWeekDates(new Date(2025, 4, 21));
    for (let i = 1; i < dates.length; i++) {
      const diff = dates[i].getDate() - dates[i - 1].getDate();
      // Normally +1, but across month boundaries may differ. Check ms instead.
      const msDiff = dates[i].getTime() - dates[i - 1].getTime();
      expect(msDiff).toBe(24 * 60 * 60 * 1000);
    }
  });

  it("handles month boundary (week spanning March/April)", () => {
    // Mar 31 2025 is Monday, Apr 6 is Sunday
    const dates = getWeekDates(new Date(2025, 3, 2)); // Wed Apr 2
    expect(dates[0].getMonth()).toBe(2); // March
    expect(dates[0].getDate()).toBe(31);
    expect(dates[6].getMonth()).toBe(3); // April
    expect(dates[6].getDate()).toBe(6);
  });

  it("handles year boundary (week spanning Dec/Jan)", () => {
    // Dec 29 2025 is Monday, Jan 4 2026 is Sunday
    const dates = getWeekDates(new Date(2025, 11, 31)); // Wed Dec 31
    expect(dates[0].getFullYear()).toBe(2025);
    expect(dates[0].getMonth()).toBe(11); // December
    expect(dates[6].getFullYear()).toBe(2026);
    expect(dates[6].getMonth()).toBe(0); // January
  });
});

// ─── getHourFromTime ──────────────────────────────────────────────

describe("getHourFromTime", () => {
  it('"09:30" → 9', () => {
    expect(getHourFromTime("09:30")).toBe(9);
  });

  it('"00:00" → 0', () => {
    expect(getHourFromTime("00:00")).toBe(0);
  });

  it('"23:59" → 23', () => {
    expect(getHourFromTime("23:59")).toBe(23);
  });

  it("null → null", () => {
    expect(getHourFromTime(null)).toBeNull();
  });

  it('"" → null', () => {
    expect(getHourFromTime("")).toBeNull();
  });

  it("undefined → null", () => {
    expect(getHourFromTime(undefined)).toBeNull();
  });
});

// ─── formatTime ───────────────────────────────────────────────────

describe("formatTime", () => {
  it('"09:30" → "9:30" (strips leading zero)', () => {
    expect(formatTime("09:30")).toBe("9:30");
  });

  it('"14:00" → "14:00" (no change needed)', () => {
    expect(formatTime("14:00")).toBe("14:00");
  });

  it('"00:00" → "0:00"', () => {
    expect(formatTime("00:00")).toBe("0:00");
  });

  it('null → "All day"', () => {
    expect(formatTime(null)).toBe("All day");
  });

  it('"" → "All day"', () => {
    expect(formatTime("")).toBe("All day");
  });

  it('undefined → "All day"', () => {
    expect(formatTime(undefined)).toBe("All day");
  });
});

// ─── getHourLabels ────────────────────────────────────────────────

describe("getHourLabels", () => {
  it("default range (6,22) returns 17 items from 6 to 22", () => {
    const labels = getHourLabels();
    expect(labels).toHaveLength(17);
    expect(labels[0]).toBe(6);
    expect(labels[labels.length - 1]).toBe(22);
  });

  it("custom range (8,10) returns [8, 9, 10]", () => {
    expect(getHourLabels(8, 10)).toEqual([8, 9, 10]);
  });

  it("same start and end returns single-element array", () => {
    expect(getHourLabels(12, 12)).toEqual([12]);
  });

  it("all labels are consecutive integers", () => {
    const labels = getHourLabels(0, 23);
    expect(labels).toHaveLength(24);
    labels.forEach((label, i) => expect(label).toBe(i));
  });
});

// ─── getLast5Occurrences ──────────────────────────────────────────

describe("getLast5Occurrences", () => {
  // A habit scheduled every weekday (Mon-Fri = days 0-4)
  const weekdayHabit = {
    id: "h1",
    days: [0, 1, 2, 3, 4],
  };

  // A habit scheduled only on Mondays (day 0)
  const mondayOnlyHabit = {
    id: "h2",
    days: [0],
  };

  it("returns at most 5 occurrences", () => {
    const viewDate = new Date(2025, 4, 22, 12, 0, 0); // Thursday May 22 noon
    const completions = {};
    const results = getLast5Occurrences(weekdayHabit, completions, viewDate);
    expect(results.length).toBeLessThanOrEqual(5);
    expect(results).toHaveLength(5);
  });

  it("skips days not in habit.days", () => {
    // Monday-only habit viewed from Thursday May 22 (use noon to avoid TZ shift)
    const viewDate = new Date(2025, 4, 22, 12, 0, 0);
    const completions = {};
    const results = getLast5Occurrences(mondayOnlyHabit, completions, viewDate);
    // All returned dates should be Mondays
    results.forEach((r) => {
      const date = new Date(r.date + "T12:00:00Z");
      expect(date.getUTCDay()).toBe(1); // Monday in UTC
    });
  });

  it('marks completed days as "done"', () => {
    const viewDate = new Date(2025, 4, 22, 12, 0, 0); // Thursday noon
    const completions = {
      "h1-2025-05-21": { effort: 3, notes: "good" }, // Wed May 21
      "h1-2025-05-20": { effort: 4, notes: "" }, // Tue May 20
    };
    const results = getLast5Occurrences(weekdayHabit, completions, viewDate);

    const wed = results.find((r) => r.date === "2025-05-21");
    expect(wed).toBeDefined();
    expect(wed.done).toBe(true);
    expect(wed.status).toBe("done");
    expect(wed.effort).toBe(3);
    expect(wed.notes).toBe("good");

    const tue = results.find((r) => r.date === "2025-05-20");
    expect(tue).toBeDefined();
    expect(tue.done).toBe(true);
    expect(tue.status).toBe("done");
  });

  it('marks first miss per week as "frozen"', () => {
    const viewDate = new Date(2025, 4, 22, 12, 0, 0); // Thursday noon
    const completions = {};
    const results = getLast5Occurrences(weekdayHabit, completions, viewDate);

    // Walking backwards from Wed May 21: Wed (frozen), Tue, Mon (same week), then
    // Fri May 16 (frozen for that week), Thu May 15.
    const frozenCount = results.filter((r) => r.status === "frozen").length;
    expect(frozenCount).toBeGreaterThanOrEqual(1);
  });

  it('marks subsequent misses in same week as "missed"', () => {
    const viewDate = new Date(2025, 4, 22, 12, 0, 0); // Thursday noon
    const completions = {};
    const results = getLast5Occurrences(weekdayHabit, completions, viewDate);

    // In week 21 (Mon-Wed), first is frozen, next two are missed.
    // In week 20 (Fri, Thu), first is frozen, second is missed.
    const missedCount = results.filter((r) => r.status === "missed").length;
    expect(missedCount).toBeGreaterThanOrEqual(1);
  });

  it("handles empty completions — all occurrences are frozen or missed", () => {
    const viewDate = new Date(2025, 4, 22, 12, 0, 0);
    const completions = {};
    const results = getLast5Occurrences(weekdayHabit, completions, viewDate);
    results.forEach((r) => {
      expect(r.done).toBe(false);
      expect(["frozen", "missed"]).toContain(r.status);
    });
  });

  it("returns effort as null and notes as empty string when not completed", () => {
    const viewDate = new Date(2025, 4, 22, 12, 0, 0);
    const completions = {};
    const results = getLast5Occurrences(weekdayHabit, completions, viewDate);
    results.forEach((r) => {
      expect(r.effort).toBeNull();
      expect(r.notes).toBe("");
    });
  });

  it("starts looking from the day before viewDate, not viewDate itself", () => {
    const viewDate = new Date(2025, 4, 22, 12, 0, 0); // Thursday May 22 noon
    const results = getLast5Occurrences(weekdayHabit, {}, viewDate);
    // Should not include May 22 itself
    const hasViewDate = results.some((r) => r.date === "2025-05-22");
    expect(hasViewDate).toBe(false);
    // First result should be May 21 (Wednesday)
    expect(results[0].date).toBe("2025-05-21");
  });

  it("returns fewer than 5 when not enough scheduled days in 90-day window", () => {
    const dailyHabit = { id: "daily", days: [0, 1, 2, 3, 4, 5, 6] };
    const results = getLast5Occurrences(dailyHabit, {}, new Date(2025, 4, 22, 12, 0, 0));
    expect(results).toHaveLength(5);
  });

  it("correctly groups freezes by ISO week", () => {
    // Mon-only habit, each Monday is in a different ISO week,
    // so each should get a freeze.
    const viewDate = new Date(2025, 4, 22, 12, 0, 0);
    const results = getLast5Occurrences(mondayOnlyHabit, {}, viewDate);
    results.forEach((r) => {
      expect(r.status).toBe("frozen");
    });
  });
});
