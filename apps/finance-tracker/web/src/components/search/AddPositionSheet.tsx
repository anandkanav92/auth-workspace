import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAccounts } from "@/lib/accounts";
import { haptic } from "@/lib/haptics";
import {
  addPositionSchema,
  useAddHolding,
  type AddPositionForm,
  type SearchResult,
} from "@/lib/search";

/**
 * M13.3 / M13.4 — "Add to..." sheet.
 *
 * Opened when the user selects a ticker in the search palette. Collects the
 * destination account, quantity, and (optional) total cost + currency,
 * validates with the shared {@link addPositionSchema} (the client mirror of the
 * server `addSchema`), then posts to `POST /api/holdings`.
 *
 * On success: a sonner toast fires, the sheet closes, and {@link useAddHolding}
 * invalidates the `["holdings"]` (+ prices/profiles) queries so the dashboard
 * tiles refetch and show the position.
 *
 * Account dropdown: lists ALL of the user's accounts including `source:"manual"`
 * (the manual-account case is just another option, not a special branch).
 */

/** Currencies a manual position can be priced in. EUR first (NL default). */
const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "SEK", "NOK", "DKK"] as const;

export interface AddPositionSheetProps {
  /** The ticker the user picked, or `null` when the sheet is closed. */
  result: SearchResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FieldErrors = Partial<Record<keyof AddPositionForm, string>>;

export function AddPositionSheet({
  result,
  open,
  onOpenChange,
}: AddPositionSheetProps) {
  const accountsQuery = useAccounts();
  const addHolding = useAddHolding();

  const [account, setAccount] = useState("");
  const [quantity, setQuantity] = useState("");
  const [cost, setCost] = useState("");
  const [currency, setCurrency] = useState<string>("EUR");
  const [errors, setErrors] = useState<FieldErrors>({});

  const accounts = useMemo(
    () => accountsQuery.data ?? [],
    [accountsQuery.data],
  );

  // Reset the form whenever a new ticker opens the sheet so stale input from a
  // previous add doesn't leak across positions. Default the account to the
  // first one available.
  useEffect(() => {
    if (open) {
      setQuantity("");
      setCost("");
      setCurrency("EUR");
      setErrors({});
      setAccount((prev) => prev || accounts[0]?.id || "");
    }
  }, [open, result, accounts]);

  if (!result) return null;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!result) return;

    const parsed = addPositionSchema.safeParse({
      account,
      ticker: result.ticker,
      // Empty string → undefined so optional fields validate as "absent" rather
      // than NaN. Quantity is required; an empty value falls through to NaN and
      // is reported by the schema.
      quantity: quantity === "" ? Number.NaN : Number(quantity),
      cost: cost === "" ? undefined : Number(cost),
      costCurrency: cost === "" ? undefined : currency,
    });

    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof AddPositionForm | undefined;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    setErrors({});
    haptic(); // M15.6: confirm-action haptic.
    addHolding.mutate(parsed.data, {
      onSuccess: () => {
        toast.success(`Added ${result.ticker} to your portfolio.`);
        onOpenChange(false);
      },
      onError: (error) => {
        const message =
          error instanceof Error ? error.message : "Could not add the position.";
        toast.error(message);
      },
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="safe-bottom rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Add {result.ticker}</SheetTitle>
          <SheetDescription>
            {result.name}
            {result.exchange ? ` · ${result.exchange}` : ""}
          </SheetDescription>
        </SheetHeader>

        <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
          <Field label="Account" htmlFor="add-account" error={errors.account}>
            <select
              id="add-account"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className={fieldClass}
              disabled={accountsQuery.isLoading}
            >
              <option value="" disabled>
                {accountsQuery.isLoading ? "Loading accounts…" : "Select an account"}
              </option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.label}
                  {acc.source === "manual" ? " (manual)" : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Quantity" htmlFor="add-quantity" error={errors.quantity}>
            <input
              id="add-quantity"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              className={fieldClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Total cost (optional)"
              htmlFor="add-cost"
              error={errors.cost}
            >
              <input
                id="add-cost"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0,00"
                className={fieldClass}
              />
            </Field>

            <Field
              label="Currency"
              htmlFor="add-currency"
              error={errors.costCurrency}
            >
              <select
                id="add-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={fieldClass}
              >
                {CURRENCIES.map((ccy) => (
                  <option key={ccy} value={ccy}>
                    {ccy}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <SheetFooter className="mt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={addHolding.isPending}>
              {addHolding.isPending ? "Adding…" : "Add position"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

const fieldClass =
  "h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}

/** Labelled form row with an inline validation message. */
function Field({ label, htmlFor, error, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-fg">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
