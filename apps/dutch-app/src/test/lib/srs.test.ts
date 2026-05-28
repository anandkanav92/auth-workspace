import { describe, it, expect } from "vitest";
import { calculateNextReview, createFlashCard, getDueCards, Rating } from "@/lib/srs";
import type { FlashCard } from "@/lib/srs";

describe("SRS Algorithm (SM-2)", () => {
  const baseCard: FlashCard = {
    id: "test-1",
    dutch: "hallo",
    english: "hello",
    chapterId: 1,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    dueDate: new Date().toISOString(),
  };

  it("schedules Again card for 1 day interval", () => {
    const updated = calculateNextReview(baseCard, Rating.Again);
    expect(updated.interval).toBe(1);
    expect(updated.repetitions).toBe(0);
    expect(updated.easeFactor).toBeLessThan(2.5);
  });

  it("schedules Good card for 1 day on first review", () => {
    const updated = calculateNextReview(baseCard, Rating.Good);
    expect(updated.interval).toBe(1);
    expect(updated.repetitions).toBe(1);
  });

  it("schedules Good card for 6 days on second review", () => {
    const firstReview = calculateNextReview(baseCard, Rating.Good);
    const secondReview = calculateNextReview(firstReview, Rating.Good);
    expect(secondReview.interval).toBe(6);
    expect(secondReview.repetitions).toBe(2);
  });

  it("increases interval with ease factor on subsequent reviews", () => {
    let card = baseCard;
    card = calculateNextReview(card, Rating.Good); // interval = 1
    card = calculateNextReview(card, Rating.Good); // interval = 6
    card = calculateNextReview(card, Rating.Good); // interval = 6 * 2.5 = 15
    expect(card.interval).toBe(15);
    expect(card.repetitions).toBe(3);
  });

  it("Easy increases ease factor", () => {
    const updated = calculateNextReview(baseCard, Rating.Easy);
    expect(updated.easeFactor).toBeGreaterThan(2.5);
  });

  it("Hard decreases ease factor but not below 1.3", () => {
    let card = { ...baseCard, easeFactor: 1.4 };
    card = calculateNextReview(card, Rating.Hard);
    expect(card.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it("resets repetitions on Again", () => {
    let card = calculateNextReview(baseCard, Rating.Good);
    card = calculateNextReview(card, Rating.Good);
    expect(card.repetitions).toBe(2);
    card = calculateNextReview(card, Rating.Again);
    expect(card.repetitions).toBe(0);
    expect(card.interval).toBe(1);
  });

  it("createFlashCard creates card with correct defaults", () => {
    const card = createFlashCard("hallo", "hello", 1);
    expect(card.dutch).toBe("hallo");
    expect(card.english).toBe("hello");
    expect(card.chapterId).toBe(1);
    expect(card.easeFactor).toBe(2.5);
    expect(card.interval).toBe(0);
    expect(card.repetitions).toBe(0);
  });

  it("getDueCards returns only cards due now or earlier", () => {
    const pastCard = { ...baseCard, id: "past", dueDate: new Date(Date.now() - 86400000).toISOString() };
    const futureCard = { ...baseCard, id: "future", dueDate: new Date(Date.now() + 86400000).toISOString() };
    const nowCard = { ...baseCard, id: "now", dueDate: new Date().toISOString() };

    const due = getDueCards([pastCard, futureCard, nowCard]);
    expect(due.map((c) => c.id)).toContain("past");
    expect(due.map((c) => c.id)).toContain("now");
    expect(due.map((c) => c.id)).not.toContain("future");
  });
});
