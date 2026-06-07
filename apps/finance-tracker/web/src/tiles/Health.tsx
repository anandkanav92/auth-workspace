import { useMemo } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { computeHealth } from "./healthMath";
import { TileCard, TileEmpty, TileSkeleton } from "./TileCard";
import { usePortfolioData } from "./usePortfolioData";
import type { TileProps } from "./types";

/**
 * Health checks — concentration/diversification rules of thumb as a pass/warn
 * checklist (largest position, top sector, single-country bias, price coverage).
 */
export function Health({ accountIds }: TileProps) {
  const { data, isLoading } = usePortfolioData(accountIds);
  const result = useMemo(
    () => (data ? computeHealth(data.positions) : null),
    [data],
  );

  const hasPositions = (data?.positions.length ?? 0) > 0;

  return (
    <TileCard title="Health checks" infoHash="health">
      {isLoading ? (
        <TileSkeleton />
      ) : !result || !hasPositions ? (
        <TileEmpty message="Add positions to run the health checks." />
      ) : (
        <div>
          <p className="mb-3 text-sm text-muted">
            <span className="font-semibold text-fg">
              {result.passing} of {result.total}
            </span>{" "}
            checks passing.
          </p>
          <ul className="space-y-2.5">
            {result.checks.map((c) => {
              const ok = c.status === "ok";
              const Icon = ok ? CheckCircle2 : AlertTriangle;
              return (
                <li key={c.id} className="flex items-start gap-2.5">
                  <Icon
                    className={ok ? "mt-0.5 h-4 w-4 shrink-0 text-success" : "mt-0.5 h-4 w-4 shrink-0 text-warning"}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-fg">
                      {c.label}
                    </span>
                    <span className="block text-xs text-muted">{c.detail}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </TileCard>
  );
}
