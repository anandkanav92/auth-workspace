import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";

import { AppHeader } from "@/components/layout/AppHeader";
import {
  BottomTabBar,
  type BottomTabId,
} from "@/components/layout/BottomTabBar";
import { FabMenu } from "@/components/layout/FabMenu";

/**
 * The shared mobile shell (M10.4): a sticky header, the routed page content, the
 * FAB (add data), and the bottom tab bar pinned to the four primary
 * destinations. The bottom bar drives navigation — selecting a tab routes to its
 * destination, and the active tab is derived from the current pathname so it
 * stays correct on deep links and back/forward.
 *
 * Search and Activity don't have dedicated routes yet (M13 / future); they map
 * to the nearest shipped surface so the bar stays fully functional.
 */
const TAB_TO_PATH: Record<BottomTabId, string> = {
  portfolio: "/portfolio",
  search: "/portfolio",
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
  const activeId = activeTabForPath(pathname);

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
      <BottomTabBar
        activeId={activeId}
        onSelect={(id) => navigate({ to: TAB_TO_PATH[id] })}
      />
    </div>
  );
}
