"use client";

import type { VocabularyItem } from "@/types/chapter";
import { useState, useEffect } from "react";
import { PlayButton } from "@/components/audio/PlayButton";
import { createFlashCard } from "@/lib/srs";
import { useStorage } from "@/hooks/useStorage";

interface VocabularySectionProps {
  vocabulary: VocabularyItem[];
  chapterId: number;
}

export function VocabularySection({
  vocabulary,
  chapterId,
}: VocabularySectionProps) {
  const storage = useStorage();
  const [revealedWords, setRevealedWords] = useState<Set<number>>(new Set());
  const [addedWords, setAddedWords] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFlashcards() {
      const existing = await storage.getFlashcards();
      setAddedWords(new Set(existing.map((c) => c.id)));
      setLoading(false);
    }
    loadFlashcards();
  }, [storage.getFlashcards]);

  const handleAddWord = async (item: VocabularyItem) => {
    const card = createFlashCard(item.dutch, item.english, chapterId);
    await storage.saveFlashcard(card);
    setAddedWords((prev) => new Set(prev).add(card.id));
  };

  const handleAddAll = async () => {
    for (const item of vocabulary) {
      await handleAddWord(item);
    }
  };

  const allAdded = vocabulary.every((item) => {
    const id = `${chapterId}-${item.dutch.toLowerCase().replace(/\s+/g, "-")}`;
    return addedWords.has(id);
  });

  const toggleReveal = (index: number) => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;

    setRevealedWords((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const q = search.toLowerCase();
  const filtered = q
    ? vocabulary
        .map((item, i) => ({ item, i }))
        .filter(
          ({ item }) =>
            item.dutch.toLowerCase().includes(q) ||
            item.english.toLowerCase().includes(q) ||
            (item.category && item.category.toLowerCase().includes(q)),
        )
    : vocabulary.map((item, i) => ({ item, i }));

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold text-slate-900">Woordenlijst</h2>
        <button
          onClick={handleAddAll}
          disabled={loading || allAdded}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
            loading || allAdded
              ? "bg-slate-100 text-slate-400 cursor-default"
              : "bg-orange-100 text-orange-700 hover:bg-orange-200"
          }`}
        >
          {loading ? "Loading..." : allAdded ? "All added ✓" : "Add all to Flashcards"}
        </button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200">
        {/* Search bar */}
        <div className="px-3 py-2 border-b border-slate-100">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search words..."
            className="w-full text-sm py-1.5 px-3 rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent"
          />
        </div>

        {/* Word count */}
        <div className="px-4 py-1.5 border-b border-slate-100 text-xs text-slate-400">
          {filtered.length} {search ? "matches" : "words"}
        </div>

        {/* Word list */}
        <div className="divide-y divide-slate-100">
          {filtered.length === 0 && (
            <p className="px-4 py-4 text-sm text-slate-400">
              No words match &ldquo;{search}&rdquo;
            </p>
          )}
          {filtered.map(({ item, i }) => {
            const cardId = `${chapterId}-${item.dutch.toLowerCase().replace(/\s+/g, "-")}`;
            const isAdded = addedWords.has(cardId);

            return (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2.5 lg:px-6 lg:py-3 hover:bg-slate-50 cursor-pointer select-text"
                onClick={() => toggleReveal(i)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <PlayButton text={item.dutch} />
                  <span className="font-medium text-slate-900 text-sm truncate">
                    {item.dutch}
                  </span>
                  {item.category && (
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded hidden sm:inline">
                      {item.category}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-sm transition-opacity duration-200 ${
                      revealedWords.has(i)
                        ? "opacity-100 text-slate-600"
                        : "opacity-0"
                    }`}
                  >
                    {item.english}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isAdded) handleAddWord(item);
                    }}
                    className={`text-xs w-6 h-6 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                      isAdded
                        ? "bg-green-100 text-green-600"
                        : "bg-slate-100 text-slate-400 hover:bg-orange-100 hover:text-orange-600"
                    }`}
                    title={isAdded ? "Added to flashcards" : "Add to flashcards"}
                  >
                    {isAdded ? "✓" : "+"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
