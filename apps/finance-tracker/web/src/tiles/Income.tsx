import { useMemo } from "react";

import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { formatEur, formatPct } from "@/lib/format";

import { computeIncome } from "./incomeMath";
import { TileCard, TileEmpty, TileSkeleton } from "./TileCard";
import { usePortfolioData } from "./usePortfolioData";
import type { TileProps } from "./types";

/**
 * M11.5 — Income tile.
 *
 * Headline = expected annual dividend income (EUR) + the portfolio-wide weighted
 * dividend yield. Positions without yield data are skipped (see incomeMath), so
 * a coverage footnote explains the headline only reflects the covered subset.
 */
export function Income({ accountIds }: TileProps) {
  const { data, isLoading } = usePortfolioData(accountIds);

  const result = useMemo(
    () => (data ? computeIncome(data.positions) : null),
    [data],
  );

  const hasData = result != null && result.totalValueEur > 0;
  const partialCoverage =
    result != null && result.coveredFraction < 0.999;

  return (
    <TileCard title="Income" infoHash="income">
      {isLoading ? (
        <TileSkeleton />
      ) : !hasData ? (
        <TileEmpty message="No positions to estimate income from yet." />
      ) : (
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <AnimatedNumber
              value={result.expectedAnnualEur}
              format={formatEur}
              className="text-2xl font-semibold tabular-nums text-fg"
            />
            <span className="text-sm tabular-nums text-muted">
              {formatPct(result.weightedYield).replace("+", "")} yield
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Estimated annual dividends across {result.contributingCount} income
            position{result.contributingCount === 1 ? "" : "s"}.
          </p>
          {partialCoverage ? (
            <p className="mt-2 text-[11px] text-muted">
              Based on{" "}
              <span className="font-medium text-fg">
                {formatPct(result.coveredFraction).replace("+", "")}
              </span>{" "}
              of the portfolio with dividend data; the rest is treated as
              non-yielding.
            </p>
          ) : null}
        </div>
      )}
    </TileCard>
  );
}
