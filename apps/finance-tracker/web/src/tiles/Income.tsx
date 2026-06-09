import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { useFullLedger } from "@/lib/activity";
import { api } from "@/lib/api";
import { formatEur, formatPct } from "@/lib/format";

import { computeIncome } from "./incomeMath";
import { computePortfolioReturns } from "./returnsMath";
import { TileCard, TileEmpty, TileSkeleton } from "./TileCard";
import { usePortfolioData } from "./usePortfolioData";
import type { FxRates, TileProps } from "./types";

/**
 * M11.5 / M6 — Income tile.
 *
 * Headline = ACTUAL dividends received in the trailing 12 months (from the
 * ledger, EUR), with the FORWARD estimate (expected annual income at the current
 * weighted yield) as a secondary line. When the ledger holds NO dividend rows we
 * fall back gracefully to the estimate-only view (the old behaviour).
 */
export function Income({ accountIds }: TileProps) {
  const { data, isLoading: portfolioLoading } = usePortfolioData(accountIds);
  const { data: ledger = [], isLoading: ledgerLoading } = useFullLedger();

  // FX from the cache usePortfolioData already populates; absent → rate-1.
  const { data: fx } = useQuery({
    queryKey: ["fx"],
    queryFn: () => api.get<FxRates | null>("/api/fx"),
    staleTime: 60 * 60_000,
  });

  const estimate = useMemo(
    () => (data ? computeIncome(data.positions) : null),
    [data],
  );

  // Actual trailing-12m dividends, reusing the M6 portfolio-returns math.
  const dividendsEur12m = useMemo(
    () =>
      data
        ? computePortfolioReturns(data.positions, ledger, fx ?? { rates: {} })
            .dividendsEur12m
        : 0,
    [data, ledger, fx],
  );

  // Did the broker ever pay a dividend? Drives the graceful estimate-only
  // fallback (a brand-new account with no dividend history yet).
  const hasDividendRows = useMemo(
    () => ledger.some((t) => t.type === "dividend"),
    [ledger],
  );

  const isLoading = portfolioLoading || ledgerLoading;
  const hasData = estimate != null && estimate.totalValueEur > 0;
  const partialCoverage =
    estimate != null && estimate.coveredFraction < 0.999;

  return (
    <TileCard title="Income" infoHash="income">
      {isLoading ? (
        <TileSkeleton />
      ) : !hasData ? (
        <TileEmpty message="No positions to estimate income from yet." />
      ) : hasDividendRows ? (
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <AnimatedNumber
              value={dividendsEur12m}
              format={formatEur}
              className="text-2xl font-semibold tabular-nums text-fg"
            />
            <span className="text-sm tabular-nums text-muted">received</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Dividends actually received in the last 12 months.
          </p>
          <p className="mt-2 text-[11px] text-muted">
            Estimated forward:{" "}
            <span className="font-medium text-fg">
              {formatEur(estimate.expectedAnnualEur)}
            </span>{" "}
            / yr at a{" "}
            {formatPct(estimate.weightedYield).replace("+", "")} weighted yield.
          </p>
        </div>
      ) : (
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <AnimatedNumber
              value={estimate.expectedAnnualEur}
              format={formatEur}
              className="text-2xl font-semibold tabular-nums text-fg"
            />
            <span className="text-sm tabular-nums text-muted">
              {formatPct(estimate.weightedYield).replace("+", "")} yield
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Estimated annual dividends across {estimate.contributingCount} income
            position{estimate.contributingCount === 1 ? "" : "s"} (no dividends
            received yet).
          </p>
          {partialCoverage ? (
            <p className="mt-2 text-[11px] text-muted">
              Based on{" "}
              <span className="font-medium text-fg">
                {formatPct(estimate.coveredFraction).replace("+", "")}
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
