import { useMemo } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

import { formatEur, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

import { computeMovers, type MoverEntry } from "./moversMath";
import { TileCard, TileEmpty, TileSkeleton } from "./TileCard";
import { usePortfolioData } from "./usePortfolioData";
import type { TileProps } from "./types";

function MoverRow({ entry, gain }: { entry: MoverEntry; gain: boolean }) {
  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span className="min-w-0 truncate font-medium text-fg">{entry.ticker}</span>
      <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
        <span className={cn("font-semibold", gain ? "text-success" : "text-danger")}>
          {formatPct(entry.returnPct)}
        </span>
        <span className="text-xs text-muted">{formatEur(entry.returnEur)}</span>
      </span>
    </li>
  );
}

/**
 * Movers — the portfolio's biggest gainers and losers by unrealised return %.
 * Cost-bearing positions only (return needs a cost basis).
 */
export function Movers({ accountIds }: TileProps) {
  const { data, isLoading } = usePortfolioData(accountIds);
  const result = useMemo(
    () => (data ? computeMovers(data.positions) : null),
    [data],
  );

  return (
    <TileCard title="Movers" infoHash="movers">
      {isLoading ? (
        <TileSkeleton />
      ) : !result || result.consideredCount === 0 ? (
        <TileEmpty message="Gainers and losers need a cost basis (e.g. Trading 212 holdings)." />
      ) : (
        <div className="space-y-3">
          <section>
            <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <TrendingUp className="h-3.5 w-3.5 text-success" aria-hidden />
              Gainers
            </h4>
            {result.gainers.length ? (
              <ul className="space-y-1.5">
                {result.gainers.map((e) => (
                  <MoverRow key={e.ticker} entry={e} gain />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No positions in the green.</p>
            )}
          </section>

          <section>
            <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <TrendingDown className="h-3.5 w-3.5 text-danger" aria-hidden />
              Losers
            </h4>
            {result.losers.length ? (
              <ul className="space-y-1.5">
                {result.losers.map((e) => (
                  <MoverRow key={e.ticker} entry={e} gain={false} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No positions in the red.</p>
            )}
          </section>
        </div>
      )}
    </TileCard>
  );
}
