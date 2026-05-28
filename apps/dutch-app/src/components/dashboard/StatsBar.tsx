"use client";

import { useEffect, useState } from "react";
import { useStorage } from "@/hooks/useStorage";
import { getDueCards } from "@/lib/srs";

export function StatsBar() {
  const storage = useStorage();
  const [stats, setStats] = useState({ dueCards: 0, streak: 0, totalCards: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      const [cards, streak] = await Promise.all([
        storage.getFlashcards(),
        storage.getStreak(),
      ]);
      const due = getDueCards(cards);
      setStats({
        dueCards: due.length,
        streak: streak.currentStreak,
        totalCards: cards.length,
      });
      setLoading(false);
    }
    loadStats();
  }, [storage.getFlashcards, storage.getStreak]);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border p-4 text-center animate-pulse">
            <div className="h-8 w-8 bg-slate-100 rounded mx-auto mb-1" />
            <div className="h-8 w-12 bg-slate-100 rounded mx-auto" />
            <div className="h-4 w-16 bg-slate-100 rounded mx-auto mt-1" />
          </div>
        ))}
      </div>
    );
  }

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
