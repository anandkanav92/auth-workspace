import type { FlashCard } from "./srs";
import type { Note, NoteCategory } from "@/types/chapter";

const KEYS = {
  flashcards: "dutch-app-flashcards",
  progress: "dutch-app-progress",
  notes: "dutch-app-notes",
  streak: "dutch-app-streak",
} as const;

function getItem<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function getFlashcards(): FlashCard[] {
  return getItem<FlashCard[]>(KEYS.flashcards, []);
}

export function saveFlashcards(cards: FlashCard[]): void {
  setItem(KEYS.flashcards, cards);
}

export function addFlashcard(card: FlashCard): FlashCard[] {
  const cards = getFlashcards();
  if (cards.find((c) => c.id === card.id)) return cards;
  const updated = [...cards, card];
  saveFlashcards(updated);
  return updated;
}

export function updateFlashcard(updated: FlashCard): FlashCard[] {
  const cards = getFlashcards().map((c) => (c.id === updated.id ? updated : c));
  saveFlashcards(cards);
  return cards;
}

export interface ChapterProgress {
  chapterId: number;
  dialogueRead: boolean;
  vocabularyStudied: boolean;
  grammarStudied: boolean;
  exercisesDone: boolean;
  pronunciationPracticed: boolean;
  cultureRead: boolean;
  quizBestScore: number;
}

export function getChapterProgress(chapterId: number): ChapterProgress {
  const all = getItem<Record<number, ChapterProgress>>(KEYS.progress, {});
  return all[chapterId] ?? {
    chapterId,
    dialogueRead: false,
    vocabularyStudied: false,
    grammarStudied: false,
    exercisesDone: false,
    pronunciationPracticed: false,
    cultureRead: false,
    quizBestScore: 0,
  };
}

export function updateChapterProgress(chapterId: number, update: Partial<ChapterProgress>): void {
  const all = getItem<Record<number, ChapterProgress>>(KEYS.progress, {});
  all[chapterId] = { ...getChapterProgress(chapterId), ...update };
  setItem(KEYS.progress, all);
}

export function getAllProgress(): Record<number, ChapterProgress> {
  return getItem<Record<number, ChapterProgress>>(KEYS.progress, {});
}

export function getChapterNotes(chapterId: number): string {
  const all = getItem<Record<number, string>>(KEYS.notes, {});
  return all[chapterId] ?? "";
}

export function saveChapterNotes(chapterId: number, notes: string): void {
  const all = getItem<Record<number, string>>(KEYS.notes, {});
  all[chapterId] = notes;
  setItem(KEYS.notes, all);
}

// --- Notes V2 (individual note objects) ---

export function generateId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getNotesV2(chapterId: number): Note[] {
  const all = getItem<Note[]>("dutch-app-notes-v2", []);
  return all
    .filter((n) => n.chapterId === chapterId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

export function getAllNotesV2(): Note[] {
  return getItem<Note[]>("dutch-app-notes-v2", []);
}

export function saveNoteV2(note: Note): void {
  const all = getItem<Note[]>("dutch-app-notes-v2", []);
  all.push(note);
  setItem("dutch-app-notes-v2", all);
}

export function updateNoteV2(
  id: string,
  text: string,
  category: NoteCategory
): void {
  const all = getItem<Note[]>("dutch-app-notes-v2", []);
  const idx = all.findIndex((n) => n.id === id);
  if (idx !== -1) {
    all[idx] = { ...all[idx], text, category, updatedAt: new Date().toISOString() };
    setItem("dutch-app-notes-v2", all);
  }
}

export function deleteNoteV2(id: string): void {
  const all = getItem<Note[]>("dutch-app-notes-v2", []);
  setItem(
    "dutch-app-notes-v2",
    all.filter((n) => n.id !== id)
  );
}

export interface StreakData {
  currentStreak: number;
  lastStudyDate: string;
}

export function getStreak(): StreakData {
  return getItem<StreakData>(KEYS.streak, { currentStreak: 0, lastStudyDate: "" });
}

export function recordStudyDay(): StreakData {
  const today = new Date().toISOString().slice(0, 10);
  const streak = getStreak();
  if (streak.lastStudyDate === today) return streak;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const updated: StreakData = {
    currentStreak: streak.lastStudyDate === yesterdayStr ? streak.currentStreak + 1 : 1,
    lastStudyDate: today,
  };
  setItem(KEYS.streak, updated);
  return updated;
}
