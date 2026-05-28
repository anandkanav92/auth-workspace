import { describe, it, expect } from "vitest";
import { categorizeNote, type NoteCategory } from "../note-categories";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function expectCategory(text: string, expected: NoteCategory) {
  expect(categorizeNote(text)).toBe(expected);
}

// ---------------------------------------------------------------------------
// Vocab detection
// ---------------------------------------------------------------------------

describe("categorizeNote — vocab", () => {
  describe("equals sign (=)", () => {
    it("detects simple word = word", () => {
      expectCategory("huis = house", "vocab");
    });

    it("detects with extra whitespace", () => {
      expectCategory("  huis  =  house  ", "vocab");
    });

    it("detects multi-word translations", () => {
      expectCategory("op zoek naar = looking for", "vocab");
    });
  });

  describe("arrow (→)", () => {
    it("detects word → word", () => {
      expectCategory("vergeten → forgotten", "vocab");
    });
  });

  describe("ASCII arrow (->)", () => {
    it("detects word -> word", () => {
      expectCategory("lopen -> to walk", "vocab");
    });
  });

  describe("dash with spaces ( - )", () => {
    it("detects word - word translation pattern", () => {
      expectCategory("hond - dog", "vocab");
    });

    it("detects with surrounding context", () => {
      expectCategory("het woord: kat - cat", "vocab");
    });
  });

  describe("keywords", () => {
    it("detects 'betekent'", () => {
      expectCategory("'huis' betekent 'house'", "vocab");
    });

    it("detects 'vertaling'", () => {
      expectCategory("De vertaling van dit woord is 'apple'", "vocab");
    });

    it("is case-insensitive for keywords", () => {
      expectCategory("Vertaling: huis = house", "vocab");
      expectCategory("BETEKENT dit iets?", "vocab");
    });
  });

  describe("priority — vocab wins over grammar", () => {
    it("categorizes as vocab even when grammar keywords are present", () => {
      expectCategory("werkwoord: lopen = to walk", "vocab");
    });
  });
});

// ---------------------------------------------------------------------------
// Grammar detection
// ---------------------------------------------------------------------------

describe("categorizeNote — grammar", () => {
  describe("verb terms", () => {
    it("detects werkwoord", () => {
      expectCategory("Het werkwoord 'zijn' is onregelmatig", "grammar");
    });

    it("detects vervoeging", () => {
      expectCategory("De vervoeging van 'hebben'", "grammar");
    });

    it("detects verleden tijd", () => {
      expectCategory("In de verleden tijd verandert de stam", "grammar");
    });

    it("detects voltooid deelwoord", () => {
      expectCategory("Het voltooid deelwoord eindigt op -d of -t", "grammar");
    });

    it("detects infinitief", () => {
      expectCategory("De infinitief van het werkwoord", "grammar");
    });
  });

  describe("noun / adjective terms", () => {
    it("detects meervoud", () => {
      expectCategory("Het meervoud van 'kind' is 'kinderen'", "grammar");
    });

    it("detects enkelvoud", () => {
      expectCategory("Dit woord staat in het enkelvoud", "grammar");
    });

    it("detects bijvoeglijk", () => {
      expectCategory("Een bijvoeglijk naamwoord beschrijft een zelfstandig naamwoord", "grammar");
    });

    it("detects verkleinwoord", () => {
      expectCategory("Een verkleinwoord eindigt op -je", "grammar");
    });
  });

  describe("article patterns", () => {
    it("detects de/het", () => {
      expectCategory("Is dit een de/het woord?", "grammar");
    });

    it("detects de-woord", () => {
      expectCategory("'Tafel' is een de-woord", "grammar");
    });

    it("detects het-woord", () => {
      expectCategory("'Huis' is een het-woord", "grammar");
    });

    it("does NOT match bare 'de' in normal Dutch sentences", () => {
      expectCategory("Ik ga naar de winkel", "general");
    });

    it("does NOT match bare 'het' in normal Dutch sentences", () => {
      expectCategory("Het is mooi weer vandaag", "general");
    });
  });

  describe("sentence structure terms", () => {
    it("detects woordvolgorde", () => {
      expectCategory("De woordvolgorde in het Nederlands", "grammar");
    });

    it("detects inversie", () => {
      expectCategory("Bij inversie komt het werkwoord voor het onderwerp", "grammar");
    });

    it("detects bijzin", () => {
      expectCategory("In een bijzin staat het werkwoord aan het einde", "grammar");
    });

    it("detects hoofdzin", () => {
      expectCategory("De hoofdzin heeft een ander woordvolgorde", "grammar");
    });
  });

  describe("abbreviations (uppercase, whole-word)", () => {
    it("detects OVT", () => {
      expectCategory("De OVT vorm van 'lopen'", "grammar");
    });

    it("detects VTT", () => {
      expectCategory("Gebruik de VTT in perfectum zinnen", "grammar");
    });

    it("does NOT match lowercase ovt/vtt", () => {
      expectCategory("ik heb een ovt gevonden", "general");
    });

    it("does NOT match OVT/VTT as part of a larger word", () => {
      expectCategory("OVTAAK is niet grammatica", "general");
    });
  });

  describe("conjugation patterns", () => {
    it("detects when at least two conjugation pairs appear", () => {
      expectCategory("ik ben, jij bent, hij is — het werkwoord 'zijn'", "grammar");
    });

    it("detects two conjugation pairs without grammar keywords", () => {
      expectCategory("ik ben blij, jij bent lief", "grammar");
    });

    it("does NOT match a single conjugation pair alone", () => {
      expectCategory("ik ben blij vandaag", "general");
    });
  });

  describe("case insensitivity", () => {
    it("matches Werkwoord with capital", () => {
      expectCategory("Werkwoord: lopen", "grammar");
    });

    it("matches MEERVOUD in all-caps", () => {
      expectCategory("MEERVOUD van boek", "grammar");
    });
  });
});

// ---------------------------------------------------------------------------
// General fallback
// ---------------------------------------------------------------------------

describe("categorizeNote — general", () => {
  it("returns general for plain Dutch text", () => {
    expectCategory("Vandaag heb ik Nederlands geleerd", "general");
  });

  it("returns general for English text", () => {
    expectCategory("I need to practice more Dutch", "general");
  });

  it("returns general for empty string", () => {
    expectCategory("", "general");
  });

  it("returns general for whitespace only", () => {
    expectCategory("   ", "general");
  });

  it("returns general for very short notes", () => {
    expectCategory("ok", "general");
  });

  it("returns general for notes with hyphens in compound words (no spaces around dash)", () => {
    expectCategory("Ik woon in een twee-onder-een-kap woning", "general");
  });

  it("returns general for sentences with bare articles", () => {
    expectCategory("De kat zit op het dak", "general");
  });

  it("returns general for a sentence that just happens to have 'de' and 'het'", () => {
    expectCategory("Ik heb het boek van de bibliotheek geleend", "general");
  });
});
