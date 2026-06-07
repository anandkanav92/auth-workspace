import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";

import { usePullToRefresh } from "@/lib/usePullToRefresh";
import { cn } from "@/lib/utils";

/**
 * M15.5 — pull-to-refresh container for mobile (portfolio + holdings).
 *
 * Wraps page content in its OWN scroll region (so the touch handler can read a
 * real `scrollTop`) and renders a pull indicator that fades/rotates in as the
 * user drags from the top. On release past the threshold it calls `onRefresh`
 * (which refetches the relevant TanStack queries) and shows a spinner-free
 * settle. Desktop pointers never trigger it — it listens to touch events only.
 *
 * Implementation note: this is a deliberately small hand-rolled handler (no
 * heavy pull-to-refresh dependency), per the milestone scope.
 */
export function PullToRefresh({
  onRefresh,
  children,
  className,
}: {
  onRefresh: () => Promise<unknown> | void;
  children: ReactNode;
  className?: string;
}) {
  const { containerRef, pullDistance, isRefreshing, willRefresh } =
    usePullToRefresh(onRefresh);

  const active = pullDistance > 0 || isRefreshing;
  // The indicator sits above the content and is revealed by the pull translate.
  const indicatorTravel = isRefreshing ? 40 : pullDistance;

  return (
    <div
      ref={containerRef}
      className={cn("relative h-full overflow-y-auto overscroll-y-contain", className)}
    >
      {/* Pull indicator — absolutely positioned, revealed by the content shift. */}
      <div
        aria-hidden={!active}
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center"
        style={{
          height: indicatorTravel,
          opacity: active ? Math.min(1, pullDistance / 70 || 1) : 0,
        }}
      >
        <span
          className={cn(
            "mt-2 flex h-8 w-8 items-center justify-center rounded-full bg-surface text-muted shadow-sm",
            willRefresh && "text-accent",
          )}
        >
          <RefreshCw
            className={cn("h-4 w-4", isRefreshing && "animate-spin")}
            style={
              isRefreshing
                ? undefined
                : { transform: `rotate(${pullDistance * 3}deg)` }
            }
            aria-hidden
          />
        </span>
      </div>

      {/* Content shifts down with the pull so the gesture feels physical. */}
      <div
        style={{
          transform: `translateY(${indicatorTravel}px)`,
          transition: pullDistance > 0 ? "none" : "transform 0.2s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
