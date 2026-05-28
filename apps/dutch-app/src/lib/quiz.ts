export interface QuizResult {
  correct: number;
  total: number;
  percentage: number;
  passed: boolean;
}

const PASS_THRESHOLD = 60;

export function scoreQuiz(correct: number, total: number): QuizResult {
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { correct, total, percentage, passed: percentage >= PASS_THRESHOLD };
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
