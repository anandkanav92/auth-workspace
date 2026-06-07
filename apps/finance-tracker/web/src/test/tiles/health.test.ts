import { describe, it, expect } from "vitest";

import { computeHealth } from "@/tiles/healthMath";
import type { Position } from "@/tiles/types";

function pos(
  over: Partial<Position> & Pick<Position, "ticker" | "valueEur">,
): Position {
  return {
    id: over.ticker,
    account: "acc",
    name: over.ticker,
    assetType: "stock",
    quantity: 1,
    price: 1,
    priceCurrency: "USD",
    hasCost: true,
    costEur: 0,
    returnEur: 0,
    returnPct: 0,
    sectorWeightings: null,
    ...over,
  };
}

const byId = (r: ReturnType<typeof computeHealth>) =>
  new Map(r.checks.map((c) => [c.id, c]));

describe("computeHealth", () => {
  it("passes a balanced, fully-priced book", () => {
    // 10 positions @ 10% each, sectors/countries spread 20% each — every check ok.
    const sectors = ["Technology", "Healthcare", "Energy", "Utilities", "Industrials"];
    const countries = ["United States", "Germany", "Japan", "France", "Netherlands"];
    const positions = Array.from({ length: 10 }, (_, i) =>
      pos({
        ticker: `P${i}`,
        valueEur: 100,
        price: 10,
        sector: sectors[i % sectors.length],
        country: countries[i % countries.length],
      }),
    );
    const r = computeHealth(positions);
    const checks = byId(r);
    expect(checks.get("position")!.status).toBe("ok"); // 10% each
    expect(checks.get("sector")!.status).toBe("ok"); // 20% per sector
    expect(checks.get("geo")!.status).toBe("ok"); // 20% per country
    expect(checks.get("priced")!.status).toBe("ok");
    expect(r.passing).toBe(r.total);
  });

  it("warns on a dominant single position and sector", () => {
    const r = computeHealth([
      pos({ ticker: "BIG", valueEur: 900, sector: "Technology", country: "United States" }),
      pos({ ticker: "SMALL", valueEur: 100, sector: "Technology", country: "United States" }),
    ]);
    const checks = byId(r);
    expect(checks.get("position")!.status).toBe("warn"); // 90%
    expect(checks.get("sector")!.status).toBe("warn"); // 100% tech
    expect(checks.get("geo")!.status).toBe("warn"); // 100% US
  });

  it("flags unpriced positions", () => {
    const r = computeHealth([
      pos({ ticker: "OK", valueEur: 100, price: 10 }),
      pos({ ticker: "UNPRICED", valueEur: 0, price: 0 }),
    ]);
    expect(byId(r).get("priced")!.status).toBe("warn");
  });
});
