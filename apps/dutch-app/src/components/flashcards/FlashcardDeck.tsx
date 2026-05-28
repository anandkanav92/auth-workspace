"use client";

import { useState, useEffect } from "react";
import { FlashcardCard } from "./FlashcardCard";
import { getDueCards, calculateNextReview, Rating } from "@/lib/srs";
import { getFlashcards, updateFlashcard } from "@/lib/storage";
import type { FlashCard } from "@/lib/srs";
import Link from "next/link";

export function FlashcardDeck() {
  const [dueCards, setDueCards] = useState<FlashCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, total: 0 });

  useEffect(() => {
    const all = getFlashcards();
    const due = getDueCards(all);
    setDueCards(due);
    setSessionStats({ reviewed: 0, total: due.length });
  }, []);

  const handleRate = (rating: Rating) => {
    const card = dueCards[currentIndex];
    const updated = calculateNextReview(card, rating);
    updateFlashcard(updated);
    setSessionStats((s) => ({ ...s, reviewed: s.reviewed + 1 }));
    setCurrentIndex((i) => i + 1);
  };

  if (dueCards.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-4">🎉</p>
        <h2 className="text-xl font-semibold text-gray-700">No cards due!</h2>
        <p className="text-gray-500 mt-2">
          Add vocabulary from chapter lessons, or come back tomorrow.
        </p>
        <Link
          href="/chapter/1"
          className="text-orange-600 hover:underline text-sm mt-4 inline-block"
        >
          Go to Chapter 1 →
        </Link>
      </div>
    );
  }

  if (currentIndex >= dueCards.length) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-4">✅</p>
        <h2 className="text-xl font-semibold text-gray-700">
          Session complete!
        </h2>
        <p className="text-gray-500 mt-2">
          Reviewed {sessionStats.total} cards.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <p className="text-sm text-gray-500">
          {currentIndex + 1} / {dueCards.length} cards
        </p>
        <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all"
            style={{
              width: `${((currentIndex + 1) / dueCards.length) * 100}%`,
            }}
          />
        </div>
      </div>
      <FlashcardCard card={dueCards[currentIndex]} onRate={handleRate} />
    </div>
  );
}
