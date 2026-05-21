import { useLocalStorage } from "./useLocalStorage";
import { DEFAULT_CATEGORIES, generateId } from "../data/constants";

export function useHabits(userId) {
  const [habits, setHabits] = useLocalStorage(`${userId}_habits`, []);
  const [categories, setCategories] = useLocalStorage(`${userId}_habit-categories`, DEFAULT_CATEGORIES);
  const [completions, setCompletions] = useLocalStorage(`${userId}_habit-completions`, {});

  function addHabit(habit) {
    setHabits((prev) => [
      ...prev,
      { ...habit, id: generateId(), createdAt: new Date().toISOString() },
    ]);
  }

  function updateHabit(id, updates) {
    setHabits((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...updates } : h))
    );
  }

  function deleteHabit(id) {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    setCompletions((prev) => {
      const prefix = `${id}-`;
      const next = {};
      for (const key in prev) {
        if (!key.startsWith(prefix)) {
          next[key] = prev[key];
        }
      }
      return next;
    });
  }

  function toggleCompletion(habitId, dateStr) {
    const key = `${habitId}-${dateStr}`;
    setCompletions((prev) => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = true;
      }
      return next;
    });
  }

  function addCategory(category) {
    setCategories((prev) => [...prev, { ...category, id: generateId() }]);
  }

  function getCategory(categoryId) {
    return categories.find((c) => c.id === categoryId) || categories[0];
  }

  return {
    habits,
    categories,
    completions,
    addHabit,
    updateHabit,
    deleteHabit,
    toggleCompletion,
    addCategory,
    getCategory,
  };
}
