import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";

import { formatEur, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

import { allocate, type AllocationDimension } from "./allocationMath";
import { LazyChart } from "./LazyChart";
import { TileCard, TileEmpty, TileSkeleton } from "./TileCard";
import { usePortfolioData } from "./usePortfolioData";
import type { TileProps } from "./types";

const TABS: { id: AllocationDimension; label: string }[] = [
  { id: "sector", label: "Sector" },
  { id: "country", label: "Country" },
  { id: "currency", label: "Currency" },
];

// A calm, distinguishable palette that reads on both themes.
const PALETTE = [
  "#4f8bff",
  "#3ecf8e",
  "#f59e0b",
  "#a855f7",
  "#ef4444",
  "#06b6d4",
  "#84cc16",
  "#ec4899",
  "#64748b",
  "#14b8a6",
];

/**
 * M11.2 — allocation donut with sector / country / currency tabs.
 *
 * Sector aggregation does ETF look-through (spike 3): an ETF spreads its value
 * across `sectorWeightings`, a stock contributes its full value to its single
 * sector. The look-through math lives in `allocation.ts`; this component just
 * renders the active dimension as a donut + ranked list.
 */
export function Allocation({ accountIds }: TileProps) {
  const { data, isLoading } = usePortfolioData(accountIds);
  const [dimension, setDimension] = useState<AllocationDimension>("sector");

  const slices = useMemo(
    () => (data ? allocate(data.positions, dimension) : []),
    [data, dimension],
  );
  const total = useMemo(
    () => slices.reduce((s, x) => s + x.valueEur, 0),
    [slices],
  );

  const option: EChartsOption = useMemo(
    () => ({
      color: PALETTE,
      tooltip: {
        trigger: "item",
        formatter: (p: unknown) => {
          const item = p as { name: string; value: number; percent: number };
          return `${item.name}<br/>${formatEur(item.value)} (${item.percent}%)`;
        },
      },
      series: [
        {
          type: "pie",
          radius: ["55%", "80%"],
          avoidLabelOverlap: true,
          label: { show: false },
          data: slices.map((s) => ({ name: s.name, value: s.valueEur })),
        },
      ],
    }),
    [slices],
  );

  return (
    <TileCard
      title="Allocation"
      action={
        <div className="flex gap-1" role="tablist" aria-label="Allocation dimension">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={dimension === t.id}
              onClick={() => setDimension(t.id)}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                dimension === t.id
                  ? "bg-accent text-accent-fg"
                  : "text-muted hover:text-fg",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      {isLoading ? (
        <TileSkeleton />
      ) : slices.length === 0 ? (
        <TileEmpty message="No positions to allocate yet." />
      ) : (
        <div>
          <LazyChart option={option} ariaLabel={`Allocation by ${dimension}`} />
          <ul className="mt-3 space-y-1.5">
            {slices.slice(0, 6).map((s, i) => (
              <li
                key={s.name}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                    aria-hidden
                  />
                  <span className="truncate text-fg">{s.name}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted">
                  {formatPct(total > 0 ? s.valueEur / total : 0)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </TileCard>
  );
}
