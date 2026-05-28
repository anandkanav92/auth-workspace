import { describe, it, expect, beforeEach } from "vitest";
import { getFlashcards, addFlashcard, saveFlashcards, updateFlashcard, getChapterProgress, updateChapterProgress, getStreak, recordStudyDay } from "@/lib/storage";
import { createFlashCard } from "@/lib/srs";

describe("Storage - Flashcards", () => {
  beforeEach(() => { localStorage.clear(); });

  it("returns empty array when no flashcards stored", () => {
    expect(getFlashcards()).toEqual([]);
  });

  it("adds a flashcard", () => {
    const card = createFlashCard("hallo", "hello", 1);
    const cards = addFlashcard(card);
    expect(cards).toHaveLength(1);
    expect(cards[0].dutch).toBe("hallo");
  });

  it("does not add duplicate flashcard", () => {
    const card = createFlashCard("hallo", "hello", 1);
    addFlashcard(card);
    const cards = addFlashcard(card);
    expect(cards).toHaveLength(1);
  });

  it("updates a flashcard", () => {
    const card = createFlashCard("hallo", "hello", 1);
    addFlashcard(card);
    const updated = { ...card, easeFactor: 3.0 };
    const cards = updateFlashcard(updated);
    expect(cards[0].easeFactor).toBe(3.0);
  });
});

describe("Storage - Progress", () => {
  beforeEach(() => { localStorage.clear(); });

  it("returns default progress for unknown chapter", () => {
    const p = getChapterProgress(1);
    expect(p.chapterId).toBe(1);
    expect(p.dialogueRead).toBe(false);
  });

  it("updates chapter progress", () => {
    updateChapterProgress(1, { dialogueRead: true });
    const p = getChapterProgress(1);
    expect(p.dialogueRead).toBe(true);
    expect(p.vocabularyStudied).toBe(false);
  });
});

describe("Storage - Streak", () => {
  beforeEach(() => { localStorage.clear(); });

  it("starts with streak of 0", () => {
    expect(getStreak().currentStreak).toBe(0);
  });

  it("records a study day", () => {
    const streak = recordStudyDay();
    expect(streak.currentStreak).toBe(1);
    expect(streak.lastStudyDate).toBe(new Date().toISOString().slice(0, 10));
  });
});
