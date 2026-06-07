import { useMemo } from "react";

import { HoldingsList } from "@/components/holdings/HoldingsList";
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
      <h1 className="text-xl font-semibold tracking-tight text-fg">
        Holdings{label ? ` · ${label}` : ""}
      </h1>
      <HoldingsList accountId={id} />
    </div>
  );
}
