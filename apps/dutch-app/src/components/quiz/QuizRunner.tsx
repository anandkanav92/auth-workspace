"use client";

import { useState, useMemo } from "react";
import type { Exercise } from "@/types/chapter";
import { scoreQuiz, shuffleArray } from "@/lib/quiz";
import { QuizQuestion } from "./QuizQuestion";
import Link from "next/link";

interface QuizRunnerProps {
  exercises: Exercise[];
  chapterId: number;
  chapterTitle: string;
}

export function QuizRunner({
  exercises,
  chapterId,
  chapterTitle,
}: QuizRunnerProps) {
  const shuffledExercises = useMemo(() => shuffleArray(exercises), [exercises]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  const total = shuffledExercises.length;
  const progress = total > 0 ? Math.round((currentIndex / total) * 100) : 0;

  function handleAnswer(correct: boolean) {
    const newCorrect = correctCount + (correct ? 1 : 0);
    setCorrectCount(newCorrect);

    if (currentIndex + 1 >= total) {
      setFinished(true);
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  }

  function handleRetry() {
    setCurrentIndex(0);
    setCorrectCount(0);
    setFinished(false);
  }

  if (finished) {
    const result = scoreQuiz(correctCount, total);

    return (
      <div className="bg-white rounded-xl border p-8 text-center space-y-6">
        <div>
          <p className="text-sm text-gray-500 mb-1">Quiz Complete</p>
          <h2 className="text-2xl font-bold text-gray-900">
            {result.percentage}%
          </h2>
          <p className="text-gray-600 mt-1">
            {result.correct} out of {result.total} correct
          </p>
        </div>

        <div
          className={`inline-block rounded-full px-4 py-1.5 text-sm font-medium ${
            result.passed
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {result.passed ? "Passed! Gefeliciteerd!" : "Not passed — try again!"}
        </div>

        <div className="flex justify-center gap-3">
          <button
            onClick={handleRetry}
            className="bg-orange-500 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            Try Again
          </button>
          <Link
            href={`/chapter/${chapterId}`}
            className="border border-gray-200 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Back to Chapter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-gray-500">
            Question {currentIndex + 1} of {total}
          </p>
          <Link
            href={`/chapter/${chapterId}`}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            Exit Quiz
          </Link>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-orange-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Current question — key forces remount on index change */}
      <QuizQuestion
        key={currentIndex}
        exercise={shuffledExercises[currentIndex]}
        onAnswer={handleAnswer}
      />
    </div>
  );
}
