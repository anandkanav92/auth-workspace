import { chapter1 } from "./ch1";
import { chapter2 } from "./ch2";
import { chapter3 } from "./ch3";
import { chapter4 } from "./ch4";
import { chapter5 } from "./ch5";
import { chapter6 } from "./ch6";
import { chapter7 } from "./ch7";
import { chapter8 } from "./ch8";
import { chapter9 } from "./ch9";
import type { Chapter } from "@/types/chapter";

export const chapters: Chapter[] = [chapter1, chapter2, chapter3, chapter4, chapter5, chapter6, chapter7, chapter8, chapter9];

export function getChapter(id: number): Chapter | undefined {
  return chapters.find((c) => c.id === id);
}

export function getAllChapterIds(): number[] {
  return chapters.map((c) => c.id);
}
