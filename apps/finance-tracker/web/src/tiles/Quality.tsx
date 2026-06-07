import { useMemo } from "react";

import { formatPct } from "@/lib/format";

import { computeQuality } from "./qualityMath";
import { TileCard, TileEmpty, TileSkeleton } from "./TileCard";
import { usePortfolioData } from "./usePortfolioData";
import type { TileProps } from "./types";

/** One-line plain-English read on the portfolio's beta. */
function betaInterpretation(beta: number): string {
  if (beta > 1.15) return "more volatile than the market";
  if (beta < 0.85) return "less volatile than the market";
  return "moves roughly with the market";
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-muted/10 p-3">
      <span className="text-xl font-semibold tabular-nums text-fg">{value}</span>
      <span className="mt-0.5 text-[11px] text-muted">{label}</span>
    </div>
  );
}

/**
 * M11.6 — Quality tile.
 *
 * Value-weighted harmonic P/E + value-weighted beta, with a one-line beta
 * interpretation. Reviewer fix I11: loss-making positions (pe ≤ 0) are excluded
 * from the harmonic P/E and called out in a banner.
 */
export function Quality({ accountIds }: TileProps) {
  const { data, isLoading } = usePortfolioData(accountIds);

  const result = useMemo(
    () => (data ? computeQuality(data.positions) : null),
    [data],
  );

  const hasData =
    result != null &&
    (result.weightedPe !== null || result.weightedBeta !== null);

  return (
    <TileCard title="Quality">
      {isLoading ? (
        <TileSkeleton />
      ) : !hasData ? (
        <TileEmpty message="No P/E or beta data for these positions yet." />
      ) : (
        <div>
          <div className="grid grid-cols-2 gap-2">
            <Metric
              label="Weighted P/E"
              value={
                result.weightedPe !== null
                  ? result.weightedPe.toFixed(1)
                  : "—"
              }
            />
            <Metric
              label="Weighted beta"
              value={
                result.weightedBeta !== null
                  ? result.weightedBeta.toFixed(2)
                  : "—"
              }
            />
          </div>

          {result.weightedBeta !== null ? (
            <p className="mt-2 text-xs text-muted">
              Your book {betaInterpretation(result.weightedBeta)} (β{" "}
              {result.weightedBeta.toFixed(2)}).
            </p>
          ) : null}

          {result.excludedCount > 0 ? (
            <p
              className="mt-3 rounded-md bg-muted/10 px-2.5 py-2 text-[11px] text-muted"
              role="note"
            >
              Quality excludes {result.excludedCount} loss-making position
              {result.excludedCount === 1 ? "" : "s"} (
              {formatPct(result.excludedFraction).replace("+", "")} of the
              portfolio).
            </p>
          ) : null}
        </div>
      )}
    </TileCard>
  );
}
