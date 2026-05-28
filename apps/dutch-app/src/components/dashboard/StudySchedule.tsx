"use client";

import Link from "next/link";

const SCHEDULE = [
  { week: 1, chapters: [1, 2, 3], label: "Review basics" },
  { week: 2, chapters: [4, 5], label: "Streets & Market" },
  { week: 3, chapters: [6, 7], label: "Restaurant & Clothing" },
  { week: 4, chapters: [8, 9], label: "Housing & Doctor" },
  { week: 5, chapters: [1, 2, 3, 4, 5, 6, 7, 8, 9], label: "Full review" },
  { week: 6, chapters: [1, 2, 3, 4, 5, 6, 7, 8, 9], label: "Exam prep" },
];

export function StudySchedule() {
  return (
    <div className="bg-white rounded-xl border p-6">
      <h2 className="font-semibold text-lg mb-4">6-Week Study Schedule</h2>
      <div className="space-y-3">
        {SCHEDULE.map((week) => (
          <div key={week.week} className="flex items-center gap-4">
            <span className="text-sm font-mono text-gray-400 w-16 shrink-0">
              Week {week.week}
            </span>
            <div className="flex gap-1 flex-wrap">
              {week.chapters.map((chId) => (
                <Link
                  key={chId}
                  href={`/chapter/${chId}`}
                  className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded hover:bg-orange-200"
                >
                  {chId}
                </Link>
              ))}
            </div>
            <span className="text-sm text-gray-500">{week.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
