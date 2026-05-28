export type NoteCategory = "vocab" | "grammar" | "general";

/**
 * Auto-categorizes a note into "vocab", "grammar", or "general".
 * Detection priority: vocab → grammar → general (first match wins).
 */
export function categorizeNote(text: string): NoteCategory {
  if (isVocab(text)) return "vocab";
  if (isGrammar(text)) return "grammar";
  return "general";
}

// ---------------------------------------------------------------------------
// Vocab detection
// ---------------------------------------------------------------------------

const WORD_TOKEN = /\S+/;

/**
 * Checks for translation-like patterns:
 *  - `word = word`, `word → word`, `word -> word`
 *  - `word - word` (dash with spaces on both sides)
 *  - Contains "betekent" or "vertaling"
 */
function isVocab(text: string): boolean {
  // "betekent" (means) or "vertaling" (translation)
  if (/\bbetekent\b/i.test(text) || /\bvertaling\b/i.test(text)) return true;

  // Separator patterns: =, →, ->
  // Require at least one word-like token on each side
  if (hasSeparatorWithContext(text, /=/) || hasSeparatorWithContext(text, /→/) || hasSeparatorWithContext(text, /->/)
  ) {
    return true;
  }

  // `word - word` pattern (dash flanked by spaces, not compound-word hyphens)
  // We require spaces around the dash AND word-like tokens on each side
  if (/\S+\s+-\s+\S+/.test(text)) {
    return true;
  }

  return false;
}

/** Returns true when `separator` appears with at least one word token on each side. */
function hasSeparatorWithContext(text: string, separator: RegExp): boolean {
  const sepSource = separator.source;
  const pattern = new RegExp(`${WORD_TOKEN.source}\\s*${sepSource}\\s*${WORD_TOKEN.source}`);
  return pattern.test(text);
}

// ---------------------------------------------------------------------------
// Grammar detection
// ---------------------------------------------------------------------------

const GRAMMAR_KEYWORDS: RegExp[] = [
  // Verb terms
  /\bwerkwoord\b/i,
  /\bvervoeging\b/i,
  /\bverleden\s+tijd\b/i,
  /\bvoltooid\s+deelwoord\b/i,
  /\binfinitief\b/i,

  // Noun / adjective terms
  /\bmeervoud\b/i,
  /\benkelvoud\b/i,
  /\bbijvoeglijk\b/i,
  /\bverkleinwoord\b/i,

  // Articles — only specific patterns, not bare "de" / "het"
  /\bde\/het\b/i,
  /\bde-woord\b/i,
  /\bhet-woord\b/i,

  // Sentence structure
  /\bwoordvolgorde\b/i,
  /\binversie\b/i,
  /\bbijzin\b/i,
  /\bhoofdzin\b/i,

  // Abbreviations — uppercase whole-word only
  /\bOVT\b/,
  /\bVTT\b/,
];

/**
 * Conjugation pattern: at least two of these pronoun–verb pairs appearing
 * together in the same note is a strong grammar signal.
 */
const CONJUGATION_PATTERNS: RegExp[] = [
  /\bik\s+ben\b/i,
  /\bjij\s+bent\b/i,
  /\bhij\s+is\b/i,
  /\bzij\s+is\b/i,
  /\bwij\s+zijn\b/i,
  /\bjullie\s+zijn\b/i,
  /\bze\s+zijn\b/i,
  /\bu\s+bent\b/i,
];

function isGrammar(text: string): boolean {
  // Check keyword list
  for (const pattern of GRAMMAR_KEYWORDS) {
    if (pattern.test(text)) return true;
  }

  // Check for conjugation patterns — need at least 2 matches
  let conjugationHits = 0;
  for (const pattern of CONJUGATION_PATTERNS) {
    if (pattern.test(text)) {
      conjugationHits++;
      if (conjugationHits >= 2) return true;
    }
  }

  return false;
}
