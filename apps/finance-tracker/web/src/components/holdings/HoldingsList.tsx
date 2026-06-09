import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";

import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { HOLDINGS_KEY } from "@/lib/holdings";
import { usePortfolioData } from "@/tiles/usePortfolioData";
import {
  filterHoldings,
  sortHoldings,
  type HoldingsFilter,
  type SortKey,
} from "@/tiles/holdingsSort";
import type { Holding, Position } from "@/tiles/types";

import { PositionRow } from "./PositionRow";
import { PositionSheet } from "./PositionSheet";

/** Sort options shown in the control; default is the first (Value desc). */
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "value", label: "Value" },
  { key: "pnlEur", label: "P&L €" },
  { key: "pnlPct", label: "P&L %" },
  { key: "name", label: "Name" },
  { key: "weight", label: "Weight" },
];

/**
 * M14.1 / 14.2 / 14.5 — flat holdings list for one account.
 *
 * Data: positions come from the M11 `usePortfolioData` selector scoped to this
 * account (it joins holdings + prices + profiles + FX). We ALSO read the raw
 * `["holdings"]` cache (the same query usePortfolioData already populated) so the
 * detail sheet can drive its mutations off the server-contract Holding (account,
 * ticker, cost in cost_currency), not the EUR-converted Position.
 *
 * Weight (M14.2) is each position's share of THIS account's total value.
 *
 * Virtualisation (M14.1): lists with > 50 rows render through
 * `@tanstack/react-virtual` so a large account stays smooth; smaller lists
 * render plainly (no scroll container) to keep the page flowing naturally.
 *
 * Closed positions (M14.5): a position is "open" when quantity > 0 (mirrors the
 * server's `openOnly` filter on GET /api/holdings, which is the ONLY source of
 * holdings — the server never returns closed rows, so in practice closed rows
 * only appear transiently from an optimistic full-sell before the refetch lands).
 * They are hidden behind a "Show closed" toggle, off by default.
 */

const VIRTUALIZE_THRESHOLD = 50;
const ROW_HEIGHT = 64;

const controlClass =
  "h-8 rounded-md border border-border bg-surface px-2 text-xs text-fg outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function HoldingsList({ accountId }: { accountId: string }) {
  const accountIds = useMemo(() => [accountId], [accountId]);
  const { data, isLoading, isError } = usePortfolioData(accountIds);

  // Raw holdings (same cache usePortfolioData filled) → id-keyed for the sheet.
  const holdingsQuery = useQuery({
    queryKey: HOLDINGS_KEY,
    queryFn: () => api.get<Holding[]>("/api/holdings"),
  });
  const holdingById = useMemo(() => {
    const map = new Map<string, Holding>();
    for (const h of holdingsQuery.data ?? []) map.set(h.id, h);
    return map;
  }, [holdingsQuery.data]);

  const [showClosed, setShowClosed] = useState(false);
  const [selected, setSelected] = useState<Position | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // M5.3 — sort + filter controls. Default sort is Value descending.
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filter, setFilter] = useState<HoldingsFilter>({});

  const positions = data?.positions ?? [];
  const totalValue = data?.totalValueEur ?? 0;

  const openPositions = positions.filter((p) => p.quantity > 0);
  const closedPositions = positions.filter((p) => p.quantity <= 0);

  // Distinct filter options drawn from the positions currently in scope.
  const assetTypes = useMemo(
    () => Array.from(new Set(openPositions.map((p) => p.assetType))).sort(),
    [openPositions],
  );
  const sectors = useMemo(
    () =>
      Array.from(
        new Set(
          openPositions
            .map((p) => p.sector)
            .filter((s): s is string => Boolean(s)),
        ),
      ).sort(),
    [openPositions],
  );

  const base = showClosed
    ? [...openPositions, ...closedPositions]
    : openPositions;
  const visible = useMemo(
    () => sortHoldings(filterHoldings(base, filter), sortKey, sortDir),
    [base, filter, sortKey, sortDir],
  );

  function handleSelect(position: Position) {
    setSelected(position);
    setSheetOpen(true);
  }

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-danger">Could not load holdings.</p>
    );
  }

  if (openPositions.length === 0 && closedPositions.length === 0) {
    return (
      <EmptyState
        title="No holdings yet"
        description="Add a position by hand, or import a broker statement into this account."
        primaryAction={{ label: "Add a position", to: "/import" }}
        secondaryAction={{ label: "Import", to: "/import" }}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {openPositions.length} position
          {openPositions.length === 1 ? "" : "s"}
        </p>
        {closedPositions.length > 0 ? (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={showClosed}
              onChange={(e) => setShowClosed(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-accent"
            />
            Show closed ({closedPositions.length})
          </label>
        ) : null}
      </div>

      {/* M5.3 — sort + filter controls (compact, mobile-friendly). */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <span className="sr-only sm:not-sr-only">Sort</span>
          <select
            aria-label="Sort by"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className={controlClass}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-label={`Sort direction: ${sortDir === "desc" ? "descending" : "ascending"}`}
          onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
          className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-fg"
        >
          {sortDir === "desc" ? "↓" : "↑"}
        </button>

        {assetTypes.length > 1 ? (
          <select
            aria-label="Filter by asset type"
            value={filter.assetType ?? "all"}
            onChange={(e) =>
              setFilter((f) => ({ ...f, assetType: e.target.value }))
            }
            className={controlClass}
          >
            <option value="all">All types</option>
            {assetTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        ) : null}

        {sectors.length > 1 ? (
          <select
            aria-label="Filter by sector"
            value={filter.sector ?? "all"}
            onChange={(e) =>
              setFilter((f) => ({ ...f, sector: e.target.value }))
            }
            className={controlClass}
          >
            <option value="all">All sectors</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {visible.length > VIRTUALIZE_THRESHOLD ? (
        <VirtualRows
          positions={visible}
          totalValue={totalValue}
          onSelect={handleSelect}
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {visible.map((p) => (
            <li key={p.id}>
              <PositionRow
                position={p}
                weight={totalValue > 0 ? p.valueEur / totalValue : 0}
                onSelect={handleSelect}
              />
            </li>
          ))}
        </ul>
      )}

      <PositionSheet
        position={selected}
        holding={selected ? (holdingById.get(selected.id) ?? null) : null}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}

/** Windowed renderer used only past {@link VIRTUALIZE_THRESHOLD} rows. */
function VirtualRows({
  positions,
  totalValue,
  onSelect,
}: {
  positions: Position[];
  totalValue: number;
  onSelect: (position: Position) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: positions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  return (
    <div
      ref={parentRef}
      className="max-h-[70vh] overflow-auto rounded-xl border border-border bg-surface"
      data-testid="holdings-virtual-scroll"
    >
      <div
        style={{ height: virtualizer.getTotalSize(), position: "relative" }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const p = positions[item.index];
          return (
            <div
              key={p.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${item.start}px)`,
              }}
            >
              <PositionRow
                position={p}
                weight={totalValue > 0 ? p.valueEur / totalValue : 0}
                onSelect={onSelect}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
