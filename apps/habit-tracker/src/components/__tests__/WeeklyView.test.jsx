import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import WeeklyView from "../WeeklyView";
import { getWeekDates, toDateStr, getJsDayToOurDay } from "../../data/constants";

// ─── Helpers ──────────────────────────────────────────────────────

const mockHabits = [
  { id: "1", name: "Morning Run", icon: "🏃", categoryId: "fitness", days: [0, 1, 2, 3, 4], time: "07:00", notes: "" },
  { id: "2", name: "Read", icon: "📖", categoryId: "learning", days: [0, 1, 2, 3, 4, 5, 6], time: null, notes: "" },
  { id: "3", name: "Meditate", icon: "🧘", categoryId: "health", days: [0, 2, 4], time: "06:00", notes: "" },
  { id: "4", name: "Early Bird", icon: "🐦", categoryId: "health", days: [0, 1, 2, 3, 4], time: "05:00", notes: "" },
  { id: "5", name: "Night Owl", icon: "🦉", categoryId: "work", days: [0, 1, 2, 3, 4], time: "23:30", notes: "" },
];

const mockGetCategory = (id) =>
  ({
    fitness: { id: "fitness", name: "Fitness", color: "#E8453C" },
    learning: { id: "learning", name: "Learning", color: "#3B82F6" },
    health: { id: "health", name: "Health", color: "#10B981" },
    work: { id: "work", name: "Work", color: "#F59E0B" },
  })[id] || { id, name: id, color: "#999" };

/** Build completions keyed by "habitId-YYYY-MM-DD" for the current week */
function buildCompletions(weekDates, entries) {
  const completions = {};
  for (const { habitId, dayIdx } of entries) {
    const dateStr = toDateStr(weekDates[dayIdx]);
    completions[`${habitId}-${dateStr}`] = { id: `comp_${habitId}_${dayIdx}`, effort: null, notes: "" };
  }
  return completions;
}

function renderWeekly(overrides = {}) {
  const defaults = {
    weekOffset: 0,
    setWeekOffset: vi.fn(),
    habits: mockHabits,
    completions: {},
    toggleCompletion: vi.fn(),
    getCategory: mockGetCategory,
    onHabitClick: vi.fn(),
    vacationMode: false,
  };
  return render(<WeeklyView {...defaults} {...overrides} />);
}

// ─── Tests ────────────────────────────────────────────────────────

describe("WeeklyView", () => {
  it("renders day headers MON through SUN", () => {
    renderWeekly();
    for (const day of ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]) {
      expect(screen.getByText(day)).toBeInTheDocument();
    }
  });

  it("shows all-day habits in ALL row — Read (no time) is in all-day section", () => {
    renderWeekly();
    // The ALL label should be present since there are all-day habits
    expect(screen.getByText("ALL")).toBeInTheDocument();
    // "Read" has no time, so it should appear (once per scheduled day)
    const readElements = screen.getAllByText("Read");
    expect(readElements.length).toBeGreaterThan(0);
  });

  it("places out-of-range timed habits in all-day row — Early Bird (05:00) and Night Owl (23:30)", () => {
    renderWeekly();
    // Both habits have times outside the 6-22 range, so they should fall back to all-day
    const earlyBirdElements = screen.getAllByText("Early Bird");
    expect(earlyBirdElements.length).toBeGreaterThan(0);
    const nightOwlElements = screen.getAllByText("Night Owl");
    expect(nightOwlElements.length).toBeGreaterThan(0);
    // They should NOT create their own hour rows (05:00 and 23:30 are outside 06-22)
    expect(screen.queryByText("05:00")).not.toBeInTheDocument();
    expect(screen.queryByText("23:00")).not.toBeInTheDocument();
  });

  it("renders timed habits in correct hour rows — Morning Run (07:00) has an 07:00 row", () => {
    renderWeekly();
    // 07:00 row label should exist for Morning Run
    expect(screen.getByText("07:00")).toBeInTheDocument();
    const morningRunElements = screen.getAllByText("Morning Run");
    expect(morningRunElements.length).toBeGreaterThan(0);
  });

  it("habits respect day schedule — Meditate (Mon/Wed/Fri) should not appear every day", () => {
    // Meditate is days [0, 2, 4] = Mon, Wed, Fri — time is 06:00 which IS in range
    renderWeekly();
    const meditateElements = screen.getAllByText("Meditate");
    // Should appear on exactly 3 days (Mon, Wed, Fri)
    expect(meditateElements).toHaveLength(3);
  });

  it("week navigation shows correct date range header", () => {
    renderWeekly();
    // The header should contain date range text with Mon and Sun dates
    const today = new Date();
    const weekDates = getWeekDates(today);
    const monStr = weekDates[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const sunStr = weekDates[6].toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    expect(screen.getByText((content) => content.includes(monStr) && content.includes(sunStr))).toBeInTheDocument();
  });

  it("completion toggle calls handler with correct habitId and dateStr", () => {
    const toggleCompletion = vi.fn();
    renderWeekly({ toggleCompletion });

    // Morning Run appears on weekdays — find one of its chip text nodes
    const morningRunSpans = screen.getAllByText("Morning Run");
    expect(morningRunSpans.length).toBeGreaterThan(0);

    // Walk up to the HabitChip root: <span> name → <span> wrapper → <div> chip root
    // The chip root has the onClick for onHabitClick, and its first child div is the checkbox
    const nameSpan = morningRunSpans[0]; // the <span style={{fontSize:9}}>
    const wrapperSpan = nameSpan.parentElement; // the <span> with icon + name
    const chipRoot = wrapperSpan.parentElement; // the outer <div onClick={onClick}>
    const checkbox = chipRoot.children[0]; // first child is the checkbox div

    fireEvent.click(checkbox);

    expect(toggleCompletion).toHaveBeenCalledTimes(1);
    const [habitId, dateStr] = toggleCompletion.mock.calls[0];
    expect(habitId).toBe("1");
    expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("renders empty state when no habits are passed", () => {
    renderWeekly({ habits: [] });
    expect(screen.getByText("No habits this week")).toBeInTheDocument();
    expect(screen.getByText("Tap + to create one")).toBeInTheDocument();
  });

  it("shows 'This week' button when weekOffset !== 0", () => {
    const { rerender } = renderWeekly({ weekOffset: 0 });
    expect(screen.queryByText("This week")).not.toBeInTheDocument();

    // Re-render with non-zero offset
    rerender(
      <WeeklyView
        weekOffset={-1}
        setWeekOffset={vi.fn()}
        habits={mockHabits}
        completions={{}}
        toggleCompletion={vi.fn()}
        getCategory={mockGetCategory}
        onHabitClick={vi.fn()}
        vacationMode={false}
      />
    );
    expect(screen.getByText("This week")).toBeInTheDocument();
  });
});
