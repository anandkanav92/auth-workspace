import { chapter1 } from "./ch1";
import { chapter2 } from "./ch2";
import { chapter3 } from "./ch3";
import type { Chapter } from "@/types/chapter";

export const chapters: Chapter[] = [chapter1, chapter2, chapter3];

export function getChapter(id: number): Chapter | undefined {
  return chapters.find((c) => c.id === id);
}

export function getAllChapterIds(): number[] {
  return chapters.map((c) => c.id);
}
