"use client";

import { useAuth } from "@myorg/auth-google";
import { useCallback } from "react";
import * as ls from "@/lib/storage";
import * as pbs from "@/lib/pb-storage";
import type { FlashCard } from "@/lib/srs";
import type { ChapterProgress, StreakData } from "@/lib/storage";
import type { Note, NoteCategory } from "@/types/chapter";

export function useStorage() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  // --- Flashcards ---
  const getFlashcards = useCallback(async (): Promise<FlashCard[]> => {
    if (uid) return pbs.pbGetFlashcards(uid);
    return ls.getFlashcards();
  }, [uid]);

  const saveFlashcard = useCallback(
    async (card: FlashCard): Promise<void> => {
      if (uid) {
        await pbs.pbSaveFlashcard(uid, card);
      }
      // Always save to localStorage too (offline cache)
      ls.addFlashcard(card);
    },
    [uid]
  );

  const updateFlashcard = useCallback(
    async (card: FlashCard): Promise<void> => {
      if (uid) {
        await pbs.pbSaveFlashcard(uid, card);
      }
      ls.updateFlashcard(card);
    },
    [uid]
  );

  // --- Chapter Progress ---
  const getChapterProgress = useCallback(
    async (chapterId: number): Promise<ChapterProgress> => {
      if (uid) {
        const progress = await pbs.pbGetChapterProgress(uid, chapterId);
        if (progress) return progress;
      }
      return ls.getChapterProgress(chapterId);
    },
    [uid]
  );

  const updateChapterProgress = useCallback(
    async (
      chapterId: number,
      update: Partial<ChapterProgress>
    ): Promise<void> => {
      if (uid) {
        await pbs.pbUpdateChapterProgress(uid, chapterId, update);
      }
      ls.updateChapterProgress(chapterId, update);
    },
    [uid]
  );

  const getAllProgress = useCallback(async (): Promise<
    Record<number, ChapterProgress>
  > => {
    if (uid) return pbs.pbGetAllProgress(uid);
    return ls.getAllProgress();
  }, [uid]);

  // --- Notes ---
  const getChapterNotes = useCallback(
    async (chapterId: number): Promise<string> => {
      if (uid) return pbs.pbGetNotes(uid, chapterId);
      return ls.getChapterNotes(chapterId);
    },
    [uid]
  );

  const saveChapterNotes = useCallback(
    async (chapterId: number, notes: string): Promise<void> => {
      if (uid) {
        await pbs.pbSaveNotes(uid, chapterId, notes);
      }
      ls.saveChapterNotes(chapterId, notes);
    },
    [uid]
  );

  // --- Notes V2 ---
  const getNotes = useCallback(
    async (chapterId: number): Promise<Note[]> => {
      if (uid) return pbs.pbGetNotesV2(uid, chapterId);
      return ls.getNotesV2(chapterId);
    },
    [uid]
  );

  const saveNote = useCallback(
    async (note: Note): Promise<void> => {
      if (uid) {
        const pbId = await pbs.pbSaveNoteV2(uid, note);
        // Update localStorage cache with PB ID
        ls.saveNoteV2({ ...note, id: pbId });
      } else {
        ls.saveNoteV2(note);
      }
    },
    [uid]
  );

  const updateNote = useCallback(
    async (id: string, text: string, category: NoteCategory): Promise<void> => {
      if (uid) {
        await pbs.pbUpdateNoteV2(id, text, category);
      }
      ls.updateNoteV2(id, text, category);
    },
    [uid]
  );

  const deleteNote = useCallback(
    async (id: string): Promise<void> => {
      if (uid) {
        await pbs.pbDeleteNoteV2(id);
      }
      ls.deleteNoteV2(id);
    },
    [uid]
  );

  // --- Streaks ---
  const getStreak = useCallback(async (): Promise<StreakData> => {
    if (uid) return pbs.pbGetStreak(uid);
    return ls.getStreak();
  }, [uid]);

  const recordStudyDay = useCallback(async (): Promise<StreakData> => {
    if (uid) return pbs.pbRecordStudyDay(uid);
    return ls.recordStudyDay();
  }, [uid]);

  return {
    isAuthenticated: !!uid,
    getFlashcards,
    saveFlashcard,
    updateFlashcard,
    getChapterProgress,
    updateChapterProgress,
    getAllProgress,
    getChapterNotes,
    saveChapterNotes,
    getNotes,
    saveNote,
    updateNote,
    deleteNote,
    getStreak,
    recordStudyDay,
  };
}
