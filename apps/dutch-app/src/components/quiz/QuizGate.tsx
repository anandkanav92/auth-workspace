"use client";

import { useStorage } from "@/hooks/useStorage";
import { LockedFeature } from "@/components/auth/LockedFeature";
import { QuizRunner } from "./QuizRunner";
import type { Exercise } from "@/types/chapter";

interface QuizGateProps {
  exercises: Exercise[];
  chapterId: number;
  chapterTitle: string;
}

export function QuizGate({ exercises, chapterId, chapterTitle }: QuizGateProps) {
  const { isAuthenticated } = useStorage();

  if (!isAuthenticated) {
    return <LockedFeature feature="Quiz" />;
  }

  return (
    <QuizRunner
      exercises={exercises}
      chapterId={chapterId}
      chapterTitle={chapterTitle}
    />
  );
}
