import { describe, it, expect } from "vitest";

import { formatEur, formatPct, formatDate, formatQty } from "@/lib/format";

// nl-NL currency output places a NON-BREAKING space (U+00A0) between "€" and the
// number. We use an explicit   escape in expected strings so the assertions
// are unambiguous regardless of editor handling of invisible characters.
const NB = " ";

describe("formatEur", () => {
  it("formats a positive amount with comma decimals and dot grouping", () => {
    expect(formatEur(1234.5)).toBe(`€${NB}1.234,50`);
  });

  it("formats large values with thousands grouping", () => {
    expect(formatEur(1234567.89)).toBe(`€${NB}1.234.567,89`);
  });

  it("formats negative values with a leading minus", () => {
    expect(formatEur(-987.65)).toBe(`€${NB}-987,65`);
  });

  it("formats small values to two decimals", () => {
    expect(formatEur(0.01)).toBe(`€${NB}0,01`);
  });

  it("formats zero as € 0,00", () => {
    expect(formatEur(0)).toBe(`€${NB}0,00`);
  });
});

describe("formatPct", () => {
  it("shows an explicit + sign for positive ratios", () => {
    expect(formatPct(0.032)).toBe("+3,20%");
  });

  it("shows a minus sign for negative ratios", () => {
    expect(formatPct(-0.054)).toBe("-5,40%");
  });

  it("renders zero without a sign", () => {
    expect(formatPct(0)).toBe("0,00%");
  });

  it("handles large ratios (>100%)", () => {
    expect(formatPct(1.5)).toBe("+150,00%");
  });

  it("handles very small ratios", () => {
    expect(formatPct(0.0001)).toBe("+0,01%");
  });
});

describe("formatQty", () => {
  it("formats whole quantities without decimals", () => {
    expect(formatQty(1000000)).toBe("1.000.000");
  });

  it("keeps meaningful fractional digits", () => {
    expect(formatQty(12.5)).toBe("12,5");
    expect(formatQty(0.4218)).toBe("0,4218");
  });

  it("caps precision at four fraction digits", () => {
    expect(formatQty(0.123456)).toBe("0,1235");
  });

  it("formats zero as 0", () => {
    expect(formatQty(0)).toBe("0");
  });

  it("formats negative quantities", () => {
    expect(formatQty(-5)).toBe("-5");
  });
});

describe("formatDate", () => {
  it("formats a Date as dd mon yyyy", () => {
    expect(formatDate(new Date(Date.UTC(2026, 5, 7, 12, 0, 0)))).toBe("07 jun 2026");
  });

  it("accepts an epoch-millisecond timestamp", () => {
    expect(formatDate(Date.UTC(2026, 0, 1, 12, 0, 0))).toBe("01 jan 2026");
  });
});
