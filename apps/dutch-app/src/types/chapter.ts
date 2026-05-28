export interface DialogueLine {
  speaker: string;
  dutch: string;
  english: string;
}

export interface Dialogue {
  lines: DialogueLine[];
}

export interface VocabularyItem {
  dutch: string;
  english: string;
  example?: string;
  category?: string;
}

export interface GrammarRule {
  topic: string;
  explanation: string;
  /** Practical tips for English speakers learning this concept */
  tips?: string[];
  /** Optional reference table (e.g. verb conjugation, pronoun chart) */
  table?: {
    headers: string[];
    rows: string[][];
  };
  examples: { dutch: string; english: string; note?: string }[];
}

export interface ExerciseFillBlank {
  type: "fill_blank";
  prompt: string;
  answer: string;
  hint?: string;
}

export interface ExerciseTranslate {
  type: "translate";
  dutch: string;
  english: string;
  direction: "nl_to_en" | "en_to_nl";
}

export interface ExerciseMultipleChoice {
  type: "multiple_choice";
  question: string;
  options: string[];
  correctIndex: number;
}

export interface ExerciseWordOrder {
  type: "word_order";
  shuffled: string[];
  correct: string;
}

export type Exercise =
  | ExerciseFillBlank
  | ExerciseTranslate
  | ExerciseMultipleChoice
  | ExerciseWordOrder;

export interface Pronunciation {
  focus: string;
  tips: string[];
  practiceWords: { word: string; pronunciation?: string }[];
}

export interface CultureNote {
  topic: string;
  content: string;
}

export interface Chapter {
  id: number;
  title: string;
  theme: string;
  dialogue: Dialogue;
  vocabulary: VocabularyItem[];
  grammar: GrammarRule[];
  exercises: Exercise[];
  pronunciation: Pronunciation;
  culture: CultureNote;
}
