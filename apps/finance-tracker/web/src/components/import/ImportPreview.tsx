import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatQty } from "@/lib/format";
import type { DiffEntry, DiffSummary, UploadPreview } from "@/lib/import";

interface ImportPreviewProps {
  preview: UploadPreview;
  /** Whether the commit is in flight (drives the CTA disabled/label). */
  committing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const STATUS_META: Record<
  DiffEntry["status"],
  { label: string; className: string }
> = {
  new: { label: "New", className: "bg-success/10 text-success" },
  changed: { label: "Changed", className: "bg-warning/10 text-warning" },
  unchanged: { label: "Unchanged", className: "bg-muted/10 text-muted" },
  removed: { label: "Removed", className: "bg-danger/10 text-danger" },
};

/** Number of "applied" changes the Confirm CTA counts (excludes unchanged). */
function changeCount(summary: DiffSummary): number {
  return summary.new + summary.changed + summary.removed;
}

/**
 * M12.3 — the review screen. Import is snapshot-replace: the committed
 * statement becomes the account's complete set of holdings, so we show the
 * full reconciliation (current → new per ticker), call out brand-new tickers,
 * and state plainly how many existing positions are being replaced.
 */
export function ImportPreview({
  preview,
  committing,
  onConfirm,
  onCancel,
}: ImportPreviewProps) {
  const { diff, summary } = preview;
  const changes = changeCount(summary);
  const removedCount = summary.removed;
  // Positions currently held = everything the statement kept (changed +
  // unchanged) plus everything it dropped (removed).
  const replacingCount = summary.changed + summary.unchanged + removedCount;
  const newTickerEntries = diff.filter(
    (entry) => entry.isNewTicker && entry.status !== "removed",
  );

  // New + changed + unchanged are the statement's end-state; removed are
  // dropped. Order so the user reads the resulting portfolio top-down.
  const order: Record<DiffEntry["status"], number> = {
    new: 0,
    changed: 1,
    unchanged: 2,
    removed: 3,
  };
  const rows = [...diff].sort((a, b) => order[a.status] - order[b.status]);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-fg">
          Review import
        </h2>
        <p className="text-sm text-muted">
          {replacingCount > 0 ? (
            <>
              Replacing the {replacingCount} previous position
              {replacingCount === 1 ? "" : "s"} in this account with{" "}
              {summary.new + summary.changed + summary.unchanged} from the
              statement.
            </>
          ) : (
            <>
              Adding {summary.new} position{summary.new === 1 ? "" : "s"} to this
              account.
            </>
          )}
        </p>
      </div>

      {newTickerEntries.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
          <div className="text-sm">
            <p className="font-medium text-fg">
              {newTickerEntries.length} new ticker
              {newTickerEntries.length === 1 ? "" : "s"} not seen before
            </p>
            <p className="text-muted">
              {newTickerEntries.map((entry) => entry.ticker).join(", ")}
            </p>
          </div>
        </div>
      )}

      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {rows.map((entry) => (
          <DiffRow key={`${entry.ticker}-${entry.isin}`} entry={entry} />
        ))}
      </ul>

      <div className="sticky bottom-20 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onCancel} disabled={committing}>
          Cancel
        </Button>
        <Button onClick={onConfirm} disabled={committing}>
          {committing
            ? "Importing…"
            : `Confirm ${changes} change${changes === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}

/** A single ticker's current → new quantity transition. */
function DiffRow({ entry }: { entry: DiffEntry }) {
  const meta = STATUS_META[entry.status];
  const showArrow = entry.status === "changed" || entry.status === "removed";

  return (
    <li className="flex items-center justify-between gap-3 bg-surface px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-fg">
            {entry.ticker}
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
              meta.className,
            )}
          >
            {meta.label}
          </span>
        </div>
        {entry.isin && (
          <span className="text-xs text-muted">{entry.isin}</span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 text-sm tabular-nums">
        {showArrow ? (
          <>
            <span className="text-muted line-through">
              {formatQty(entry.currentQuantity)}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-muted" aria-hidden />
            <span className="font-medium text-fg">
              {formatQty(entry.newQuantity)}
            </span>
          </>
        ) : (
          <span className="font-medium text-fg">
            {formatQty(entry.newQuantity)}
          </span>
        )}
      </div>
    </li>
  );
}
