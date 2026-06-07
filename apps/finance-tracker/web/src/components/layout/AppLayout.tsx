import { useCallback, useState } from "react";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";

import { AppHeader } from "@/components/layout/AppHeader";
import {
  BottomTabBar,
  type BottomTabId,
} from "@/components/layout/BottomTabBar";
import { FabMenu } from "@/components/layout/FabMenu";
import { SearchCommand, SearchOverlay } from "@/components/search/SearchCommand";
import { useCommandShortcut } from "@/lib/useCommandShortcut";
import { useIsMobile } from "@/lib/useIsMobile";

/**
 * The shared mobile shell (M10.4): a sticky header, the routed page content, the
 * FAB (add data), and the bottom tab bar pinned to the four primary
 * destinations. The bottom bar drives navigation — selecting a tab routes to its
 * destination, and the active tab is derived from the current pathname so it
 * stays correct on deep links and back/forward.
 *
 * M13: the "Search" tab no longer navigates — it opens the full-screen search
 * overlay (M13.5). The same search palette is also reachable globally via
 * Cmd/Ctrl-K (M13.1), rendered here as a centred command dialog. Activity still
 * maps to the nearest shipped surface (/import) until it has its own route.
 */
const TAB_TO_PATH: Record<Exclude<BottomTabId, "search">, string> = {
  portfolio: "/portfolio",
  activity: "/import",
  settings: "/settings",
};

function activeTabForPath(pathname: string): BottomTabId {
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/import")) return "activity";
  // /portfolio and /account/* both belong under the portfolio destination.
  return "portfolio";
}

export function AppLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isMobile = useIsMobile();

  // The Cmd-K command palette (desktop) and the full-screen overlay (mobile)
  // share one open-state; the trigger differs but they show the same search.
  const [searchOpen, setSearchOpen] = useState(false);
  const toggleSearch = useCallback(() => setSearchOpen((prev) => !prev), []);
  useCommandShortcut(toggleSearch);

  // The Search tab reflects as active while the overlay is open; otherwise the
  // active tab is derived from the route.
  const activeId: BottomTabId = searchOpen
    ? "search"
    : activeTabForPath(pathname);

  function handleTabSelect(id: BottomTabId) {
    if (id === "search") {
      setSearchOpen(true);
      return;
    }
    navigate({ to: TAB_TO_PATH[id] });
  }

  return (
    <div className="min-h-screen bg-bg text-fg">
      <AppHeader />

      <main className="mx-auto max-w-2xl px-4 pb-28 pt-4">
        <Outlet />
      </main>

      <FabMenu
        onUpload={() => navigate({ to: "/import" })}
        onAdd={() => navigate({ to: "/import" })}
      />
      <BottomTabBar activeId={activeId} onSelect={handleTabSelect} />

      {/* One presentation at a time so two palettes never stack. Mobile gets the
          full-screen overlay (M13.5); desktop gets the centred Cmd-K dialog. */}
      {isMobile ? (
        <SearchOverlay open={searchOpen} onOpenChange={setSearchOpen} />
      ) : (
        <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} />
      )}
    </div>
  );
}
