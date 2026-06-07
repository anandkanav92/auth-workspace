import { TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

export interface HeroStripProps {
  /** Total portfolio value, in euros (pre-formatted display string). */
  totalValue: string;
  /** Period change as a display string, e.g. "+€1,240.50". */
  changeAbs: string;
  /** Period change percentage as a display string, e.g. "+3.2%". */
  changePct: string;
  /** Sign of the change — drives colour + icon. */
  direction: "up" | "down" | "flat";
  /** Caption describing the comparison window, e.g. "Today". */
  periodLabel?: string;
}

/**
 * Top-of-dashboard summary: total value, the period delta, and a placeholder
 * sparkline area. Real sparkline rendering arrives with the charts milestone;
 * for now we paint a token-coloured gradient strip so the layout reads true.
 */
export function HeroStrip({
  totalValue,
  changeAbs,
  changePct,
  direction,
  periodLabel = "Today",
}: HeroStripProps) {
  const isUp = direction === "up";
  const isDown = direction === "down";

  const deltaColor = isUp
    ? "text-success"
    : isDown
      ? "text-danger"
      : "text-muted";

  const DeltaIcon = isUp ? TrendingUp : isDown ? TrendingDown : null;

  return (
    <section
      aria-label="Portfolio summary"
      className="rounded-xl bg-surface p-5 shadow-sm md:p-6"
    >
      <p className="text-sm font-medium text-muted">Total value</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-fg md:text-4xl">
        {totalValue}
      </p>

      <div className={cn("mt-2 flex items-center gap-1.5 text-sm font-medium", deltaColor)}>
        {DeltaIcon ? <DeltaIcon className="h-4 w-4" aria-hidden /> : null}
        <span className="tabular-nums">{changeAbs}</span>
        <span className="tabular-nums">({changePct})</span>
        <span className="text-muted">· {periodLabel}</span>
      </div>

      {/* Placeholder sparkline area — replaced by a real chart later. */}
      <div
        aria-hidden
        className={cn(
          "mt-4 h-16 w-full rounded-lg bg-gradient-to-r opacity-70 md:h-20",
          isUp
            ? "from-success/5 via-success/20 to-success/5"
            : isDown
              ? "from-danger/5 via-danger/20 to-danger/5"
              : "from-muted/5 via-muted/20 to-muted/5",
        )}
      />
    </section>
  );
}
