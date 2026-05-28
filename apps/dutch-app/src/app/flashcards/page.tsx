"use client";

import { FlashcardDeck } from "@/components/flashcards/FlashcardDeck";
import { LockedFeature } from "@/components/auth/LockedFeature";
import { useStorage } from "@/hooks/useStorage";

export default function FlashcardsPage() {
  const { isAuthenticated } = useStorage();

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Flashcards</h1>
      <p className="text-gray-500 mb-8">Daily spaced repetition review</p>
      {isAuthenticated ? <FlashcardDeck /> : <LockedFeature feature="Flashcards" />}
    </div>
  );
}
