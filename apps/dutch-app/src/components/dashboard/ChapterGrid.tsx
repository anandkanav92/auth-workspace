"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { chapters } from "@/data/chapters";
import { getChapterProgress, type ChapterProgress } from "@/lib/storage";

export function ChapterGrid() {
  const [progress, setProgress] = useState<Record<number, ChapterProgress>>({});

  useEffect(() => {
    const p: Record<number, ChapterProgress> = {};
    chapters.forEach((ch) => {
      p[ch.id] = getChapterProgress(ch.id);
    });
    setProgress(p);
  }, []);

  const getCompletionPercent = (cp: ChapterProgress | undefined): number => {
    if (!cp) return 0;
    const fields = [
      cp.dialogueRead,
      cp.vocabularyStudied,
      cp.grammarStudied,
      cp.exercisesDone,
      cp.pronunciationPracticed,
      cp.cultureRead,
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      {chapters.map((ch) => {
        const pct = getCompletionPercent(progress[ch.id]);
        return (
          <Link
            key={ch.id}
            href={`/chapter/${ch.id}`}
            className="bg-white rounded-xl border p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-orange-100 text-orange-700 text-xs font-bold rounded px-2 py-0.5">
                {ch.id}
              </span>
              <h3 className="font-semibold text-sm">{ch.title}</h3>
            </div>
            <p className="text-xs text-gray-400 mb-3 line-clamp-1">{ch.theme}</p>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{pct}% complete</p>
          </Link>
        );
      })}
    </div>
  );
}
