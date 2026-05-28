import { FlashcardDeck } from "@/components/flashcards/FlashcardDeck";

export default function FlashcardsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Flashcards</h1>
      <p className="text-gray-500 mb-8">Daily spaced repetition review</p>
      <FlashcardDeck />
    </div>
  );
}
