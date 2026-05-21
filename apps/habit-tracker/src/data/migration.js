import { ACTIVITIES, WEEKLY_PLAN } from "./activities";

const PRIORITY_TO_CATEGORY = {
  knee: "fitness",
  heart: "fitness",
  cali: "fitness",
  sport: "fitness",
  flex: "health",
  recovery: "recovery",
};

function buildNotes(activity) {
  const sections = [];

  if (activity.mustDo && activity.mustDo.length > 0) {
    const items = activity.mustDo
      .map((item, i) => `${i + 1}. ${item}`)
      .join("\n");
    sections.push(`MUST DO:\n${items}`);
  }

  if (activity.avoid && activity.avoid.length > 0) {
    const items = activity.avoid.map((item) => `• ${item}`).join("\n");
    sections.push(`AVOID:\n${items}`);
  }

  if (activity.notes) {
    sections.push(`NOTES:\n${activity.notes}`);
  }

  if (activity.links && activity.links.length > 0) {
    const items = activity.links
      .map((link) => `• ${link.text} — ${link.url}`)
      .join("\n");
    sections.push(`LINKS:\n${items}`);
  }

  return sections.join("\n\n");
}

function getScheduledDays(activityId) {
  const days = [];
  WEEKLY_PLAN.forEach((dayPlan, dayIdx) => {
    const found = dayPlan.activities.some((a) => a.id === activityId);
    if (found) {
      days.push(dayIdx);
    }
  });
  return days.sort((a, b) => a - b);
}

export function migrateIfNeeded(currentHabits, addHabit, userId) {
  const flagKey = `${userId}_habits-migrated`;
  if (localStorage.getItem(flagKey)) {
    return;
  }

  if (currentHabits.length > 0) {
    localStorage.setItem(flagKey, "true");
    return;
  }

  // Migrate standard activities from ACTIVITIES
  const migratedIds = new Set();
  for (const [id, activity] of Object.entries(ACTIVITIES)) {
    const days = getScheduledDays(id);
    const categoryId = PRIORITY_TO_CATEGORY[activity.priority] || "fitness";
    addHabit({
      name: activity.name,
      icon: activity.icon,
      categoryId,
      days,
      notes: buildNotes(activity),
    });
    migratedIds.add(id);
  }

  // Migrate custom activities embedded in WEEKLY_PLAN
  WEEKLY_PLAN.forEach((dayPlan, dayIdx) => {
    dayPlan.activities.forEach((entry) => {
      if (entry.customActivity && !migratedIds.has(entry.id)) {
        const activity = entry.customActivity;
        const categoryId =
          PRIORITY_TO_CATEGORY[activity.priority] || "fitness";
        addHabit({
          name: activity.name,
          icon: activity.icon,
          categoryId,
          days: [dayIdx],
          notes: buildNotes(activity),
        });
        migratedIds.add(entry.id);
      }
    });
  });

  localStorage.setItem(flagKey, "true");
}
