import { chapter1 } from "./ch1";
import { chapter2 } from "./ch2";
import { chapter3 } from "./ch3";
import { chapter4 } from "./ch4";
import { chapter5 } from "./ch5";
import { chapter6 } from "./ch6";
import { chapter7 } from "./ch7";
import { chapter8 } from "./ch8";
import { chapter9 } from "./ch9";
import { chapter10 } from "./ch10";
import { chapter11 } from "./ch11";
import { chapter12 } from "./ch12";
import { chapter13 } from "./ch13";
import { chapter14 } from "./ch14";
import { chapter15 } from "./ch15";
import { chapter16 } from "./ch16";
import { chapter17 } from "./ch17";
import { chapter18 } from "./ch18";
import type { Chapter } from "@/types/chapter";

export const chapters: Chapter[] = [chapter1, chapter2, chapter3, chapter4, chapter5, chapter6, chapter7, chapter8, chapter9, chapter10, chapter11, chapter12, chapter13, chapter14, chapter15, chapter16, chapter17, chapter18];

export function getChapter(id: number): Chapter | undefined {
  return chapters.find((c) => c.id === id);
}

export function getAllChapterIds(): number[] {
  return chapters.map((c) => c.id);
}
