import { Skeleton } from "@/components/ui/skeleton";
import { TileGrid } from "@/components/layout/TileGrid";

/**
 * M15.1 — full-page loading skeleton for the dashboard's first load.
 *
 * Mirrors the real layout: hero summary card, the account-tab row, and a grid of
 * tile-shaped placeholders. Rendered while {@link usePortfolioData} resolves the
 * initial join, so the page settles in one step rather than popping the hero in
 * before the tiles.
 */
export function PortfolioPageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      {/* Hero */}
      <div className="space-y-3 rounded-xl bg-surface p-5 shadow-sm md:p-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-16 w-full rounded-lg md:h-20" />
      </div>

      {/* Account tabs */}
      <div className="flex gap-2">
        <Skeleton className="h-8 w-16 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>

      {/* Tile grid */}
      <TileGrid>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="space-y-3 rounded-xl bg-surface p-4 shadow-sm"
          >
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mx-auto h-28 w-28 rounded-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </TileGrid>
    </div>
  );
}
