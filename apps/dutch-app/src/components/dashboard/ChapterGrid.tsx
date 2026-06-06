"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { chapters } from "@/data/chapters";
import { useStorage } from "@/hooks/useStorage";
import { PASS_THRESHOLD } from "@/lib/quiz";
import type { ChapterProgress } from "@/lib/storage";

export function ChapterGrid() {
  const storage = useStorage();
  const [progress, setProgress] = useState<Record<number, ChapterProgress>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProgress() {
      const all = await storage.getAllProgress();
      setProgress(all);
      setLoading(false);
    }
    loadProgress();
  }, [storage.getAllProgress]);

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

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {chapters.map((ch) => (
          <div key={ch.id} className="bg-white rounded-xl border p-5 animate-pulse">
            <div className="h-5 w-24 bg-slate-100 rounded mb-2" />
            <div className="h-3 w-32 bg-slate-100 rounded mb-3" />
            <div className="h-2 bg-slate-100 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {chapters.map((ch) => {
        const cp = progress[ch.id];
        const pct = getCompletionPercent(cp);
        const quizAttempted = !!cp?.exercisesDone;
        const quizScore = cp?.quizBestScore ?? 0;
        const quizPassed = quizScore >= PASS_THRESHOLD;
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
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-gray-400">{pct}% complete</p>
              {quizAttempted ? (
                <span
                  className={`text-[11px] font-semibold ${
                    quizPassed ? "text-green-600" : "text-amber-600"
                  }`}
                >
                  🎯 {quizScore}%{quizPassed ? " ✓" : ""}
                </span>
              ) : (
                <span className="text-[11px] text-gray-300">🎯 —</span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
