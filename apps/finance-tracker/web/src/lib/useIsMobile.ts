import { useEffect, useState } from "react";

/**
 * Tracks whether the viewport is below Tailwind's `md` breakpoint (768px).
 *
 * M13.5 uses this to pick the search presentation: a full-screen overlay on
 * mobile, a centred Cmd-K dialog on desktop. Mirrors the matchMedia pattern in
 * `theme.tsx`; defaults to `false` (desktop) when matchMedia is unavailable
 * (SSR / jsdom without a stub).
 */
const MOBILE_QUERY = "(max-width: 767px)";

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
