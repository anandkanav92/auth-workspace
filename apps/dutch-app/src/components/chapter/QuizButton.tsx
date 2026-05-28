"use client";

import Link from "next/link";
import { useStorage } from "@/hooks/useStorage";

export function QuizButton({ chapterId }: { chapterId: number }) {
  const { isAuthenticated } = useStorage();

  if (!isAuthenticated) {
    return (
      <span className="inline-flex items-center gap-1 bg-slate-200 text-slate-400 px-4 py-2 rounded-lg text-sm font-medium shrink-0 cursor-not-allowed">
        🔒 Quiz
      </span>
    );
  }

  return (
    <Link
      href={`/chapter/${chapterId}/quiz`}
      className="inline-block bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 text-sm font-medium shrink-0 shadow-sm"
    >
      Quiz →
    </Link>
  );
}
