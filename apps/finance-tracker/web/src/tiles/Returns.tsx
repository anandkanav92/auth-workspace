import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { useFullLedger } from "@/lib/activity";
import { api } from "@/lib/api";
import { formatEur, formatPct } from "@/lib/format";

import { computePortfolioReturns } from "./returnsMath";
import { TileCard, TileEmpty, TileSkeleton } from "./TileCard";
import { usePortfolioData } from "./usePortfolioData";
import type { FxRates, TileProps } from "./types";

/** One labelled figure in the Returns grid. */
function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "signed";
  /** When "signed", colour by the leading sign of the formatted value. */
}) {
  const signClass =
    tone === "signed"
      ? value.trimStart().startsWith("-")
        ? "text-danger"
        : "text-success"
      : "text-fg";
  // A full-width row (label left, value right) so long euro amounts never
  // collide — three of these stacked read cleanly even on a narrow phone.
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-lg bg-muted/10 px-3 py-2.5">
      <span className="shrink-0 text-xs text-muted">{label}</span>
      <span
        className={`min-w-0 truncate text-right text-base font-semibold tabular-nums ${signClass}`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * M6 — Returns tile.
 *
 * A compact read on the three P&L figures the rest of the dashboard doesn't
 * surface together: live UNREALISED gain (€ + %), locked-in REALISED gain (€,
 * average-cost over the full ledger), and DIVIDENDS actually received in the
 * trailing 12 months (€). Realised + dividends need the complete ledger, so this
 * tile reads `useFullLedger` rather than the truncated feed.
 */
export function Returns({ accountIds }: TileProps) {
  const { data: portfolio, isLoading: portfolioLoading } =
    usePortfolioData(accountIds);
  const { data: ledger = [], isLoading: ledgerLoading } = useFullLedger();

  // FX from the same cache usePortfolioData populates; absent → rate-1 default.
  const { data: fx } = useQuery({
    queryKey: ["fx"],
    queryFn: () => api.get<FxRates | null>("/api/fx"),
    staleTime: 60 * 60_000,
  });

  const result = useMemo(() => {
    if (!portfolio) return null;
    return computePortfolioReturns(
      portfolio.positions,
      ledger,
      fx ?? { rates: {} },
    );
  }, [portfolio, ledger, fx]);

  const isLoading = portfolioLoading || ledgerLoading;
  const hasData = result != null && (portfolio?.positions.length ?? 0) > 0;

  return (
    <TileCard title="Returns" infoHash="returns">
      {isLoading ? (
        <TileSkeleton />
      ) : !hasData ? (
        <TileEmpty message="No positions to report returns for yet." />
      ) : (
        <div>
          <div className="space-y-2">
            <Metric
              label="Unrealised"
              tone="signed"
              value={formatEur(result.unrealisedEur)}
            />
            <Metric
              label="Realised"
              tone="signed"
              value={formatEur(result.realisedEur)}
            />
            <Metric
              label="Dividends (12m)"
              value={formatEur(result.dividendsEur12m)}
            />
          </div>

          {result.unrealisedPct !== null ? (
            <p className="mt-2 text-xs text-muted">
              Unrealised{" "}
              <span className="font-medium text-fg">
                {formatPct(result.unrealisedPct)}
              </span>{" "}
              over the holdings where we know your cost; realised + dividends are
              actuals from your transaction history.
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted">
              Realised P&amp;L and dividends are actuals from your transaction
              history. Unrealised needs a cost basis, which Revolut doesn&rsquo;t
              provide.
            </p>
          )}
        </div>
      )}
    </TileCard>
  );
}
