import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import DailyAgenda from "../DailyAgenda";

// Pre-sorted as App.jsx provides: all-day first, then timed ascending.
const habits = [
  { id: "2", name: "Read", icon: "📖", categoryId: "learning", days: [0, 1, 2, 3, 4, 5, 6], time: null, notes: "" },
  { id: "3", name: "Meditate", icon: "🧘", categoryId: "health", days: [0, 1, 2, 3, 4, 5, 6], time: "06:30", notes: "" },
  { id: "1", name: "Morning Run", icon: "🏃", categoryId: "fitness", days: [0, 1, 2, 3, 4, 5, 6], time: "07:00", notes: "" },
];

const getCategory = (id) =>
  ({
    fitness: { id: "fitness", name: "Fitness", color: "#E8453C" },
    learning: { id: "learning", name: "Learning", color: "#3B82F6" },
    health: { id: "health", name: "Health", color: "#10B981" },
  })[id] || { id, name: id, color: "#999" };

function renderAgenda(overrides = {}) {
  const defaults = {
    habits,
    dateStr: "2025-05-21",
    viewDate: new Date(2025, 4, 21),
    completions: {},
    getCategory,
    vacationMode: false,
    onToggle: vi.fn(),
    onOpenHabit: vi.fn(),
  };
  return render(<DailyAgenda {...defaults} {...overrides} />);
}

describe("DailyAgenda", () => {
  it("groups all-day habits under an 'All day' label", () => {
    renderAgenda();
    expect(screen.getByText("All day")).toBeInTheDocument();
    expect(screen.getByText(/Read/)).toBeInTheDocument();
  });

  it("shows the time in the left gutter for timed habits", () => {
    renderAgenda();
    expect(screen.getByText("6:30")).toBeInTheDocument();
    expect(screen.getByText("7:00")).toBeInTheDocument();
  });

  it("shows the category name as a subtitle on each habit", () => {
    renderAgenda();
    expect(screen.getByText("Learning")).toBeInTheDocument();
    expect(screen.getByText("Fitness")).toBeInTheDocument();
    expect(screen.getByText("Health")).toBeInTheDocument();
  });

  it("calls onOpenHabit when the card body is clicked", () => {
    const onOpenHabit = vi.fn();
    renderAgenda({ onOpenHabit });
    fireEvent.click(screen.getByText(/Morning Run/));
    expect(onOpenHabit).toHaveBeenCalled();
  });

  it("calls onToggle (not onOpenHabit) when the checkbox is clicked", () => {
    const onToggle = vi.fn();
    const onOpenHabit = vi.fn();
    renderAgenda({ onToggle, onOpenHabit });

    // name div -> info div -> card div; the card's first child is the checkbox
    const nameEl = screen.getByText(/Morning Run/);
    const card = nameEl.parentElement.parentElement;
    fireEvent.click(card.firstChild);

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onOpenHabit).not.toHaveBeenCalled();
  });

  it("renders nothing-but-timed when there are no all-day habits", () => {
    renderAgenda({ habits: habits.filter((h) => h.time) });
    expect(screen.queryByText("All day")).not.toBeInTheDocument();
    expect(screen.getByText("6:30")).toBeInTheDocument();
  });
});
