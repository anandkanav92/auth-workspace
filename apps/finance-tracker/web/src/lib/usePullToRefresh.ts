import { useCallback, useEffect, useRef, useState } from "react";

/**
 * M15.5 — lightweight pull-to-refresh for mobile.
 *
 * No library: a small touch handler on a scroll container. When the user is at
 * the very top (scrollTop === 0) and drags down past a threshold, we call
 * `onRefresh` and expose the live pull distance so the caller can render an
 * indicator. Pull distance is dampened (logarithmic-ish) so it feels rubber-band
 * rather than 1:1, and capped.
 *
 * Returns a ref to attach to the scrollable element plus UI state. The handler
 * is passive where it can be; the touchmove listener is non-passive only while a
 * pull is active so we can `preventDefault` the native overscroll during a pull.
 *
 * Guards:
 *  - only engages when the container is scrolled to the top;
 *  - only engages on a net-downward drag;
 *  - ignores re-entrancy while a refresh is already in flight.
 */
export interface PullToRefreshState {
  /** Attach to the scroll container (the element the user drags). */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Current dampened pull distance in px (0 when idle). */
  pullDistance: number;
  /** True while `onRefresh`'s promise is pending. */
  isRefreshing: boolean;
  /** True once the pull has crossed the trigger threshold. */
  willRefresh: boolean;
}

const THRESHOLD = 70; // px of dampened pull needed to trigger
const MAX_PULL = 110; // px cap on the indicator travel
const DAMPING = 0.5; // how much raw drag translates to visible pull

export function usePullToRefresh(
  onRefresh: () => Promise<unknown> | void,
): PullToRefreshState {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const startY = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Keep the latest onRefresh without re-binding listeners each render.
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const finishRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await onRefreshRef.current();
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function handleTouchStart(e: TouchEvent) {
      // Only arm a pull when starting from the very top and not mid-refresh.
      if (el!.scrollTop <= 0 && !isRefreshing) {
        startY.current = e.touches[0].clientY;
      } else {
        startY.current = null;
      }
    }

    function handleTouchMove(e: TouchEvent) {
      if (startY.current === null || isRefreshing) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        // Upward / no drag — let native scroll handle it.
        setPullDistance(0);
        return;
      }
      // Dampen + cap the pull so it reads as a rubber-band.
      const damped = Math.min(MAX_PULL, delta * DAMPING);
      setPullDistance(damped);
      // Prevent native overscroll/bounce while actively pulling down at the top.
      if (e.cancelable) e.preventDefault();
    }

    function handleTouchEnd() {
      if (startY.current === null) return;
      const shouldRefresh = pullDistance >= THRESHOLD;
      startY.current = null;
      if (shouldRefresh) {
        void finishRefresh();
      } else {
        setPullDistance(0);
      }
    }

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    // non-passive so handleTouchMove can preventDefault during an active pull.
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    el.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [pullDistance, isRefreshing, finishRefresh]);

  return {
    containerRef,
    pullDistance,
    isRefreshing,
    willRefresh: pullDistance >= THRESHOLD,
  };
}
