"use client";

import { useState } from "react";
import type { FlashCard } from "@/lib/srs";
import { Rating } from "@/lib/srs";

interface FlashcardCardProps {
  card: FlashCard;
  onRate: (rating: Rating) => void;
}

export function FlashcardCard({ card, onRate }: FlashcardCardProps) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        onClick={() => setFlipped(!flipped)}
        className="w-full max-w-md h-64 bg-white rounded-2xl border-2 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:shadow-md transition-shadow p-8"
      >
        {!flipped ? (
          <>
            <p className="text-2xl font-bold text-gray-900">{card.dutch}</p>
            <p className="text-sm text-gray-400 mt-4">Tap to reveal</p>
          </>
        ) : (
          <>
            <p className="text-lg text-gray-500 mb-2">{card.dutch}</p>
            <p className="text-2xl font-bold text-gray-900">{card.english}</p>
          </>
        )}
      </div>

      {flipped && (
        <div className="flex gap-3">
          {[
            { rating: Rating.Again, label: "Again", color: "bg-red-500" },
            { rating: Rating.Hard, label: "Hard", color: "bg-orange-500" },
            { rating: Rating.Good, label: "Good", color: "bg-green-500" },
            { rating: Rating.Easy, label: "Easy", color: "bg-blue-500" },
          ].map(({ rating, label, color }) => (
            <button
              key={rating}
              onClick={() => {
                onRate(rating);
                setFlipped(false);
              }}
              className={`${color} text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
