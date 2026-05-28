"use client";

import { useState } from "react";
import type { Exercise } from "@/types/chapter";

interface QuizQuestionProps {
  exercise: Exercise;
  onAnswer: (correct: boolean) => void;
}

function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase().replace(/[.!?]+$/, "");
}

export function QuizQuestion({ exercise, onAnswer }: QuizQuestionProps) {
  const [userInput, setUserInput] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  function checkAnswer() {
    let correct = false;

    switch (exercise.type) {
      case "fill_blank":
        correct =
          normalizeAnswer(userInput) === normalizeAnswer(exercise.answer);
        break;
      case "translate": {
        const expected =
          exercise.direction === "nl_to_en" ? exercise.english : exercise.dutch;
        correct = normalizeAnswer(userInput) === normalizeAnswer(expected);
        break;
      }
      case "multiple_choice":
        correct = selectedIndex === exercise.correctIndex;
        break;
      case "word_order":
        correct =
          normalizeAnswer(userInput) === normalizeAnswer(exercise.correct);
        break;
    }

    setIsCorrect(correct);
    setSubmitted(true);
  }

  function handleNext() {
    onAnswer(isCorrect);
  }

  function getCorrectAnswer(): string {
    switch (exercise.type) {
      case "fill_blank":
        return exercise.answer;
      case "translate":
        return exercise.direction === "nl_to_en"
          ? exercise.english
          : exercise.dutch;
      case "multiple_choice":
        return exercise.options[exercise.correctIndex];
      case "word_order":
        return exercise.correct;
    }
  }

  const canSubmit =
    exercise.type === "multiple_choice"
      ? selectedIndex !== null
      : userInput.trim().length > 0;

  return (
    <div className="bg-white rounded-xl border p-6 space-y-4">
      {/* Question prompt */}
      <div>
        <span className="text-xs font-medium text-orange-600 uppercase tracking-wide">
          {exercise.type === "fill_blank" && "Fill in the blank"}
          {exercise.type === "translate" &&
            (exercise.direction === "nl_to_en"
              ? "Translate to English"
              : "Translate to Dutch")}
          {exercise.type === "multiple_choice" && "Multiple choice"}
          {exercise.type === "word_order" && "Put the words in order"}
        </span>

        <p className="text-lg font-medium text-gray-900 mt-1">
          {exercise.type === "fill_blank" && exercise.prompt}
          {exercise.type === "translate" &&
            (exercise.direction === "nl_to_en"
              ? exercise.dutch
              : exercise.english)}
          {exercise.type === "multiple_choice" && exercise.question}
          {exercise.type === "word_order" && (
            <span className="flex flex-wrap gap-2 mt-2">
              {exercise.shuffled.map((word, i) => (
                <span
                  key={i}
                  className="bg-orange-50 border border-orange-200 px-3 py-1 rounded-lg text-sm font-medium"
                >
                  {word}
                </span>
              ))}
            </span>
          )}
        </p>

        {exercise.type === "fill_blank" && exercise.hint && (
          <p className="text-sm text-gray-400 mt-1">Hint: {exercise.hint}</p>
        )}
      </div>

      {/* Input area */}
      {exercise.type === "multiple_choice" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {exercise.options.map((option, i) => {
            let buttonStyle =
              "border rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ";

            if (submitted) {
              if (i === exercise.correctIndex) {
                buttonStyle += "bg-green-50 border-green-400 text-green-800";
              } else if (i === selectedIndex && !isCorrect) {
                buttonStyle += "bg-red-50 border-red-400 text-red-800";
              } else {
                buttonStyle += "bg-gray-50 border-gray-200 text-gray-400";
              }
            } else if (i === selectedIndex) {
              buttonStyle += "bg-orange-50 border-orange-400 text-orange-800";
            } else {
              buttonStyle +=
                "bg-white border-gray-200 text-gray-700 hover:border-orange-300 hover:bg-orange-50";
            }

            return (
              <button
                key={i}
                onClick={() => !submitted && setSelectedIndex(i)}
                disabled={submitted}
                className={buttonStyle}
              >
                {option}
              </button>
            );
          })}
        </div>
      ) : (
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !submitted && canSubmit) checkAnswer();
          }}
          disabled={submitted}
          placeholder="Type your answer..."
          className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 disabled:bg-gray-50"
        />
      )}

      {/* Feedback */}
      {submitted && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            isCorrect
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {isCorrect ? (
            "Correct! Goed gedaan!"
          ) : (
            <>
              Incorrect. The correct answer is:{" "}
              <span className="font-semibold">{getCorrectAnswer()}</span>
            </>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-3">
        {!submitted ? (
          <button
            onClick={checkAnswer}
            disabled={!canSubmit}
            className="bg-orange-500 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Check
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="bg-orange-500 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            Next &rarr;
          </button>
        )}
      </div>
    </div>
  );
}
