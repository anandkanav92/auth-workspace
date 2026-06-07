import { useMemo, useState } from "react";

import {
  AccountTabs,
  type AccountTab,
} from "@/components/layout/AccountTabs";
import { HeroStrip } from "@/components/layout/HeroStrip";
import { TileGrid } from "@/components/layout/TileGrid";
import { Skeleton } from "@/components/ui/skeleton";
import { formatEur, formatPct } from "@/lib/format";
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
 */
export function PortfolioPage() {
  // "all" or a single account id. Tiles take an accountIds list.
  const [activeAccount, setActiveAccount] = useState("all");

  const accountIds = activeAccount === "all" ? "all" : [activeAccount];
  const { data, isLoading } = usePortfolioData(accountIds);

  // The account list comes from the same join (unscoped tab set is fine — we
  // always want every account selectable, so derive it from the "all" portfolio).
  const allAccounts = usePortfolioData("all").data?.accounts ?? [];
  const tabs: AccountTab[] = useMemo(
    () => [
      { id: "all", label: "All" },
      ...allAccounts.map((a) => ({ id: a.id, label: a.label })),
    ],
    [allAccounts],
  );

  const direction = (data?.totalReturnEur ?? 0) >= 0 ? "up" : "down";

  return (
    <div className="space-y-4">
      {isLoading || !data ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : (
        <HeroStrip
          totalValue={formatEur(data.totalValueEur)}
          changeAbs={`${data.totalReturnEur >= 0 ? "+" : ""}${formatEur(
            data.totalReturnEur,
          )}`}
          changePct={
            data.totalReturnPct !== null ? formatPct(data.totalReturnPct) : "—"
          }
          direction={direction}
        />
      )}

      {data && data.costlessCount > 0 ? (
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
    </div>
  );
}
