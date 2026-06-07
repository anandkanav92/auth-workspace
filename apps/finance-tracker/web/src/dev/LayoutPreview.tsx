import { useState } from "react";

import { AccountTabs, type AccountTab } from "@/components/layout/AccountTabs";
import { BottomTabBar, type BottomTabId } from "@/components/layout/BottomTabBar";
import { FabMenu } from "@/components/layout/FabMenu";
import { HeroStrip } from "@/components/layout/HeroStrip";
import { TileGrid } from "@/components/layout/TileGrid";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * DEV-ONLY visual QA surface for the layout shell (milestone 9.6).
 *
 * Renders the assembled mobile shell twice, side by side, with the theme FORCED
 * per panel via a `data-theme` attribute on the panel wrapper. Because the
 * design tokens are declared on `:root` / `[data-theme="dark"]`, setting the
 * attribute on a subtree root re-binds the CSS variables for everything inside
 * it — so we get a genuine light/dark comparison on one screen without touching
 * the global ThemeProvider state. Not part of the shipped app.
 */

const ACCOUNT_TABS: AccountTab[] = [
  { id: "all", label: "All" },
  { id: "degiro", label: "DEGIRO" },
  { id: "ibkr", label: "IBKR" },
];

/** A single placeholder holding tile in its skeleton (loading) state. */
function SkeletonTile() {
  return (
    <div className="rounded-xl bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="mt-4 h-6 w-1/2" />
      <Skeleton className="mt-2 h-3 w-1/4" />
    </div>
  );
}

/** The full assembled shell — reused for both the light and dark panels. */
function ShellPreview() {
  const [activeAccount, setActiveAccount] = useState("all");
  const [activeNav, setActiveNav] = useState<BottomTabId>("portfolio");

  return (
    // `relative` so the fixed-position FabMenu / BottomTabBar anchor to this
    // panel for preview purposes. `overflow-hidden` clips them to the panel.
    <div className="relative h-[640px] overflow-hidden bg-bg text-fg">
      <div className="h-full space-y-4 overflow-y-auto px-4 pb-28 pt-4">
        <HeroStrip
          totalValueEur={48213.55}
          changeEur={1240.5}
          changePct={0.0264}
          direction="up"
        />

        <AccountTabs
          tabs={ACCOUNT_TABS}
          activeId={activeAccount}
          onSelect={setActiveAccount}
        />

        <TileGrid>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonTile key={i} />
          ))}
        </TileGrid>
      </div>

      <FabMenu />
      <BottomTabBar activeId={activeNav} onSelect={setActiveNav} />
    </div>
  );
}

interface PanelProps {
  theme: "light" | "dark";
}

function Panel({ theme }: PanelProps) {
  return (
    <div className="flex-1 overflow-hidden rounded-2xl border border-border">
      <div className="border-b border-border bg-surface px-4 py-2 text-sm font-medium capitalize text-fg">
        {theme}
      </div>
      {/* Forcing the theme on this wrapper re-binds the design tokens for the
          whole subtree, independent of the global ThemeProvider. */}
      <div data-theme={theme}>
        <ShellPreview />
      </div>
    </div>
  );
}

export function LayoutPreview() {
  return (
    <div className="min-h-screen bg-bg p-4 text-fg">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Layout preview</h1>
          <p className="text-sm text-muted">
            Dev-only visual QA · forced light + dark panels
          </p>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex flex-col gap-4 md:flex-row">
        <Panel theme="light" />
        <Panel theme="dark" />
      </div>
    </div>
  );
}
