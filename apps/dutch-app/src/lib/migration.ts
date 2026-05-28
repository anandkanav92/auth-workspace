import * as ls from "./storage";
import * as pbs from "./pb-storage";

export async function migrateLocalStorageToPocketBase(
  userId: string
): Promise<void> {
  const flagKey = `dutch-app-pb-migrated-${userId}`;
  if (typeof window === "undefined") return;
  if (localStorage.getItem(flagKey)) return;

  try {
    // Migrate flashcards
    const flashcards = ls.getFlashcards();
    for (const card of flashcards) {
      await pbs.pbSaveFlashcard(userId, card);
    }

    // Migrate chapter progress
    const progress = ls.getAllProgress();
    for (const [chapterId, p] of Object.entries(progress)) {
      await pbs.pbUpdateChapterProgress(userId, Number(chapterId), p);
    }

    // Migrate notes (check chapters 1-9)
    for (let i = 1; i <= 9; i++) {
      const notes = ls.getChapterNotes(i);
      if (notes) {
        await pbs.pbSaveNotes(userId, i, notes);
      }
    }

    // Migrate streak
    const streak = ls.getStreak();
    if (streak.currentStreak > 0) {
      await pbs.pbRecordStudyDay(userId);
    }

    localStorage.setItem(flagKey, "true");
    console.log("[Migration] localStorage data migrated to PocketBase");
  } catch (err) {
    console.error("[Migration] Failed to migrate:", err);
    // Don't set the flag so it retries next time
  }
}
