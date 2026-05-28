import { describe, it, expect } from "vitest";
import { chapters, getChapter, getAllChapterIds } from "@/data/chapters";

describe("Chapter data", () => {
  it("exports an array of chapters", () => {
    expect(Array.isArray(chapters)).toBe(true);
    expect(chapters.length).toBeGreaterThanOrEqual(1);
  });

  it("chapter 1 has all required fields", () => {
    const ch1 = getChapter(1);
    expect(ch1).toBeDefined();
    expect(ch1!.title).toBe("Welkom");
    expect(ch1!.theme).toBeTruthy();
    expect(ch1!.dialogue.lines.length).toBeGreaterThan(0);
    expect(ch1!.vocabulary.length).toBeGreaterThan(0);
    expect(ch1!.grammar.length).toBeGreaterThan(0);
    expect(ch1!.exercises.length).toBeGreaterThan(0);
    expect(ch1!.pronunciation).toBeDefined();
    expect(ch1!.culture).toBeDefined();
  });

  it("every vocabulary item has dutch and english", () => {
    const ch1 = getChapter(1)!;
    ch1.vocabulary.forEach((v) => {
      expect(v.dutch).toBeTruthy();
      expect(v.english).toBeTruthy();
    });
  });

  it("every exercise has a valid type", () => {
    const ch1 = getChapter(1)!;
    const validTypes = ["fill_blank", "translate", "multiple_choice", "word_order"];
    ch1.exercises.forEach((ex) => {
      expect(validTypes).toContain(ex.type);
    });
  });

  it("getAllChapterIds returns array of ids", () => {
    const ids = getAllChapterIds();
    expect(ids).toContain(1);
  });

  it("getChapter returns undefined for non-existent id", () => {
    expect(getChapter(999)).toBeUndefined();
  });
});
