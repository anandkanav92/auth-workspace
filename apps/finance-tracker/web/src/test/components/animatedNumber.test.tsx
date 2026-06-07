import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

/**
 * M15.2 — light coverage only (animations themselves are not unit-tested).
 * We assert the two contract guarantees:
 *   1. the real value is shown immediately on first paint (no spin-up from 0);
 *   2. the formatter is applied to the displayed value.
 */
describe("AnimatedNumber", () => {
  it("renders the formatted value on first paint", () => {
    render(
      <AnimatedNumber value={1234.5} format={(n) => `€${n.toFixed(2)}`} />,
    );
    expect(screen.getByText("€1234.50")).toBeInTheDocument();
  });
});
