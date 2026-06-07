import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import HabitForm from "../HabitForm";

const mockCategories = [
  { id: "fitness", name: "Fitness", color: "#E8453C" },
  { id: "learning", name: "Learning", color: "#3B82F6" },
  { id: "health", name: "Health", color: "#10B981" },
];

function renderForm(overrides = {}) {
  const defaults = {
    habit: null,
    categories: mockCategories,
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
    onAddCategory: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  return { ...render(<HabitForm {...props} />), props };
}

describe("HabitForm", () => {
  it("save includes time field when time is set", () => {
    const onSave = vi.fn();
    renderForm({ onSave });

    // Fill required fields: name
    const nameInput = screen.getByPlaceholderText("Habit name");
    fireEvent.change(nameInput, { target: { value: "Yoga" } });

    // Set time
    const timeInput = screen.getByDisplayValue("");
    // The time input is type="time"
    const timeInputEl = document.querySelector('input[type="time"]');
    fireEvent.change(timeInputEl, { target: { value: "09:00" } });

    // Category is already selected (first one by default)
    // Click save
    fireEvent.click(screen.getByText("Create Habit"));

    expect(onSave).toHaveBeenCalledTimes(1);
    const payload = onSave.mock.calls[0][0];
    expect(payload.time).toBe("09:00");
    expect(payload.name).toBe("Yoga");
  });

  it("save with no time passes null", () => {
    const onSave = vi.fn();
    renderForm({ onSave });

    // Fill required fields only — no time
    const nameInput = screen.getByPlaceholderText("Habit name");
    fireEvent.change(nameInput, { target: { value: "Read" } });

    fireEvent.click(screen.getByText("Create Habit"));

    expect(onSave).toHaveBeenCalledTimes(1);
    const payload = onSave.mock.calls[0][0];
    expect(payload.time).toBeNull();
  });

  it("edit mode pre-populates time field", () => {
    const existingHabit = {
      id: "h1",
      name: "Stretch",
      icon: "🤸",
      categoryId: "health",
      days: [0, 1, 2, 3, 4],
      notes: "",
      time: "14:30",
    };
    renderForm({ habit: existingHabit });

    const timeInput = document.querySelector('input[type="time"]');
    expect(timeInput.value).toBe("14:30");

    // Should show "Edit Habit" title in edit mode
    expect(screen.getByText("Edit Habit")).toBeInTheDocument();
  });

  it("clear button removes time value", () => {
    const existingHabit = {
      id: "h2",
      name: "Jog",
      icon: "🏃",
      categoryId: "fitness",
      days: [0, 1, 2, 3, 4],
      notes: "",
      time: "08:00",
    };
    renderForm({ habit: existingHabit });

    const timeInput = document.querySelector('input[type="time"]');
    expect(timeInput.value).toBe("08:00");

    // Clear button should be visible when time is set
    const clearButton = screen.getByText("Clear");
    fireEvent.click(clearButton);

    // After clearing, time input should be empty
    expect(timeInput.value).toBe("");

    // "All day" text should now be visible
    expect(screen.getByText("All day")).toBeInTheDocument();
  });
});
