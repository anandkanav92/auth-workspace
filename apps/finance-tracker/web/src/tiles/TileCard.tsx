import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Shared chrome for every analytics tile: a raised surface card with a title
 * and a body slot. Tiles render their own loading skeleton via {@link TileSkeleton}
 * (design §8: skeletons, never spinners) and their own empty state.
 */
export function TileCard({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("rounded-xl bg-surface p-4 shadow-sm", className)}
      aria-label={title}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Body-level loading placeholder used while `usePortfolioData` resolves. */
export function TileSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="mx-auto h-28 w-28 rounded-full" />
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

/** Shared empty state for tiles with no positions in scope. */
export function TileEmpty({ message }: { message: string }) {
  return (
    <p className="py-6 text-center text-sm text-muted">{message}</p>
  );
}
