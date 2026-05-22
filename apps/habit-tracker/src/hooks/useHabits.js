import { useState, useEffect, useCallback } from "react";
import pb from "../lib/pb";
import { DEFAULT_CATEGORIES, generateId, toDateStr } from "../data/constants";
import { migrateIfNeeded } from "../data/migration";

function cutoffDate() {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return toDateStr(d);
}

function recordToHabit(r) {
  return {
    id: r.id,
    userId: r.userId || "",
    name: r.name,
    icon: r.icon || "",
    categoryId: r.categoryId || "",
    days: Array.isArray(r.days) ? r.days : (r.days ? JSON.parse(r.days) : []),
    notes: r.notes || "",
    createdAt: r.created,
  };
}

function recordToCategory(r) {
  return { id: r.id, name: r.name, color: r.color || "#3B82F6" };
}

// One-time migration from localStorage to PocketBase.
// Only runs when PocketBase has no habits for this user yet.
async function migrateFromLocalStorage(userId) {
  const flagKey = `${userId}_pb_migrated`;
  if (localStorage.getItem(flagKey)) return;
  localStorage.setItem(flagKey, "true");

  const lsHabits = JSON.parse(localStorage.getItem(`${userId}_habits`) || "[]");
  if (lsHabits.length === 0) return;

  const lsCompletions = JSON.parse(localStorage.getItem(`${userId}_habit-completions`) || "{}");
  const lsCategories = JSON.parse(localStorage.getItem(`${userId}_habit-categories`) || "null");

  // Migrate any custom categories (ones not in DEFAULT_CATEGORIES)
  const catIdMap = {};
  if (lsCategories) {
    for (const cat of lsCategories) {
      if (DEFAULT_CATEGORIES.some(d => d.id === cat.id)) continue;
      const r = await pb.collection("categories").create({
        userId, name: cat.name, color: cat.color || "#3B82F6",
      });
      catIdMap[cat.id] = r.id;
    }
  }

  // Migrate habits (DEFAULT_CATEGORY IDs stay as-is; only custom ones get remapped)
  const habitIdMap = {};
  for (const h of lsHabits) {
    const r = await pb.collection("habits").create({
      userId,
      name: h.name,
      icon: h.icon || "",
      categoryId: catIdMap[h.categoryId] || h.categoryId || "",
      days: h.days || [],
      notes: h.notes || "",
    });
    habitIdMap[h.id] = r.id;
  }

  // Migrate completions from the last 90 days
  const cutoff = cutoffDate();
  for (const key of Object.keys(lsCompletions)) {
    const match = key.match(/^(.+)-(\d{4}-\d{2}-\d{2})$/);
    if (!match) continue;
    const [, oldHabitId, dateStr] = match;
    if (dateStr < cutoff) continue;
    const newHabitId = habitIdMap[oldHabitId];
    if (!newHabitId) continue;
    await pb.collection("completions").create({ userId, habitId: newHabitId, dateStr });
  }
}

export function useHabits(userId) {
  const [habits, setHabits] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [completions, setCompletions] = useState({});
  const [loading, setLoading] = useState(true);
  const [vacationMode, setVacationMode] = useState(false);
  const [vacationStart, setVacationStart] = useState(null);
  const [settingsRecordId, setSettingsRecordId] = useState(null);

  const categories = [...DEFAULT_CATEGORIES, ...customCategories];

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function init() {
      const cutoff = cutoffDate();
      const [habitsRes, catsRes, compsRes, settingsRes] = await Promise.all([
        pb.collection("habits").getFullList({ filter: `userId='${userId}'`, sort: "created" }),
        pb.collection("categories").getFullList({ filter: `userId='${userId}'`, sort: "created" }),
        pb.collection("completions").getFullList({ filter: `userId='${userId}' && dateStr>='${cutoff}'` }),
        pb.collection("user_settings").getList(1, 1, { filter: `userId='${userId}'` }).catch(() => ({ items: [] })),
      ]);

      if (cancelled) return;

      // If no habits yet, attempt localStorage migration or seed defaults
      if (habitsRes.length === 0) {
        await migrateFromLocalStorage(userId);
        // After migration, re-fetch habits
        const migrated = await pb.collection("habits").getFullList({ filter: `userId='${userId}'` });
        if (!cancelled) {
          setHabits(migrated.map(recordToHabit));
          // If still empty, seed from default activity list (new user)
          if (migrated.length === 0) {
            // migrateIfNeeded uses addHabit which goes to PocketBase
          }
        }
      } else {
        if (!cancelled) setHabits(habitsRes.map(recordToHabit));
      }

      if (!cancelled) {
        setCustomCategories(catsRes.map(recordToCategory));
        const compsMap = {};
        compsRes.forEach(r => {
          compsMap[`${r.habitId}-${r.dateStr}`] = {
            id: r.id,
            effort: r.effort ?? null,
            notes: r.notes || "",
          };
        });
        setCompletions(compsMap);

        // Load vacation state
        if (settingsRes.items.length > 0) {
          const s = settingsRes.items[0];
          setSettingsRecordId(s.id);
          setVacationMode(!!s.vacationMode);
          setVacationStart(s.vacationStart || null);
        }

        setLoading(false);
      }

      // Realtime subscriptions
      pb.collection("habits").subscribe("*", (e) => {
        if (e.record.userId !== userId) return;
        const habit = recordToHabit(e.record);
        setHabits(prev => {
          if (e.action === "delete") return prev.filter(h => h.id !== e.record.id);
          if (e.action === "create") return prev.some(h => h.id === habit.id) ? prev : [...prev, habit];
          return prev.map(h => h.id === habit.id ? habit : h);
        });
      });

      pb.collection("categories").subscribe("*", (e) => {
        if (e.record.userId !== userId) return;
        const cat = recordToCategory(e.record);
        setCustomCategories(prev => {
          if (e.action === "delete") return prev.filter(c => c.id !== e.record.id);
          if (e.action === "create") return prev.some(c => c.id === cat.id) ? prev : [...prev, cat];
          return prev.map(c => c.id === cat.id ? cat : c);
        });
      });

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
    }

    init().catch(err => {
      console.error("PocketBase init failed:", err);
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      pb.collection("habits").unsubscribe("*");
      pb.collection("categories").unsubscribe("*");
      pb.collection("completions").unsubscribe("*");
      pb.collection("user_settings").unsubscribe("*");
    };
  }, [userId]);

  const addHabit = useCallback(async (habit) => {
    await pb.collection("habits").create({
      userId,
      name: habit.name,
      icon: habit.icon || "",
      categoryId: habit.categoryId || "",
      days: habit.days || [],
      notes: habit.notes || "",
    });
  }, [userId]);

  const updateHabit = useCallback(async (id, updates) => {
    await pb.collection("habits").update(id, updates);
  }, []);

  const deleteHabit = useCallback(async (id) => {
    // Optimistic update
    setHabits(prev => prev.filter(h => h.id !== id));
    setCompletions(prev => {
      const next = {};
      for (const key of Object.keys(prev)) {
        if (!key.startsWith(`${id}-`)) next[key] = prev[key];
      }
      return next;
    });
    await pb.collection("habits").delete(id);
    // Clean up completions in background
    pb.collection("completions").getFullList({ filter: `habitId='${id}'` })
      .then(records => Promise.all(records.map(r => pb.collection("completions").delete(r.id))))
      .catch(console.error);
  }, []);

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
            filter: `userId='${userId}' && habitId='${habitId}' && dateStr='${dateStr}'`,
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

  const addCategory = useCallback(async (category) => {
    await pb.collection("categories").create({
      userId,
      name: category.name,
      color: category.color || "#3B82F6",
    });
  }, [userId]);

  const getCategory = useCallback((categoryId) => {
    return categories.find(c => c.id === categoryId) || categories[0];
  }, [categories]);

  // Safety filter: ensure only this user's data is returned,
  // even if PocketBase query or realtime subscription leaks other users' records.
  const userHabits = habits.filter(h => h.userId === userId);
  const userHabitIds = new Set(userHabits.map(h => h.id));
  const userCompletions = {};
  for (const key of Object.keys(completions)) {
    // Key format: "${habitId}-YYYY-MM-DD" — strip the date suffix to get habitId
    const habitId = key.replace(/-\d{4}-\d{2}-\d{2}$/, "");
    if (userHabitIds.has(habitId)) userCompletions[key] = completions[key];
  }

  return {
    habits: userHabits,
    categories,
    completions: userCompletions,
    loading,
    addHabit,
    updateHabit,
    deleteHabit,
    toggleCompletion,
    updateCompletion,
    addCategory,
    getCategory,
    vacationMode,
    vacationStart,
    toggleVacation,
  };
}
