import { useMemo } from "react";

import { HoldingsList } from "@/components/holdings/HoldingsList";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccounts } from "@/lib/accounts";

/**
 * M14 — flat holdings list for one account (route `/account/$id/holdings`).
 *
 * The page resolves the account label for the heading and delegates the list,
 * row, sheet, and sell/edit flows to {@link HoldingsList}.
 */
export function AccountHoldingsPage({ id }: { id: string }) {
  const accountsQuery = useAccounts();
  const label = useMemo(
    () => accountsQuery.data?.find((a) => a.id === id)?.label,
    [accountsQuery.data, id],
  );

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-fg">
        Holdings
        {accountsQuery.isLoading ? (
          // M15.1: skeleton for the account label while accounts load.
          <Skeleton className="h-5 w-28" />
        ) : label ? (
          <span>· {label}</span>
        ) : null}
      </h1>
      <HoldingsList accountId={id} />
    </div>
  );
}
