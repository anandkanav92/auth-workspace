import { describe, it, expect } from "vitest";
import { scoreQuiz, shuffleArray } from "@/lib/quiz";

describe("Quiz scoring", () => {
  it("calculates percentage correctly", () => {
    const result = scoreQuiz(7, 10);
    expect(result.percentage).toBe(70);
    expect(result.correct).toBe(7);
    expect(result.total).toBe(10);
  });

  it("handles perfect score", () => {
    const result = scoreQuiz(5, 5);
    expect(result.percentage).toBe(100);
    expect(result.passed).toBe(true);
  });

  it("marks below 60% as not passed", () => {
    const result = scoreQuiz(2, 10);
    expect(result.percentage).toBe(20);
    expect(result.passed).toBe(false);
  });

  it("handles zero total", () => {
    const result = scoreQuiz(0, 0);
    expect(result.percentage).toBe(0);
  });
});

describe("shuffleArray", () => {
  it("returns same length array", () => {
    const arr = [1, 2, 3, 4, 5];
    expect(shuffleArray(arr)).toHaveLength(5);
  });

  it("contains all original elements", () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray(arr);
    arr.forEach((item) => expect(shuffled).toContain(item));
  });

  it("does not mutate original", () => {
    const arr = [1, 2, 3];
    shuffleArray(arr);
    expect(arr).toEqual([1, 2, 3]);
  });
});
