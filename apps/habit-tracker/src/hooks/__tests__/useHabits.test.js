import { describe, it, expect } from "vitest";
import { recordToHabit } from "../useHabits";

describe("recordToHabit", () => {
  it("maps all fields correctly including time", () => {
    const record = {
      id: "abc123",
      userId: "user1",
      name: "Morning Run",
      icon: "🏃",
      categoryId: "fitness",
      days: [0, 1, 2, 3, 4],
      notes: "Run 5km",
      time: "07:00",
      created: "2025-05-01T10:00:00Z",
    };

    const habit = recordToHabit(record);

    expect(habit).toEqual({
      id: "abc123",
      userId: "user1",
      name: "Morning Run",
      icon: "🏃",
      categoryId: "fitness",
      days: [0, 1, 2, 3, 4],
      notes: "Run 5km",
      time: "07:00",
      createdAt: "2025-05-01T10:00:00Z",
    });
  });

  it("defaults missing fields — icon is '', notes is '', time is null", () => {
    const record = {
      id: "xyz",
      name: "Minimal",
      created: "2025-01-01",
    };

    const habit = recordToHabit(record);

    expect(habit.icon).toBe("");
    expect(habit.notes).toBe("");
    expect(habit.time).toBeNull();
    expect(habit.userId).toBe("");
    expect(habit.categoryId).toBe("");
    expect(habit.days).toEqual([]);
  });

  it("parses days from JSON string when PocketBase returns a string instead of array", () => {
    const record = {
      id: "str-days",
      name: "String Days",
      days: "[0,2,4]",
      created: "2025-01-01",
    };

    const habit = recordToHabit(record);

    expect(habit.days).toEqual([0, 2, 4]);
    expect(Array.isArray(habit.days)).toBe(true);
  });

  it("handles missing time — returns null, not undefined or empty string", () => {
    // No time field at all
    const noTime = recordToHabit({ id: "1", name: "A", created: "2025-01-01" });
    expect(noTime.time).toBeNull();
    expect(noTime.time).not.toBeUndefined();
    expect(noTime.time).not.toBe("");

    // Explicit empty string for time
    const emptyTime = recordToHabit({ id: "2", name: "B", time: "", created: "2025-01-01" });
    expect(emptyTime.time).toBeNull();

    // Explicit null for time
    const nullTime = recordToHabit({ id: "3", name: "C", time: null, created: "2025-01-01" });
    expect(nullTime.time).toBeNull();
  });
});
