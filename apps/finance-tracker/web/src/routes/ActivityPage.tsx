import { useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useActivity,
  type ActivityFilter,
  type LedgerTransaction,
} from "@/lib/activity";
import { summarizeRecent } from "@/lib/activityMath";
import { formatDate, formatEur, formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * M4 — the Activity feed at `/activity`.
 *
 * A chronological (newest-first) feed of ledger events — buys, sells, and
 * dividends from the Trading 212 sync (and manual holdings mutations). Each row
 * shows the date, ticker, a type badge, quantity, price, and a computed value.
 *
 * VALUE/PRICE CONVENTION (mirrors server schemas.ts):
 *   - buy / sell : `price` is per-share → value = quantity × price.
 *   - dividend   : `price` IS the total cash amount paid (income); quantity ×
 *                  price would be meaningless, so we surface `price` as income.
 *
 * Topped by a "Last 30 days" summary card (pure `summarizeRecent`) and a type
 * filter (All / Buys / Sells / Dividends) that scopes the query server-side.
 */

const FILTERS: { id: ActivityFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "buy", label: "Buys" },
  { id: "sell", label: "Sells" },
  { id: "dividend", label: "Dividends" },
];

export function ActivityPage() {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const query = useActivity(filter);

  // The summary card always reflects the full recent ledger, independent of the
  // active type filter — so we fetch it unfiltered.
  const allQuery = useActivity("all");
  const summary = useMemo(
    () => summarizeRecent(allQuery.data ?? [], 30),
    [allQuery.data],
  );

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-fg">
          Activity
        </h1>
        <p className="text-sm text-muted">
          Every buy, sell, and dividend across your accounts.
        </p>
      </div>

      <SummaryCard summary={summary} loading={allQuery.isLoading} />

      <FilterPills active={filter} onSelect={setFilter} />

      {query.isLoading ? (
        <FeedSkeleton />
      ) : query.isError ? (
        <p className="text-sm text-danger" role="alert">
          Could not load your activity. Please try again.
        </p>
      ) : (query.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No activity yet"
          description="Connect Trading 212 and sync to see your buys, sells, and dividends here."
          primaryAction={{ label: "Connect Trading 212", to: "/settings" }}
        />
      ) : (
        <Feed transactions={query.data ?? []} />
      )}
    </div>
  );
}

// --- summary card -----------------------------------------------------------

function SummaryCard({
  summary,
  loading,
}: {
  summary: ReturnType<typeof summarizeRecent>;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        Last 30 days
      </p>
      {loading ? (
        <Skeleton className="mt-2 h-5 w-56" />
      ) : (
        <p className="mt-1 text-sm text-fg">
          <span className="font-semibold">{summary.buys}</span> buys{" "}
          <span className="text-muted">·</span>{" "}
          <span className="font-semibold">{summary.sells}</span> sells{" "}
          <span className="text-muted">·</span>{" "}
          <span className="font-semibold text-accent">
            {formatEur(summary.dividendTotal)}
          </span>{" "}
          dividends
        </p>
      )}
    </div>
  );
}

// --- type filter ------------------------------------------------------------

function FilterPills({
  active,
  onSelect,
}: {
  active: ActivityFilter;
  onSelect: (id: ActivityFilter) => void;
}) {
  return (
    <div role="tablist" aria-label="Activity type" className="flex gap-2">
      {FILTERS.map((f) => {
        const isActive = f.id === active;
        return (
          <button
            key={f.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onSelect(f.id)}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-accent text-accent-fg"
                : "bg-surface text-muted hover:text-fg",
            )}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

// --- feed (grouped by day) --------------------------------------------------

/** A day-of bucket: the day label and that day's events (already newest-first). */
interface DayGroup {
  key: string;
  label: string;
  items: LedgerTransaction[];
}

/**
 * Bucket ledger events by calendar day, preserving the incoming newest-first
 * order (both across days and within a day). Keyed by ISO date so re-renders
 * keep stable keys.
 */
function groupByDay(transactions: LedgerTransaction[]): DayGroup[] {
  const groups: DayGroup[] = [];
  const byKey = new Map<string, DayGroup>();

  for (const tx of transactions) {
    const date = new Date(tx.occurred_at);
    const key = Number.isFinite(date.getTime())
      ? date.toISOString().slice(0, 10)
      : "unknown";
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        label: Number.isFinite(date.getTime())
          ? formatDate(date)
          : "Unknown date",
        items: [],
      };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(tx);
  }

  return groups;
}

function Feed({ transactions }: { transactions: LedgerTransaction[] }) {
  const groups = useMemo(() => groupByDay(transactions), [transactions]);

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.key} className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted">
            {group.label}
          </h2>
          <ul className="space-y-2">
            {group.items.map((tx) => (
              <ActivityRow key={tx.id} tx={tx} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// --- a single ledger row ----------------------------------------------------

function ActivityRow({ tx }: { tx: LedgerTransaction }) {
  const isDividend = tx.type === "dividend";
  const price = tx.price ?? 0;
  // Dividends: `price` is the cash amount (income). Buys/sells: per-share price
  // → value is quantity × price.
  const value = isDividend ? price : tx.quantity * price;

  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <TypeBadge type={tx.type} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-fg">{tx.ticker}</p>
        <p className="text-xs text-muted">
          {isDividend
            ? "Dividend"
            : `${formatQty(tx.quantity)} @ ${formatEur(price)}`}
        </p>
      </div>

      <div className="text-right">
        <p
          className={cn(
            "text-sm font-semibold tabular-nums",
            isDividend ? "text-accent" : "text-fg",
          )}
        >
          {isDividend ? "+" : ""}
          {formatEur(value)}
        </p>
        {isDividend ? (
          <p className="text-xs text-muted">income</p>
        ) : (
          <p className="text-xs text-muted">value</p>
        )}
      </div>
    </li>
  );
}

const BADGE_STYLES: Record<string, { label: string; className: string }> = {
  buy: { label: "Buy", className: "bg-success/15 text-success" },
  sell: { label: "Sell", className: "bg-danger/15 text-danger" },
  dividend: { label: "Dividend", className: "bg-accent/15 text-accent" },
};

function TypeBadge({ type }: { type: LedgerTransaction["type"] }) {
  const style = BADGE_STYLES[type] ?? {
    label: type.charAt(0).toUpperCase() + type.slice(1),
    className: "bg-muted-foreground/15 text-muted",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        style.className,
      )}
    >
      {style.label}
    </span>
  );
}

// --- loading skeleton -------------------------------------------------------

function FeedSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
        >
          <Skeleton className="h-5 w-12 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
