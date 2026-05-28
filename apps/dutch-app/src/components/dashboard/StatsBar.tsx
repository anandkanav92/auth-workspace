"use client";

import { useEffect, useState } from "react";
import { getFlashcards } from "@/lib/storage";
import { getDueCards } from "@/lib/srs";
import { getStreak } from "@/lib/storage";

export function StatsBar() {
  const [stats, setStats] = useState({ dueCards: 0, streak: 0, totalCards: 0 });

  useEffect(() => {
    const cards = getFlashcards();
    const due = getDueCards(cards);
    const streak = getStreak();
    setStats({
      dueCards: due.length,
      streak: streak.currentStreak,
      totalCards: cards.length,
    });
  }, []);

  const items = [
    { label: "Cards Due", value: stats.dueCards, icon: "🃏", color: "text-orange-600" },
    { label: "Day Streak", value: stats.streak, icon: "🔥", color: "text-red-500" },
    { label: "Total Cards", value: stats.totalCards, icon: "📚", color: "text-blue-500" },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {items.map((item) => (
        <div key={item.label} className="bg-white rounded-xl border p-4 text-center">
          <p className="text-2xl mb-1">{item.icon}</p>
          <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
          <p className="text-sm text-gray-500">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
