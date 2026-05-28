export enum Rating {
  Again = 0,
  Hard = 1,
  Good = 2,
  Easy = 3,
}

export interface FlashCard {
  id: string;
  dutch: string;
  english: string;
  chapterId: number;
  easeFactor: number;
  interval: number;
  repetitions: number;
  dueDate: string;
}

export function calculateNextReview(card: FlashCard, rating: Rating): FlashCard {
  let { easeFactor, interval, repetitions } = card;

  const efDelta = 0.1 - (3 - rating) * (0.08 + (3 - rating) * 0.02);
  easeFactor = Math.max(1.3, easeFactor + efDelta);

  if (rating === Rating.Again) {
    repetitions = 0;
    interval = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + interval);

  return { ...card, easeFactor, interval, repetitions, dueDate: dueDate.toISOString() };
}

export function createFlashCard(dutch: string, english: string, chapterId: number): FlashCard {
  return {
    id: `${chapterId}-${dutch.toLowerCase().replace(/\s+/g, "-")}`,
    dutch,
    english,
    chapterId,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    dueDate: new Date().toISOString(),
  };
}

export function getDueCards(cards: FlashCard[]): FlashCard[] {
  const now = new Date();
  return cards
    .filter((c) => new Date(c.dueDate) <= now)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
}
