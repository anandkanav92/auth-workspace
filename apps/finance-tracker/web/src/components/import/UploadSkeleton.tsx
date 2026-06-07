import { Skeleton } from "@/components/ui/skeleton";

/**
 * M12.2 — loading state shown while the BFF parses the PDF, dedups it, diffs it
 * against current holdings, and enriches new tickers. The shape echoes the
 * preview screen so the transition feels continuous (no spinner — design §8).
 */
export function UploadSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Parsing statement">
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
      <span className="sr-only">Parsing your statement…</span>
    </div>
  );
}
