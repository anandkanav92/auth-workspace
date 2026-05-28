import pb from "./pb";
import type { FlashCard } from "./srs";
import type { ChapterProgress, StreakData } from "./storage";
import type { Note, NoteCategory } from "@/types/chapter";

// Sanitize strings for PocketBase filter expressions to prevent injection
function sanitize(value: string): string {
  return value.replace(/"/g, '\\"');
}

// --- Flashcards ---

export async function pbGetFlashcards(userId: string): Promise<FlashCard[]> {
  const records = await pb.collection("flashcards").getFullList({
    filter: `userId = "${sanitize(userId)}"`,
  });
  return records.map((r) => ({
    id: r["cardId"] as string,
    dutch: r["dutch"] as string,
    english: r["english"] as string,
    chapterId: r["chapterId"] as number,
    easeFactor: r["easeFactor"] as number,
    interval: r["interval"] as number,
    repetitions: r["repetitions"] as number,
    dueDate: r["dueDate"] as string,
  }));
}

export async function pbSaveFlashcard(
  userId: string,
  card: FlashCard
): Promise<void> {
  const existing = await pb.collection("flashcards").getFullList({
    filter: `userId = "${sanitize(userId)}" && cardId = "${sanitize(card.id)}"`,
  });
  const data = {
    userId,
    cardId: card.id,
    dutch: card.dutch,
    english: card.english,
    chapterId: card.chapterId,
    easeFactor: card.easeFactor,
    interval: card.interval,
    repetitions: card.repetitions,
    dueDate: card.dueDate,
  };
  if (existing.length > 0) {
    await pb.collection("flashcards").update(existing[0].id, data);
  } else {
    await pb.collection("flashcards").create(data);
  }
}

// --- Chapter Progress ---

export async function pbGetChapterProgress(
  userId: string,
  chapterId: number
): Promise<ChapterProgress | null> {
  const records = await pb.collection("chapter_progress").getFullList({
    filter: `userId = "${sanitize(userId)}" && chapterId = ${chapterId}`,
  });
  if (records.length === 0) return null;
  const r = records[0];
  return {
    chapterId: r["chapterId"] as number,
    dialogueRead: r["dialogueRead"] as boolean,
    vocabularyStudied: r["vocabularyStudied"] as boolean,
    grammarStudied: r["grammarStudied"] as boolean,
    exercisesDone: r["exercisesDone"] as boolean,
    pronunciationPracticed: r["pronunciationPracticed"] as boolean,
    cultureRead: r["cultureRead"] as boolean,
    quizBestScore: r["quizBestScore"] as number,
  };
}

export async function pbUpdateChapterProgress(
  userId: string,
  chapterId: number,
  update: Partial<ChapterProgress>
): Promise<void> {
  const records = await pb.collection("chapter_progress").getFullList({
    filter: `userId = "${sanitize(userId)}" && chapterId = ${chapterId}`,
  });
  if (records.length > 0) {
    await pb.collection("chapter_progress").update(records[0].id, update);
  } else {
    await pb.collection("chapter_progress").create({
      userId,
      chapterId,
      dialogueRead: false,
      vocabularyStudied: false,
      grammarStudied: false,
      exercisesDone: false,
      pronunciationPracticed: false,
      cultureRead: false,
      quizBestScore: 0,
      ...update,
    });
  }
}

export async function pbGetAllProgress(
  userId: string
): Promise<Record<number, ChapterProgress>> {
  const records = await pb.collection("chapter_progress").getFullList({
    filter: `userId = "${sanitize(userId)}"`,
  });
  const result: Record<number, ChapterProgress> = {};
  for (const r of records) {
    result[r["chapterId"] as number] = {
      chapterId: r["chapterId"] as number,
      dialogueRead: r["dialogueRead"] as boolean,
      vocabularyStudied: r["vocabularyStudied"] as boolean,
      grammarStudied: r["grammarStudied"] as boolean,
      exercisesDone: r["exercisesDone"] as boolean,
      pronunciationPracticed: r["pronunciationPracticed"] as boolean,
      cultureRead: r["cultureRead"] as boolean,
      quizBestScore: r["quizBestScore"] as number,
    };
  }
  return result;
}

// --- Notes ---

export async function pbGetNotes(
  userId: string,
  chapterId: number
): Promise<string> {
  const records = await pb.collection("notes").getFullList({
    filter: `userId = "${sanitize(userId)}" && chapterId = ${chapterId}`,
  });
  return records.length > 0 ? (records[0]["content"] as string) : "";
}

export async function pbSaveNotes(
  userId: string,
  chapterId: number,
  content: string
): Promise<void> {
  const records = await pb.collection("notes").getFullList({
    filter: `userId = "${sanitize(userId)}" && chapterId = ${chapterId}`,
  });
  if (records.length > 0) {
    await pb.collection("notes").update(records[0].id, { content });
  } else {
    await pb.collection("notes").create({ userId, chapterId, content });
  }
}

// --- Notes V2 (individual note objects) ---

export async function pbGetNotesV2(
  userId: string,
  chapterId: number
): Promise<Note[]> {
  const records = await pb.collection("notes_v2").getFullList({
    filter: `userId = "${sanitize(userId)}" && chapterId = ${chapterId}`,
    sort: "-created",
  });
  return records.map((r) => ({
    id: r.id,
    chapterId: r["chapterId"] as number,
    text: r["text"] as string,
    category: r["category"] as NoteCategory,
    createdAt: r["created"] as string,
    updatedAt: r["updated"] as string,
  }));
}

export async function pbSaveNoteV2(
  userId: string,
  note: Note
): Promise<string> {
  const record = await pb.collection("notes_v2").create({
    userId,
    chapterId: note.chapterId,
    text: note.text,
    category: note.category,
  });
  return record.id; // Return PB-generated ID
}

export async function pbUpdateNoteV2(
  noteId: string,
  text: string,
  category: NoteCategory
): Promise<void> {
  await pb.collection("notes_v2").update(noteId, { text, category });
}

export async function pbDeleteNoteV2(noteId: string): Promise<void> {
  await pb.collection("notes_v2").delete(noteId);
}

// --- Streaks ---

export async function pbGetStreak(userId: string): Promise<StreakData> {
  const records = await pb.collection("streaks").getFullList({
    filter: `userId = "${sanitize(userId)}"`,
  });
  if (records.length === 0) return { currentStreak: 0, lastStudyDate: "" };
  return {
    currentStreak: records[0]["currentStreak"] as number,
    lastStudyDate: records[0]["lastStudyDate"] as string,
  };
}

export async function pbRecordStudyDay(userId: string): Promise<StreakData> {
  const today = new Date().toISOString().slice(0, 10);
  const streak = await pbGetStreak(userId);
  if (streak.lastStudyDate === today) return streak;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const updated: StreakData = {
    currentStreak:
      streak.lastStudyDate === yesterdayStr ? streak.currentStreak + 1 : 1,
    lastStudyDate: today,
  };

  const records = await pb.collection("streaks").getFullList({
    filter: `userId = "${sanitize(userId)}"`,
  });
  if (records.length > 0) {
    await pb.collection("streaks").update(records[0].id, updated);
  } else {
    await pb.collection("streaks").create({ userId, ...updated });
  }
  return updated;
}

// --- Direct streak set (for migration, preserves existing streak count) ---

export async function pbSetStreak(
  userId: string,
  streakData: StreakData
): Promise<void> {
  const records = await pb.collection("streaks").getFullList({
    filter: `userId = "${sanitize(userId)}"`,
  });
  if (records.length > 0) {
    await pb.collection("streaks").update(records[0].id, streakData);
  } else {
    await pb.collection("streaks").create({ userId, ...streakData });
  }
}
