import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface TileGridProps {
  children: ReactNode;
  className?: string;
}

/**
 * Responsive holding/widget grid: a single column on mobile, two columns from
 * the `md` breakpoint, three from `xl`. Children are the individual tiles
 * (holding cards, summary widgets, skeletons during load).
 */
export function TileGrid({ children, className }: TileGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
