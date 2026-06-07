import { useMemo, useState } from "react";

import {
  AccountTabs,
  type AccountTab,
} from "@/components/layout/AccountTabs";
import { HeroStrip } from "@/components/layout/HeroStrip";
import { TileGrid } from "@/components/layout/TileGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import { PortfolioPageSkeleton } from "@/routes/PortfolioPageSkeleton";
import { PHASE_1_TILES } from "@/tiles/registry";
import { usePortfolioData } from "@/tiles/usePortfolioData";

/**
 * Default destination (M10.4) — the global dashboard surface (M9): hero summary
 * strip, account selector, and the Phase 1 tile grid (M11).
 *
 * The page owns the account-scope selection and feeds `{ accountIds }` to each
 * registered tile; each tile loads + joins its own data via `usePortfolioData`
 * (which TanStack Query dedupes across tiles) and renders its own skeleton while
 * loading. The hero strip is driven by the same joined portfolio.
 *
 * M15.1: while the FIRST load is in flight we show a full-page skeleton (hero +
 * tile grid placeholders) instead of a lone hero skeleton, so the layout doesn't
 * pop in two stages.
 * M15.3: empty states — when the user has no accounts at all, or the selected
 * scope holds no positions, we render a single clear CTA instead of a grid of
 * empty tiles.
 */
export function PortfolioPage() {
  // "all" or a single account id. Tiles take an accountIds list.
  const [activeAccount, setActiveAccount] = useState("all");

  const accountIds = activeAccount === "all" ? "all" : [activeAccount];
  const { data, isLoading } = usePortfolioData(accountIds);

  // The account list comes from the same join (unscoped tab set is fine — we
  // always want every account selectable, so derive it from the "all" portfolio).
  const allPortfolio = usePortfolioData("all");
  const allAccounts = allPortfolio.data?.accounts ?? [];
  const tabs: AccountTab[] = useMemo(
    () => [
      { id: "all", label: "All" },
      ...allAccounts.map((a) => ({ id: a.id, label: a.label })),
    ],
    [allAccounts],
  );

  // First load (no joined data yet): full-page skeleton.
  if (isLoading || !data) {
    return <PortfolioPageSkeleton />;
  }

  // No accounts at all → onboarding CTA (M15.3). Checked against the unscoped
  // portfolio so it holds regardless of the active tab.
  if (allAccounts.length === 0) {
    return (
      <EmptyState
        title="No accounts yet"
        description="Add your first account, or upload a broker statement to get started."
        primaryAction={{ label: "Add your first account", to: "/import" }}
        secondaryAction={{ label: "Upload a statement", to: "/import" }}
      />
    );
  }

  const direction = data.totalReturnEur >= 0 ? "up" : "down";

  return (
    <div className="space-y-4">
      <HeroStrip
        totalValueEur={data.totalValueEur}
        changeEur={data.totalReturnEur}
        changePct={data.totalReturnPct}
        direction={direction}
      />

      {data.costlessCount > 0 ? (
        <p className="px-1 text-xs text-muted">
          Return excludes {data.costlessCount} position
          {data.costlessCount === 1 ? "" : "s"} without cost data (e.g. Revolut).
        </p>
      ) : null}

      <AccountTabs
        tabs={tabs}
        activeId={activeAccount}
        onSelect={setActiveAccount}
      />

      {data.positions.length === 0 ? (
        <EmptyState
          title="No positions in this account"
          description="Add a position by hand, or import a statement to fill it in."
          primaryAction={{ label: "Add a position", to: "/import" }}
          secondaryAction={{ label: "Import", to: "/import" }}
        />
      ) : (
        <TileGrid>
          {PHASE_1_TILES.map(({ id, component: Tile, fullWidth }) => (
            <div
              key={id}
              className={fullWidth ? "md:col-span-2 xl:col-span-3" : undefined}
            >
              <Tile accountIds={accountIds} />
            </div>
          ))}
        </TileGrid>
      )}
    </div>
  );
}
