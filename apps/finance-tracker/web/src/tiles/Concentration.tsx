import { useMemo } from "react";

import { formatEur, formatPct } from "@/lib/format";

import { topConcentration } from "./concentrationMath";
import { TileCard, TileEmpty, TileSkeleton } from "./TileCard";
import { usePortfolioData } from "./usePortfolioData";
import type { TileProps } from "./types";

/**
 * M11.3 — top-5 concentration.
 *
 * Headline "Your top 5 are X% of the portfolio." over horizontal bars, one per
 * top holding. Bars are widthed by each holding's share of the WHOLE portfolio
 * (CSS bars, no chart needed — keeps the tile light).
 */
export function Concentration({ accountIds }: TileProps) {
  const { data, isLoading } = usePortfolioData(accountIds);

  const result = useMemo(
    () => (data ? topConcentration(data.positions, 5) : null),
    [data],
  );

  // Scale bar width relative to the largest holding so the leader fills the row.
  const maxShare = result?.top[0]?.share ?? 0;

  return (
    <TileCard title="Top 5">
      {isLoading ? (
        <TileSkeleton />
      ) : !result || result.top.length === 0 ? (
        <TileEmpty message="No positions to rank yet." />
      ) : (
        <div>
          <p className="mb-3 text-sm text-muted">
            Your top {result.top.length} are{" "}
            <span className="font-semibold text-fg">
              {formatPct(result.topShare).replace("+", "")}
            </span>{" "}
            of the portfolio.
          </p>
          <ul className="space-y-2.5">
            {result.top.map((e) => (
              <li key={e.ticker}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-medium text-fg">
                    {e.ticker}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted">
                    {formatPct(e.share).replace("+", "")} ·{" "}
                    {formatEur(e.valueEur)}
                  </span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-muted/15"
                  role="progressbar"
                  aria-valuenow={Math.round(e.share * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${e.ticker} share`}
                >
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{
                      width: `${maxShare > 0 ? (e.share / maxShare) * 100 : 0}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </TileCard>
  );
}
