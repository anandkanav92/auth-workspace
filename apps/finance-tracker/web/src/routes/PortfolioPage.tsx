import { useState } from "react";

import {
  AccountTabs,
  type AccountTab,
} from "@/components/layout/AccountTabs";
import { HeroStrip } from "@/components/layout/HeroStrip";
import { TileGrid } from "@/components/layout/TileGrid";
import { Skeleton } from "@/components/ui/skeleton";
import { formatEur, formatPct } from "@/lib/format";

/**
 * Default destination (M10.4). Assembles the M9 dashboard surface: the hero
 * summary strip, the account selector, and the tile grid. Real portfolio data
 * arrives in M11 — for now the tiles render as skeletons and the hero shows
 * placeholder figures so the routed shell reads true end-to-end.
 */
const ACCOUNT_TABS: AccountTab[] = [
  { id: "all", label: "All" },
  { id: "degiro", label: "DEGIRO" },
  { id: "ibkr", label: "IBKR" },
];

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

export function PortfolioPage() {
  const [activeAccount, setActiveAccount] = useState("all");

  return (
    <div className="space-y-4">
      <HeroStrip
        totalValue={formatEur(48213.55)}
        changeAbs={`+${formatEur(1240.5)}`}
        changePct={formatPct(0.0264)}
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
  );
}
