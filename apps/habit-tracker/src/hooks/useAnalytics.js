import { useMemo } from "react";
import { toDateStr, getJsDayToOurDay } from "../data/constants";

/** Returns an array of Date objects for the last N days ending today. */
function getLastNDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days;
}

/** Count scheduled and completed for a given set of dates. */
function computeRates(habits, completions, dates) {
  let scheduled = 0;
  let completed = 0;
  for (const date of dates) {
    const ourDay = getJsDayToOurDay(date.getDay());
    const dateStr = toDateStr(date);
    for (const habit of habits) {
      if (habit.days.includes(ourDay)) {
        scheduled++;
        if (completions[`${habit.id}-${dateStr}`]) completed++;
      }
    }
  }
  return { scheduled, completed, pct: scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0 };
}

export function useAnalytics(habits, completions, categories) {
  return useMemo(() => {
    if (habits.length === 0) {
      return {
        completionRate: 0,
        currentStreak: 0,
        bestDay: null,
        activeHabits: 0,
        motivationalMessage: "Create your first habit to get started!",
        weeklyData: [],
        categoryStats: [],
        habitStats: [],
        heatmapData: [],
      };
    }

    const today = new Date();
    const last30 = getLastNDays(30);
    const last7 = getLastNDays(7);
    const last84 = getLastNDays(84);

    // --- Summary cards ---
    const { pct: completionRate } = computeRates(habits, completions, last30);

    // Current streak: walk backward from today, count days where at least 1 habit was completed
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

    // Best day of week: average completion % per weekday over last 30 days
    const dayTotals = Array.from({ length: 7 }, () => ({ scheduled: 0, completed: 0 }));
    for (const date of last30) {
      const ourDay = getJsDayToOurDay(date.getDay());
      const dateStr = toDateStr(date);
      for (const habit of habits) {
        if (habit.days.includes(ourDay)) {
          dayTotals[ourDay].scheduled++;
          if (completions[`${habit.id}-${dateStr}`]) dayTotals[ourDay].completed++;
        }
      }
    }
    const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    let bestDay = null;
    let bestPct = -1;
    dayTotals.forEach((dt, idx) => {
      const p = dt.scheduled > 0 ? dt.completed / dt.scheduled : 0;
      if (p > bestPct) { bestPct = p; bestDay = DAY_NAMES[idx]; }
    });

    // Active habits this week
    const allWeekDays = [0, 1, 2, 3, 4, 5, 6];
    const activeHabits = habits.filter(h => allWeekDays.some(d => h.days.includes(d))).length;

    // Motivational message
    let motivationalMessage;
    if (completionRate > 80) motivationalMessage = "\u{1F525} You're on fire — keep it up!";
    else if (completionRate >= 50) motivationalMessage = "\u{1F4AA} Solid progress — push a little harder";
    else motivationalMessage = "\u{1F331} Every day is a fresh start";

    // --- Weekly trend (last 7 days) ---
    const weeklyData = last7.map(date => {
      const ourDay = getJsDayToOurDay(date.getDay());
      const dateStr = toDateStr(date);
      let scheduled = 0, completed = 0;
      for (const habit of habits) {
        if (habit.days.includes(ourDay)) {
          scheduled++;
          if (completions[`${habit.id}-${dateStr}`]) completed++;
        }
      }
      return {
        date: dateStr,
        dayLabel: DAY_NAMES[ourDay],
        pct: scheduled > 0 ? Math.round((completed / scheduled) * 100) : -1, // -1 means no habits scheduled
        isToday: toDateStr(today) === dateStr,
      };
    });

    // --- Category breakdown (last 30 days) ---
    const catMap = {};
    for (const cat of categories) {
      const catHabits = habits.filter(h => h.categoryId === cat.id);
      if (catHabits.length === 0) continue;
      const { pct } = computeRates(catHabits, completions, last30);
      catMap[cat.id] = { id: cat.id, name: cat.name, color: cat.color, pct };
    }
    const categoryStats = Object.values(catMap).sort((a, b) => b.pct - a.pct);

    // --- Habit leaderboard (last 30 days) ---
    const habitStats = habits
      .map(habit => {
        const { scheduled, completed, pct } = computeRates([habit], completions, last30);
        if (scheduled < 3) return null; // skip habits with < 3 scheduled occurrences

        // Current streak for this habit
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

        const cat = categories.find(c => c.id === habit.categoryId) || categories[0];
        return {
          id: habit.id,
          name: habit.name,
          icon: habit.icon,
          categoryColor: cat.color,
          pct,
          streak,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.pct - a.pct || b.streak - a.streak);

    // --- Heatmap (last 84 days = 12 weeks) ---
    const heatmapData = last84.map(date => {
      const ourDay = getJsDayToOurDay(date.getDay());
      const dateStr = toDateStr(date);
      let scheduled = 0, completed = 0;
      for (const habit of habits) {
        if (habit.days.includes(ourDay)) {
          scheduled++;
          if (completions[`${habit.id}-${dateStr}`]) completed++;
        }
      }
      return {
        date: dateStr,
        pct: scheduled > 0 ? Math.round((completed / scheduled) * 100) : -1,
        month: date.toLocaleDateString("en-GB", { month: "short" }),
        dayOfWeek: ourDay,
      };
    });

    return {
      completionRate,
      currentStreak,
      bestDay,
      activeHabits,
      motivationalMessage,
      weeklyData,
      categoryStats,
      habitStats,
      heatmapData,
    };
  }, [habits, completions, categories]);
}
