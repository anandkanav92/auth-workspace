import { formatEur, formatPct, formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Position } from "@/tiles/types";

/**
 * M14.2 — one row in the account holdings list.
 *
 * Layout (single tap target):
 *   [TICKER badge]  Name                         EUR value
 *                   qty · weight%        total P&L (abs + %)
 *
 * P&L: this is TOTAL unrealised P&L (valueEur − costEur). The M11 portfolio
 * model carries no day-change / previous-close field, so a same-day "day P&L"
 * cannot be computed from the available data — we render total P&L only. For a
 * null-cost position (Revolut: no cost_currency), P&L is unknowable and renders
 * "—" per the spike-2 / M11 convention (see Position.hasCost).
 *
 * `weight` is the position's share of the scoped portfolio's total value, passed
 * in by the list so the row stays a pure presentational component.
 */
export interface PositionRowProps {
  position: Position;
  /** Share of the scoped portfolio value (0..1). */
  weight: number;
  onSelect: (position: Position) => void;
}

export function PositionRow({ position, weight, onSelect }: PositionRowProps) {
  const { ticker, name, quantity, valueEur, hasCost, returnEur, returnPct } =
    position;

  const pnlTone = !hasCost
    ? "text-muted"
    : (returnEur ?? 0) >= 0
      ? "text-success"
      : "text-danger";

  return (
    <button
      type="button"
      onClick={() => onSelect(position)}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`${ticker} ${name}`}
    >
      <span className="inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-md bg-accent/10 px-1.5 text-xs font-semibold tabular-nums text-accent">
        {ticker}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">{name}</p>
        <p className="text-xs text-muted">
          <span className="tabular-nums">{formatQty(quantity)}</span> ·{" "}
          <span className="tabular-nums">
            {formatPct(weight).replace("+", "")}
          </span>
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-medium tabular-nums text-fg">
          {formatEur(valueEur)}
        </p>
        <p className={cn("text-xs tabular-nums", pnlTone)}>
          {hasCost && returnEur !== null ? (
            <>
              {returnEur >= 0 ? "+" : ""}
              {formatEur(returnEur)}
              {returnPct !== null ? (
                <span className="ml-1 opacity-80">
                  ({formatPct(returnPct)})
                </span>
              ) : null}
            </>
          ) : (
            "—"
          )}
        </p>
      </div>
    </button>
  );
}
