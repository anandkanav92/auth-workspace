import { describe, it, expect } from "vitest";

import {
  buildTreemapData,
  colorForReturn,
  NEUTRAL_COLOR,
  OTHER_COLOR,
  OTHER_NAME,
} from "@/tiles/treemapMath";
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
    price: over.valueEur,
    priceCurrency: "EUR",
    hasCost: over.returnPct != null,
    costEur: over.returnPct != null ? over.valueEur : null,
    returnEur: null,
    returnPct: over.returnPct ?? null,
    sectorWeightings: null,
    ...over,
  };
}

describe("colorForReturn", () => {
  it("returns the neutral colour for a null (no-cost) return", () => {
    expect(colorForReturn(null)).toBe(NEUTRAL_COLOR);
  });

  it("returns a green for gains and a red for losses", () => {
    const gain = colorForReturn(0.5);
    const loss = colorForReturn(-0.5);
    // At full saturation the green channel dominates for gains, red for losses.
    expect(gain).toBe("#10b981"); // emerald-500
    expect(loss).toBe("#ef4444"); // red-500
  });

  it("scales intensity by magnitude (small gain is paler than a big one)", () => {
    expect(colorForReturn(0)).toBe("#d1fae5"); // emerald-100 at break-even
    expect(colorForReturn(1)).toBe("#10b981"); // clamps at saturation
  });
});

describe("buildTreemapData — sizing + colour", () => {
  it("maps each position to a node sized by value, sorted desc", () => {
    const nodes = buildTreemapData([
      pos({ ticker: "A", valueEur: 100, returnPct: 0.2 }),
      pos({ ticker: "B", valueEur: 300, returnPct: -0.1 }),
    ]);
    expect(nodes.map((n) => n.name)).toEqual(["B", "A"]);
    expect(nodes.map((n) => n.value)).toEqual([300, 100]);
    expect(nodes[1].itemStyle.color).toBe(colorForReturn(0.2));
  });

  it("colours a no-cost position neutral and carries its null returnPct", () => {
    const [node] = buildTreemapData([pos({ ticker: "REVO", valueEur: 500 })]);
    expect(node.returnPct).toBeNull();
    expect(node.itemStyle.color).toBe(NEUTRAL_COLOR);
  });

  it("drops zero / negative-value positions (no area to draw)", () => {
    const nodes = buildTreemapData([
      pos({ ticker: "A", valueEur: 100, returnPct: 0.1 }),
      pos({ ticker: "ZERO", valueEur: 0, returnPct: 0.1 }),
    ]);
    expect(nodes.map((n) => n.name)).toEqual(["A"]);
  });
});

describe("buildTreemapData — grouping for 100+ positions", () => {
  function manyPositions(count: number): Position[] {
    // Descending values so the top-N split is deterministic: T0=count, T1=count-1...
    return Array.from({ length: count }, (_, i) =>
      pos({ ticker: `T${i}`, valueEur: count - i, returnPct: 0.1 }),
    );
  }

  it("keeps individual leaves at or below the threshold", () => {
    const nodes = buildTreemapData(manyPositions(100), {
      groupThreshold: 100,
      topN: 50,
    });
    expect(nodes).toHaveLength(100);
    expect(nodes.some((n) => n.name === OTHER_NAME)).toBe(false);
  });

  it("collapses the tail into a drill-down 'Other' node above the threshold", () => {
    const nodes = buildTreemapData(manyPositions(120), {
      groupThreshold: 100,
      topN: 50,
    });
    // 50 leaves + 1 "Other" group.
    expect(nodes).toHaveLength(51);
    const other = nodes[nodes.length - 1];
    expect(other.name).toBe(OTHER_NAME);
    expect(other.itemStyle.color).toBe(OTHER_COLOR);
    // The 70 tail positions become its drill-down children.
    expect(other.children).toHaveLength(70);
  });

  it("conserves total value across the grouping (Other = Σ tail)", () => {
    const positions = manyPositions(120);
    const total = positions.reduce((s, p) => s + p.valueEur, 0);
    const nodes = buildTreemapData(positions, {
      groupThreshold: 100,
      topN: 50,
    });
    const headSum = nodes.slice(0, 50).reduce((s, n) => s + n.value, 0);
    const otherSum = nodes[50].value;
    expect(headSum + otherSum).toBeCloseTo(total, 6);
  });
});
