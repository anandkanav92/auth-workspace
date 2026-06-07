import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";

import { AppLayout } from "@/components/layout/AppLayout";
import { LayoutPreview } from "@/dev/LayoutPreview";
import { TilesPreview } from "@/dev/TilesPreview";
import { AccountHoldingsPage } from "@/routes/AccountHoldingsPage";
import { AccountPage } from "@/routes/AccountPage";
import { ImportPage } from "@/routes/ImportPage";
import { LearnPage } from "@/routes/LearnPage";
import { PortfolioPage } from "@/routes/PortfolioPage";
import { SettingsPage } from "@/routes/SettingsPage";

/**
 * M10.4 — code-based (file-less) TanStack Router tree.
 *
 * Structure:
 *   root  (bare <Outlet/>; providers live above the RouterProvider in App.tsx)
 *   ├─ layout  (AppLayout shell: header + bottom tab bar + FAB)
 *   │   ├─ /            -> redirects to /portfolio (default destination)
 *   │   ├─ /portfolio
 *   │   ├─ /account/$id
 *   │   ├─ /account/$id/holdings
 *   │   ├─ /settings
 *   │   └─ /import
 *   ├─ /dev/layout  (standalone visual-QA surface; NOT inside the shell)
 *   └─ /dev/tiles   (standalone analytics-tile gallery; fixture data, no BFF)
 */

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

// Pathless layout route: wraps the primary app surfaces in the AppLayout shell
// without contributing a path segment.
const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  component: AppLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/",
  // Default destination is the portfolio dashboard.
  beforeLoad: () => {
    throw redirect({ to: "/portfolio" });
  },
});

const portfolioRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/portfolio",
  component: PortfolioPage,
});

const accountRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/account/$id",
  component: function AccountRouteComponent() {
    const { id } = accountRoute.useParams();
    return <AccountPage id={id} />;
  },
});

const accountHoldingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/account/$id/holdings",
  component: function AccountHoldingsRouteComponent() {
    const { id } = accountHoldingsRoute.useParams();
    return <AccountHoldingsPage id={id} />;
  },
});

const settingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/settings",
  component: SettingsPage,
});

const importRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/import",
  component: ImportPage,
});

const learnRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/learn",
  component: LearnPage,
});

// Dev-only visual QA surface. Lives outside the AppLayout shell on purpose — it
// renders its own forced light/dark panels.
const devLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dev/layout",
  component: LayoutPreview,
});

// Dev-only analytics-tile gallery. Renders the six REAL tiles populated from a
// seeded fixture cache (no BFF, no auth) so charts can be screenshot-verified.
const devTilesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dev/tiles",
  component: TilesPreview,
});

const routeTree = rootRoute.addChildren([
  appLayoutRoute.addChildren([
    indexRoute,
    portfolioRoute,
    accountRoute,
    accountHoldingsRoute,
    settingsRoute,
    importRoute,
    learnRoute,
  ]),
  devLayoutRoute,
  devTilesRoute,
]);

export const router = createRouter({ routeTree });

// Register the router instance for type-safe Link/navigate inference.
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
